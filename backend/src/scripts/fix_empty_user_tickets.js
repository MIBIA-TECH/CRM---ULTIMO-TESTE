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
  console.log(`Iniciando a correção de tickets com status 'open' e userId nulo...`);

  const client = new Client(dbConfig);
  await client.connect();

  try {
    await client.query('BEGIN');

    const res = await client.query(`
      UPDATE "Tickets"
      SET status = 'pending'
      WHERE status = 'open' AND "userId" IS NULL
    `);

    console.log(`Sucesso: ${res.rowCount} tickets atualizados de 'open' para 'pending'.`);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar tickets:', error);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
