import pool from "../config/db.js";
import bcrypt from "bcryptjs";

export async function getDashboard(req, res) {
  try {
    const userId = req.user.id;

    const { rows: user } = await pool.query(
      "SELECT id, name, email, phone FROM users WHERE id = $1",
      [userId]
    );

    const { rows: memberships } = await pool.query(
      `SELECT m.*, fp.name as plan_name
       FROM memberships m
       JOIN fee_plans fp ON m.fee_plan_id = fp.id
       WHERE m.user_id = $1
       ORDER BY m.created_at DESC LIMIT 1`,
      [userId]
    );

    const { rows: bookings } = await pool.query(
      `SELECT b.*, s.seat_number, r.name as room_name,
              fp.name as plan_name, fp.start_minute, fp.end_minute, fp.is_24_hour
       FROM bookings b
       JOIN seats s ON b.seat_id = s.id
       JOIN rooms r ON s.room_id = r.id
       LEFT JOIN fee_plans fp ON b.fee_plan_id = fp.id
       WHERE b.user_id = $1 AND b.status = 'active'
       ORDER BY b.booked_at DESC LIMIT 1`,
      [userId]
    );

    const { rows: payments } = await pool.query(
      `SELECT p.*, fp.name as plan_name
       FROM payments p
       LEFT JOIN memberships m ON p.membership_id = m.id
       LEFT JOIN fee_plans fp ON m.fee_plan_id = fp.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC LIMIT 1`,
      [userId]
    );

    const { rows: notifications } = await pool.query(
      "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false",
      [userId]
    );

    const membership = memberships[0] || null;
    const isActive = membership && membership.status === 'active' && new Date(membership.end_date) >= new Date();

    res.json({
      user: user[0],
      membership: isActive ? membership : null,
      expired_membership: !isActive && membership ? membership : null,
      booking: bookings[0] || null,
      payment: payments[0] || null,
      unreadNotifications: parseInt(notifications[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getFeePlans(req, res) {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM fee_plans WHERE is_active = true ORDER BY start_minute"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function purchaseMembership(req, res) {
  try {
    const userId = req.user.id;
    const { fee_plan_id } = req.body;

    if (!fee_plan_id) {
      return res.status(400).json({ error: "Fee plan ID is required" });
    }

    const { rows: planRows } = await pool.query(
      "SELECT * FROM fee_plans WHERE id = $1 AND is_active = true",
      [fee_plan_id]
    );
    if (planRows.length === 0) {
      return res.status(404).json({ error: "Fee plan not found or inactive" });
    }

    const { rows: activeMembership } = await pool.query(
      "SELECT id FROM memberships WHERE user_id = $1 AND status IN ('active', 'pending') AND end_date >= CURRENT_DATE",
      [userId]
    );
    if (activeMembership.length > 0) {
      return res.status(400).json({ error: "You already have an active or pending membership" });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const { rows: membershipRows } = await pool.query(
      `INSERT INTO memberships (user_id, fee_plan_id, status, start_date, end_date)
       VALUES ($1, $2, 'pending', $3, $4) RETURNING *`,
      [userId, fee_plan_id, startDate, endDate]
    );

    const { rows: paymentRows } = await pool.query(
      `INSERT INTO payments (user_id, membership_id, amount, method, status, payment_type)
       VALUES ($1, $2, $3, 'upi', 'pending', 'online') RETURNING *`,
      [userId, membershipRows[0].id, planRows[0].price]
    );

    res.status(201).json({
      membership: membershipRows[0],
      payment: paymentRows[0],
      message: "Payment submitted. Waiting for admin approval.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getSeats(req, res) {
  try {
    const { rows: seats } = await pool.query(
      `SELECT s.id, s.seat_number, s.room_id, r.name as room_name,
              CASE
                WHEN s.status = 'disabled' THEN 'disabled'
                WHEN s.status = 'reserved' THEN 'reserved'
                WHEN EXISTS (
                  SELECT 1 FROM bookings b
                  JOIN memberships m ON b.user_id = m.user_id AND b.fee_plan_id = m.fee_plan_id
                  WHERE b.seat_id = s.id AND b.status = 'active'
                    AND m.status IN ('active', 'pending') AND m.end_date >= CURRENT_DATE
                ) THEN 'booked'
                ELSE 'available'
              END as status,
              sl.position, sl.sort_order,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', b.id,
                    'user_id', b.user_id,
                    'fee_plan_id', b.fee_plan_id,
                    'booking_start', b.booking_start,
                    'booking_end', b.booking_end,
                    'user_name', u.name
                  )
                ) FILTER (WHERE b.status = 'active'),
                '[]'
              ) as current_bookings
       FROM seats s
       JOIN rooms r ON s.room_id = r.id
       LEFT JOIN seat_layouts sl ON s.id = sl.seat_id
       LEFT JOIN bookings b ON s.id = b.seat_id AND b.status = 'active'
       LEFT JOIN memberships m ON b.user_id = m.user_id AND b.fee_plan_id = m.fee_plan_id
         AND m.status IN ('active', 'pending') AND m.end_date >= CURRENT_DATE
       LEFT JOIN users u ON b.user_id = u.id
       GROUP BY s.id, s.seat_number, s.room_id, r.name, s.status, sl.position, sl.sort_order
       ORDER BY r.name, sl.sort_order, s.seat_number`
    );
    res.json(seats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function bookSeat(req, res) {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { seat_id, fee_plan_id } = req.body;

    if (!seat_id || !fee_plan_id) {
      return res.status(400).json({ error: "Seat ID and fee plan ID are required" });
    }

    await client.query("BEGIN");

    // Cancel any expired bookings for this user and release their seats
    const { rows: expiredBookings } = await client.query(
      `UPDATE bookings SET status = 'cancelled'
       WHERE user_id = $1 AND status = 'active' AND booking_end < CURRENT_DATE
       RETURNING id, seat_id`,
      [userId]
    );
    for (const eb of expiredBookings) {
      const { rows: remaining } = await client.query(
        "SELECT id FROM bookings WHERE seat_id = $1 AND status = 'active' AND id != $2",
        [eb.seat_id, eb.id]
      );
      if (remaining.length === 0) {
        await client.query("UPDATE seats SET status = 'available' WHERE id = $1", [eb.seat_id]);
      }
    }

    const { rows: planRows } = await client.query(
      "SELECT * FROM fee_plans WHERE id = $1 AND is_active = true",
      [fee_plan_id]
    );
    if (planRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Fee plan not found or inactive" });
    }
    const feePlan = planRows[0];

    // Accept both active and pending memberships (pending = just purchased, awaiting admin approval)
    const { rows: membershipRows } = await client.query(
      `SELECT * FROM memberships WHERE user_id = $1 AND fee_plan_id = $2 AND status IN ('active', 'pending') AND end_date >= CURRENT_DATE`,
      [userId, fee_plan_id]
    );
    if (membershipRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Valid membership with this fee plan is required. Please purchase a membership first." });
    }
    const membership = membershipRows[0];

    const { rows: existingBookings } = await client.query(
      "SELECT id FROM bookings WHERE user_id = $1 AND status = 'active'",
      [userId]
    );
    if (existingBookings.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "You already have an active booking" });
    }

    const { rows: seatRows } = await client.query(
      "SELECT * FROM seats WHERE id = $1 FOR UPDATE",
      [seat_id]
    );
    if (seatRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Seat not found" });
    }
    const seat = seatRows[0];

    if (seat.status === "disabled") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Seat is disabled" });
    }

    // Check for active bookings on this seat with non-expired memberships
    const { rows: activeSeatBookings } = await client.query(
      `SELECT b.*, fp.start_minute, fp.end_minute, fp.is_24_hour
       FROM bookings b
       JOIN fee_plans fp ON b.fee_plan_id = fp.id
       JOIN memberships m ON b.user_id = m.user_id AND b.fee_plan_id = m.fee_plan_id
       WHERE b.seat_id = $1 AND b.status = 'active'
         AND m.status IN ('active', 'pending') AND m.end_date >= CURRENT_DATE`,
      [seat_id]
    );

    if (activeSeatBookings.length >= 2) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Seat is full" });
    }

    if (activeSeatBookings.length === 1) {
      const existing = activeSeatBookings[0];
      const hasOverlap =
        existing.is_24_hour ||
        feePlan.is_24_hour ||
        (feePlan.start_minute < existing.end_minute && existing.start_minute < feePlan.end_minute);

      if (hasOverlap) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Timing conflicts with existing booking" });
      }
    }

    const { rows: bookingRows } = await client.query(
      `INSERT INTO bookings (user_id, seat_id, fee_plan_id, booking_start, booking_end, status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
      [userId, seat_id, fee_plan_id, membership.start_date, membership.end_date]
    );

    await client.query(
      "UPDATE seats SET status = 'booked' WHERE id = $1",
      [seat_id]
    );

    await client.query(
      "INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)",
      [userId, "Seat Booked", `You have successfully booked seat ${seat.seat_number}.`]
    );

    await client.query("COMMIT");

    res.status(201).json(bookingRows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
}

export async function cancelBooking(req, res) {
  const client = await pool.connect();
  try {
    const { booking_id } = req.params;
    const userId = req.user.id;

    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT * FROM bookings WHERE id = $1 AND user_id = $2 AND status = 'active' FOR UPDATE",
      [booking_id, userId]
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = rows[0];

    await client.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [booking_id]);

    const { rows: remaining } = await client.query(
      "SELECT id FROM bookings WHERE seat_id = $1 AND status = 'active' AND id != $2",
      [booking.seat_id, booking_id]
    );

    if (remaining.length === 0) {
      await client.query("UPDATE seats SET status = 'available' WHERE id = $1", [booking.seat_id]);
    }

    await client.query(
      "INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)",
      [userId, "Booking Cancelled", "Your seat booking has been cancelled."]
    );

    await client.query("COMMIT");

    res.json({ message: "Booking cancelled" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
}

export async function getPaymentHistory(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, fp.name as plan_name
       FROM payments p
       JOIN memberships m ON p.membership_id = m.id
       JOIN fee_plans fp ON m.fee_plan_id = fp.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function uploadScreenshot(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Screenshot file is required" });
    }

    const { payment_id } = req.body;
    if (!payment_id) {
      return res.status(400).json({ error: "Payment ID is required" });
    }

    const { rows: paymentRows } = await pool.query(
      "SELECT * FROM payments WHERE id = $1 AND user_id = $2",
      [payment_id, req.user.id]
    );
    if (paymentRows.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const screenshotUrl = `/uploads/screenshots/${req.file.filename}`;
    await pool.query(
      "UPDATE payments SET screenshot_url = $1 WHERE id = $2",
      [screenshotUrl, payment_id]
    );

    res.json({ message: "Screenshot uploaded", screenshot_url: screenshotUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getProfile(req, res) {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, phone, avatar, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function updateProfile(req, res) {
  try {
    const { name, phone } = req.body;
    const { rows } = await pool.query(
      "UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone) WHERE id = $3 RETURNING id, name, email, phone, role, avatar",
      [name, phone, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getNotifications(req, res) {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM notifications WHERE user_id = $1 OR user_id IS NULL ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function markNotificationRead(req, res) {
  try {
    await pool.query(
      "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    res.json({ message: "Marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function submitLostFound(req, res) {
  try {
    const { item_name, description, location, status } = req.body;
    if (!item_name) {
      return res.status(400).json({ error: "Item name is required" });
    }
    const { rows } = await pool.query(
      "INSERT INTO lost_found (user_id, item_name, description, location, status) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [req.user.id, item_name, description || "", location || "", status || "lost"]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getLostFound(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT lf.*, u.name as reported_by
       FROM lost_found lf
       JOIN users u ON lf.user_id = u.id
       ORDER BY lf.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;

    const { rows } = await pool.query("SELECT password FROM users WHERE id = $1", [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const valid = await bcrypt.compare(current_password, rows[0].password);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hash, req.user.id]);

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
