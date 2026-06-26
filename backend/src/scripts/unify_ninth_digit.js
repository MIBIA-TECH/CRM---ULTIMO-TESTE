const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '5432',
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
};

async function run() {
  const companyId = process.argv[2] ? parseInt(process.argv[2], 10) : null;
  console.log(`Iniciando unificação de contatos duplicados pelo 9º dígito...`);
  if (companyId) {
    console.log(`Filtrando por Empresa ID: ${companyId}`);
  }

  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Buscar todos os contatos do Brasil (começam com 55 e não são grupos)
    let query = `SELECT id, name, number, "companyId", channel, lid, "remoteJid", "createdAt" FROM "Contacts" WHERE number LIKE '55%' AND "isGroup" = false`;
    const params = [];
    if (companyId) {
      query += ` AND "companyId" = $1`;
      params.push(companyId);
    }
    query += ` ORDER BY number ASC, "createdAt" ASC`;

    const res = await client.query(query, params);
    const contacts = res.rows;
    console.log(`Total de contatos brasileiros recuperados: ${contacts.length}`);

    // Função para obter número normalizado (sem o 9º dígito se tiver 13 caracteres e 9 na posição correta)
    function getNormalizedNumber(num) {
      if (num.startsWith('55') && num.length === 13 && num[4] === '9') {
        return num.slice(0, 4) + num.slice(5);
      }
      return num;
    }

    // Agrupar contatos pelo número normalizado
    const grouped = new Map();
    contacts.forEach(contact => {
      const normalized = getNormalizedNumber(contact.number);
      if (!grouped.has(normalized)) {
        grouped.set(normalized, []);
      }
      grouped.get(normalized).push(contact);
    });

    let groupsUnified = 0;
    let deletedCount = 0;

    for (const [normalizedNumber, list] of grouped) {
      if (list.length > 1) {
        console.log(`\n--- Unificando grupo para número normalizado: ${normalizedNumber} (${list.length} contatos) ---`);

        // Obter estatísticas para decidir o contato principal
        const stats = [];
        for (const contact of list) {
          const msgRes = await client.query(`SELECT COUNT(*) FROM "Messages" WHERE "contactId" = $1`, [contact.id]);
          const ticketRes = await client.query(`SELECT COUNT(*) FROM "Tickets" WHERE "contactId" = $1`, [contact.id]);
          
          stats.push({
            contact,
            messageCount: parseInt(msgRes.rows[0].count, 10),
            ticketCount: parseInt(ticketRes.rows[0].count, 10),
            hasLid: !!contact.lid || (contact.remoteJid && contact.remoteJid.includes('@lid')),
          });
        }

        // Ordenar:
        // 1. Mais mensagens
        // 2. Mais tickets
        // 3. Tem LID
        // 4. Criado primeiro
        stats.sort((a, b) => {
          if (b.messageCount !== a.messageCount) return b.messageCount - a.messageCount;
          if (b.ticketCount !== a.ticketCount) return b.ticketCount - a.ticketCount;
          if (a.hasLid !== b.hasLid) return a.hasLid ? -1 : 1;
          return new Date(a.contact.createdAt) - new Date(b.contact.createdAt);
        });

        const mainContact = stats[0].contact;
        const duplicateContacts = list.filter(c => c.id !== mainContact.id);

        console.log(`Contato principal definido: ID=${mainContact.id}, Nome="${mainContact.name}", Número=${mainContact.number}, Canal=${mainContact.channel}`);

        // Iniciar transação para este grupo
        await client.query('BEGIN');

        try {
          // Renomear temporariamente os números dos contatos duplicados para evitar conflito de chave única ao atualizar o principal
          for (const dup of duplicateContacts) {
            await client.query(`UPDATE "Contacts" SET number = number || '_dup_' || id WHERE id = $1`, [dup.id]);
          }

          // Se o contato principal tem número de 12 dígitos, mas um duplicado tem 13 dígitos, atualizar o principal para 13 dígitos
          const has13Digit = duplicateContacts.find(c => c.number.length === 13);
          if (mainContact.number.length === 12 && has13Digit) {
            const oldNum = mainContact.number;
            mainContact.number = has13Digit.number;
            let newRemoteJid = mainContact.remoteJid;
            if (mainContact.remoteJid && !mainContact.remoteJid.includes('@lid')) {
              newRemoteJid = `${has13Digit.number}@s.whatsapp.net`;
            }
            await client.query(`UPDATE "Contacts" SET number = $1, "remoteJid" = $2 WHERE id = $3`, [has13Digit.number, newRemoteJid, mainContact.id]);
            console.log(`Atualizado número do contato principal de ${oldNum} para ${mainContact.number}`);
          }

          for (const duplicateContact of duplicateContacts) {
            console.log(`Mesclando contato duplicado: ID=${duplicateContact.id}, Nome="${duplicateContact.name}", Número=${duplicateContact.number}`);

            // 1. Atualizar campos nulos/vazios no contato principal a partir do duplicado
            const updates = [];
            const values = [];
            let valIdx = 1;

            if ((!mainContact.name || mainContact.name === mainContact.number) && duplicateContact.name && duplicateContact.name !== duplicateContact.number) {
              updates.push(`name = $${valIdx++}`);
              values.push(duplicateContact.name);
            }
            if (!mainContact.email && duplicateContact.email) {
              updates.push(`email = $${valIdx++}`);
              values.push(duplicateContact.email);
            }
            if (!mainContact.empresa && duplicateContact.empresa) {
              updates.push(`empresa = $${valIdx++}`);
              values.push(duplicateContact.empresa);
            }
            if (!mainContact.cpf && duplicateContact.cpf) {
              updates.push(`cpf = $${valIdx++}`);
              values.push(duplicateContact.cpf);
            }
            if (!mainContact.whatsappId && duplicateContact.whatsappId) {
              updates.push(`"whatsappId" = $${valIdx++}`);
              values.push(duplicateContact.whatsappId);
            }
            if ((!mainContact.channel || mainContact.channel === 'whatsapp') && duplicateContact.channel && duplicateContact.channel !== 'whatsapp') {
              updates.push(`channel = $${valIdx++}`);
              values.push(duplicateContact.channel);
            }
            if (!mainContact.lid && duplicateContact.lid) {
              updates.push(`lid = $${valIdx++}`);
              values.push(duplicateContact.lid);
            }

            if (updates.length > 0) {
              values.push(mainContact.id);
              await client.query(`UPDATE "Contacts" SET ${updates.join(', ')} WHERE id = $${valIdx}`, values);
              console.log(`Dados do contato principal atualizados com campos do duplicado.`);
            }

            // 2. Transferir tabelas simples (UPDATE direto)
            const simpleTables = [
              'Tickets',
              'Messages',
              'TicketNotes',
              'DialogChatBots',
              'Schedules',
              'CampaignShipping',
              'FailedMessages'
            ];

            for (const table of simpleTables) {
              const resUpdate = await client.query(`UPDATE "${table}" SET "contactId" = $1 WHERE "contactId" = $2`, [mainContact.id, duplicateContact.id]);
              if (parseInt(resUpdate.rowCount, 10) > 0) {
                console.log(`Transferidos ${resUpdate.rowCount} registros na tabela "${table}".`);
              }
            }

            // 3. Mesclar tabelas com restrições de chave única
            // WhatsappLidMaps
            await client.query(`
              DELETE FROM "WhatsappLidMaps" w1
              WHERE w1."contactId" = $1
                AND EXISTS (
                  SELECT 1 FROM "WhatsappLidMaps" w2
                  WHERE w2."contactId" = $2
                    AND w2.lid = w1.lid
                )
            `, [duplicateContact.id, mainContact.id]);
            await client.query(`UPDATE "WhatsappLidMaps" SET "contactId" = $1 WHERE "contactId" = $2`, [mainContact.id, duplicateContact.id]);

            // ContactTags
            await client.query(`
              DELETE FROM "ContactTags" ct1
              WHERE ct1."contactId" = $1
                AND EXISTS (
                  SELECT 1 FROM "ContactTags" ct2
                  WHERE ct2."contactId" = $2
                    AND ct2."tagId" = ct1."tagId"
                )
            `, [duplicateContact.id, mainContact.id]);
            await client.query(`UPDATE "ContactTags" SET "contactId" = $1 WHERE "contactId" = $2`, [mainContact.id, duplicateContact.id]);

            // ContactWallets
            await client.query(`
              DELETE FROM "ContactWallets" cw1
              WHERE cw1."contactId" = $1
                AND EXISTS (
                  SELECT 1 FROM "ContactWallets" cw2
                  WHERE cw2."contactId" = $2
                    AND cw2."walletId" = cw1."walletId"
                    AND cw2."companyId" = cw1."companyId"
                )
            `, [duplicateContact.id, mainContact.id]);
            await client.query(`UPDATE "ContactWallets" SET "contactId" = $1 WHERE "contactId" = $2`, [mainContact.id, duplicateContact.id]);

            // ContactCustomFields
            await client.query(`
              DELETE FROM "ContactCustomFields" ccf1
              WHERE ccf1."contactId" = $1
                AND EXISTS (
                  SELECT 1 FROM "ContactCustomFields" ccf2
                  WHERE ccf2."contactId" = $2
                    AND ccf2.name = ccf1.name
                )
            `, [duplicateContact.id, mainContact.id]);
            await client.query(`UPDATE "ContactCustomFields" SET "contactId" = $1 WHERE "contactId" = $2`, [mainContact.id, duplicateContact.id]);

            // 4. Excluir o contato duplicado
            await client.query(`DELETE FROM "Contacts" WHERE id = $1`, [duplicateContact.id]);
            deletedCount++;
            console.log(`Contato duplicado ID=${duplicateContact.id} excluído com sucesso.`);
          }

          await client.query('COMMIT');
          groupsUnified++;
          console.log(`Unificação do grupo concluída com sucesso!`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`Erro ao mesclar grupo. Transação revertida.`, err);
        }
      }
    }

    console.log(`\nUnificação finalizada! ${groupsUnified} grupos unificados, ${deletedCount} contatos duplicados removidos.`);

  } catch (error) {
    console.error('Erro na execução do script:', error);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
