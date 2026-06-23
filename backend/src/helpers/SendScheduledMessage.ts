import moment from "moment-timezone";
import Contact from "../models/Contact";
import Message from "../models/Message";
import Schedule from "../models/Schedule";
import Ticket from "../models/Ticket";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import { sendMessageWhatsAppOficial } from "../libs/whatsAppOficial/whatsAppOficial.service";
import { ISendMessageOficial } from "../libs/whatsAppOficial/IWhatsAppOficial.interfaces";
import path from "path";
import fs from "fs";
import logger from "../utils/logger";
import SafeCreateMessage from "./SafeCreateMessage";

interface SendScheduledMessageParams {
  schedule: Schedule;
  contact: Contact;
  whatsapp: Whatsapp;
  user?: User;
}

const SendScheduledMessage = async ({
  schedule,
  contact,
  whatsapp,
  user
}: SendScheduledMessageParams): Promise<void> => {
  try {
    logger.info(`📅 [SCHEDULE] Iniciando envio - ID: ${schedule.id} | Contato: ${contact.name}`);

    // Criar ou atualizar contato
    const contactData = await CreateOrUpdateContactService({
      name: contact.name,
      number: contact.number,
      email: contact.email,
      profilePicUrl: contact.profilePicUrl,
      companyId: schedule.companyId,
      channel: whatsapp.channel || "whatsapp",
      isGroup: false // Agendamentos são sempre para contatos individuais
    });

    // Buscar ou criar ticket
    const ticket = await FindOrCreateTicketService(
      contactData,
      whatsapp,
      0, // unreadMessages
      schedule.companyId,
      schedule.queueId,
      user?.id || schedule.ticketUserId || schedule.userId,
      undefined, // groupContact
      whatsapp.channel || "whatsapp", // channel
      false, // isImported
      false, // isForward
      {}, // settings
      false, // isTransfered
      false // isCampaign
    );

    logger.info(`🎫 [SCHEDULE] Ticket criado/encontrado - ID: ${ticket.id}`);

    // Preparar corpo da mensagem
    let messageBody = schedule.body;

    // Se assinar está habilitado, adicionar assinatura do usuário
    if (schedule.assinar && user) {
      messageBody = `${messageBody}\n\n_Enviado por: ${user.name}_`;
    }

    // Enviar mensagem baseado no provider
    const isOficial = whatsapp.provider === "oficial" || 
                     
                     whatsapp.channel === "whatsapp-oficial" || 
                     whatsapp.channel === "whatsapp_oficial";
    
    if (isOficial) {
      // Envio via API Oficial
      logger.info(`📱 [SCHEDULE] Enviando via API Oficial (Provider: ${whatsapp.provider}, Channel: ${whatsapp.channel})`);

      const normalizedNumber = contact.number.replace(/[^\d]/g, "");
      let payload: ISendMessageOficial;
      let mediaType = "conversation";
      let bodyTicket = messageBody;

      // ✅ Verificar se é um template
      if (schedule.isTemplate && schedule.templateMetaId) {
        logger.info(`📋 [SCHEDULE] Enviando via TEMPLATE - MetaID: ${schedule.templateMetaId}`);

        const templateName = schedule.templateName || schedule.templateMetaId;
        payload = {
          to: normalizedNumber,
          type: "template",
          body_template: {
            name: templateName,
            language: {
              code: schedule.templateLanguage || "pt_BR"
            },
            components: schedule.templateComponents || []
          }
        };
        mediaType = "template";
        bodyTicket = `📋 Template: ${templateName}`;

        logger.info(`✅ [SCHEDULE] Payload do template:`, JSON.stringify(payload, null, 2));
      } else {
        // Envio de texto livre
        payload = {
          to: normalizedNumber,
          type: "text",
          body_text: {
            body: messageBody
          }
        };
      }

      let mediaPath: string | null = null;

      // Se tem mídia anexada (apenas para mensagens de texto, não templates)
      if (!schedule.isTemplate && schedule.mediaPath && schedule.mediaName) {
        const fullMediaPath = path.resolve("public", schedule.mediaPath);
        if (fs.existsSync(fullMediaPath)) {
          logger.info(`📎 [SCHEDULE] Enviando mídia: ${schedule.mediaName}`);
          mediaPath = fullMediaPath;

          const mediaName = schedule.mediaName.toLowerCase();
          if (/\.(jpg|jpeg|png|gif|webp)$/.test(mediaName)) {
            payload = {
              to: normalizedNumber,
              type: "image",
              fileName: schedule.mediaName,
              body_image: { caption: messageBody }
            };
          } else if (/\.(mp4|mov|avi|mkv|webm)$/.test(mediaName)) {
            payload = {
              to: normalizedNumber,
              type: "video",
              fileName: schedule.mediaName,
              body_video: { caption: messageBody }
            };
          } else if (/\.(mp3|ogg|wav|m4a|aac)$/.test(mediaName)) {
            payload = {
              to: normalizedNumber,
              type: "audio",
              fileName: schedule.mediaName
            };
          } else {
            payload = {
              to: normalizedNumber,
              type: "document",
              fileName: schedule.mediaName,
              body_document: { caption: messageBody }
            };
            mediaType = "document";
            bodyTicket = "📂 Arquivo de Documento";
          }
        }
      }

      const sendMessage = await sendMessageWhatsAppOficial(
        mediaPath,
        whatsapp.token || whatsapp.send_token || whatsapp.tokenMeta,
        payload
      );

      // Pegar ID oficial retornado
      const getOfficialMessageId = (result: any): string | null => {
        if (Array.isArray(result?.idMessageWhatsApp) && result.idMessageWhatsApp[0]) {
          return result.idMessageWhatsApp[0];
        }

        if (Array.isArray(result?.messages) && result.messages[0]?.id) {
          return result.messages[0].id;
        }

        return null;
      };

      const officialMessageId = getOfficialMessageId(sendMessage);

      // Atualizar o ticket com a última mensagem
      await ticket.update({
        lastMessage: mediaType === "conversation" ? messageBody : bodyTicket,
        imported: null,
        unreadMessages: 0,
        fromMe: true
      });

      const bodyToSave = mediaType === "conversation" ? messageBody : (schedule.body || bodyTicket);

      const messageData = {
        wid: officialMessageId,
        ticketId: ticket.id,
        contactId: contactData.id,
        body: bodyToSave,
        fromMe: true,
        mediaType: mediaType,
        mediaUrl: schedule.mediaPath ? schedule.mediaName : null,
        read: true,
        quotedMsgId: null,
        ack: 1,
        channel: 'whatsapp_oficial',
        remoteJid: `${contactData.number}@s.whatsapp.net`,
        participant: null,
        dataJson: JSON.stringify(payload),
        ticketTrakingId: null,
        isPrivate: false,
        createdAt: new Date().toISOString(),
        ticketImported: ticket.imported,
        isForwarded: false,
        originalName: schedule.mediaName || null
      };

      logger.info(`[SCHEDULE OFFICIAL - SAVE] Salvando mensagem no banco - Ticket: ${ticket.id}`);

      await SafeCreateMessage({
        messageData,
        companyId: ticket.companyId,
        maxRetries: 3,
        context: `SCHEDULE_OFICIAL_${ticket.id}`
      });

    } else {
      // Envio via Baileys (WhatsApp não oficial)
      logger.info(`📱 [SCHEDULE] Enviando via Baileys`);

      if (schedule.mediaPath && schedule.mediaName) {
        // Enviar com mídia
        const mediaPath = path.resolve("public", schedule.mediaPath);
        if (fs.existsSync(mediaPath)) {
          logger.info(`📎 [SCHEDULE] Enviando mídia: ${schedule.mediaName}`);
          await SendWhatsAppMedia({
            media: {
              filename: schedule.mediaName,
              path: mediaPath
            } as any,
            ticket,
            body: messageBody
          });
        } else {
          logger.warn(`⚠️ [SCHEDULE] Arquivo de mídia não encontrado: ${mediaPath}`);
          // Enviar apenas texto se mídia não existir
          await SendWhatsAppMessage({
            body: messageBody,
            ticket
          });
        }
      } else {
        // Enviar apenas texto
        await SendWhatsAppMessage({
          body: messageBody,
          ticket
        });
      }
    }

    // Atualizar status do ticket baseado na configuração
    if (schedule.openTicket === "disabled" || schedule.statusTicket === "closed") {
      await ticket.update({
        status: "closed",
        closedAt: new Date()
      });
      logger.info(`🔒 [SCHEDULE] Ticket fechado automaticamente`);
    } else if (schedule.statusTicket === "open") {
      await ticket.update({
        status: "open"
      });
      logger.info(`🔓 [SCHEDULE] Ticket mantido/aberto`);
    }

    logger.info(`✅ [SCHEDULE] Mensagem enviada com sucesso - Schedule ID: ${schedule.id}`);

  } catch (error: any) {
    logger.error(`❌ [SCHEDULE] Erro ao enviar mensagem - Schedule ID: ${schedule.id}`);
    logger.error(`❌ [SCHEDULE] Erro detalhado:`, error);
    logger.error(`❌ [SCHEDULE] Stack trace:`, error.stack);
    logger.error(`❌ [SCHEDULE] Message:`, error.message);
    
    // Log dos dados do schedule para debug
    logger.error(`❌ [SCHEDULE] Dados do schedule:`, {
      id: schedule.id,
      contactId: schedule.contactId,
      whatsappId: schedule.whatsappId,
      isTemplate: schedule.isTemplate,
      templateMetaId: schedule.templateMetaId,
      provider: whatsapp.provider,
      channel: whatsapp.channel
    });
    
    throw error;
  }
};

export default SendScheduledMessage;
