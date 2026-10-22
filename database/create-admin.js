require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

function poolConfig() {
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

async function createAdmin() {
  const name = process.env.ADMIN_NAME || 'Campus Administrator';
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email || !password) {
    throw new Error(
      'Set ADMIN_EMAIL and ADMIN_PASSWORD in your .env file, then run: npm run db:admin'
    );
  }

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  }

  const pool = new Pool(poolConfig());
  const existing = await pool.query('SELECT id, role FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  if (existing.rowCount && existing.rows[0].role === 'super_admin') {
    await pool.end();
    throw new Error('That email belongs to a super administrator. Use a different email for a regular admin.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, 'admin', TRUE)
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           role = 'admin',
           is_active = TRUE
     RETURNING id, email`,
    [name, email, passwordHash]
  );

  await pool.end();
  console.log(`Administrator ready: ${result.rows[0].email}`);
}

createAdmin().catch((err) => {
  console.error('Could not create administrator:', err.message);
  process.exit(1);
});
