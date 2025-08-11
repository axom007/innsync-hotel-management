// PMS logic on top of pmsData. Computes room states, metrics, and supports manager actions.
import { loadCSVRooms, loadCSVDevices, loadCSVRoomDevices, loadBookings, loadStays, loadAlerts, addWalkinBooking, markCheckedIn, addOccupancyEvent, addAlert, resetOverlays } from './pmsData.js';

export function getSession() {
  try { return JSON.parse(localStorage.getItem('innsync_user')||''); } catch { return null; }
}

export async function ensureDemoInit() {
  // No heavy init required; overlays are empty initially.
  return true;
}

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24*3600*1000);
  return [start, end];
}

export async function listRoomsWithState() {
  const session = getSession(); if (!session) return [];
  const [rooms, devices, roomDevices, bookings, stays, alerts] = await Promise.all([
    loadCSVRooms(), loadCSVDevices(), loadCSVRoomDevices(), loadBookings(), loadStays(), loadAlerts()
  ]);
  const hotelRooms = rooms.filter(r => r.hotel_id === session.hotel_id);
  const deviceByRoomId = new Map();
  for (const rd of roomDevices) deviceByRoomId.set(rd.room_id, rd.device_id);

  const lastStayByRoom = new Map();
  for (const s of stays.filter(s => s.hotel_id === session.hotel_id)) {
    lastStayByRoom.set(s.room_id, s);
  }

  const lastBookingByRoom = new Map();
  for (const b of bookings.filter(b => b.hotel_id === session.hotel_id)) {
    lastBookingByRoom.set(b.room_id, b);
  }

  const alertRoomIds = new Set(alerts.filter(a => a.hotel_id === session.hotel_id && !a.resolved_at).map(a => a.room_id));

  return hotelRooms.map(r => {
    const b = lastBookingByRoom.get(r.id);
    const s = lastStayByRoom.get(r.id);
    let state = 'vacant', stateLabel = 'Vacant';
    if (b && (b.status === 'booked' || b.status === 'checked_in')) state = 'booked', stateLabel = 'Booked';
    if (s && !s.checkout_ts) state = 'checked', stateLabel = 'Checked-in';
    if (alertRoomIds.has(r.id)) state = 'flagged', stateLabel = 'Flagged';
    return { ...r, device_id: deviceByRoomId.get(r.id)||null, state, stateLabel };
  });
}

export async function computeMetrics() {
  const session = getSession(); if (!session) return { occupancyRate:0, revenueToday:0, bookedCount:0, flagsCount:0 };
  const [rooms, bookings, stays, alerts] = await Promise.all([loadCSVRooms(), loadBookings(), loadStays(), loadAlerts()]);
  const hotelRooms = rooms.filter(r => r.hotel_id === session.hotel_id);
  const activeStays = stays.filter(s => s.hotel_id === session.hotel_id && !s.checkout_ts);
  const occupancyRate = hotelRooms.length ? (activeStays.length / hotelRooms.length) * 100 : 0;
  const [start, end] = todayRange();
  const bookingsToday = bookings.filter(b => {
    if (b.hotel_id !== session.hotel_id || b.status === 'cancelled') return false;
    const ts = b.checkin_ts ? new Date(b.checkin_ts) : null;
    return ts && ts >= start && ts < end;
  });
  const revenueToday = bookingsToday.reduce((sum, b) => sum + (Number(b.price||0)), 0);
  const flagsCount = alerts.filter(a => a.hotel_id === session.hotel_id && !a.resolved_at).length;
  const bookedCount = bookingsToday.length;
  return { occupancyRate, revenueToday, bookedCount, flagsCount, roomsTotal: hotelRooms.length };
}

export async function simulateRandomPresence() {
  const session = getSession(); if (!session) return;
  const rooms = await listRoomsWithState();
  // pick a random room
  const pick = rooms[Math.floor(Math.random()*rooms.length)];
  await addOccupancyEvent({ hotel_id: session.hotel_id, device_id: pick.device_id, room_id: pick.id, event_type: 'presence' });
  // If presence but not checked in -> create alert
  if (pick.state !== 'checked') {
    await addAlert({ hotel_id: session.hotel_id, room_id: pick.id, type: 'Presence without check-in', details_json: `Room ${pick.number} presence detected but not checked-in` });
  }
}

export async function managerAddWalkin({ room_id, guest_name, price }) {
  const session = getSession(); if (!session) return null;
  return addWalkinBooking({ hotel_id: session.hotel_id, room_id, guest_name, price });
}

export async function managerMarkCheckin(room_id) {
  const session = getSession(); if (!session) return null;
  return markCheckedIn({ hotel_id: session.hotel_id, room_id });
}

export async function listAlerts() {
  const session = getSession(); if (!session) return [];
  const alerts = await loadAlerts();
  return alerts.filter(a => a.hotel_id === session.hotel_id).sort((a,b) => (a.created_at||'').localeCompare(b.created_at||''));
}

export async function resetDemo() { resetOverlays(); }
