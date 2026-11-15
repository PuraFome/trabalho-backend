require('dotenv').config({ quiet: true });

const mysql = require('mysql2/promise');

const requiredVars = ['DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
for (const v of requiredVars) {
  if (!process.env[v]) {
    throw new Error(`Variável de ambiente ausente: ${v}`);
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  dateStrings: true,
  timezone: 'Z'
});

module.exports = pool;