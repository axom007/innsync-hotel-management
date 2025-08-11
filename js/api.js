let API_BASE = (window.INNSYNC_API_BASE || localStorage.getItem('INNSYNC_API_BASE') || '').replace(/\/$/, '') || '';
if (!API_BASE && location.protocol === 'file:') {
  // default to common dev port if opened from file://
  API_BASE = 'http://localhost:8080';
}

async function http(path, init) {
  const doFetch = async (base) => {
    const res = await fetch(base + path, { ...init, headers: { 'Content-Type': 'application/json', ...(init&&init.headers||{}) } });
    if (!res.ok) throw new Error(await res.text());
    return res;
  };
  try {
    const res = await doFetch(API_BASE);
    return res.json();
  } catch (e) {
    // Fallback probes if base is not set or unreachable
    const candidates = [];
    if (!API_BASE || API_BASE.startsWith('http://localhost')) {
      candidates.push('http://localhost:8091', 'http://localhost:8090', 'http://localhost:8080');
    }
    for (const c of candidates) {
      try {
        const res = await doFetch(c);
        API_BASE = c; localStorage.setItem('INNSYNC_API_BASE', c);
        return res.json();
      } catch {}
    }
    throw e;
  }
}

export async function apiLogin(email, password) { return http('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) }); }
export async function apiMetrics(hotel_id) { return http(`/api/metrics?hotel_id=${encodeURIComponent(hotel_id)}`); }
export async function apiRooms(hotel_id) { return http(`/api/rooms?hotel_id=${encodeURIComponent(hotel_id)}`); }
export async function apiRoomsState(hotel_id) { return http(`/api/rooms/state?hotel_id=${encodeURIComponent(hotel_id)}`); }
export async function apiDevices(hotel_id) { return http(`/api/devices?hotel_id=${encodeURIComponent(hotel_id)}`); }
export async function apiAlerts(hotel_id) { return http(`/api/alerts?hotel_id=${encodeURIComponent(hotel_id)}`); }
export async function apiWalkin(hotel_id, room_id, guest_name, price) { return http('/api/bookings/walkin', { method: 'POST', body: JSON.stringify({ hotel_id, room_id, guest_name, price }) }); }
export async function apiCheckin(hotel_id, room_id) { return http('/api/stays/checkin', { method: 'POST', body: JSON.stringify({ hotel_id, room_id }) }); }
export async function apiIngestPresence(hotel_id, room_id, device_id) { return http('/api/ingest/occupancy', { method: 'POST', body: JSON.stringify({ hotel_id, room_id, device_id, event_type: 'presence' }) }); }
export async function apiBookings(hotel_id, status) { const s = status? `&status=${encodeURIComponent(status)}`: ''; return http(`/api/bookings?hotel_id=${encodeURIComponent(hotel_id)}${s}`); }
export async function apiBookingsReady(hotel_id) { return http(`/api/bookings?hotel_id=${encodeURIComponent(hotel_id)}&ready=true`); }
export async function apiRoomsAvailable(hotel_id, category) { const c = category? `&category=${encodeURIComponent(category)}`: ''; return http(`/api/rooms/available?hotel_id=${encodeURIComponent(hotel_id)}${c}`); }
export async function apiOtaBooking(hotel_id, category, check_in_date, check_out_date, guest_name, price) { return http('/api/bookings/ota', { method: 'POST', body: JSON.stringify({ hotel_id, category, check_in_date, check_out_date, guest_name, price }) }); }
export async function apiBookingCheckin(booking_id, hotel_id, room_id) { return http(`/api/bookings/${encodeURIComponent(booking_id)}/checkin`, { method: 'POST', body: JSON.stringify({ hotel_id, room_id }) }); }
export async function apiResolveAlert(id) { return http(`/api/alerts/${encodeURIComponent(id)}/resolve`, { method: 'POST' }); }
export async function apiWalkinByCategory(hotel_id, category, guest_name, price) { return http('/api/bookings/walkin-category', { method: 'POST', body: JSON.stringify({ hotel_id, category, guest_name, price }) }); }
export async function apiOtaBookingRandom(hotel_id) { return http('/api/bookings/ota/random', { method: 'POST', body: JSON.stringify({ hotel_id }) }); }
export async function apiResetHotel(hotel_id) { return http('/api/reset/hotel', { method: 'POST', body: JSON.stringify({ hotel_id }) }); }
export async function apiSimulateFlagVacant(hotel_id) { return http('/api/simulate/flag-vacant', { method: 'POST', body: JSON.stringify({ hotel_id }) }); }
