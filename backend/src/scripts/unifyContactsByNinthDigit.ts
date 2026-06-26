import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Message from "../models/Message";
import ContactTag from "../models/ContactTag";
import ContactWallet from "../models/ContactWallet";
import ContactCustomField from "../models/ContactCustomField";
import WhatsappLidMap from "../models/WhatsapplidMap";
import TicketNote from "../models/TicketNote";
import DialogChatBots from "../models/DialogChatBots";
import Schedule from "../models/Schedule";
import CampaignShipping from "../models/CampaignShipping";
import FailedMessage from "../models/FailedMessage";
import logger from "../utils/logger";
import { Op } from "sequelize";
import sequelize from "../database";

// Função para normalizar número brasileiro (remove o 9 se for celular de 13 dígitos)
const getNormalizedNumber = (num: string): string => {
  if (num.startsWith("55") && num.length === 13 && num[4] === "9") {
    return num.slice(0, 4) + num.slice(5);
  }
  return num;
};

const unifyContactsByNinthDigit = async (companyId?: number) => {
  const transaction = await sequelize.transaction();
  try {
    logger.info("Iniciando unificação de contatos duplicados pelo 9º dígito...");

    const whereCondition = companyId ? { companyId } : {};

    // Buscar todos os contatos do Brasil (começam com 55 e não são grupos)
    const contacts = await Contact.findAll({
      where: {
        ...whereCondition,
        number: { [Op.like]: "55%" },
        isGroup: false
      },
      transaction
    });

    logger.info(`Total de contatos brasileiros encontrados: ${contacts.length}`);

    // Agrupar contatos pelo número normalizado
    const groupedContacts = new Map<string, Contact[]>();
    contacts.forEach(contact => {
      const normalized = getNormalizedNumber(contact.number);
      if (!groupedContacts.has(normalized)) {
        groupedContacts.set(normalized, []);
      }
      groupedContacts.get(normalized)!.push(contact);
    });

    let groupsUnified = 0;
    let deletedCount = 0;

    for (const [normalizedNumber, contactList] of groupedContacts) {
      if (contactList.length > 1) {
        logger.info(`--- Unificando grupo para número normalizado: ${normalizedNumber} (${contactList.length} contatos) ---`);

        // Determinar o contato principal com base em mensagens e data de criação
        const contactStats = await Promise.all(
          contactList.map(async contact => {
            const messageCount = await Message.count({
              where: { contactId: contact.id, companyId: contact.companyId },
              transaction
            });
            const ticketCount = await Ticket.count({
              where: { contactId: contact.id, companyId: contact.companyId },
              transaction
            });
            return {
              contact,
              messageCount,
              ticketCount,
              hasLid: !!contact.lid || !!contact.remoteJid?.includes("@lid")
            };
          })
        );

        // Ordenar: 1. Mais mensagens, 2. Mais tickets, 3. Tem LID, 4. Criado primeiro
        contactStats.sort((a, b) => {
          if (b.messageCount !== a.messageCount) return b.messageCount - a.messageCount;
          if (b.ticketCount !== a.ticketCount) return b.ticketCount - a.ticketCount;
          if (a.hasLid !== b.hasLid) return a.hasLid ? -1 : 1;
          return a.contact.createdAt.getTime() - b.contact.createdAt.getTime();
        });

        const mainContact = contactStats[0].contact;
        const duplicateContacts = contactList.filter(c => c.id !== mainContact.id);

        logger.info(`Contato principal definido: ID=${mainContact.id}, Nome="${mainContact.name}", Número=${mainContact.number}, Canal=${mainContact.channel}`);

        // Preferir o número completo de 13 dígitos para o contato principal
        const has13DigitNumber = duplicateContacts.find(c => c.number.length === 13);
        if (mainContact.number.length === 12 && has13DigitNumber) {
          const oldNum = mainContact.number;
          mainContact.number = has13DigitNumber.number;
          if (mainContact.remoteJid && !mainContact.remoteJid.includes("@lid")) {
            mainContact.remoteJid = `${has13DigitNumber.number}@s.whatsapp.net`;
          }
          await mainContact.save({ transaction });
          logger.info(`Atualizado número do contato principal de ${oldNum} para ${mainContact.number}`);
        }

        for (const duplicateContact of duplicateContacts) {
          logger.info(`Mesclando contato duplicado: ID=${duplicateContact.id}, Nome="${duplicateContact.name}", Número=${duplicateContact.number}`);

          // 1. Atualizar campos vazios no principal
          const updateData: any = {};
          if (!mainContact.name || mainContact.name === mainContact.number) {
            if (duplicateContact.name && duplicateContact.name !== duplicateContact.number) {
              updateData.name = duplicateContact.name;
            }
          }
          if (!mainContact.email && duplicateContact.email) updateData.email = duplicateContact.email;
          if (!mainContact.empresa && duplicateContact.empresa) updateData.empresa = duplicateContact.empresa;
          if (!mainContact.cpf && duplicateContact.cpf) updateData.cpf = duplicateContact.cpf;
          if (!mainContact.whatsappId && duplicateContact.whatsappId) updateData.whatsappId = duplicateContact.whatsappId;
          if ((!mainContact.channel || mainContact.channel === "whatsapp") && duplicateContact.channel && duplicateContact.channel !== "whatsapp") {
            updateData.channel = duplicateContact.channel;
          }
          if (!mainContact.lid && duplicateContact.lid) updateData.lid = duplicateContact.lid;

          if (Object.keys(updateData).length > 0) {
            await mainContact.update(updateData, { transaction });
            logger.info(`Atualizados dados do contato principal: ${JSON.stringify(updateData)}`);
          }

          // 2. Transferir Tickets
          await Ticket.update(
            { contactId: mainContact.id },
            { where: { contactId: duplicateContact.id }, transaction }
          );

          // 3. Transferir Mensagens
          await Message.update(
            { contactId: mainContact.id },
            { where: { contactId: duplicateContact.id }, transaction }
          );

          // 4. Transferir Notas de Ticket
          await TicketNote.update(
            { contactId: mainContact.id },
            { where: { contactId: duplicateContact.id }, transaction }
          );

          // 5. Transferir DialogChatBots
          await DialogChatBots.update(
            { contactId: mainContact.id },
            { where: { contactId: duplicateContact.id }, transaction }
          );

          // 6. Transferir Schedules
          await Schedule.update(
            { contactId: mainContact.id },
            { where: { contactId: duplicateContact.id }, transaction }
          );

          // 7. Transferir CampaignShipping
          await CampaignShipping.update(
            { contactId: mainContact.id },
            { where: { contactId: duplicateContact.id }, transaction }
          );

          // 8. Transferir FailedMessages
          await FailedMessage.update(
            { contactId: mainContact.id },
            { where: { contactId: duplicateContact.id }, transaction }
          );

          // 9. Mesclar WhatsappLidMaps (evitar duplicado)
          const lidMaps = await WhatsappLidMap.findAll({
            where: { contactId: duplicateContact.id },
            transaction
          });
          for (const map of lidMaps) {
            const exists = await WhatsappLidMap.findOne({
              where: { contactId: mainContact.id, lid: map.lid },
              transaction
            });
            if (exists) {
              await map.destroy({ transaction });
            } else {
              await map.update({ contactId: mainContact.id }, { transaction });
            }
          }

          // 10. Mesclar ContactTags (evitar duplicado)
          const tags = await ContactTag.findAll({
            where: { contactId: duplicateContact.id },
            transaction
          });
          for (const tag of tags) {
            const exists = await ContactTag.findOne({
              where: { contactId: mainContact.id, tagId: tag.tagId },
              transaction
            });
            if (exists) {
              await tag.destroy({ transaction });
            } else {
              await tag.update({ contactId: mainContact.id }, { transaction });
            }
          }

          // 11. Mesclar ContactWallets (evitar duplicado)
          const wallets = await ContactWallet.findAll({
            where: { contactId: duplicateContact.id },
            transaction
          });
          for (const wallet of wallets) {
            const exists = await ContactWallet.findOne({
              where: { contactId: mainContact.id, walletId: wallet.walletId, companyId: wallet.companyId },
              transaction
            });
            if (exists) {
              await wallet.destroy({ transaction });
            } else {
              await wallet.update({ contactId: mainContact.id }, { transaction });
            }
          }

          // 12. Mesclar ContactCustomFields (evitar duplicado)
          const customFields = await ContactCustomField.findAll({
            where: { contactId: duplicateContact.id },
            transaction
          });
          for (const field of customFields) {
            const exists = await ContactCustomField.findOne({
              where: { contactId: mainContact.id, name: field.name },
              transaction
            });
            if (exists) {
              await field.destroy({ transaction });
            } else {
              await field.update({ contactId: mainContact.id }, { transaction });
            }
          }

          // 13. Excluir o contato duplicado
          await duplicateContact.destroy({ transaction });
          deletedCount++;
        }

        groupsUnified++;
      }
    }

    await transaction.commit();
    logger.info(`Unificação concluída com sucesso! ${groupsUnified} grupos de contatos unificados, ${deletedCount} contatos duplicados removidos.`);
  } catch (error) {
    await transaction.rollback();
    logger.error("Erro durante a unificação de contatos pelo 9º dígito:", error);
    throw error;
  }
};

if (require.main === module) {
  const companyId = process.argv[2] ? parseInt(process.argv[2]) : undefined;

  unifyContactsByNinthDigit(companyId)
    .then(() => {
      logger.info("Script de unificação pelo 9º dígito executado com sucesso!");
      process.exit(0);
    })
    .catch(error => {
      logger.error("Erro ao executar script de unificação pelo 9º dígito:", error);
      process.exit(1);
    });
}

export default unifyContactsByNinthDigit;
