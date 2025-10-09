const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });  // Loads from root if in /server

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  port: parseInt(process.env.DB_PORT) || 5432,
  password: String(process.env.DB_PASSWORD || ''),
  database: process.env.DB_NAME || 'nextable',
});

pool.on('connect', () => console.log('Connected to PostgreSQL'));
pool.on('error', (err) => console.error('DB Connection Error:', err));

module.exports = pool;