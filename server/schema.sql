-- InnSync demo schema
create table if not exists hotels (
  id uuid primary key,
  name text not null,
  timezone text,
  address text
);

create table if not exists rooms (
  id uuid primary key,
  hotel_id uuid references hotels(id),
  number text,
  floor int,
  type text,
  rate int
);

create table if not exists devices (
  id uuid primary key,
  hotel_id uuid references hotels(id),
  device_uid text unique,
  model text,
  status text
);

create table if not exists room_devices (
  room_id uuid references rooms(id),
  device_id uuid references devices(id),
  bound_at timestamptz,
  active boolean,
  primary key (room_id, device_id)
);

create table if not exists users (
  id uuid primary key,
  email text unique,
  password_demo text,
  status text
);

create table if not exists hotel_users (
  hotel_id uuid references hotels(id),
  user_id uuid references users(id),
  role text,
  primary key (hotel_id, user_id)
);

create table if not exists bookings (
  id uuid primary key,
  hotel_id uuid references hotels(id),
  room_id uuid references rooms(id),
  -- category-level bookings (OTA) can keep room_id null until check-in
  category text,
  channel text,
  guest_name text,
  checkin_ts timestamptz,
  checkout_ts timestamptz,
  status text,
  price int,
  currency text
);

-- migrations for existing databases
alter table bookings add column if not exists category text;

create table if not exists stays (
  id uuid primary key,
  hotel_id uuid references hotels(id),
  room_id uuid references rooms(id),
  booking_id uuid references bookings(id),
  source text,
  checkin_ts timestamptz,
  checkout_ts timestamptz
);

create table if not exists occupancy_events (
  id uuid primary key,
  hotel_id uuid references hotels(id),
  device_id uuid references devices(id),
  room_id uuid references rooms(id),
  event_ts timestamptz,
  event_type text,
  payload_json text
);

create table if not exists alerts (
  id uuid primary key,
  hotel_id uuid references hotels(id),
  room_id uuid references rooms(id),
  type text,
  details_json text,
  severity text,
  created_at timestamptz,
  resolved_at timestamptz
);

create table if not exists payments (
  id uuid primary key,
  hotel_id uuid references hotels(id),
  booking_id uuid references bookings(id),
  amount int,
  method text,
  received_ts timestamptz,
  reference text
);

-- PMS additions: categories and sensors to support category-level bookings and occupancy
create table if not exists categories (
  id uuid primary key,
  hotel_id uuid references hotels(id),
  name text,
  description text,
  unique (hotel_id, name)
);

create table if not exists sensors (
  id uuid primary key,
  hotel_id uuid references hotels(id),
  room_id uuid references rooms(id),
  detected_occupancy boolean,
  last_updated timestamptz
);

-- Helpful indexes
create index if not exists idx_rooms_hotel_type on rooms(hotel_id, type);
create index if not exists idx_bookings_hotel_status on bookings(hotel_id, status);
create index if not exists idx_bookings_checkin on bookings(checkin_ts);
create index if not exists idx_bookings_checkout on bookings(checkout_ts);
create index if not exists idx_sensors_room on sensors(room_id);
alter table sensors add constraint sensors_room_unique unique (room_id);
