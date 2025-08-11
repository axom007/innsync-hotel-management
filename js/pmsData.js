// Lightweight CSV data layer for the InnSync demo (client-side only)
// Loads CSVs from ./data and exposes convenient helpers. Uses Cache + localStorage overlays for demo mutations.

const DATA_PREFIX = './data/';
const LS = {
  bookings: 'innsync_demo_bookings',
  stays: 'innsync_demo_stays',
  occupancy: 'innsync_demo_occupancy',
  alerts: 'innsync_demo_alerts',
  payments: 'innsync_demo_payments',
};

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines.shift().split(',');
  return lines.filter(Boolean).map(line => {
    // naive CSV split (no quoted commas in our demo files)
    const parts = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = parts[i] === '' ? '' : parts[i]);
    return obj;
  });
}

const FALLBACKS = {
  'innsync_dummy_hotels.csv': `id,name,timezone,address\ncf6f590b-0877-469c-b8cb-b2c13b19edf6,Hotel Sunrise Residency,Asia/Kolkata,"MG Road, Bengaluru, KA"\n`,
  'innsync_dummy_rooms.csv': `id,hotel_id,number,floor,type,rate\n13c34176-49b4-418e-9a44-18ba926df791,cf6f590b-0877-469c-b8cb-b2c13b19edf6,101,1,Deluxe,4200\n3c00fe5b-75af-4546-bc42-2591e8ce392b,cf6f590b-0877-469c-b8cb-b2c13b19edf6,102,1,Standard,3200\naf5ab751-6513-4461-b831-60825644c42c,cf6f590b-0877-469c-b8cb-b2c13b19edf6,103,1,Suite,5800\n3cf2648b-1e12-4109-984d-5e546eeedb04,cf6f590b-0877-469c-b8cb-b2c13b19edf6,104,1,Deluxe,4200\nee0be6b4-bb0f-489b-a33d-4c77960d23d2,cf6f590b-0877-469c-b8cb-b2c13b19edf6,105,1,Standard,3200\ndb6e200d-65c2-4dc4-900e-644db3ac2bd3,cf6f590b-0877-469c-b8cb-b2c13b19edf6,106,1,Suite,5800\n87564b5b-6db7-49e7-ad1a-5ff0bc4f36a1,cf6f590b-0877-469c-b8cb-b2c13b19edf6,107,2,Deluxe,4200\n39fb257b-be3f-4bdb-b88e-a76a87883d25,cf6f590b-0877-469c-b8cb-b2c13b19edf6,108,2,Standard,3200\n92db4cd1-c206-4912-86fa-297502190981,cf6f590b-0877-469c-b8cb-b2c13b19edf6,109,2,Suite,5800\n1d8f378b-cdd5-4892-bde0-1b5d4dc7539b,cf6f590b-0877-469c-b8cb-b2c13b19edf6,110,2,Deluxe,4200\n8da2a6d7-f6a5-45dc-ba87-f3988e7ffe5c,cf6f590b-0877-469c-b8cb-b2c13b19edf6,111,2,Standard,3200\n8b247bc4-9df5-43f6-a02a-c42d6bceb285,cf6f590b-0877-469c-b8cb-b2c13b19edf6,112,2,Suite,5800\n8f159dee-8b16-43a3-857f-c7caf1295f54,cf6f590b-0877-469c-b8cb-b2c13b19edf6,113,3,Deluxe,4200\n5ee8803c-486c-4bfb-a901-e71b0872a295,cf6f590b-0877-469c-b8cb-b2c13b19edf6,114,3,Standard,3200\na004a981-4179-4254-a9ab-b832af2830fe,cf6f590b-0877-469c-b8cb-b2c13b19edf6,115,3,Suite,5800\ne7fc8e5e-8809-4a83-b52a-758a47b56d81,cf6f590b-0877-469c-b8cb-b2c13b19edf6,116,3,Deluxe,4200\nbe31b36c-62b1-4bb5-8d51-8caa2d991f79,cf6f590b-0877-469c-b8cb-b2c13b19edf6,117,3,Standard,3200\n59dfdf9b-ec5b-4f1d-a0c7-7d014775edfc,cf6f590b-0877-469c-b8cb-b2c13b19edf6,118,3,Suite,5800\n`,
  'innsync_dummy_devices.csv': `id,hotel_id,device_uid,model,status\n48b6c318-5f06-4dd7-b564-d854c4165415,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-101-352a7246,InnSync-IRP-1,active\n70574bd9-5ea6-4fb6-80bc-c3eaf4392c5f,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-102-58c18f35,InnSync-IRP-1,active\n2bb7510a-629c-4f39-ab7c-3980ebdafbde,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-103-b387a89a,InnSync-IRP-1,active\n1743d9a7-5664-4d71-bd47-b5dbb4339b80,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-104-29b79ef7,InnSync-IRP-1,active\n4d3c1116-1388-4fbc-9945-52db2093f1cb,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-105-31c95269,InnSync-IRP-1,active\n9b961c8c-84ce-43dd-ae33-ceaaf553e794,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-106-f2fbd68c,InnSync-IRP-1,active\nb10f253c-39f0-4038-8045-e1263a188304,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-107-e1d4e54b,InnSync-IRP-1,active\n5acedfba-5447-446d-80e3-8977645ef639,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-108-ee7aa299,InnSync-IRP-1,active\n16bca836-a5f3-493b-99b2-02f641a633a7,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-109-cb24130e,InnSync-IRP-1,active\n55426843-72bd-4b4e-ac6d-75f8158ee1fe,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-110-36b9295e,InnSync-IRP-1,active\n49904fa5-332a-4fea-b22b-2b839588d86c,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-111-0f1b1a39,InnSync-IRP-1,active\nac110e76-7458-4629-84e6-e36863ad15b0,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-112-60bd5489,InnSync-IRP-1,active\na9b8f670-6d53-490b-a6f7-fea4b2b62534,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-113-a92af01a,InnSync-IRP-1,active\n39d5ea1c-bda0-4ceb-a180-cfa0ae1b9326,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-114-0feee986,InnSync-IRP-1,active\n998a21f0-c81a-48d2-b3c0-d1eb6f5b70fc,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-115-7120218d,InnSync-IRP-1,active\n6b744a11-0f04-42c0-8ece-e165bce4b1b1,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-116-477887a2,InnSync-IRP-1,active\n5482d55e-b79c-470d-8dca-e3621e7442d3,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-117-cc9bbbc5,InnSync-IRP-1,active\n894dec8a-4cd5-43c7-ba66-65552384df60,cf6f590b-0877-469c-b8cb-b2c13b19edf6,INS-118-58059d55,InnSync-IRP-1,active\n`,
  'innsync_dummy_room_devices.csv': `room_id,device_id,bound_at,active\n13c34176-49b4-418e-9a44-18ba926df791,48b6c318-5f06-4dd7-b564-d854c4165415,2025-08-09T10:00:00+05:30,True\n3c00fe5b-75af-4546-bc42-2591e8ce392b,70574bd9-5ea6-4fb6-80bc-c3eaf4392c5f,2025-08-09T10:00:00+05:30,True\naf5ab751-6513-4461-b831-60825644c42c,2bb7510a-629c-4f39-ab7c-3980ebdafbde,2025-08-09T10:00:00+05:30,True\n3cf2648b-1e12-4109-984d-5e546eeedb04,1743d9a7-5664-4d71-bd47-b5dbb4339b80,2025-08-09T10:00:00+05:30,True\nee0be6b4-bb0f-489b-a33d-4c77960d23d2,4d3c1116-1388-4fbc-9945-52db2093f1cb,2025-08-09T10:00:00+05:30,True\ndb6e200d-65c2-4dc4-900e-644db3ac2bd3,9b961c8c-84ce-43dd-ae33-ceaaf553e794,2025-08-09T10:00:00+05:30,True\n87564b5b-6db7-49e7-ad1a-5ff0bc4f36a1,b10f253c-39f0-4038-8045-e1263a188304,2025-08-09T10:00:00+05:30,True\n39fb257b-be3f-4bdb-b88e-a76a87883d25,5acedfba-5447-446d-80e3-8977645ef639,2025-08-09T10:00:00+05:30,True\n92db4cd1-c206-4912-86fa-297502190981,16bca836-a5f3-493b-99b2-02f641a633a7,2025-08-09T10:00:00+05:30,True\n1d8f378b-cdd5-4892-bde0-1b5d4dc7539b,55426843-72bd-4b4e-ac6d-75f8158ee1fe,2025-08-09T10:00:00+05:30,True\n8da2a6d7-f6a5-45dc-ba87-f3988e7ffe5c,49904fa5-332a-4fea-b22b-2b839588d86c,2025-08-09T10:00:00+05:30,True\n8b247bc4-9df5-43f6-a02a-c42d6bceb285,ac110e76-7458-4629-84e6-e36863ad15b0,2025-08-09T10:00:00+05:30,True\n8f159dee-8b16-43a3-857f-c7caf1295f54,a9b8f670-6d53-490b-a6f7-fea4b2b62534,2025-08-09T10:00:00+05:30,True\n5ee8803c-486c-4bfb-a901-e71b0872a295,39d5ea1c-bda0-4ceb-a180-cfa0ae1b9326,2025-08-09T10:00:00+05:30,True\na004a981-4179-4254-a9ab-b832af2830fe,998a21f0-c81a-48d2-b3c0-d1eb6f5b70fc,2025-08-09T10:00:00+05:30,True\ne7fc8e5e-8809-4a83-b52a-758a47b56d81,6b744a11-0f04-42c0-8ece-e165bce4b1b1,2025-08-09T10:00:00+05:30,True\nbe31b36c-62b1-4bb5-8d51-8caa2d991f79,5482d55e-b79c-470d-8dca-e3621e7442d3,2025-08-09T10:00:00+05:30,True\n59dfdf9b-ec5b-4f1d-a0c7-7d014775edfc,894dec8a-4cd5-43c7-ba66-65552384df60,2025-08-09T10:00:00+05:30,True\n`,
  'innsync_dummy_bookings.csv': `id,hotel_id,room_id,channel,guest_name,checkin_ts,checkout_ts,status,price,currency\n2e175996-4008-4a56-9bb0-a3544db5f089,cf6f590b-0877-469c-b8cb-b2c13b19edf6,13c34176-49b4-418e-9a44-18ba926df791,OTA,Priya R,2025-08-08T10:00:00+05:30,2025-08-10T10:00:00+05:30,checked_in,4200,INR\nfecefff9-0ba6-43c3-b6b1-07fdc1a656d0,cf6f590b-0877-469c-b8cb-b2c13b19edf6,3cf2648b-1e12-4109-984d-5e546eeedb04,Direct,S. Dutta,2025-08-09T11:30:00+05:30,2025-08-10T10:00:00+05:30,booked,3200,INR\n9ec064a3-6781-4106-a9c3-b16b56612354,cf6f590b-0877-469c-b8cb-b2c13b19edf6,87564b5b-6db7-49e7-ad1a-5ff0bc4f36a1,OTA,Rahul K,2025-08-09T13:00:00+05:30,2025-08-11T10:00:00+05:30,booked,4200,INR\n`,
  'innsync_dummy_stays.csv': `id,hotel_id,room_id,booking_id,source,checkin_ts,checkout_ts\n817fc3b8-e46f-481f-a1b1-29cb2cc19940,cf6f590b-0877-469c-b8cb-b2c13b19edf6,13c34176-49b4-418e-9a44-18ba926df791,2e175996-4008-4a56-9bb0-a3544db5f089,OTA,2025-08-08T08:00:00+05:30,\n`,
  'innsync_dummy_alerts.csv': `id,hotel_id,room_id,type,details_json,severity,created_at,resolved_at\n`,
  'innsync_dummy_payments.csv': `id,hotel_id,booking_id,amount,method,received_ts,reference\n`,
  'innsync_dummy_occupancy_events.csv': `id,hotel_id,device_id,room_id,event_ts,event_type,payload_json\n`,
  'innsync_dummy_users.csv': `id,email,password_demo,status\nd00d8589-1549-42eb-a6de-c3055dcc1df0,owner@sunrise.example,owner123,active\n`,
  'innsync_dummy_hotel_users.csv': `hotel_id,user_id,role\ncf6f590b-0877-469c-b8cb-b2c13b19edf6,d00d8589-1549-42eb-a6de-c3055dcc1df0,OWNER\n`,
};

async function loadCSVFile(name) {
  try {
    const res = await fetch(DATA_PREFIX + name);
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    const text = await res.text();
    return parseCSV(text);
  } catch (e) {
    const fb = FALLBACKS[name];
    if (fb !== undefined) {
      console.warn('Using fallback for', name);
      return parseCSV(fb);
    }
    console.warn('No data for', name, e);
    return [];
  }
}

export async function loadCSVHotels() { return loadCSVFile('innsync_dummy_hotels.csv'); }
export async function loadCSVRooms() { const rows = await loadCSVFile('innsync_dummy_rooms.csv'); return rows.map(r => ({ ...r, rate: Number(r.rate||0) })); }
export async function loadCSVDevices() { return loadCSVFile('innsync_dummy_devices.csv'); }
export async function loadCSVRoomDevices() { return loadCSVFile('innsync_dummy_room_devices.csv'); }
export async function loadCSVBookingsRaw() { return loadCSVFile('innsync_dummy_bookings.csv'); }
export async function loadCSVUsers() { return loadCSVFile('innsync_dummy_users.csv'); }
export async function loadCSVHotelUsers() { return loadCSVFile('innsync_dummy_hotel_users.csv'); }
export async function loadCSVStaysRaw() { return loadCSVFile('innsync_dummy_stays.csv'); }
export async function loadCSVAlertsRaw() { return loadCSVFile('innsync_dummy_alerts.csv'); }
export async function loadCSVPaymentsRaw() { return loadCSVFile('innsync_dummy_payments.csv'); }

export async function getHotelForUserEmail(userId) {
  const links = await loadCSVHotelUsers();
  const row = links.find(r => r.user_id === userId);
  return row?.hotel_id || null;
}

// Overlay mutating data using localStorage to keep demo interactions
function readOverlay(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } }
function writeOverlay(key, arr) { localStorage.setItem(key, JSON.stringify(arr)); }

export function resetOverlays() {
  Object.values(LS).forEach(k => localStorage.removeItem(k));
}

export async function loadBookings() {
  const base = await loadCSVBookingsRaw();
  const overlay = readOverlay(LS.bookings);
  return [...base, ...overlay];
}

export async function loadStays() {
  const base = await loadCSVStaysRaw();
  const overlay = readOverlay(LS.stays);
  return [...base, ...overlay];
}

export async function loadAlerts() {
  const base = await loadCSVAlertsRaw();
  const overlay = readOverlay(LS.alerts);
  return [...base, ...overlay];
}

export async function loadOccupancyEvents() {
  const base = await loadCSVFile('innsync_dummy_occupancy_events.csv');
  const overlay = readOverlay(LS.occupancy);
  return [...base, ...overlay];
}

export async function loadPayments() {
  const base = await loadCSVPaymentsRaw();
  const overlay = readOverlay(LS.payments);
  return [...base, ...overlay];
}

// Mutators
function uuid4() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8); return v.toString(16); }); }

export async function addWalkinBooking({ hotel_id, room_id, guest_name, price }) {
  const id = uuid4();
  const now = new Date().toISOString();
  const rec = { id, hotel_id, room_id, channel: 'Walk-in', guest_name, checkin_ts: now, checkout_ts: '', status: 'booked', price: String(price||0), currency: 'INR' };
  const cur = readOverlay(LS.bookings); cur.push(rec); writeOverlay(LS.bookings, cur); return rec;
}

export async function markCheckedIn({ hotel_id, room_id }) {
  const id = uuid4();
  const now = new Date().toISOString();
  const rec = { id, hotel_id, room_id, booking_id: '', source: 'MANUAL', checkin_ts: now, checkout_ts: '' };
  const cur = readOverlay(LS.stays); cur.push(rec); writeOverlay(LS.stays, cur); return rec;
}

export async function addOccupancyEvent({ hotel_id, device_id, room_id, event_type='presence'}) {
  const id = uuid4();
  const now = new Date().toISOString();
  const rec = { id, hotel_id, device_id, room_id, event_ts: now, event_type, payload_json: '' };
  const cur = readOverlay(LS.occupancy); cur.push(rec); writeOverlay(LS.occupancy, cur); return rec;
}

export async function addAlert({ hotel_id, room_id, type, details_json, severity='medium' }) {
  const id = uuid4();
  const now = new Date().toISOString();
  const rec = { id, hotel_id, room_id, type, details_json, severity, created_at: now, resolved_at: '' };
  const cur = readOverlay(LS.alerts); cur.push(rec); writeOverlay(LS.alerts, cur); return rec;
}
