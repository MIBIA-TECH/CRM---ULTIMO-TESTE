import { Op } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";

interface Request {
  contactId: number;
  companyId: number;
  searchParam: string;
  pageNumber?: string;
}

interface Response {
  messages: Message[];
  count: number;
  hasMore: boolean;
}

const SearchContactMessagesService = async ({
  contactId,
  companyId,
  searchParam,
  pageNumber = "1"
}: Request): Promise<Response> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  // Buscar todos os contatos com número correspondente (conciliação 9º dígito BR)
  const currentContact = await Contact.findByPk(contactId);
  if (!currentContact) {
    return { messages: [], count: 0, hasMore: false };
  }

  const numbersToSearch = [currentContact.number];
  if (!currentContact.isGroup && currentContact.number.startsWith("55")) {
    if (currentContact.number.length === 13 && currentContact.number[4] === "9") {
      numbersToSearch.push(currentContact.number.slice(0, 4) + currentContact.number.slice(5));
    } else if (currentContact.number.length === 12) {
      numbersToSearch.push(currentContact.number.slice(0, 4) + "9" + currentContact.number.slice(4));
    }
  }

  const contacts = await Contact.findAll({
    where: { number: { [Op.in]: numbersToSearch }, companyId },
    attributes: ["id"]
  });
  const contactIds = contacts.map(c => c.id);

  // Buscar todos os tickets desses contatos
  const tickets = await Ticket.findAll({
    where: {
      contactId: { [Op.in]: contactIds },
      companyId
    },
    attributes: ["id"]
  });

  const ticketIds = tickets.map(ticket => ticket.id);

  if (ticketIds.length === 0) {
    return {
      messages: [],
      count: 0,
      hasMore: false
    };
  }

  const whereCondition = {
    ticketId: {
      [Op.in]: ticketIds
    },
    body: {
      [Op.iLike]: `%${searchParam}%`
    },
    isDeleted: false
  };

  const { count, rows: messages } = await Message.findAndCountAll({
    where: whereCondition,
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name"]
      },
      {
        model: Ticket,
        as: "ticket",
        attributes: ["id", "uuid"]
      }
    ],
    attributes: [
      "id",
      "wid",
      "body",
      "fromMe",
      "mediaType",
      "mediaUrl",
      "createdAt",
      "ticketId"
    ],
    limit,
    offset,
    order: [["createdAt", "DESC"]]
  });

  const hasMore = count > offset + messages.length;

  return {
    messages,
    count,
    hasMore
  };
};

export default SearchContactMessagesService;