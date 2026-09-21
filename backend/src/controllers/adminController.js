import crypto from "crypto";
import bcrypt from "bcryptjs";
import pool from "../config/db.js";

export async function getDashboard(_req, res) {
  try {
    const { rows: students } = await pool.query(
      "SELECT COUNT(*) FROM users WHERE role = 'student'"
    );
    const { rows: totalSeats } = await pool.query("SELECT COUNT(*) FROM seats");
    const { rows: availableSeats } = await pool.query(
      "SELECT COUNT(*) FROM seats WHERE status = 'available'"
    );
    const { rows: bookedSeats } = await pool.query(
      "SELECT COUNT(*) FROM seats WHERE status = 'booked'"
    );
    const { rows: disabledSeats } = await pool.query(
      "SELECT COUNT(*) FROM seats WHERE status = 'disabled'"
    );
    const { rows: activeMemberships } = await pool.query(
      "SELECT COUNT(*) FROM memberships WHERE status = 'active'"
    );
    const { rows: pendingPayments } = await pool.query(
      "SELECT COUNT(*) FROM payments WHERE status = 'pending'"
    );
    const { rows: revenue } = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'"
    );
    const { rows: cashCollection } = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_type = 'offline_cash' AND status = 'completed'"
    );
    const { rows: upiCollection } = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_type IN ('online', 'offline_upi') AND status = 'completed'"
    );

    const { rows: recentPayments } = await pool.query(
      `SELECT p.id, p.amount, p.status, p.utr_number, p.created_at,
              u.name as user_name
       FROM payments p
       JOIN users u ON p.user_id = u.id
       ORDER BY p.created_at DESC
       LIMIT 5`
    );

    res.json({
      totalStudents: parseInt(students[0].count),
      totalSeats: parseInt(totalSeats[0].count),
      availableSeats: parseInt(availableSeats[0].count),
      bookedSeats: parseInt(bookedSeats[0].count),
      disabledSeats: parseInt(disabledSeats[0].count),
      activeMemberships: parseInt(activeMemberships[0].count),
      pendingPayments: parseInt(pendingPayments[0].count),
      totalRevenue: parseInt(revenue[0].total),
      cashCollection: parseInt(cashCollection[0].total),
      upiCollection: parseInt(upiCollection[0].total),
      recentPayments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getStudents(_req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at, u.is_active,
        latest_m.status as membership_status, latest_m.plan_name, latest_m.membership_expiry,
        s.seat_number as current_seat, s.id as seat_id, r.name as current_room,
        b.id as booking_id, b.booking_source
       FROM users u
       LEFT JOIN LATERAL (
         SELECT m.status, fp.name as plan_name, m.end_date as membership_expiry
         FROM memberships m
         LEFT JOIN fee_plans fp ON m.fee_plan_id = fp.id
         WHERE m.user_id = u.id
         ORDER BY m.created_at DESC
         LIMIT 1
       ) latest_m ON true
       LEFT JOIN bookings b ON u.id = b.user_id AND b.status = 'active'
       LEFT JOIN seats s ON b.seat_id = s.id
       LEFT JOIN rooms r ON s.room_id = r.id
       WHERE u.role = 'student'
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getSeats(_req, res) {
  try {
    const { rows } = await pool.query(
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
              u.name as occupied_by, b.user_id as booked_by,
              b.id as booking_id, b.booking_source,
              fp.name as fee_plan_name, fp.start_minute, fp.end_minute, fp.is_24_hour,
              b.booking_start, b.booking_end,
              p.amount as payment_amount, p.payment_mode, p.status as payment_status, p.payment_type
       FROM seats s
       JOIN rooms r ON s.room_id = r.id
       LEFT JOIN seat_layouts sl ON s.id = sl.seat_id
       LEFT JOIN bookings b ON s.id = b.seat_id AND b.status = 'active'
       LEFT JOIN memberships m ON b.user_id = m.user_id AND b.fee_plan_id = m.fee_plan_id
         AND m.status IN ('active', 'pending') AND m.end_date >= CURRENT_DATE
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN fee_plans fp ON b.fee_plan_id = fp.id
       LEFT JOIN payments p ON b.user_id = p.user_id AND b.fee_plan_id = p.membership_id
         AND p.status = 'completed'
       ORDER BY r.name, sl.sort_order, s.seat_number`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function updateSeatStatus(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["available", "reserved", "disabled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be 'available', 'reserved', or 'disabled'." });
    }

    await client.query("BEGIN");

    const { rows: seatRows } = await client.query(
      "SELECT * FROM seats WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (seatRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Seat not found" });
    }

    if (status === "disabled") {
      await client.query(
        "UPDATE bookings SET status = 'cancelled' WHERE seat_id = $1 AND status = 'active'",
        [id]
      );
    }

    await client.query("UPDATE seats SET status = $1 WHERE id = $2", [status, id]);

    await client.query("COMMIT");

    const { rows } = await pool.query(
      `SELECT s.id, s.seat_number, s.room_id, r.name as room_name, s.status,
              sl.position, sl.sort_order
       FROM seats s
       JOIN rooms r ON s.room_id = r.id
       LEFT JOIN seat_layouts sl ON s.id = sl.seat_id
       WHERE s.id = $1`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
}

export async function getPayments(_req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, u.name as user_name, u.email as user_email,
        fp.name as plan_name, b.booking_source
       FROM payments p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN memberships m ON p.membership_id = m.id
       LEFT JOIN fee_plans fp ON m.fee_plan_id = fp.id
       LEFT JOIN bookings b ON m.user_id = b.user_id AND m.fee_plan_id = b.fee_plan_id AND b.status = 'active'
       ORDER BY p.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function approvePayment(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const { rows: paymentRows } = await client.query(
      "SELECT * FROM payments WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (paymentRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Payment not found" });
    }

    const payment = paymentRows[0];
    if (payment.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Payment is not pending" });
    }

    await client.query(
      "UPDATE payments SET status = 'completed' WHERE id = $1",
      [id]
    );

    await client.query(
      "UPDATE memberships SET status = 'active' WHERE id = $1",
      [payment.membership_id]
    );

    await client.query(
      "INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)",
      [
        payment.user_id,
        "Payment Approved",
        `Your payment of ₹${payment.amount} has been approved. Your membership is now active.`,
      ]
    );

    await client.query("COMMIT");

    res.json({ message: "Payment approved and membership activated" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
}

export async function rejectPayment(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await client.query("BEGIN");

    const { rows: paymentRows } = await client.query(
      "SELECT * FROM payments WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (paymentRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Payment not found" });
    }

    if (paymentRows[0].status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Payment is not pending" });
    }

    await client.query(
      "UPDATE payments SET status = 'rejected', admin_note = $1 WHERE id = $2",
      [reason || "", id]
    );

    await client.query(
      "UPDATE memberships SET status = 'cancelled' WHERE id = $1",
      [paymentRows[0].membership_id]
    );

    // Cancel any active bookings associated with this membership's user and fee plan
    if (paymentRows[0].membership_id) {
      const { rows: memRows } = await client.query(
        "SELECT fee_plan_id FROM memberships WHERE id = $1",
        [paymentRows[0].membership_id]
      );
      if (memRows.length > 0) {
        const { rows: cancelled } = await client.query(
          `UPDATE bookings SET status = 'cancelled'
           WHERE user_id = $1 AND fee_plan_id = $2 AND status = 'active'
           RETURNING id, seat_id`,
          [paymentRows[0].user_id, memRows[0].fee_plan_id]
        );
        for (const cb of cancelled) {
          const { rows: remaining } = await client.query(
            "SELECT id FROM bookings WHERE seat_id = $1 AND status = 'active' AND id != $2",
            [cb.seat_id, cb.id]
          );
          if (remaining.length === 0) {
            await client.query("UPDATE seats SET status = 'available' WHERE id = $1", [cb.seat_id]);
          }
        }
      }
    }

    await client.query(
      "INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)",
      [
        paymentRows[0].user_id,
        "Payment Rejected",
        `Your payment has been rejected. ${reason || ""}`,
      ]
    );

    await client.query("COMMIT");

    res.json({ message: "Payment rejected" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
}

export async function createOfflineBooking(req, res) {
  const client = await pool.connect();
  try {
    const {
      student_email,
      student_name,
      phone,
      seat_id,
      fee_plan_id,
      amount,
      payment_method,
      payment_date,
      start_date,
      end_date,
      notes,
    } = req.body;

    if (!seat_id || !fee_plan_id || !amount || !payment_method) {
      return res.status(400).json({ error: "seat_id, fee_plan_id, amount, and payment_method are required" });
    }

    if (!student_email && !student_name) {
      return res.status(400).json({ error: "Either student_email or student_name is required" });
    }

    await client.query("BEGIN");

    let student;
    if (student_email) {
      const { rows } = await client.query(
        "SELECT * FROM users WHERE email = $1 AND role = 'student'",
        [student_email]
      );
      if (rows.length === 0) {
        const tempPassword = crypto.randomBytes(12).toString("base64url");
        const hash = await bcrypt.hash(tempPassword, 10);
        const { rows: newUser } = await client.query(
          "INSERT INTO users (name, email, password, phone, role) VALUES ($1, $2, $3, $4, 'student') RETURNING *",
          [student_name || student_email.split("@")[0], student_email, hash, phone || null]
        );
        student = newUser[0];
        console.log(`Created student ${student_email} with temporary password: ${tempPassword}`);
      } else {
        student = rows[0];
      }
    } else {
      const { rows } = await client.query(
        "SELECT * FROM users WHERE name = $1 AND phone = $2 AND role = 'student'",
        [student_name, phone]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Student not found. Provide student_email to create a new student." });
      }
      student = rows[0];
    }

    const { rows: activeMembership } = await client.query(
      "SELECT id FROM memberships WHERE user_id = $1 AND status IN ('active', 'pending') AND end_date >= CURRENT_DATE",
      [student.id]
    );
    if (activeMembership.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Student already has an active or pending membership" });
    }

    const { rows: feePlanRows } = await client.query(
      "SELECT * FROM fee_plans WHERE id = $1 AND is_active = true",
      [fee_plan_id]
    );
    if (feePlanRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Fee plan not found or inactive" });
    }
    const feePlan = feePlanRows[0];

    const { rows: seatRows } = await client.query(
      "SELECT * FROM seats WHERE id = $1 FOR UPDATE",
      [seat_id]
    );
    if (seatRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Seat not found" });
    }
    if (seatRows[0].status === "disabled") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Seat is disabled" });
    }

    const { rows: activeSeatBookings } = await client.query(
      `SELECT b.*, fp.start_minute, fp.end_minute, fp.is_24_hour
       FROM bookings b
       JOIN fee_plans fp ON b.fee_plan_id = fp.id
       WHERE b.seat_id = $1 AND b.status = 'active'`,
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

    const membershipStart = start_date || new Date();
    const membershipEnd = end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const { rows: membershipRows } = await client.query(
      `INSERT INTO memberships (user_id, fee_plan_id, status, start_date, end_date)
       VALUES ($1, $2, 'active', $3, $4) RETURNING *`,
      [student.id, fee_plan_id, membershipStart, membershipEnd]
    );

    const { rows: bookingRows } = await client.query(
      `INSERT INTO bookings (user_id, seat_id, fee_plan_id, booking_start, booking_end, status, booking_source)
       VALUES ($1, $2, $3, $4, $5, 'active', 'offline') RETURNING *`,
      [student.id, seat_id, fee_plan_id, membershipStart, membershipEnd]
    );

    await client.query(
      "UPDATE seats SET status = 'booked' WHERE id = $1 AND status = 'available'",
      [seat_id]
    );

    const paymentType = payment_method === "cash" ? "offline_cash" : payment_method === "upi" ? "offline_upi" : "offline_other";
    const { rows: paymentRows } = await client.query(
      `INSERT INTO payments (user_id, membership_id, amount, method, status, payment_type, payment_date, receipt_number, admin_id, admin_note, payment_mode, amount_paid)
       VALUES ($1, $2, $3, $4, 'completed', $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        student.id,
        membershipRows[0].id,
        amount,
        payment_method,
        paymentType,
        payment_date || new Date(),
        `REC-${Date.now()}`,
        req.user.id,
        notes || "",
        payment_method,
        amount,
      ]
    );

    const { rows: seatInfo } = await client.query(
      "SELECT s.seat_number, r.name as room_name FROM seats s JOIN rooms r ON s.room_id = r.id WHERE s.id = $1",
      [seat_id]
    );
    const seatInfoRow = seatInfo[0] || {};

    await client.query(
      "INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)",
      [
        student.id,
        "Offline Booking Created",
        `Offline booking created. Seat: ${seatInfoRow.seat_number || seatRows[0].seat_number}, Room: ${seatInfoRow.room_name || "N/A"}. Plan: ${feePlan.name}. Valid: ${new Date(membershipStart).toLocaleDateString("en-IN")} to ${new Date(membershipEnd).toLocaleDateString("en-IN")}.`,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      membership: membershipRows[0],
      booking: bookingRows[0],
      payment: paymentRows[0],
      message: "Offline booking created successfully",
    });
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
    const { id } = req.params;

    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT b.*, s.seat_number FROM bookings b JOIN seats s ON b.seat_id = s.id WHERE b.id = $1 FOR UPDATE",
      [id]
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = rows[0];
    if (booking.status !== "active") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Booking is not active" });
    }

    await client.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [id]);

    const { rows: remaining } = await client.query(
      "SELECT id FROM bookings WHERE seat_id = $1 AND status = 'active' AND id != $2",
      [booking.seat_id, id]
    );

    if (remaining.length === 0) {
      await client.query("UPDATE seats SET status = 'available' WHERE id = $1", [booking.seat_id]);
    }

    await client.query(
      "INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)",
      [booking.user_id, "Booking Cancelled", `Your booking for seat ${booking.seat_number} has been cancelled by admin.`]
    );

    await client.query("COMMIT");

    res.json({ message: "Booking cancelled and seat released" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
}

export async function getAvailableSeats(_req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.seat_number, s.status, r.name as room_name
       FROM seats s
       JOIN rooms r ON s.room_id = r.id
       WHERE s.status != 'disabled'
         AND NOT EXISTS (
           SELECT 1 FROM bookings b
           JOIN memberships m ON b.user_id = m.user_id AND b.fee_plan_id = m.fee_plan_id
           WHERE b.seat_id = s.id AND b.status = 'active'
             AND m.status IN ('active', 'pending') AND m.end_date >= CURRENT_DATE
         )
       ORDER BY r.name, s.seat_number`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function assignSeat(req, res) {
  const client = await pool.connect();
  try {
    const { student_id, seat_id } = req.body;

    if (!student_id || !seat_id) {
      return res.status(400).json({ error: "student_id and seat_id are required" });
    }

    await client.query("BEGIN");

    const { rows: studentRows } = await client.query(
      "SELECT * FROM users WHERE id = $1 AND role = 'student'",
      [student_id]
    );
    if (studentRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Student not found" });
    }

    const { rows: seatRows } = await client.query(
      "SELECT * FROM seats WHERE id = $1 FOR UPDATE",
      [seat_id]
    );
    if (seatRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Seat not found" });
    }
    if (seatRows[0].status === "disabled") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Seat is disabled" });
    }
    // Check if seat has active bookings with non-expired memberships
    const { rows: seatActiveBookings } = await client.query(
      `SELECT 1 FROM bookings b
       JOIN memberships m ON b.user_id = m.user_id AND b.fee_plan_id = m.fee_plan_id
       WHERE b.seat_id = $1 AND b.status = 'active'
         AND m.status IN ('active', 'pending') AND m.end_date >= CURRENT_DATE`,
      [seat_id]
    );
    if (seatActiveBookings.length >= 2) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Seat is full" });
    }

    // Cancel any expired bookings for this student and release their seats
    const { rows: expiredBookings } = await client.query(
      `UPDATE bookings SET status = 'cancelled'
       WHERE user_id = $1 AND status = 'active'
         AND (booking_end < CURRENT_DATE
           OR NOT EXISTS (
             SELECT 1 FROM memberships m
             WHERE m.user_id = bookings.user_id AND m.fee_plan_id = bookings.fee_plan_id
               AND m.status IN ('active', 'pending') AND m.end_date >= CURRENT_DATE
           ))
       RETURNING id, seat_id`,
      [student_id]
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

    const { rows: existingBooking } = await client.query(
      "SELECT b.*, s.seat_number FROM bookings b JOIN seats s ON b.seat_id = s.id WHERE b.user_id = $1 AND b.status = 'active'",
      [student_id]
    );

    let oldSeatId = null;
    let oldSeatNumber = null;
    let bookingId = null;

    if (existingBooking.length > 0) {
      oldSeatId = existingBooking[0].seat_id;
      oldSeatNumber = existingBooking[0].seat_number;
      bookingId = existingBooking[0].id;

      if (oldSeatId === seat_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Student is already assigned to this seat" });
      }

      await client.query(
        "UPDATE bookings SET seat_id = $1 WHERE id = $2",
        [seat_id, bookingId]
      );

      const { rows: remaining } = await client.query(
        "SELECT id FROM bookings WHERE seat_id = $1 AND status = 'active' AND id != $2",
        [oldSeatId, bookingId]
      );
      if (remaining.length === 0) {
        await client.query("UPDATE seats SET status = 'available' WHERE id = $1", [oldSeatId]);
      }
    } else {
      const { rows: membershipRows } = await client.query(
        "SELECT * FROM memberships WHERE user_id = $1 AND status IN ('active', 'pending') AND end_date >= CURRENT_DATE",
        [student_id]
      );
      if (membershipRows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Student has no valid membership. Create membership first." });
      }
      const membership = membershipRows[0];

      const { rows: activeSeatBookings } = await client.query(
        `SELECT b.*, fp.start_minute, fp.end_minute, fp.is_24_hour
         FROM bookings b
         JOIN fee_plans fp ON b.fee_plan_id = fp.id
         WHERE b.seat_id = $1 AND b.status = 'active'`,
        [seat_id]
      );

      const { rows: feePlanRows } = await client.query(
        "SELECT * FROM fee_plans WHERE id = $1",
        [membership.fee_plan_id]
      );
      const feePlan = feePlanRows[0];

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
          return res.status(400).json({ error: "Timing conflicts with existing booking on this seat" });
        }
      }

      bookingId = null;
      oldSeatId = null;
      oldSeatNumber = null;

      const { rows: newBooking } = await client.query(
        `INSERT INTO bookings (user_id, seat_id, fee_plan_id, booking_start, booking_end, status, booking_source)
         VALUES ($1, $2, $3, $4, $5, 'active', 'offline') RETURNING *`,
        [student_id, seat_id, membership.fee_plan_id, membership.start_date, membership.end_date]
      );
      bookingId = newBooking[0].id;
    }

    await client.query("UPDATE seats SET status = 'booked' WHERE id = $1", [seat_id]);

    await client.query(
      "INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)",
      [
        student_id,
        oldSeatId ? "Seat Changed" : "Seat Assigned",
        oldSeatId
          ? `Your seat has been changed from ${oldSeatNumber} to ${seatRows[0].seat_number}.`
          : `Seat ${seatRows[0].seat_number} has been assigned to you.`,
      ]
    );

    await client.query("COMMIT");

    const message = oldSeatId
      ? `Seat changed from ${oldSeatNumber} to ${seatRows[0].seat_number} successfully`
      : `Seat ${seatRows[0].seat_number} assigned successfully`;

    res.json({ message, old_seat: oldSeatNumber, new_seat: seatRows[0].seat_number, booking_id: bookingId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
}

export async function deleteStudent(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const { rows: studentRows } = await client.query(
      "SELECT * FROM users WHERE id = $1 AND role = 'student' FOR UPDATE",
      [id]
    );
    if (studentRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Student not found" });
    }

    const { rows: hasBookings } = await client.query(
      "SELECT COUNT(*) FROM bookings WHERE user_id = $1",
      [id]
    );
    const { rows: hasPayments } = await client.query(
      "SELECT COUNT(*) FROM payments WHERE user_id = $1",
      [id]
    );
    const { rows: hasMemberships } = await client.query(
      "SELECT COUNT(*) FROM memberships WHERE user_id = $1",
      [id]
    );

    const totalHistory =
      parseInt(hasBookings[0].count) +
      parseInt(hasPayments[0].count) +
      parseInt(hasMemberships[0].count);

    if (totalHistory > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "This student has booking/payment history and cannot be permanently deleted.",
        has_history: true,
      });
    }

    const { rows: activeBookings } = await client.query(
      "SELECT b.*, s.seat_number FROM bookings b JOIN seats s ON b.seat_id = s.id WHERE b.user_id = $1 AND b.status = 'active'",
      [id]
    );
    for (const booking of activeBookings) {
      await client.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [booking.id]);
      const { rows: remaining } = await client.query(
        "SELECT id FROM bookings WHERE seat_id = $1 AND status = 'active' AND id != $2",
        [booking.seat_id, booking.id]
      );
      if (remaining.length === 0) {
        await client.query("UPDATE seats SET status = 'available' WHERE id = $1", [booking.seat_id]);
      }
    }

    await client.query("DELETE FROM notifications WHERE user_id = $1", [id]);
    await client.query("DELETE FROM users WHERE id = $1", [id]);

    await client.query("COMMIT");

    res.json({ message: "Student deleted permanently" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
}

export async function getFeePlans(_req, res) {
  try {
    const { rows } = await pool.query("SELECT * FROM fee_plans ORDER BY start_minute");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function updateFeePlan(req, res) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== "boolean") {
      return res.status(400).json({ error: "is_active must be a boolean" });
    }

    const { rows } = await pool.query(
      "UPDATE fee_plans SET is_active = $1 WHERE id = $2 RETURNING *",
      [is_active, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Fee plan not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getPaymentSettings(_req, res) {
  try {
    const { rows } = await pool.query("SELECT * FROM payment_settings ORDER BY setting_key");
    const settings = {};
    for (const row of rows) {
      if (row.setting_key === "qr_image_url") settings.qr_code_url = row.setting_value;
      else if (row.setting_key === "receiver_name") settings.receiver_name = row.setting_value;
      else if (row.setting_key === "upi_id") settings.upi_id = row.setting_value;
      else if (row.setting_key === "upi_note") settings.note = row.setting_value;
    }
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function updatePaymentSettings(req, res) {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== "object") {
      return res.status(400).json({ error: "Settings object is required" });
    }

    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        "UPDATE payment_settings SET setting_value = $1 WHERE setting_key = $2",
        [String(value), key]
      );
    }

    const { rows } = await pool.query("SELECT * FROM payment_settings ORDER BY setting_key");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function uploadQRCode(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "QR image file is required" });
    }

    const qrUrl = "/uploads/screenshots/payment/active-qr.jpg";
    await pool.query(
      "UPDATE payment_settings SET setting_value = $1, updated_by = $2, updated_at = NOW() WHERE setting_key = 'qr_image_url'",
      [qrUrl, req.user.id]
    );

    const { rows } = await pool.query("SELECT * FROM payment_settings ORDER BY setting_key");
    const settings = {};
    for (const row of rows) {
      if (row.setting_key === "qr_image_url") settings.qr_code_url = row.setting_value;
      else if (row.setting_key === "receiver_name") settings.receiver_name = row.setting_value;
      else if (row.setting_key === "upi_id") settings.upi_id = row.setting_value;
      else if (row.setting_key === "upi_note") settings.note = row.setting_value;
    }
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function sendNotification(req, res) {
  try {
    const { user_id, title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required" });
    }

    if (user_id) {
      const { rows } = await pool.query(
        "INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3) RETURNING *",
        [user_id, title, message]
      );
      return res.status(201).json(rows[0]);
    }

    const { rows } = await pool.query(
      "INSERT INTO notifications (user_id, title, message) VALUES (NULL, $1, $2) RETURNING id, title, message, created_at",
      [title, message]
    );

    const { rows: count } = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'student'");
    res.status(201).json({ ...rows[0], message: `Notification sent to ${count[0].count} students` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getNotifications(_req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, message, created_at
       FROM notifications
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getLostFound(_req, res) {
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

export async function updateLostFound(req, res) {
  try {
    const { status } = req.body;
    if (!status || !["lost", "found", "returned"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    await pool.query("UPDATE lost_found SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.json({ message: "Item status updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function renewMembership(req, res) {
  const client = await pool.connect();
  try {
    const { student_id, fee_plan_id, amount, payment_method, admin_note } = req.body;

    if (!student_id || !fee_plan_id || !amount || !payment_method) {
      return res.status(400).json({ error: "student_id, fee_plan_id, amount, and payment_method are required" });
    }

    if (!["cash", "upi"].includes(payment_method)) {
      return res.status(400).json({ error: "payment_method must be 'cash' or 'upi'" });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    await client.query("BEGIN");

    const { rows: studentRows } = await client.query(
      "SELECT * FROM users WHERE id = $1 AND role = 'student'",
      [student_id]
    );
    if (studentRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Student not found" });
    }

    const { rows: activeMembership } = await client.query(
      "SELECT id FROM memberships WHERE user_id = $1 AND status IN ('active', 'pending') AND end_date >= CURRENT_DATE",
      [student_id]
    );
    if (activeMembership.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Student already has an active or pending membership" });
    }

    const { rows: planRows } = await client.query(
      "SELECT * FROM fee_plans WHERE id = $1 AND is_active = true",
      [fee_plan_id]
    );
    if (planRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Fee plan not found or inactive" });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const { rows: membershipRows } = await client.query(
      `INSERT INTO memberships (user_id, fee_plan_id, status, start_date, end_date)
       VALUES ($1, $2, 'active', $3, $4) RETURNING *`,
      [student_id, fee_plan_id, startDate, endDate]
    );

    // Find the student's previous seat from their most recent cancelled booking
    const { rows: prevBookingRows } = await client.query(
      `SELECT b.seat_id, s.seat_number, r.name as room_name
       FROM bookings b
       JOIN seats s ON b.seat_id = s.id
       JOIN rooms r ON s.room_id = r.id
       WHERE b.user_id = $1 AND b.status = 'cancelled'
       ORDER BY b.booked_at DESC LIMIT 1`,
      [student_id]
    );

    let newBooking = null;
    if (prevBookingRows.length > 0) {
      const prevSeat = prevBookingRows[0];

      // Check seat is still available for this timing
      const { rows: activeSeatBookings } = await client.query(
        `SELECT b.*, fp.start_minute, fp.end_minute, fp.is_24_hour
         FROM bookings b
         JOIN fee_plans fp ON b.fee_plan_id = fp.id
         WHERE b.seat_id = $1 AND b.status = 'active'`,
        [prevSeat.seat_id]
      );

      const { rows: planCheck } = await client.query(
        "SELECT * FROM fee_plans WHERE id = $1",
        [fee_plan_id]
      );
      const feePlan = planCheck[0];

      let seatAvailable = activeSeatBookings.length < 2;
      if (seatAvailable && activeSeatBookings.length === 1) {
        const existing = activeSeatBookings[0];
        const hasOverlap =
          existing.is_24_hour ||
          feePlan.is_24_hour ||
          (feePlan.start_minute < existing.end_minute && existing.start_minute < feePlan.end_minute);
        if (hasOverlap) seatAvailable = false;
      }

      if (seatAvailable) {
        const { rows: bookingRows } = await client.query(
          `INSERT INTO bookings (user_id, seat_id, fee_plan_id, booking_start, booking_end, status, booking_source)
           VALUES ($1, $2, $3, $4, $5, 'active', 'offline') RETURNING *`,
          [student_id, prevSeat.seat_id, fee_plan_id, startDate, endDate]
        );
        newBooking = bookingRows[0];
        await client.query("UPDATE seats SET status = 'booked' WHERE id = $1", [prevSeat.seat_id]);
      }
    }

    const paymentType = payment_method === "cash" ? "offline_cash" : "offline_upi";
    const { rows: paymentRows } = await client.query(
      `INSERT INTO payments (user_id, membership_id, amount, method, status, payment_type, payment_date, receipt_number, admin_id, admin_note, payment_mode, amount_paid)
       VALUES ($1, $2, $3, $4, 'completed', $5, CURRENT_DATE, $6, $7, $8, $9, $10) RETURNING *`,
      [
        student_id,
        membershipRows[0].id,
        amount,
        payment_method,
        paymentType,
        `REC-${Date.now()}`,
        req.user.id,
        admin_note || "",
        payment_method,
        amount,
      ]
    );

    const seatLabel = newBooking
      ? (() => {
          const idx = prevBookingRows.findIndex((r) => r.seat_id === newBooking.seat_id);
          return idx >= 0 ? `${prevBookingRows[idx].seat_number}, ${prevBookingRows[idx].room_name}` : "";
        })()
      : "";

    await client.query(
      "INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)",
      [
        student_id,
        "Membership Renewed",
        `Your membership has been renewed successfully. Valid until ${endDate.toLocaleDateString("en-IN")}.${seatLabel ? ` Seat: ${seatLabel}.` : ""}`,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      membership: membershipRows[0],
      payment: paymentRows[0],
      booking: newBooking,
      message: "Membership renewed successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
}

export async function getReports(_req, res) {
  try {
    const { rows: totalStudents } = await pool.query(
      "SELECT COUNT(*) FROM users WHERE role = 'student'"
    );
    const { rows: totalSeats } = await pool.query("SELECT COUNT(*) FROM seats");
    const { rows: activeMemberships } = await pool.query(
      "SELECT COUNT(*) FROM memberships WHERE status = 'active'"
    );
    const { rows: totalRevenue } = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'"
    );
    const { rows: totalBookings } = await pool.query(
      "SELECT COUNT(*) FROM bookings WHERE status = 'active'"
    );
    const { rows: totalPayments } = await pool.query(
      "SELECT COUNT(*) FROM payments WHERE status = 'completed'"
    );
    const { rows: totalLostFound } = await pool.query("SELECT COUNT(*) FROM lost_found");

    res.json({
      totalStudents: parseInt(totalStudents[0].count),
      totalSeats: parseInt(totalSeats[0].count),
      activeMemberships: parseInt(activeMemberships[0].count),
      totalRevenue: parseInt(totalRevenue[0].total),
      totalBookings: parseInt(totalBookings[0].count),
      totalPayments: parseInt(totalPayments[0].count),
      totalLostFound: parseInt(totalLostFound[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
