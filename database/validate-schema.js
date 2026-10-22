require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function validateSchema() {
    const sql = fs.readFileSync(
        path.join(__dirname, 'schema_repaired.sql'),
        'utf8'
    );

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    let connected = false;

    try {
        await client.connect();
        connected = true;

        await client.query('BEGIN');
        await client.query(sql);
        await client.query('ROLLBACK');

        console.log('SUCCESS: PostgreSQL accepted the schema.');
        console.log('All test changes were rolled back.');
        console.log('Your database schema was not changed.');
    } catch (error) {
        if (connected) {
            try {
                await client.query('ROLLBACK');
            } catch (_) {}
        }

        console.error('SCHEMA VALIDATION FAILED:');
        console.error(error.message);
        console.log('Do not replace schema.sql yet.');
        process.exitCode = 1;
    } finally {
        if (connected) await client.end();
    }
}

validateSchema();
