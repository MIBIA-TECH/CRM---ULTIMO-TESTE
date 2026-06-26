import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { Op } from "sequelize";
import { intersection } from "lodash";
import User from "../../models/User";
import isQueueIdHistoryBlocked from "../UserServices/isQueueIdHistoryBlocked";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  ticketId: string;
  companyId: number;
  pageNumber?: string;
  queues?: number[];
  user?: User;
}

interface Response {
  messages: Message[];
  ticket: Ticket;
  count: number;
  hasMore: boolean;
}

const ListMessagesService = async ({
  pageNumber = "1",
  ticketId,
  companyId,
  queues = [],
  user
}: Request): Promise<Response> => {

  if (!isNaN(Number(ticketId))) {
    const uuid = await Ticket.findOne({
      where: {
        id: ticketId,
        companyId
      },
      attributes: ["uuid"]
    });
    ticketId = uuid.uuid;
  }
  const ticket = await Ticket.findOne({
    where: {
      uuid: ticketId,
      companyId
    }
  });

  const ticketsFilter: any[] | null = [];

  const isAllHistoricEnabled = await isQueueIdHistoryBlocked({ userRequest: user.id });

  // Buscar todos os contatos com número correspondente (conciliação 9º dígito BR)
  const currentContact = await Contact.findByPk(ticket.contactId);
  const numbersToSearch = [currentContact.number];

  if (!ticket.isGroup && currentContact.number.startsWith("55")) {
    if (currentContact.number.length === 13 && currentContact.number[4] === "9") {
      numbersToSearch.push(currentContact.number.slice(0, 4) + currentContact.number.slice(5));
    } else if (currentContact.number.length === 12) {
      numbersToSearch.push(currentContact.number.slice(0, 4) + "9" + currentContact.number.slice(4));
    }
  }

  const contacts = await Contact.findAll({
    where: { number: { [Op.in]: numbersToSearch }, companyId: ticket.companyId },
    attributes: ["id"]
  });
  const contactIds = contacts.map(c => c.id);

  let ticketIds = [];
  if (!isAllHistoricEnabled) {
    ticketIds = await Ticket.findAll({
      where:
      {
        companyId: ticket.companyId,
        contactId: { [Op.in]: contactIds },
        whatsappId: ticket.whatsappId,
        isGroup: ticket.isGroup,
        queueId: user.profile === "admin" || user.allTicket === "enable" || (ticket.isGroup && user.allowGroup) ?
          {
            [Op.or]: [queues, null]
          } :
          { [Op.in]: queues },
      },
      attributes: ["id"]
    });
  } else {
    ticketIds = await Ticket.findAll({
      where:
      {
        companyId: ticket.companyId,
        contactId: { [Op.in]: contactIds },
        whatsappId: ticket.whatsappId,
        isGroup: ticket.isGroup
      },
      attributes: ["id"]
    });
  }

  if (ticketIds) {
    ticketsFilter.push(ticketIds.map(t => t.id));
  }
  // }

  const tickets: number[] = intersection(...ticketsFilter);

  if (!tickets) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // await setMessagesAsRead(ticket);
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: messages } = await Message.findAndCountAll({
    where: { ticketId: tickets, companyId },
    attributes: ["id", "wid", "fromMe", "mediaUrl", "body", "mediaType", "ack", "createdAt", "ticketId", "isDeleted", "queueId", "isForwarded", "isEdited", "isPrivate", "companyId", "deliveryError", "deliveryErrorCode"],
    limit,
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name"],
      },
      {
        model: Message,
        attributes: ["id", "wid", "fromMe", "mediaUrl", "body", "mediaType", "companyId"],
        as: "quotedMsg",
        include: [
          {
            model: Contact,
            as: "contact",
            attributes: ["id", "name"],
          }
        ],
        required: false
      },
      {
        model: Ticket,
        required: true,
        attributes: ["id", "whatsappId", "queueId"],
        include: [
          {
            model: Queue,
            as: "queue",
            attributes: ["id", "name", "color"]
          }
        ],
      }
    ],
    distinct: true,
    offset,
    subQuery: false,
    order: [["createdAt", "DESC"]]
  });

  const hasMore = count > offset + messages.length;

  return {
    messages: messages.reverse(),
    ticket,
    count,
    hasMore
  };
};

export default ListMessagesService;