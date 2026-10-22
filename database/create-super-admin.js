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

async function createSuperAdmin() {
  const name = process.env.SUPER_ADMIN_NAME || 'Campus Super Administrator';
  const email = (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || '';

  if (!email || !password) {
    throw new Error(
      'Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in your .env file, then run: npm run db:super-admin'
    );
  }

  if (password.length < 8) {
    throw new Error('SUPER_ADMIN_PASSWORD must be at least 8 characters.');
  }

  const pool = new Pool(poolConfig());
  const passwordHash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, 'super_admin', TRUE)
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           role = 'super_admin',
           is_active = TRUE
     RETURNING id, email`,
    [name, email, passwordHash]
  );

  await pool.end();
  console.log(`Super administrator ready: ${result.rows[0].email}`);
}

createSuperAdmin().catch((err) => {
  console.error('Could not create super administrator:', err.message);
  process.exit(1);
});
