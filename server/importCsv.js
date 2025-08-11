// Import CSVs from ./data into Postgres
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, getClient } from './db.js';
import { randomUUID } from 'crypto';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readCSV(file) {
  const p = path.join(__dirname, '..', 'data', file);
  const text = fs.readFileSync(p, 'utf8');
  return parse(text, { columns: true, skip_empty_lines: true, trim: true });
}

async function run() {
  // create schema
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await query(schemaSql);

  // load data
  const hotels = readCSV('innsync_dummy_hotels.csv');
  const rooms = readCSV('innsync_dummy_rooms.csv');
  const devices = readCSV('innsync_dummy_devices.csv');
  const roomDevices = readCSV('innsync_dummy_room_devices.csv');
  const users = readCSV('innsync_dummy_users.csv');
  const hotelUsers = readCSV('innsync_dummy_hotel_users.csv');
  const bookings = readCSV('innsync_dummy_bookings.csv');
  const stays = readCSV('innsync_dummy_stays.csv');
  const alerts = readCSV('innsync_dummy_alerts.csv');
  const payments = readCSV('innsync_dummy_payments.csv');
  // optional additional demo files
  let categories = [];
  let sensors = [];
  try { categories = readCSV('categories.csv'); } catch {}
  try { sensors = readCSV('sensors.csv'); } catch {}

  const client = await getClient();
  try {
    await client.query('begin');
    for (const h of hotels) await client.query('insert into hotels(id,name,timezone,address) values($1,$2,$3,$4) on conflict (id) do nothing', [h.id, h.name, h.timezone, h.address]);
    for (const r of rooms) await client.query('insert into rooms(id,hotel_id,number,floor,type,rate) values($1,$2,$3,$4,$5,$6) on conflict (id) do nothing', [r.id, r.hotel_id, r.number, Number(r.floor||0), r.type, Number(r.rate||0)]);
    for (const c of categories) {
      const cid = randomUUID();
      await client.query('insert into categories(id,hotel_id,name,description) values($1,$2,$3,$4) on conflict (hotel_id,name) do nothing', [cid, hotels[0]?.id || null, c.category_name, c.description]);
    }
    for (const d of devices) await client.query('insert into devices(id,hotel_id,device_uid,model,status) values($1,$2,$3,$4,$5) on conflict (id) do nothing', [d.id, d.hotel_id, d.device_uid, d.model, d.status]);
    for (const rd of roomDevices) await client.query('insert into room_devices(room_id,device_id,bound_at,active) values($1,$2,$3,$4) on conflict (room_id,device_id) do nothing', [rd.room_id, rd.device_id, rd.bound_at||null, (rd.active||'').toLowerCase()==='true']);
    for (const u of users) await client.query('insert into users(id,email,password_demo,status) values($1,$2,$3,$4) on conflict (id) do nothing', [u.id, u.email, u.password_demo, u.status]);
    for (const hu of hotelUsers) await client.query('insert into hotel_users(hotel_id,user_id,role) values($1,$2,$3) on conflict (hotel_id,user_id) do nothing', [hu.hotel_id, hu.user_id, hu.role]);
  for (const b of bookings) await client.query('insert into bookings(id,hotel_id,room_id,category,channel,guest_name,checkin_ts,checkout_ts,status,price,currency) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (id) do nothing', [b.id, b.hotel_id, b.room_id||null, b.category||b.type||null, b.channel, b.guest_name, b.checkin_ts||null, b.checkout_ts||null, b.status, Number(b.price||0), b.currency]);
    for (const s of stays) await client.query('insert into stays(id,hotel_id,room_id,booking_id,source,checkin_ts,checkout_ts) values($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing', [s.id, s.hotel_id, s.room_id, s.booking_id||null, s.source, s.checkin_ts||null, s.checkout_ts||null]);
    for (const a of alerts) await client.query('insert into alerts(id,hotel_id,room_id,type,details_json,severity,created_at,resolved_at) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id) do nothing', [a.id, a.hotel_id, a.room_id||null, a.type, a.details_json||null, a.severity||null, a.created_at||null, a.resolved_at||null]);
    for (const p of payments) await client.query('insert into payments(id,hotel_id,booking_id,amount,method,received_ts,reference) values($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing', [p.id, p.hotel_id, p.booking_id||null, Number(p.amount||0), p.method||null, p.received_ts||null, p.reference||null]);
    // Build map from room number -> room UUID for the first hotel (demo data)
    const { rows: roomRows } = await client.query('select id, hotel_id, number from rooms');
    const byNumber = new Map(roomRows.map(r => [String(r.number), r.id]));
    for (const s of sensors) {
      const sid = randomUUID();
      const rid = byNumber.get(String(s.room_id)) || null;
      await client.query('insert into sensors(id,hotel_id,room_id,detected_occupancy,last_updated) values($1,$2,$3,$4,$5) on conflict (id) do nothing', [sid, hotels[0]?.id || null, rid, (String(s.detected_occupancy||'').toLowerCase()==='true'), s.last_updated || null]);
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

run();
