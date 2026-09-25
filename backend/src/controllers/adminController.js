import crypto from "crypto";
import bcrypt from "bcryptjs";
import pool from "../config/db.js";

// Strict YYYY-MM-DD calendar-date validation (rejects e.g. 2026-02-30 or 2026-13-01).
function isValidDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

// Formats a 'YYYY-MM-DD' string as a local calendar date (no timezone conversion),
// so 2026-10-10 can never render as 2026-10-09.
function formatDateString(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN");
}

export async function getDashboard(_req, res) {
  try {
    const [
      students, totalSeats, availableSeats, bookedSeats, disabledSeats,
      activeMemberships, pendingPayments, revenue, cashCollection, upiCollection, recentPayments,
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(DISTINCT u.id) FROM users u
         JOIN memberships m ON m.user_id = u.id
         WHERE u.role = 'student' AND m.status = 'active' AND m.end_date >= CURRENT_DATE`
      ),
      pool.query("SELECT COUNT(*) FROM seats"),
      pool.query("SELECT COUNT(*) FROM seats WHERE status = 'available'"),
      pool.query("SELECT COUNT(*) FROM seats WHERE status = 'booked'"),
      pool.query("SELECT COUNT(*) FROM seats WHERE status = 'disabled'"),
      pool.query("SELECT COUNT(*) FROM memberships WHERE status = 'active' AND end_date >= CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM payments WHERE status = 'pending'"),
      pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'"),
      pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_type = 'offline_cash' AND status = 'completed'"),
      pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_type IN ('online', 'offline_upi') AND status = 'completed'"),
      pool.query(
        `SELECT p.id, p.amount, p.status, p.utr_number, p.created_at, p.payment_type,
                u.name as user_name, u.phone as user_phone,
                (p.screenshot_data IS NOT NULL OR p.screenshot_url <> '') AS has_screenshot
         FROM payments p
         JOIN users u ON p.user_id = u.id
         ORDER BY p.created_at DESC
         LIMIT 5`
      ),
    ]);

    res.json({
      totalStudents: parseInt(students.rows[0].count),
      totalSeats: parseInt(totalSeats.rows[0].count),
      availableSeats: parseInt(availableSeats.rows[0].count),
      bookedSeats: parseInt(bookedSeats.rows[0].count),
      disabledSeats: parseInt(disabledSeats.rows[0].count),
      activeMemberships: parseInt(activeMemberships.rows[0].count),
      pendingPayments: parseInt(pendingPayments.rows[0].count),
      totalRevenue: parseInt(revenue.rows[0].total),
      cashCollection: parseInt(cashCollection.rows[0].total),
      upiCollection: parseInt(upiCollection.rows[0].total),
      recentPayments: recentPayments.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getStudents(_req, res) {
  try {
    // Returns ALL students (not only those with an active membership).
    // Membership status is computed from the DB date (end_date < CURRENT_DATE => expired),
    // so the UI can never show "Expired" for a future expiry or "Active" for a past one.
    // Booking prefers active > pending > latest; payment is the student's latest payment.
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at, u.is_active,
        TO_CHAR(u.created_at, 'DD FMMonth YYYY') as joining_date,
        COALESCE(u.password_set, true) as password_set,
        lm.status as membership_status, lm.plan_name,
        lm.membership_start, lm.membership_expiry,
        lm.membership_start_label, lm.membership_expiry_label, lm.membership_id,
        s.seat_number as current_seat, s.id as seat_id, r.name as current_room,
        b.id as booking_id, b.booking_source, b.status as booking_status,
        b.booked_at, b.booking_start, b.booking_end,
        lp.status as payment_status, lp.has_screenshot, lp.utr_number
       FROM users u
       LEFT JOIN LATERAL (
         SELECT CASE
                  WHEN m.end_date IS NOT NULL AND m.end_date < CURRENT_DATE THEN 'expired'
                  ELSE m.status
                END as status,
                fp.name as plan_name,
                m.start_date as membership_start, m.end_date as membership_expiry,
                TO_CHAR(m.start_date, 'DD FMMonth YYYY') as membership_start_label,
                TO_CHAR(m.end_date, 'DD FMMonth YYYY') as membership_expiry_label,
                m.id as membership_id
         FROM memberships m
         LEFT JOIN fee_plans fp ON m.fee_plan_id = fp.id
         WHERE m.user_id = u.id
         ORDER BY (m.status = 'active' AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)) DESC,
                  (m.status = 'pending' AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)) DESC,
                  m.created_at DESC, m.id DESC
         LIMIT 1
       ) lm ON true
       LEFT JOIN LATERAL (
         SELECT b2.*
         FROM bookings b2
         WHERE b2.user_id = u.id
         ORDER BY (b2.status = 'active') DESC, (b2.status = 'pending') DESC, b2.booked_at DESC, b2.id DESC
         LIMIT 1
       ) b ON true
       LEFT JOIN seats s ON b.seat_id = s.id
       LEFT JOIN rooms r ON s.room_id = r.id
       LEFT JOIN LATERAL (
         SELECT p.status, p.utr_number,
                (p.screenshot_data IS NOT NULL OR p.screenshot_url <> '') as has_screenshot
         FROM payments p
         WHERE p.user_id = u.id
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT 1
       ) lp ON true
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
                WHEN EXISTS (
                  SELECT 1 FROM bookings b
                  JOIN memberships m ON b.user_id = m.user_id AND b.fee_plan_id = m.fee_plan_id
                  WHERE b.seat_id = s.id AND b.status = 'active'
                    AND m.status IN ('active', 'pending') AND m.end_date >= CURRENT_DATE
                ) THEN 'booked'
                WHEN EXISTS (
                  SELECT 1 FROM bookings pb WHERE pb.seat_id = s.id AND pb.status = 'pending'
                ) THEN 'reserved'
                WHEN s.status = 'reserved' THEN 'reserved'
                ELSE 'available'
              END as status,
              sl.position, sl.sort_order,
              u.name as occupied_by, b.user_id as booked_by,
              b.id as booking_id, b.booking_source, b.status as booking_status,
              fp.name as fee_plan_name, fp.start_minute, fp.end_minute, fp.is_24_hour,
              b.booking_start, b.booking_end,
              p.amount as payment_amount, p.payment_mode, p.status as payment_status, p.payment_type
       FROM seats s
       JOIN rooms r ON s.room_id = r.id
       LEFT JOIN seat_layouts sl ON s.id = sl.seat_id
       LEFT JOIN LATERAL (
         SELECT b2.* FROM bookings b2
         WHERE b2.seat_id = s.id AND b2.status IN ('active', 'pending')
         ORDER BY (b2.status = 'active') DESC, b2.booked_at DESC, b2.id DESC
         LIMIT 1
       ) b ON true
       LEFT JOIN memberships m ON b.user_id = m.user_id AND b.fee_plan_id = m.fee_plan_id
         AND m.status IN ('active', 'pending') AND m.end_date >= CURRENT_DATE
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN fee_plans fp ON b.fee_plan_id = fp.id
       LEFT JOIN LATERAL (
         SELECT p2.amount, p2.payment_mode, p2.status, p2.payment_type
         FROM payments p2
         WHERE p2.membership_id = m.id
         ORDER BY p2.created_at DESC, p2.id DESC
         LIMIT 1
       ) p ON true
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

    if (status === "disabled" || status === "available") {
      await client.query(
        "UPDATE bookings SET status = 'cancelled' WHERE seat_id = $1 AND status IN ('active', 'pending')",
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
      `SELECT p.id, p.user_id, p.membership_id, p.amount, p.method, p.payment_type,
              p.utr_number, p.status, p.admin_note, p.payment_date, p.payment_mode,
              p.amount_paid, p.created_at, p.receipt_number,
              (p.screenshot_data IS NOT NULL OR p.screenshot_url <> '') AS has_screenshot,
              u.name as user_name, u.email as user_email, u.phone as user_phone,
              fp.name as plan_name, bs.booking_source
       FROM payments p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN memberships m ON p.membership_id = m.id
       LEFT JOIN fee_plans fp ON m.fee_plan_id = fp.id
       LEFT JOIN LATERAL (
         SELECT b.booking_source FROM bookings b
         WHERE b.user_id = p.user_id AND b.fee_plan_id = m.fee_plan_id
         ORDER BY (b.status = 'active') DESC, (b.status = 'pending') DESC, b.booked_at DESC
         LIMIT 1
       ) bs ON true
       ORDER BY p.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getPaymentScreenshot(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT p.screenshot_data, p.screenshot_mime_type, p.screenshot_url, u.email
       FROM payments p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }
    const payment = rows[0];
    if (payment.screenshot_data) {
      res.set("Content-Type", payment.screenshot_mime_type || "image/jpeg");
      res.set("Cache-Control", "private, max-age=300");
      return res.send(payment.screenshot_data);
    }
    if (payment.screenshot_url) {
      // Legacy disk-based screenshot (pre-BYTEA migration)
      return res.redirect(payment.screenshot_url);
    }
    return res.status(404).json({ error: "No screenshot uploaded for this payment" });
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

    // Activate the held booking(s) created by submitPayment and mark seats booked
    const { rows: pendingBookings } = await client.query(
      `UPDATE bookings SET status = 'active'
       WHERE user_id = $1 AND status = 'pending'
       RETURNING seat_id`,
      [payment.user_id]
    );
    for (const pb of pendingBookings) {
      await client.query(
        "UPDATE seats SET status = 'booked' WHERE id = $1 AND status = 'reserved'",
        [pb.seat_id]
      );
    }

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

    // Cancel any active or pending bookings associated with this membership's user and fee plan
    if (paymentRows[0].membership_id) {
      const { rows: memRows } = await client.query(
        "SELECT fee_plan_id FROM memberships WHERE id = $1",
        [paymentRows[0].membership_id]
      );
      if (memRows.length > 0) {
        const { rows: cancelled } = await client.query(
          `UPDATE bookings SET status = 'cancelled'
           WHERE user_id = $1 AND fee_plan_id = $2 AND status IN ('active', 'pending')
           RETURNING id, seat_id`,
          [paymentRows[0].user_id, memRows[0].fee_plan_id]
        );
        for (const cb of cancelled) {
          const { rows: remaining } = await client.query(
            "SELECT id FROM bookings WHERE seat_id = $1 AND status IN ('active', 'pending') AND id != $2",
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

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    const allowedMethods = new Set(["cash", "upi", "other"]);
    if (!allowedMethods.has(String(payment_method).toLowerCase())) {
      return res.status(400).json({ error: "payment_method must be cash, upi, or other" });
    }

    if (!student_email && !student_name) {
      return res.status(400).json({ error: "Either student_email or student_name is required" });
    }

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let normalizedEmail = null;
    if (student_email) {
      normalizedEmail = String(student_email).trim().toLowerCase();
      if (!EMAIL_RE.test(normalizedEmail)) {
        return res.status(400).json({ error: "Valid student email is required" });
      }
    }

    await client.query("BEGIN");

    let student;
    let createdNewStudent = false;
    // Never select or return password/otp material from this endpoint.
    const SAFE_USER_COLS = "id, name, email, phone, role, is_active, password_set";
    if (normalizedEmail) {
      const { rows: emailOwners } = await client.query(
        "SELECT id, role FROM users WHERE LOWER(email) = $1",
        [normalizedEmail]
      );
      if (emailOwners.length > 0 && emailOwners[0].role !== "student") {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "This email is already registered to an administrator account" });
      }
      if (emailOwners.length === 0) {
        if (!student_name || !String(student_name).trim()) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Student name is required to create a new student" });
        }
        // Admin never sets a password. Store an unusable random secret hash only;
        // password_set = false forces email OTP activation before login.
        const placeholderSecret = crypto.randomBytes(32).toString("hex");
        const hash = await bcrypt.hash(placeholderSecret, 10);
        const cleanPhone = phone ? String(phone).trim().replace(/\s+/g, "") : "";
        const { rows: newUser } = await client.query(
          `INSERT INTO users (name, email, password, phone, role, password_set)
           VALUES ($1, $2, $3, $4, 'student', false)
           RETURNING id, name, email, phone, role, is_active, password_set`,
          [String(student_name).trim(), normalizedEmail, hash, cleanPhone]
        );
        student = newUser[0];
        createdNewStudent = true;
      } else {
        const { rows } = await client.query(
          `SELECT ${SAFE_USER_COLS} FROM users WHERE id = $1`,
          [emailOwners[0].id]
        );
        student = rows[0];
      }
    } else {
      const { rows } = await client.query(
        `SELECT ${SAFE_USER_COLS} FROM users WHERE name = $1 AND phone = $2 AND role = 'student'`,
        [student_name, phone]
      );
      if (rows.length === 0) {
        await client.query("ROLLBACK");
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
       WHERE b.seat_id = $1 AND b.status IN ('active', 'pending')`,
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

    const needsActivation = createdNewStudent || student.password_set === false;
    const message = needsActivation
      ? "Offline booking created successfully. The student must activate their account and set a password using the registered email."
      : "Offline booking created successfully for the existing student.";

    // Safe subsets only — never expose password, hash, OTP, or screenshot bytes.
    const { screenshot_data, screenshot_mime_type, ...safePayment } = paymentRows[0];
    res.status(201).json({
      membership: membershipRows[0],
      booking: bookingRows[0],
      payment: {
        ...safePayment,
        utr_number: safePayment.utr_number || "",
        screenshot_url: safePayment.screenshot_url || "",
        has_screenshot: false,
      },
      created_new_student: createdNewStudent,
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        phone: student.phone,
        password_set: student.password_set,
      },
      seat: {
        id: Number(seat_id),
        seat_number: seatInfoRow.seat_number || seatRows[0].seat_number,
        room_name: seatInfoRow.room_name || null,
      },
      message,
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
    if (!["active", "pending"].includes(booking.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Booking is not active" });
    }

    await client.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [id]);

    const { rows: remaining } = await client.query(
      "SELECT id FROM bookings WHERE seat_id = $1 AND status IN ('active', 'pending') AND id != $2",
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
       WHERE s.status = 'available'
         AND NOT EXISTS (
           SELECT 1 FROM bookings b
           WHERE b.seat_id = s.id AND b.status IN ('active', 'pending')
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
    // Check if seat has active or pending bookings with non-expired memberships
    const { rows: seatActiveBookings } = await client.query(
      `SELECT 1 FROM bookings b
       JOIN memberships m ON b.user_id = m.user_id AND b.fee_plan_id = m.fee_plan_id
       WHERE b.seat_id = $1 AND b.status IN ('active', 'pending')
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
       WHERE user_id = $1 AND status IN ('active', 'pending')
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
        "SELECT id FROM bookings WHERE seat_id = $1 AND status IN ('active', 'pending') AND id != $2",
        [eb.seat_id, eb.id]
      );
      if (remaining.length === 0) {
        await client.query("UPDATE seats SET status = 'available' WHERE id = $1", [eb.seat_id]);
      }
    }

    const { rows: existingBooking } = await client.query(
      "SELECT b.*, s.seat_number FROM bookings b JOIN seats s ON b.seat_id = s.id WHERE b.user_id = $1 AND b.status IN ('active', 'pending')",
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
        "SELECT id FROM bookings WHERE seat_id = $1 AND status IN ('active', 'pending') AND id != $2",
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
         WHERE b.seat_id = $1 AND b.status IN ('active', 'pending')`,
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
      if (row.setting_key === "qr_image_url") {
        settings.qr_code_url = row.qr_image_data ? "/api/settings/payment-qr" : row.setting_value;
      }
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

    const qrUrl = "/api/settings/payment-qr";
    await pool.query(
      `UPDATE payment_settings
       SET setting_value = $1, qr_image_data = $2, qr_image_mime_type = $3,
           updated_by = $4, updated_at = NOW()
       WHERE setting_key = 'qr_image_url'`,
      [qrUrl, req.file.buffer, req.file.mimetype, req.user.id]
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
    if (!status || !["lost", "found", "returned", "closed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const { rows: before } = await pool.query("SELECT status FROM lost_found WHERE id = $1", [req.params.id]);
    if (before.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }
    const { rows } = await pool.query(
      "UPDATE lost_found SET status = $1 WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );
    if (before[0].status !== status) {
      const label = { found: "marked as found", returned: "marked as returned", closed: "closed", lost: "marked as lost" }[status];
      await pool.query(
        "INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)",
        [rows[0].user_id, "Lost & Found Update", `Your item "${rows[0].item_name}" was ${label}.`]
      );
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function renewMembership(req, res) {
  const client = await pool.connect();
  try {
    const { student_id, fee_plan_id, amount, payment_method, admin_note, start_date, end_date } = req.body;

    if (!student_id || !fee_plan_id || !amount || !payment_method) {
      return res.status(400).json({ error: "student_id, fee_plan_id, amount, and payment_method are required" });
    }

    if (!start_date || !end_date) {
      return res.status(400).json({ error: "start_date and end_date are required" });
    }

    if (!isValidDateString(start_date) || !isValidDateString(end_date)) {
      return res.status(400).json({ error: "start_date and end_date must be valid dates in YYYY-MM-DD format" });
    }

    if (end_date <= start_date) {
      return res.status(400).json({ error: "New Expiry Date must be after Start Date" });
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

    // Admin-selected dates are stored exactly as chosen. They are passed as
    // 'YYYY-MM-DD' strings (never JS Date objects) so Postgres stores the DATE
    // values verbatim with no timezone conversion.
    const startDate = start_date;
    const endDate = end_date;

    const { rows: membershipRows } = await client.query(
      `INSERT INTO memberships (user_id, fee_plan_id, status, start_date, end_date)
       VALUES ($1, $2, 'active', $3::date, $4::date) RETURNING *`,
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
         WHERE b.seat_id = $1 AND b.status IN ('active', 'pending')`,
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
           VALUES ($1, $2, $3, $4::date, $5::date, 'active', 'offline') RETURNING *`,
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
        `Your membership has been renewed successfully. Valid until ${formatDateString(endDate)}.${seatLabel ? ` Seat: ${seatLabel}.` : ""}`,
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

// --- Help Desk (admin side) ---

export async function getHelpRequests(_req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT h.id, h.user_id, h.subject, h.message, h.status, h.admin_reply,
              h.replied_at, h.created_at, u.name as student_name, u.email as student_email
       FROM help_requests h
       JOIN users u ON h.user_id = u.id
       ORDER BY CASE WHEN h.status = 'pending' THEN 0 ELSE 1 END, h.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function updateHelpRequest(req, res) {
  try {
    const { id } = req.params;
    const { reply, status } = req.body;

    if (status && !["pending", "in_progress", "resolved"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be 'pending', 'in_progress', or 'resolved'." });
    }

    // Read previous state so we can avoid duplicate notifications on re-save
    const { rows: beforeRows } = await pool.query(
      "SELECT user_id, subject, admin_reply FROM help_requests WHERE id = $1",
      [id]
    );
    if (beforeRows.length === 0) {
      return res.status(404).json({ error: "Help request not found" });
    }
    const before = beforeRows[0];

    const updates = [];
    const values = [];
    let replyChanged = false;
    if (reply !== undefined && reply !== null) {
      replyChanged = String(reply).trim() !== (before.admin_reply || "").trim();
      values.push(String(reply));
      updates.push(`admin_reply = $${values.length}`);
      values.push("NOW()");
      updates.push(`replied_at = $${values.length}`);
      if (!status) {
        values.push("in_progress");
        updates.push(`status = $${values.length}`);
      }
    }
    if (status) {
      values.push(status);
      updates.push(`status = $${values.length}`);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: "Nothing to update. Provide reply and/or status." });
    }

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE help_requests SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Help request not found" });
    }

    // Notify only when the reply text is new or actually changed
    // (editing the same reply or only flipping status must not re-notify)
    if (replyChanged && String(reply).trim()) {
      await pool.query(
        "INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)",
        [before.user_id, "Help Request Reply", `Admin replied to your help request "${before.subject}".`]
      );
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getReports(_req, res) {
  try {
    const { rows: totalStudents } = await pool.query(
      `SELECT COUNT(DISTINCT u.id) FROM users u
       JOIN memberships m ON m.user_id = u.id
       WHERE u.role = 'student' AND m.status = 'active' AND m.end_date >= CURRENT_DATE`
    );
    const { rows: totalSeats } = await pool.query("SELECT COUNT(*) FROM seats");
    const { rows: activeMemberships } = await pool.query(
      "SELECT COUNT(*) FROM memberships WHERE status = 'active' AND end_date >= CURRENT_DATE"
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
