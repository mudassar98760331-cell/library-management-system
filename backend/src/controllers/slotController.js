import pool from "../config/db.js";
import {
  quoteSlots,
  getSeatSlotAvailability,
  getSeatSlotOccupants,
} from "../services/pricing.js";

// GET /api/student/seats/:id/slots  (also used by admin)
// Returns the four access slots with per-seat availability. No prices —
// pricing is only revealed through the quote endpoint after selection.
export async function getSeatSlots(req, res) {
  const client = await pool.connect();
  try {
    const seatId = Number(req.params.id);
    if (!Number.isInteger(seatId) || seatId <= 0) {
      return res.status(400).json({ error: "Invalid seat id" });
    }

    const { rows: seatRows } = await client.query(
      `SELECT s.id, s.seat_number, s.status, r.name as room_name
       FROM seats s JOIN rooms r ON s.room_id = r.id WHERE s.id = $1`,
      [seatId]
    );
    if (seatRows.length === 0) {
      return res.status(404).json({ error: "Seat not found" });
    }
    const seat = seatRows[0];
    if (seat.status === "disabled") {
      return res.status(400).json({ error: "Seat is disabled" });
    }

    const slots = await getSeatSlotAvailability(client, seatId);

    // Admins additionally see WHO currently holds each booked slot
    // (student-facing responses only show "Booked").
    if (req.user?.role === "admin") {
      const bookedSlotIds = slots
        .filter((s) => s.status === "booked")
        .map((s) => s.id);
      const occupants = await getSeatSlotOccupants(client, seatId, bookedSlotIds);
      for (const slot of slots) {
        const name = occupants.get(slot.id);
        if (name) slot.booked_by = name;
      }
    }

    res.json({
      seat: {
        id: seat.id,
        seat_number: seat.seat_number,
        room_name: seat.room_name,
      },
      slots,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
}

// POST /api/student/slots/quote  (also used by admin)
// Backend-calculated final price for a slot selection. The client never
// supplies or influences the amount — it only sends slot ids.
export async function quoteSlotPrice(req, res) {
  const client = await pool.connect();
  try {
    const result = await quoteSlots(req.body?.slot_ids, client);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    res.json({
      price: result.price,
      slots: result.slots.map((s) => ({
        id: s.id,
        slot_number: s.slot_number,
        name: s.name,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
}

// GET /api/admin/slots — admin slot & pricing management (slots + combos).
export async function getSlotPricing(_req, res) {
  try {
    const [slotsRes, combosRes] = await Promise.all([
      pool.query(
        "SELECT id, slot_number, name, start_minute, end_minute, price, is_active FROM slots ORDER BY slot_number"
      ),
      pool.query(
        `SELECT c.id, c.slots_key, c.price, c.is_active, c.created_at
         FROM slot_combo_prices c ORDER BY c.slots_key`
      ),
    ]);

    // Decorate each combo with human-readable slot labels (e.g. "Slot 1 + Slot 2").
    const { rows: slotRows } = await pool.query(
      "SELECT slot_number, name FROM slots ORDER BY slot_number"
    );
    const byNumber = new Map(slotRows.map((s) => [s.slot_number, s.name]));
    const combos = combosRes.rows.map((c) => {
      const numbers = c.slots_key.split("+").map(Number);
      return {
        ...c,
        slot_numbers: numbers,
        label: numbers.map((n) => `Slot ${n}`).join(" + "),
        slots: numbers.map((n) => ({
          slot_number: n,
          name: byNumber.get(n) || `Slot ${n}`,
        })),
      };
    });

    res.json({ slots: slotsRes.rows, combos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

// PUT /api/admin/slots/:id — admin changes an individual slot price/status.
export async function updateSlot(req, res) {
  try {
    const slotId = Number(req.params.id);
    if (!Number.isInteger(slotId) || slotId <= 0) {
      return res.status(400).json({ error: "Invalid slot id" });
    }

    const { price, is_active } = req.body || {};
    if (price === undefined && is_active === undefined) {
      return res.status(400).json({ error: "price or is_active is required" });
    }

    const updates = [];
    const values = [];
    if (price !== undefined) {
      const priceNum = Number(price);
      if (!Number.isInteger(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: "price must be a non-negative integer" });
      }
      values.push(priceNum);
      updates.push(`price = $${values.length}`);
    }
    if (is_active !== undefined) {
      if (typeof is_active !== "boolean") {
        return res.status(400).json({ error: "is_active must be a boolean" });
      }
      values.push(is_active);
      updates.push(`is_active = $${values.length}`);
    }
    values.push(slotId);

    const { rows } = await pool.query(
      `UPDATE slots SET ${updates.join(", ")} WHERE id = $${values.length}
       RETURNING id, slot_number, name, start_minute, end_minute, price, is_active`,
      values
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Slot not found" });
    }
    res.json({ slot: rows[0], message: "Slot pricing updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

// PUT /api/admin/slot-combos/:id — admin changes a combination price.
export async function updateSlotCombo(req, res) {
  try {
    const comboId = Number(req.params.id);
    if (!Number.isInteger(comboId) || comboId <= 0) {
      return res.status(400).json({ error: "Invalid combination id" });
    }

    const { price, is_active } = req.body || {};
    if (price === undefined && is_active === undefined) {
      return res.status(400).json({ error: "price or is_active is required" });
    }

    const updates = [];
    const values = [];
    if (price !== undefined) {
      const priceNum = Number(price);
      if (!Number.isInteger(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: "price must be a non-negative integer" });
      }
      values.push(priceNum);
      updates.push(`price = $${values.length}`);
    }
    if (is_active !== undefined) {
      if (typeof is_active !== "boolean") {
        return res.status(400).json({ error: "is_active must be a boolean" });
      }
      values.push(is_active);
      updates.push(`is_active = $${values.length}`);
    }
    values.push(comboId);

    const { rows } = await pool.query(
      `UPDATE slot_combo_prices SET ${updates.join(", ")} WHERE id = $${values.length}
       RETURNING id, slots_key, price, is_active`,
      values
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Combination not found" });
    }
    res.json({ combo: rows[0], message: "Combination pricing updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
