require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function adminConfig() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = '/postgres';
    return { connectionString: url.toString() };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
  };
}

function appConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'sherubtsean_suggest_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
  };
}

function quoteIdent(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error('Invalid database name. Use letters, numbers, and underscores only.');
  }
  return `"${name}"`;
}

async function createDatabaseSafely() {
  const dbName = process.env.DB_NAME || 'sherubtsean_suggest_db';
  const client = new Client(adminConfig());
  await client.connect();

  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE ${quoteIdent(dbName)}`);
    console.log(`Created database ${dbName}`);
  } else {
    console.log(`Database ${dbName} already exists`);
  }

  await client.end();
}

async function applySchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const client = new Client(appConfig());
  await client.connect();
  await client.query(sql);
  await migrateRoles(client);
  await client.end();
  console.log('Schema applied successfully');
}

async function migrateRoles(client) {
  await client.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
  await client.query(
    `ALTER TABLE users
     ADD CONSTRAINT users_role_check
     CHECK (role IN ('student', 'tutor', 'admin', 'super_admin'))`
  );
}

(async () => {
  try {
    await createDatabaseSafely();
    await applySchema();
    process.exit(0);
  } catch (err) {
    console.error('Database setup failed:', err.message);
    process.exit(1);
  }
})();
