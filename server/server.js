import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { query, getClient } from './db.js';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Static frontend (optional: serve from project root)
app.use('/', express.static(path.join(__dirname, '..')));

// Auth (demo): verify email/password, return hotel_id
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email/password required' });
  const { rows: users } = await query('select * from users where email=$1 and password_demo=$2', [email, password]);
  if (!users.length) return res.status(401).json({ error: 'invalid' });
  const user = users[0];
  const { rows: roles } = await query('select * from hotel_users where user_id=$1', [user.id]);
  if (!roles.length) return res.status(403).json({ error: 'no_hotel' });
  // Prefer OWNER if user has multiple roles, else take the first
  const owner = roles.find(r => String(r.role).toUpperCase()==='OWNER');
  const picked = owner || roles[0];
  res.json({ user_id: user.id, email: user.email, hotel_id: picked.hotel_id, role: String(picked.role).toUpperCase() });
});

app.get('/api/rooms', async (req, res) => {
  const { hotel_id } = req.query;
  const { rows } = await query('select * from rooms where hotel_id=$1 order by number', [hotel_id]);
  res.json(rows);
});

app.get('/api/devices', async (req, res) => {
  const { hotel_id } = req.query;
  const { rows } = await query(`select d.*, rd.room_id from devices d left join room_devices rd on rd.device_id=d.id where d.hotel_id=$1 order by d.device_uid`, [hotel_id]);
  res.json(rows);
});

app.get('/api/rooms/state', async (req, res) => {
  const { hotel_id } = req.query;
  const { rows } = await query(`
    select r.*,
    case 
      when exists(select 1 from alerts a where a.hotel_id=$1 and a.room_id=r.id and a.resolved_at is null) then 'flagged'
      when exists(select 1 from stays s where s.hotel_id=$1 and s.room_id=r.id and s.checkout_ts is null) then 'checked'
      when exists(select 1 from bookings b where b.hotel_id=$1 and b.room_id=r.id and b.status!='cancelled' and date(b.checkin_ts)=current_date) then 'booked'
      else 'vacant'
    end as state
    from rooms r where r.hotel_id=$1 order by r.number
  `, [hotel_id]);
  res.json(rows);
});

app.get('/api/alerts', async (req, res) => {
  const { hotel_id } = req.query;
  const { rows } = await query('select * from alerts where hotel_id=$1 order by created_at desc', [hotel_id]);
  res.json(rows);
});

// List bookings for a hotel, optionally filter by status
app.get('/api/bookings', async (req, res) => {
  const { hotel_id, status, ready } = req.query;
  if (!hotel_id) return res.status(400).json({ error: 'hotel_id required' });
  if (String(ready).toLowerCase() === 'true') {
    const { rows } = await query(`
      select * from bookings b
      where b.hotel_id=$1 and b.status not in ('cancelled','checked-in')
        and not exists (
          select 1 from stays s where s.hotel_id=b.hotel_id and s.booking_id=b.id and s.checkout_ts is null
        )
      order by coalesce(b.checkin_ts, now()) desc
    `, [hotel_id]);
    return res.json(rows);
  }
  let sql = 'select * from bookings where hotel_id=$1';
  const params = [hotel_id];
  if (status) { sql += ' and status=$2'; params.push(status); }
  sql += ' order by coalesce(checkin_ts, now()) desc';
  const { rows } = await query(sql, params);
  res.json(rows);
});

// Available rooms (exclude checked-in). Optional category filter.
app.get('/api/rooms/available', async (req, res) => {
  const { hotel_id, category } = req.query;
  if (!hotel_id) return res.status(400).json({ error: 'hotel_id required' });
  const { rows } = await query(`
    select r.* from rooms r
    where r.hotel_id=$1
      and not exists (
        select 1 from stays s where s.hotel_id=$1 and s.room_id=r.id and s.checkout_ts is null
      )
      and ($2::text is null or r.type=$2)
    order by r.number
  `, [hotel_id, category||null]);
  res.json(rows);
});

// Walk-in by category: pick a random available room from the category and book it
app.post('/api/bookings/walkin-category', async (req, res) => {
  const { hotel_id, category, guest_name, price } = req.body || {};
  if (!hotel_id || !category) return res.status(400).json({ error: 'hotel_id/category required' });
  const { rows: candidates } = await query(`
    select r.id from rooms r
    where r.hotel_id=$1 and r.type=$2
      and not exists (
        select 1 from stays s where s.hotel_id=$1 and s.room_id=r.id and s.checkout_ts is null
      )
      and not exists (
        select 1 from bookings b where b.hotel_id=$1 and b.room_id=r.id and b.status not in ('cancelled','checked-in')
          and date(coalesce(b.checkin_ts, now()))=current_date
      )
    order by random() limit 1
  `, [hotel_id, category]);
  if (!candidates.length) return res.status(409).json({ error: 'no_available_room' });
  const room_id = candidates[0].id;
  const id = randomUUID();
  await query('insert into bookings(id,hotel_id,room_id,category,channel,guest_name,checkin_ts,status,price,currency) values($1,$2,$3,$4,$5,$6,now(),$7,$8,$9)', [id, hotel_id, room_id, category, 'Walk-in', guest_name||'Walk-in Guest', 'booked', Number(price||0), 'INR']);
  res.json({ id, room_id });
});

app.get('/api/metrics', async (req, res) => {
  const { hotel_id } = req.query;
  const roomsTotal = (await query('select count(*) from rooms where hotel_id=$1', [hotel_id])).rows[0].count|0;
  const checkedIn = (await query("select count(*) from stays where hotel_id=$1 and checkout_ts is null", [hotel_id])).rows[0].count|0;
  const bookedToday = (await query("select count(*) from bookings where hotel_id=$1 and status!='cancelled' and date(checkin_ts)=current_date", [hotel_id])).rows[0].count|0;
  const revenueToday = (await query("select coalesce(sum(price),0) sum from bookings where hotel_id=$1 and status!='cancelled' and date(checkin_ts)=current_date", [hotel_id])).rows[0].sum|0;
  const flags = (await query("select count(*) from alerts where hotel_id=$1 and resolved_at is null", [hotel_id])).rows[0].count|0;
  res.json({ roomsTotal: Number(roomsTotal), occupancyRate: roomsTotal? (Number(checkedIn)/Number(roomsTotal))*100 : 0, booked: Number(bookedToday), revenueToday: Number(revenueToday), flags: Number(flags) });
});

app.post('/api/bookings/walkin', async (req, res) => {
  const { hotel_id, room_id, guest_name, price } = req.body || {};
  if (!hotel_id || !room_id) return res.status(400).json({ error: 'hotel_id/room_id required' });
  const id = randomUUID();
  await query('insert into bookings(id,hotel_id,room_id,channel,guest_name,checkin_ts,status,price,currency) values($1,$2,$3,$4,$5,now(),$6,$7,$8)', [id, hotel_id, room_id, 'Walk-in', guest_name||'Walk-in Guest', 'booked', Number(price||0), 'INR']);
  res.json({ id });
});

// OTA booking at category level with inventory check
app.post('/api/bookings/ota', async (req, res) => {
  const { hotel_id, category, check_in_date, check_out_date, guest_name, price } = req.body || {};
  if (!hotel_id || !category || !check_in_date || !check_out_date) return res.status(400).json({ error: 'hotel_id/category/check_in_date/check_out_date required' });
  try {
    const client = await getClient();
    try {
      await client.query('begin');
      const roomsTotal = Number((await client.query('select count(*) from rooms where hotel_id=$1 and type=$2', [hotel_id, category])).rows[0].count || 0);
      if (!roomsTotal) { await client.query('rollback'); return res.status(409).json({ error: 'no_inventory', message: 'No rooms in this category' }); }
      const overlapSql = `
        select count(*) from bookings
        where hotel_id=$1 and status!='cancelled' and category=$2
          and checkin_ts is not null and checkout_ts is not null
          and (date(checkin_ts) < $4::date and date(checkout_ts) > $3::date)
      `;
      const overlapping = Number((await client.query(overlapSql, [hotel_id, category, check_in_date, check_out_date])).rows[0].count || 0);
      if (overlapping >= roomsTotal) { await client.query('rollback'); return res.status(409).json({ error: 'no_inventory', message: 'Category fully booked for selected dates' }); }
      const id = randomUUID();
      const insertSql = `insert into bookings(id,hotel_id,room_id,category,channel,guest_name,checkin_ts,checkout_ts,status,price,currency)
                         values($1,$2,null,$3,$4,$5,$6,$7,$8,$9,$10)`;
      await client.query(insertSql, [id, hotel_id, category, 'OTA', guest_name||'OTA Guest', check_in_date, check_out_date, 'reserved', Number(price||0), 'INR']);
      await client.query('commit');
      res.json({ id });
    } catch (e) {
      await (async () => { try { await client.query('rollback'); } catch {} })();
      console.error(e);
      res.status(500).json({ error: 'server_error' });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Simulate an OTA booking for a random vacant room
app.post('/api/bookings/ota/random', async (req, res) => {
  const { hotel_id } = req.body || {};
  if (!hotel_id) return res.status(400).json({ error: 'hotel_id required' });

  const client = await getClient();
  try {
    await client.query('begin');

    // Find a random available room
    const { rows: candidates } = await client.query(`
      select r.id, r.type, r.rate from rooms r
      where r.hotel_id=$1
        and not exists (
          select 1 from stays s where s.hotel_id=$1 and s.room_id=r.id and s.checkout_ts is null
        )
        and not exists (
          select 1 from bookings b where b.hotel_id=$1 and b.room_id=r.id and b.status not in ('cancelled','checked-in')
            and date(coalesce(b.checkin_ts, now()))=current_date
        )
      order by random() limit 1
    `, [hotel_id]);

    if (!candidates.length) {
      await client.query('rollback');
      return res.status(409).json({ error: 'no_available_room', message: 'No vacant rooms available for a random booking.' });
    }

    const room = candidates[0];
    const guestName = `OTA Guest ${Math.floor(100 + Math.random() * 900)}`;
    const checkinDate = new Date();
    const checkoutDate = new Date();
    checkoutDate.setDate(checkinDate.getDate() + 1);

    const id = randomUUID();
    const insertSql = `insert into bookings(id,hotel_id,room_id,category,channel,guest_name,checkin_ts,checkout_ts,status,price,currency)
                       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`;
    await client.query(insertSql, [id, hotel_id, room.id, room.type, 'OTA', guestName, checkinDate, checkoutDate, 'reserved', room.rate || 3200, 'INR']);
    
    await client.query('commit');
    res.json({ id, room_id: room.id });
  } catch (e) {
    await (async () => { try { await client.query('rollback'); } catch {} })();
    console.error('Random OTA booking failed:', e);
    res.status(500).json({ error: 'server_error' });
  } finally {
    client.release();
  }
});

// Assign room and check-in (locks the booking)
app.post('/api/bookings/:id/checkin', async (req, res) => {
  const bookingId = req.params.id;
  const { hotel_id, room_id } = req.body || {};
  if (!bookingId || !hotel_id) return res.status(400).json({ error: 'booking_id/hotel_id required' });
  const client = await getClient();
  try {
    await client.query('begin');
    const { rows: bRows } = await client.query('select * from bookings where id=$1 and hotel_id=$2', [bookingId, hotel_id]);
    if (!bRows.length) { await client.query('rollback'); return res.status(404).json({ error: 'not_found' }); }
    const b = bRows[0];
    // Determine room to use: if already assigned, prefer that; else require provided room_id
    const targetRoomId = b.room_id || room_id;
    if (!targetRoomId) { await client.query('rollback'); return res.status(400).json({ error: 'room_required' }); }
    // Validate category match if booking has category
    if (b.category) {
      const { rows: rRows } = await client.query('select * from rooms where id=$1 and hotel_id=$2', [targetRoomId, hotel_id]);
      if (!rRows.length) { await client.query('rollback'); return res.status(404).json({ error: 'room_not_found' }); }
      const roomType = String(rRows[0].type||'').trim().toLowerCase();
      const bCat = String(b.category||'').trim().toLowerCase();
      if (roomType !== bCat) { await client.query('rollback'); return res.status(409).json({ error: 'category_mismatch' }); }
    }
    // Ensure no active stay already for this booking
    const { rows: existingStay } = await client.query('select 1 from stays where hotel_id=$1 and booking_id=$2 and checkout_ts is null limit 1', [hotel_id, bookingId]);
    if (existingStay.length) { await client.query('rollback'); return res.status(409).json({ error: 'already_checked_in' }); }
    // Ensure room is not already occupied by another stay
    const { rows: activeStay } = await client.query('select 1 from stays where hotel_id=$1 and room_id=$2 and checkout_ts is null limit 1', [hotel_id, targetRoomId]);
    if (activeStay.length) { await client.query('rollback'); return res.status(409).json({ error: 'room_occupied' }); }
    // Update booking (preserve existing room_id if set) and set status
    if (b.room_id) {
      await client.query('update bookings set status=$1 where id=$2', ['checked-in', bookingId]);
    } else {
      await client.query('update bookings set room_id=$1, status=$2 where id=$3', [targetRoomId, 'checked-in', bookingId]);
    }
    const stayId = randomUUID();
    await client.query('insert into stays(id,hotel_id,room_id,booking_id,source,checkin_ts) values($1,$2,$3,$4,$5,now())', [stayId, hotel_id, targetRoomId, bookingId, 'BOOKING']);
    await client.query('commit');
    res.json({ id: stayId });
  } catch (e) {
    await (async () => { try { await client.query('rollback'); } catch {} })();
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  } finally {
    client.release();
  }
});

app.post('/api/stays/checkin', async (req, res) => {
  const { hotel_id, room_id } = req.body || {};
  if (!hotel_id || !room_id) return res.status(400).json({ error: 'hotel_id/room_id required' });
  const id = randomUUID();
  await query('insert into stays(id,hotel_id,room_id,source,checkin_ts) values($1,$2,$3,$4,now())', [id, hotel_id, room_id, 'MANUAL']);
  res.json({ id });
});

app.post('/api/ingest/occupancy', async (req, res) => {
  const { hotel_id, device_id, room_id, event_type, detected_occupancy } = req.body || {};
  if (!hotel_id || !room_id) return res.status(400).json({ error: 'hotel_id/room_id required' });
  const id = randomUUID();
  await query('insert into occupancy_events(id,hotel_id,device_id,room_id,event_ts,event_type) values($1,$2,$3,$4,now(),$5)', [id, hotel_id, device_id||null, room_id, event_type||'presence']);
  // Upsert sensors table
  await query(`
    insert into sensors(id, hotel_id, room_id, detected_occupancy, last_updated)
    values($1,$2,$3,$4, now())
    on conflict (room_id) do update set detected_occupancy=excluded.detected_occupancy, last_updated=excluded.last_updated
  `, [device_id || randomUUID(), hotel_id, room_id, !!detected_occupancy]);
  // Create alert if presence but no active stay and a booking exists for this room/category today
  const { rows: stayRows } = await query('select 1 from stays where hotel_id=$1 and room_id=$2 and checkout_ts is null limit 1', [hotel_id, room_id]);
  if (!stayRows.length && (detected_occupancy === true || event_type === 'presence')) {
    // check if room has a booking today or category booking today not checked-in
    const { rows: roomRows } = await query('select type from rooms where id=$1 and hotel_id=$2', [room_id, hotel_id]);
    const roomType = roomRows.length ? roomRows[0].type : null;
    const bookingCheckSql = `
      select 1 from bookings b
      where b.hotel_id=$1 and b.status!='cancelled'
        and (
          (b.room_id=$2) or (b.room_id is null and b.category=$3)
        )
        and (date(coalesce(b.checkin_ts, now())) <= current_date and date(coalesce(b.checkout_ts, now())) >= current_date)
      limit 1`;
    const { rows: hasBooking } = await query(bookingCheckSql, [hotel_id, room_id, roomType]);
    if (hasBooking.length) {
      const aid = randomUUID();
      await query('insert into alerts(id,hotel_id,room_id,type,details_json,severity,created_at) values($1,$2,$3,$4,$5,$6,now())', [aid, hotel_id, room_id, 'Presence without check-in', JSON.stringify({ room_id, note: 'Occupancy detected but no check-in' }), 'medium']);
    }
  }
  res.json({ id });
});

// Resolve alert
app.post('/api/alerts/:id/resolve', async (req, res) => {
  const id = req.params.id;
  await query('update alerts set resolved_at=now() where id=$1', [id]);
  res.json({ ok: true });
});

// Simulate: create a fake alert for a random vacant room, or any un-flagged room if no vacant ones are available.
app.post('/api/simulate/flag-vacant', async (req, res) => {
  const { hotel_id } = req.body || {};
  if (!hotel_id) return res.status(400).json({ error: 'hotel_id required' });
  const client = await getClient();
  try {
    await client.query('begin');
    // First, try to find a truly vacant room
    let { rows: candidates } = await client.query(`
      select r.id from rooms r
      where r.hotel_id=$1
        and not exists (select 1 from stays s where s.hotel_id=$1 and s.room_id=r.id and s.checkout_ts is null)
        and not exists (select 1 from bookings b where b.hotel_id=$1 and b.room_id=r.id and b.status!='cancelled' and date(b.checkin_ts)=current_date)
        and not exists (select 1 from alerts a where a.hotel_id=$1 and a.room_id=r.id and a.resolved_at is null)
      order by random() limit 1
    `, [hotel_id]);

    // If no vacant room is found, fall back to any room that is not currently flagged.
    if (!candidates.length) {
      ({ rows: candidates } = await client.query(`
        select r.id from rooms r
        where r.hotel_id=$1
          and not exists (select 1 from alerts a where a.hotel_id=$1 and a.room_id=r.id and a.resolved_at is null)
        order by random() limit 1
      `, [hotel_id]));
    }

    if (!candidates.length) {
      await client.query('rollback');
      return res.status(404).json({ error: 'no_unflagged_room', message: 'No available room to flag for simulation.' });
    }
    const room_id = candidates[0].id;
    const aid = randomUUID();
    await client.query('insert into alerts(id,hotel_id,room_id,type,details_json,severity,created_at) values($1,$2,$3,$4,$5,$6,now())', [aid, hotel_id, room_id, 'Simulated Presence', JSON.stringify({ note: 'Sensor detected presence in a vacant room.' }), 'medium']);
    await client.query('commit');
    res.json({ ok: true, room_id });
  } catch (e) {
    await (async () => { try { await client.query('rollback'); } catch {} })();
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  } finally {
    client.release();
  }
});

// Danger: reset hotel data (bookings, stays, guest names, alerts, payments, occupancy events, sensors)
app.post('/api/reset/hotel', async (req, res) => {
  const { hotel_id } = req.body || {};
  if (!hotel_id) return res.status(400).json({ error: 'hotel_id required' });

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Truncate tables that are directly related to hotel_id via foreign key
    await client.query('DELETE FROM bookings WHERE hotel_id=$1', [hotel_id]);
    await client.query('DELETE FROM stays WHERE hotel_id=$1', [hotel_id]);
    await client.query('DELETE FROM alerts WHERE hotel_id=$1', [hotel_id]);
    await client.query('DELETE FROM payments WHERE hotel_id=$1', [hotel_id]);
    await client.query('DELETE FROM occupancy_events WHERE hotel_id=$1', [hotel_id]);
    await client.query('DELETE FROM sensors WHERE hotel_id=$1', [hotel_id]);

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Reset failed:', e?.message);
    res.status(500).json({ error: 'server_error', message: e.message });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Server running on http://localhost:'+PORT));
