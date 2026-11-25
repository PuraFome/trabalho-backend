require('dotenv').config({ quiet: true });

const mysql = require('mysql2/promise');

const requiredVars = ['DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
for (const v of requiredVars) {
  if (!process.env[v]) {
    throw new Error(`Variável de ambiente ausente: ${v}`);
  }
}

// Bancos gerenciados (ex.: filess.io) impõem um teto de conexões por usuário
// (max_user_connections). O pool nunca deve excedê-lo, ou as conexões excedentes
// são rejeitadas com ER_USER_LIMIT_REACHED. Padrão 4 = 1 de folga sobre o teto 5.
const connectionLimit = Number(process.env.DB_CONNECTION_LIMIT || 4);

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit,
  maxIdle: Number(process.env.DB_MAX_IDLE || 2),
  idleTimeout: Number(process.env.DB_IDLE_TIMEOUT || 30000),
  queueLimit: 0,
  charset: 'utf8mb4',
  dateStrings: true,
  timezone: 'Z'
});

module.exports = pool;