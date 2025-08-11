import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

function buildConfig() {
  const cfg = {};
  if (process.env.DATABASE_URL) cfg.connectionString = process.env.DATABASE_URL;
  if (process.env.PGHOST) cfg.host = process.env.PGHOST;
  if (process.env.PGPORT) cfg.port = Number(process.env.PGPORT);
  if (process.env.PGUSER) cfg.user = process.env.PGUSER;
  if (process.env.PGPASSWORD !== undefined && process.env.PGPASSWORD !== '') cfg.password = String(process.env.PGPASSWORD);
  if (process.env.PGDATABASE) cfg.database = process.env.PGDATABASE;
  if (process.env.PGSSL === 'true') cfg.ssl = { rejectUnauthorized: false };
  return cfg;
}

const pool = new Pool(buildConfig());

export async function query(text, params) { return pool.query(text, params); }
export async function getClient() { return pool.connect(); }
