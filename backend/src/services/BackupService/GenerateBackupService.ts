import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import Message from "../../models/Message";
import ChatMessage from "../../models/ChatMessage";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Chat from "../../models/Chat";
import logger from "../../utils/logger";

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

interface GenerateBackupRequest {
  companyId: number;
  dateFrom?: string;
  dateTo?: string;
}

interface BackupFile {
  filename: string;
  type: "whatsapp" | "chat";
  path: string;
}

const escapeCSV = (value: string | number | boolean | null | undefined): string => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const generateWhatsAppCSV = async (
  companyId: number,
  dateFrom: Date,
  dateTo: Date,
  outputPath: string
): Promise<void> => {
  const messages = await Message.findAll({
    where: {
      companyId,
      createdAt: {
        [Op.gte]: dateFrom,
        [Op.lte]: dateTo,
      },
    },
    include: [
      {
        model: Ticket,
        as: "ticket",
        attributes: ["id", "status", "contactId", "whatsappId", "userId", "queueId"],
        include: [
          { model: Contact, as: "contact", attributes: ["id", "name", "number"] },
          { model: User, as: "user", attributes: ["id", "name"] },
          { model: Queue, as: "queue", attributes: ["id", "name"] },
        ],
      },
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number"],
      },
    ],
    order: [["createdAt", "ASC"]],
    raw: false,
  });

  const header = [
    "ID",
    "Ticket_ID",
    "Data",
    "Remetente",
    "Atendente",
    "Fila",
    "Contato_Nome",
    "Contato_Numero",
    "Direcao",
    "Tipo_Midia",
    "Mensagem",
    "Deletada",
    "Editada",
    "Privada",
  ].join(",");

  const rows = messages.map((msg: any) => {
    const contactName = msg.contact?.name || msg.ticket?.contact?.name || "";
    const contactNumber = msg.contact?.number || msg.ticket?.contact?.number || "";
    const attendantName = msg.fromMe ? (msg.ticket?.user?.name || "Bot") : "";
    const queueName = msg.ticket?.queue?.name || "";

    return [
      escapeCSV(msg.id),
      escapeCSV(msg.ticketId),
      escapeCSV(msg.createdAt ? new Date(msg.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : ""),
      escapeCSV(msg.fromMe ? attendantName : contactName),
      escapeCSV(attendantName),
      escapeCSV(queueName),
      escapeCSV(contactName),
      escapeCSV(contactNumber),
      escapeCSV(msg.fromMe ? "Enviada" : "Recebida"),
      escapeCSV(msg.mediaType || "texto"),
      escapeCSV(msg.body),
      escapeCSV(msg.isDeleted ? "Sim" : "Nao"),
      escapeCSV(msg.isEdited ? "Sim" : "Nao"),
      escapeCSV(msg.isPrivate ? "Sim" : "Nao"),
    ].join(",");
  });

  const csvContent = [header, ...rows].join("\n");
  fs.writeFileSync(outputPath, "\uFEFF" + csvContent, "utf-8");
};

const generateChatCSV = async (
  companyId: number,
  dateFrom: Date,
  dateTo: Date,
  outputPath: string
): Promise<void> => {
  const messages = await ChatMessage.findAll({
    where: {
      companyId,
      createdAt: {
        [Op.gte]: dateFrom,
        [Op.lte]: dateTo,
      },
    },
    include: [
      { model: User, as: "sender", attributes: ["id", "name"] },
      { model: Chat, as: "chat", attributes: ["id", "title", "isGroup"] },
    ],
    order: [["createdAt", "ASC"]],
    raw: false,
  });

  const header = [
    "ID",
    "Data",
    "Remetente",
    "Chat_Titulo",
    "Grupo",
    "Tipo_Midia",
    "Mensagem",
    "Deletada",
    "Editada",
  ].join(",");

  const rows = messages.map((msg: any) => {
    return [
      escapeCSV(msg.id),
      escapeCSV(msg.createdAt ? new Date(msg.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : ""),
      escapeCSV(msg.sender?.name || ""),
      escapeCSV(msg.chat?.title || "Chat Privado"),
      escapeCSV(msg.chat?.isGroup ? "Sim" : "Nao"),
      escapeCSV(msg.mediaType || "texto"),
      escapeCSV(msg.message),
      escapeCSV(msg.isDeleted ? "Sim" : "Nao"),
      escapeCSV(msg.isEdited ? "Sim" : "Nao"),
    ].join(",");
  });

  const csvContent = [header, ...rows].join("\n");
  fs.writeFileSync(outputPath, "\uFEFF" + csvContent, "utf-8");
};

const GenerateBackupService = async ({
  companyId,
  dateFrom,
  dateTo,
}: GenerateBackupRequest): Promise<BackupFile[]> => {
  const backupDir = path.resolve(publicFolder, `company${companyId}`, "backups");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timestamp = now.getTime();

  const fromDate = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const toDate = dateTo ? new Date(new Date(dateTo).setHours(23, 59, 59, 999)) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);

  const files: BackupFile[] = [];

  // Generate WhatsApp backup
  const whatsappFilename = `whatsapp_${dateStr}_${timestamp}.csv`;
  const whatsappPath = path.resolve(backupDir, whatsappFilename);

  await generateWhatsAppCSV(companyId, fromDate, toDate, whatsappPath);
  files.push({ filename: whatsappFilename, type: "whatsapp", path: whatsappPath });

  // Generate Chat backup
  const chatFilename = `chat_${dateStr}_${timestamp}.csv`;
  const chatPath = path.resolve(backupDir, chatFilename);

  await generateChatCSV(companyId, fromDate, toDate, chatPath);
  files.push({ filename: chatFilename, type: "chat", path: chatPath });

  logger.info(`Backup generated for company ${companyId}: ${whatsappFilename}, ${chatFilename}`);

  return files;
};

export default GenerateBackupService;
