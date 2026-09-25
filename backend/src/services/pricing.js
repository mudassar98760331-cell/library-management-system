import pool from "../config/db.js";

// Canonical key for a set of slot numbers, e.g. [2,1] -> "1+2".
// Used to look up admin-configured combination prices.
export function canonicalSlotsKey(slotNumbers) {
  return [...new Set(slotNumbers.map(Number))].sort((a, b) => a - b).join("+");
}

// Parses/validates raw client input. Returns a sorted, unique array of
// positive integers or null when the input is not a usable slot selection.
export function parseSlotIds(raw) {
  let ids = raw;
  if (typeof raw === "string") {
    try {
      ids = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 4) return null;
  const numbers = [];
  for (const value of ids) {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) return null;
    numbers.push(n);
  }
  const unique = [...new Set(numbers)];
  if (unique.length !== numbers.length) return null;
  return unique.sort((a, b) => a - b);
}

// Loads the requested slots (must exist and be active), ordered by slot_number.
export async function resolveSlots(client, slotIds) {
  const { rows } = await client.query(
    "SELECT id, slot_number, name, start_minute, end_minute, price FROM slots WHERE id = ANY($1::int[]) AND is_active = true ORDER BY slot_number",
    [slotIds]
  );
  if (rows.length !== slotIds.length) return null;
  return rows;
}

// THE pricing rule: an explicit combination price always wins over summing
// individual prices; otherwise fall back to the sum of individual prices.
export async function computeSlotsPrice(client, slots) {
  const key = canonicalSlotsKey(slots.map((s) => s.slot_number));
  const { rows } = await client.query(
    "SELECT price FROM slot_combo_prices WHERE slots_key = $1 AND is_active = true",
    [key]
  );
  if (rows.length > 0) return rows[0].price;
  return slots.reduce((sum, s) => sum + Number(s.price), 0);
}

// Validates a raw slot selection and returns { ok, error?, slots?, price? }.
// The price is ALWAYS computed here on the server — never trusted from the client.
export async function quoteSlots(rawSlotIds, client = pool) {
  const slotIds = parseSlotIds(rawSlotIds);
  if (!slotIds) {
    return { ok: false, error: "Select between 1 and 4 valid slots" };
  }
  const slots = await resolveSlots(client, slotIds);
  if (!slots) {
    return { ok: false, error: "One or more selected slots are not available" };
  }
  const price = await computeSlotsPrice(client, slots);
  return { ok: true, slotIds, slots, price };
}

// Per-seat slot availability. A slot is 'booked' for a seat when any active or
// pending non-expired booking on that seat occupies it:
//   - slot-based bookings occupy exactly their booking_slots rows
//   - legacy plan-based bookings occupy their fee-plan time range (or 24h)
// Slots are mutually non-overlapping, so this gives independent per-slot state
// and never marks a whole seat unavailable because one slot is taken.
export async function getSeatSlotAvailability(client, seatId) {
  const { rows } = await client.query(
    `SELECT sl.id, sl.slot_number, sl.name, sl.start_minute, sl.end_minute,
            CASE WHEN EXISTS (
              SELECT 1 FROM bookings b
              LEFT JOIN fee_plans fp ON b.fee_plan_id = fp.id
              WHERE b.seat_id = $1
                AND b.status IN ('active', 'pending')
                AND (b.booking_end IS NULL OR b.booking_end >= CURRENT_DATE)
                AND (
                  EXISTS (
                    SELECT 1 FROM booking_slots bs
                    WHERE bs.booking_id = b.id AND bs.slot_id = sl.id
                  )
                  OR (
                    NOT EXISTS (
                      SELECT 1 FROM booking_slots bs WHERE bs.booking_id = b.id
                    )
                    AND (
                      fp.is_24_hour = true
                      OR (sl.start_minute < fp.end_minute AND fp.start_minute < sl.end_minute)
                    )
                  )
                )
            ) THEN 'booked' ELSE 'available' END as status
     FROM slots sl
     WHERE sl.is_active = true
     ORDER BY sl.slot_number`,
    [seatId]
  );
  return rows;
}

// True when at least one slot on the seat is still selectable.
export function hasAvailableSlot(availability) {
  return availability.some((s) => s.status === "available");
}
