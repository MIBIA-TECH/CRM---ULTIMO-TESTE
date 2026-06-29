import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import CreateMessageService from "../MessageServices/CreateMessageService";

interface Request {
  body: string;
  visitorUuid: string;
  companyId: number;
}

const ReceiveWebChatMessageService = async ({
  body,
  visitorUuid,
  companyId
}: Request): Promise<Message> => {
  // 1. Buscar ou criar a conexão Whatsapp fictícia para o WebChat
  let whatsapp = await Whatsapp.findOne({
    where: {
      companyId,
      channel: "webchat"
    }
  });

  if (!whatsapp) {
    whatsapp = await Whatsapp.create({
      name: "WebChat",
      session: "webchat",
      qrcode: "",
      status: "CONNECTED",
      provider: "webchat",
      channel: "webchat",
      companyId,
      number: "webchat"
    });
  }

  // 2. Buscar ou criar o contato temporário (Visitante Web)
  let contact = await Contact.findOne({
    where: {
      companyId,
      number: visitorUuid
    }
  });

  if (!contact) {
    contact = await Contact.create({
      name: `Visitante Web ${visitorUuid.substring(0, 4)}`,
      number: visitorUuid,
      channel: "webchat",
      companyId
    });
  }

  // 3. Buscar ou criar o Ticket ativo
  const ticket = await FindOrCreateTicketService(
    contact,
    whatsapp,
    1, // unreadMessages
    companyId,
    null, // queueId
    null, // userId
    null, // groupContact
    "webchat" // channel!
  );

  // 4. Salvar a mensagem no banco
  const messageData = {
    wid: `WBC_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ticketId: ticket.id,
    contactId: contact.id,
    body: body,
    fromMe: false, // veio do visitante
    mediaType: "extendedTextMessage",
    read: false,
    quotedMsgId: null,
    ack: 0,
    remoteJid: contact.remoteJid || "",
    participant: null,
    dataJson: null,
    ticketTrakingId: null,
    isPrivate: false
  };

  const message = await CreateMessageService({
    messageData,
    companyId
  });

  return message;
};

export default ReceiveWebChatMessageService;
