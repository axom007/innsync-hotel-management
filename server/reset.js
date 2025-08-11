import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const resetTransactionalData = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Truncating transactional tables...');
    await client.query('TRUNCATE TABLE bookings, stays, occupancy_events, alerts, payments, sensors RESTART IDENTITY CASCADE');
    await client.query('COMMIT');
    console.log('Transactional data has been reset successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Failed to reset transactional data', e);
  } finally {
    client.release();
  }
};

resetTransactionalData().then(() => {
  pool.end();
});
