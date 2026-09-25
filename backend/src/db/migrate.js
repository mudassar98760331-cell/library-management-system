import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const dropTables = [
  "DROP TABLE IF EXISTS lost_found",
  "DROP TABLE IF EXISTS help_requests",
  "DROP TABLE IF EXISTS password_setup_otps",
  "DROP TABLE IF EXISTS notifications",
  "DROP TABLE IF EXISTS bookings",
  "DROP TABLE IF EXISTS payments",
  "DROP TABLE IF EXISTS memberships",
  "DROP TABLE IF EXISTS fee_plans",
  "DROP TABLE IF EXISTS coupons",
  "DROP TABLE IF EXISTS seat_layouts",
  "DROP TABLE IF EXISTS seats",
  "DROP TABLE IF EXISTS rooms",
  "DROP TABLE IF EXISTS payment_settings",
  "DROP TABLE IF EXISTS payment_screenshots",
  "DROP TABLE IF EXISTS admin_logs",
  "DROP TABLE IF EXISTS settings",
  "DROP TABLE IF EXISTS membership_plans",
  "DROP TABLE IF EXISTS users CASCADE",
];

const createTables = [
  `CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(15) DEFAULT '',
    role VARCHAR(10) DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    avatar VARCHAR(255) DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    password_set BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    capacity INTEGER NOT NULL,
    description TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE seats (
    id SERIAL PRIMARY KEY,
    seat_number VARCHAR(10) NOT NULL,
    room_id INTEGER NOT NULL REFERENCES rooms(id),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'booked', 'reserved', 'disabled')),
    UNIQUE(seat_number)
  )`,

  `CREATE TABLE seat_layouts (
    id SERIAL PRIMARY KEY,
    seat_id INTEGER NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
    position VARCHAR(20) NOT NULL CHECK (position IN ('top', 'left', 'right', 'bottom', 'middle')),
    sort_order INTEGER DEFAULT 0,
    UNIQUE(seat_id)
  )`,

  `CREATE TABLE fee_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_minute INTEGER NOT NULL,
    end_minute INTEGER NOT NULL,
    is_24_hour BOOLEAN DEFAULT false,
    price INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE memberships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    fee_plan_id INTEGER REFERENCES fee_plans(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('active', 'expired', 'pending', 'cancelled')),
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    seat_id INTEGER REFERENCES seats(id),
    fee_plan_id INTEGER REFERENCES fee_plans(id),
    booking_start DATE,
    booking_end DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed', 'pending')),
    booking_source VARCHAR(20) DEFAULT 'online' CHECK (booking_source IN ('online', 'offline')),
    booked_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    membership_id INTEGER REFERENCES memberships(id),
    amount INTEGER NOT NULL,
    method VARCHAR(50) DEFAULT 'upi',
    payment_type VARCHAR(20) DEFAULT 'online' CHECK (payment_type IN ('online', 'offline_cash', 'offline_upi', 'offline_other')),
    utr_number VARCHAR(100) DEFAULT '',
    screenshot_url VARCHAR(255) DEFAULT '',
    screenshot_data BYTEA,
    screenshot_mime_type VARCHAR(50) DEFAULT '',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('completed', 'pending', 'rejected')),
    admin_note TEXT DEFAULT '',
    payment_date DATE,
    receipt_number VARCHAR(100),
    admin_id INTEGER REFERENCES users(id),
    payment_mode VARCHAR(20) DEFAULT '' CHECK (payment_mode IN ('', 'cash', 'upi', 'other')),
    amount_paid INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE lost_found (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    item_name VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    location VARCHAR(200) DEFAULT '',
    status VARCHAR(20) DEFAULT 'lost' CHECK (status IN ('lost', 'found', 'returned', 'closed')),
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE help_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
    admin_reply TEXT DEFAULT '',
    replied_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE password_setup_otps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE payment_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
];

// The four timing plans. Legacy plans (24 Hours, 7:00 AM to 11:00 PM) are
// removed from fresh seeds and deactivated (NOT deleted) on existing
// databases by the idempotent ALTER block below, so historical
// memberships/payments keep their original labels.
const seedFeePlans = `
INSERT INTO fee_plans (name, start_minute, end_minute, is_24_hour, price) VALUES
  ('5:00 AM to 10:00 AM', 300, 600, false, 500),
  ('10:00 AM to 6:30 PM', 600, 1110, false, 1000),
  ('7:00 PM to 12:00 AM', 1140, 1440, false, 500),
  ('12:00 AM to 5:00 AM', 0, 300, false, 500);
`;

const seedRooms = `
INSERT INTO rooms (name, capacity, description) VALUES
  ('Room 1', 20, 'Main study room with 20 seats'),
  ('Room 2', 19, 'Study room with 19 seats'),
  ('Room 3', 4, 'Small group study room with 4 seats');
`;

const seedRoom1Seats = `
INSERT INTO seats (seat_number, room_id, status) VALUES
  ('S-10', 1, 'available'), ('S-18', 1, 'available'), ('S-19', 1, 'available'),
  ('S-01', 1, 'available'), ('S-02', 1, 'available'),
  ('S-11', 1, 'available'), ('S-20', 1, 'available'), ('S-21', 1, 'available'),
  ('S-22', 1, 'available'), ('S-23', 1, 'available'), ('S-24', 1, 'available'),
  ('S-03', 1, 'available'), ('S-04', 1, 'available'), ('S-05', 1, 'available'),
  ('S-06', 1, 'available'), ('S-07', 1, 'available'), ('S-08', 1, 'available'),
  ('S-09', 1, 'available'),
  ('S-13', 1, 'available'), ('S-12', 1, 'available');
`;

const seedRoom2Seats = `
INSERT INTO seats (seat_number, room_id, status) VALUES
  ('S-31', 2, 'available'), ('S-32', 2, 'available'), ('S-33', 2, 'available'),
  ('S-34', 2, 'available'), ('S-35', 2, 'available'),
  ('S-30', 2, 'available'), ('S-29', 2, 'available'), ('S-28', 2, 'available'),
  ('S-27', 2, 'available'), ('S-26', 2, 'available'), ('S-25', 2, 'available'),
  ('S-36', 2, 'available'), ('S-37', 2, 'available'), ('S-38', 2, 'available'),
  ('S-39', 2, 'available'), ('S-40', 2, 'available'), ('S-41', 2, 'available'),
  ('S-42', 2, 'available'),
  ('S-43', 2, 'available');
`;

const seedRoom3Seats = `
INSERT INTO seats (seat_number, room_id, status) VALUES
  ('S3-14', 3, 'available'), ('S3-15', 3, 'available'),
  ('S3-16', 3, 'available'), ('S3-17', 3, 'available');
`;

const seedSeatLayouts = `
DO $$
BEGIN
  INSERT INTO seat_layouts (seat_id, position, sort_order)
  SELECT id, 'top', CASE seat_number
    WHEN 'S-10' THEN 1 WHEN 'S-18' THEN 2 WHEN 'S-19' THEN 3
    WHEN 'S-01' THEN 4 WHEN 'S-02' THEN 5 END
  FROM seats WHERE seat_number IN ('S-10','S-18','S-19','S-01','S-02') AND room_id = 1;

  INSERT INTO seat_layouts (seat_id, position, sort_order)
  SELECT id, 'left', CASE seat_number
    WHEN 'S-11' THEN 1 WHEN 'S-20' THEN 2 WHEN 'S-21' THEN 3
    WHEN 'S-22' THEN 4 WHEN 'S-23' THEN 5 WHEN 'S-24' THEN 6 END
  FROM seats WHERE seat_number IN ('S-11','S-20','S-21','S-22','S-23','S-24') AND room_id = 1;

  INSERT INTO seat_layouts (seat_id, position, sort_order)
  SELECT id, 'right', CASE seat_number
    WHEN 'S-03' THEN 1 WHEN 'S-04' THEN 2 WHEN 'S-05' THEN 3
    WHEN 'S-06' THEN 4 WHEN 'S-07' THEN 5 WHEN 'S-08' THEN 6 WHEN 'S-09' THEN 7 END
  FROM seats WHERE seat_number IN ('S-03','S-04','S-05','S-06','S-07','S-08','S-09') AND room_id = 1;

  INSERT INTO seat_layouts (seat_id, position, sort_order)
  SELECT id, 'bottom', CASE seat_number
    WHEN 'S-13' THEN 1 WHEN 'S-12' THEN 2 END
  FROM seats WHERE seat_number IN ('S-13','S-12') AND room_id = 1;

  INSERT INTO seat_layouts (seat_id, position, sort_order)
  SELECT id, 'top', CASE seat_number
    WHEN 'S-31' THEN 1 WHEN 'S-32' THEN 2 WHEN 'S-33' THEN 3
    WHEN 'S-34' THEN 4 WHEN 'S-35' THEN 5 END
  FROM seats WHERE seat_number IN ('S-31','S-32','S-33','S-34','S-35') AND room_id = 2;

  INSERT INTO seat_layouts (seat_id, position, sort_order)
  SELECT id, 'left', CASE seat_number
    WHEN 'S-30' THEN 1 WHEN 'S-29' THEN 2 WHEN 'S-28' THEN 3
    WHEN 'S-27' THEN 4 WHEN 'S-26' THEN 5 WHEN 'S-25' THEN 6 END
  FROM seats WHERE seat_number IN ('S-30','S-29','S-28','S-27','S-26','S-25') AND room_id = 2;

  INSERT INTO seat_layouts (seat_id, position, sort_order)
  SELECT id, 'right', CASE seat_number
    WHEN 'S-36' THEN 1 WHEN 'S-37' THEN 2 WHEN 'S-38' THEN 3
    WHEN 'S-39' THEN 4 WHEN 'S-40' THEN 5 WHEN 'S-41' THEN 6 WHEN 'S-42' THEN 7 END
  FROM seats WHERE seat_number IN ('S-36','S-37','S-38','S-39','S-40','S-41','S-42') AND room_id = 2;

  INSERT INTO seat_layouts (seat_id, position, sort_order)
  SELECT id, 'bottom', 1
  FROM seats WHERE seat_number = 'S-43' AND room_id = 2;

  INSERT INTO seat_layouts (seat_id, position, sort_order)
  SELECT id, 'middle', CASE seat_number
    WHEN 'S3-14' THEN 1 WHEN 'S3-15' THEN 2
    WHEN 'S3-16' THEN 3 WHEN 'S3-17' THEN 4 END
  FROM seats WHERE seat_number IN ('S3-14','S3-15','S3-16','S3-17') AND room_id = 3;
END $$;
`;

const seedPaymentSettings = `
INSERT INTO payment_settings (setting_key, setting_value) VALUES
  ('qr_image_url', '/uploads/qr/phonepe-qr.jpeg'),
  ('receiver_name', 'NISHANT SAHU'),
  ('upi_id', 'lakshyalibrary@okicicibank'),
  ('upi_note', 'Pay only after verifying receiver name: NISHANT SAHU');
`;

async function migrate() {
  const startTime = Date.now();
  const isFresh = process.argv.includes("--fresh");
  console.log("Starting migration..." + (isFresh ? " (fresh reset)" : ""));

  // Check if tables already exist
  const { rows: tableCheck } = await pool.query(
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')"
  );
  const tablesExist = tableCheck[0].exists;

  if (!tablesExist || isFresh) {
    // Full reset: drop and recreate everything
    for (const sql of dropTables) {
      await pool.query(sql);
    }
    console.log("Dropped all old tables.");

    for (const sql of createTables) {
      await pool.query(sql);
    }
    console.log("Created all tables.");

    await pool.query(seedFeePlans);
    console.log("Seeded 5 fee plans.");

    await pool.query(seedRooms);
    console.log("Seeded 3 rooms.");

    await pool.query(seedRoom1Seats);
    await pool.query(seedRoom2Seats);
    await pool.query(seedRoom3Seats);
    console.log("Seeded 43 seats (Room 1: 20, Room 2: 19, Room 3: 4).");

    await pool.query(seedSeatLayouts);
    console.log("Seeded seat layouts.");

    await pool.query(seedPaymentSettings);
    console.log("Seeded payment settings.");

    const adminEmail = process.env.ADMIN_EMAIL || "admin@library.com";
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error("ERROR: ADMIN_PASSWORD must be set in .env before running migration.");
      process.exit(1);
    }
    const hash = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'admin')",
      ["Admin", adminEmail, hash]
    );
    console.log(`Seeded admin user: ${adminEmail}`);
  } else {
    console.log("Tables already exist — skipping drop/create/seed.");
  }

  // Safe ALTER TABLE migrations for existing databases
  const alterStatements = [
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_source VARCHAR(20) DEFAULT 'online'`,
    `ALTER TABLE seats ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'available'`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seats_status_check') THEN
        ALTER TABLE seats DROP CONSTRAINT IF EXISTS seats_status_check;
        ALTER TABLE seats ADD CONSTRAINT seats_status_check CHECK (status IN ('available', 'booked', 'reserved', 'disabled'));
      END IF;
    END $$`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) DEFAULT ''`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_paid INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
    `ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS qr_image_data BYTEA`,
    `ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS qr_image_mime_type VARCHAR(50) DEFAULT ''`,
    // Payment screenshots stored persistently in PostgreSQL (same approach as QR BYTEA)
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS screenshot_data BYTEA`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS screenshot_mime_type VARCHAR(50) DEFAULT ''`,
    // Bookings may be 'pending' while awaiting admin payment verification
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bookings_status_check'
          AND pg_get_constraintdef(oid) LIKE '%pending%'
      ) THEN
        ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
        ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
          CHECK (status IN ('active', 'cancelled', 'completed', 'pending'));
      END IF;
    END $$`,
    // Lost & Found gains 'closed' status
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'lost_found_status_check'
          AND pg_get_constraintdef(oid) LIKE '%closed%'
      ) THEN
        ALTER TABLE lost_found DROP CONSTRAINT IF EXISTS lost_found_status_check;
        ALTER TABLE lost_found ADD CONSTRAINT lost_found_status_check
          CHECK (status IN ('lost', 'found', 'returned', 'closed'));
      END IF;
    END $$`,
    // Help desk table (student requests -> admin replies)
    `CREATE TABLE IF NOT EXISTS help_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      subject VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
      admin_reply TEXT DEFAULT '',
      replied_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    // Account activation: admin-created offline students start with password_set = false
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set BOOLEAN DEFAULT true`,
    // Single-use, short-lived OTPs for set-password / account activation
    `CREATE TABLE IF NOT EXISTS password_setup_otps (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      otp_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 5,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_password_setup_otps_user ON password_setup_otps(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_password_setup_otps_expires ON password_setup_otps(expires_at)`,
    // --- Slot booking + admin-controlled dynamic pricing ---
    // Four fixed access/booking slots (NOT memberships). Prices live in the DB
    // so admin can change them without any frontend/code change.
    `CREATE TABLE IF NOT EXISTS slots (
      id SERIAL PRIMARY KEY,
      slot_number INTEGER UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      start_minute INTEGER NOT NULL,
      end_minute INTEGER NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    // Explicit combination prices: when a combo is configured it MUST win over
    // summing the individual slot prices (e.g. 1+2 = 1100, not 500+1000).
    `CREATE TABLE IF NOT EXISTS slot_combo_prices (
      id SERIAL PRIMARY KEY,
      slots_key VARCHAR(50) UNIQUE NOT NULL,
      price INTEGER NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    // Booking -> selected slots relationship (Booking -> Seat -> Room -> Slot -> Payment)
    `CREATE TABLE IF NOT EXISTS booking_slots (
      booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
      slot_id INTEGER REFERENCES slots(id) ON DELETE CASCADE,
      PRIMARY KEY (booking_id, slot_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_booking_slots_slot ON booking_slots(slot_id)`,
    // Seed only when missing — ON CONFLICT DO NOTHING preserves admin-set prices.
    `INSERT INTO slots (slot_number, name, start_minute, end_minute, price) VALUES
      (1, '5:00 AM - 10:00 AM', 300, 600, 500),
      (2, '10:00 AM - 6:30 PM', 600, 1110, 1000),
      (3, '7:00 PM - 12:00 AM', 1140, 1440, 500),
      (4, '12:00 AM - 5:00 AM', 0, 300, 500)
      ON CONFLICT (slot_number) DO NOTHING`,
    `INSERT INTO slot_combo_prices (slots_key, price) VALUES
      ('1+2', 1100),
      ('2+3', 1200),
      ('1+2+3', 1200),
      ('1+2+3+4', 1500),
      ('1+3', 800),
      ('3+4', 800)
      ON CONFLICT (slots_key) DO NOTHING`,
    // 2+3 combo correction: full-day + late-evening = 1200 (was 1100 on older
    // databases). Guarded so admin-adjusted prices are never overwritten.
    `UPDATE slot_combo_prices SET price = 1200 WHERE slots_key = '2+3' AND price = 1100`,
    // Reference/default price captured at transaction time (admin flows may
    // charge a different final amount). Nullable for legacy payment rows.
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_amount INTEGER`,
    // --- Four timing plans (replace the legacy five-plan setup) ---
    // 1) Add the missing 12:00 AM - 5:00 AM plan (skip when a 0-300 plan exists).
    `INSERT INTO fee_plans (name, start_minute, end_minute, is_24_hour, price)
     SELECT '12:00 AM to 5:00 AM', 0, 300, false, 500
     WHERE NOT EXISTS (SELECT 1 FROM fee_plans WHERE start_minute = 0 AND end_minute = 300)`,
    // 2) Deactivate every plan outside the four timing windows (24 Hours and
    //    7:00 AM to 11:00 PM). Rows are KEPT so historical memberships and
    //    payments retain their original plan labels. Idempotent.
    `UPDATE fee_plans SET is_active = false
      WHERE is_active = true
        AND NOT (start_minute = 300 AND end_minute = 600)
        AND NOT (start_minute = 600 AND end_minute = 1110)
        AND NOT (start_minute = 1140 AND end_minute = 1440)
        AND NOT (start_minute = 0 AND end_minute = 300)`,
    // Performance indexes for hot query paths
    `CREATE INDEX IF NOT EXISTS idx_bookings_user_status ON bookings(user_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_seat_status ON bookings(seat_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_memberships_user_status ON memberships(user_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_payments_user_created ON payments(user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_help_requests_user ON help_requests(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_help_requests_status ON help_requests(status)`,
  ];

  for (const sql of alterStatements) {
    try {
      await pool.query(sql);
    } catch (err) {
      // Ignore errors from ALTER if columns already exist or constraints already applied
      if (!err.message.includes("already exists") && !err.message.includes("column") && !err.message.includes("constraint")) {
        console.warn(`ALTER warning: ${err.message}`);
      }
    }
  }
  console.log("Applied safe schema alterations.");

  // Migrate existing QR file from filesystem into PostgreSQL (if not already stored)
  try {
    const { rows: qrCheck } = await pool.query(
      "SELECT qr_image_data FROM payment_settings WHERE setting_key = 'qr_image_url' LIMIT 1"
    );
    if (qrCheck.length > 0 && !qrCheck[0].qr_image_data) {
      const possiblePaths = [
        path.join(__dirname, "../../uploads/screenshots/payment/active-qr.jpg"),
        path.join(__dirname, "../../uploads/qr/phonepe-qr.jpeg"),
      ];
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          const data = fs.readFileSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mimeMap = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
          const mime = mimeMap[ext] || "image/jpeg";
          await pool.query(
            "UPDATE payment_settings SET qr_image_data = $1, qr_image_mime_type = $2 WHERE setting_key = 'qr_image_url'",
            [data, mime]
          );
          console.log(`Migrated existing QR file into PostgreSQL: ${filePath}`);
          break;
        }
      }
    }
  } catch (err) {
    console.warn(`QR migration skip: ${err.message}`);
  }

  // Migrate existing payment screenshot files from filesystem into PostgreSQL
  // (Render's local filesystem is ephemeral; screenshots must live in the DB like the QR code)
  try {
    const { rows: shots } = await pool.query(
      "SELECT id, screenshot_url FROM payments WHERE screenshot_data IS NULL AND screenshot_url <> ''"
    );
    const mimeMap = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
    for (const row of shots) {
      const fileName = path.basename(row.screenshot_url);
      const possiblePaths = [
        path.join(__dirname, "../../uploads/screenshots", fileName),
        path.join(__dirname, "../../uploads/screenshots/payment", fileName),
      ];
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          const data = fs.readFileSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          await pool.query(
            "UPDATE payments SET screenshot_data = $1, screenshot_mime_type = $2 WHERE id = $3",
            [data, mimeMap[ext] || "image/jpeg", row.id]
          );
          console.log(`Migrated payment screenshot #${row.id} into PostgreSQL.`);
          try { fs.unlinkSync(filePath); } catch { /* ignore */ }
          break;
        }
      }
    }
  } catch (err) {
    console.warn(`Screenshot migration skip: ${err.message}`);
  }

  // --- Membership expiry sync ---
  // Expire memberships past their end_date (safe, idempotent)
  await pool.query(`
    UPDATE memberships SET status = 'expired'
    WHERE status IN ('active', 'pending') AND end_date < CURRENT_DATE
  `);
  console.log("Expired memberships past their end date.");

  // Cancel bookings (active or pending) that are past their end date, or whose
  // LATEST membership for the same plan is expired/cancelled.
  // Uses the latest membership only, so an old expired membership never
  // cancels a newer renewed booking for the same plan.
  await pool.query(`
    UPDATE bookings SET status = 'cancelled'
    WHERE status IN ('active', 'pending')
      AND (
        booking_end < CURRENT_DATE
        OR EXISTS (
          SELECT 1 FROM memberships m
          WHERE m.user_id = bookings.user_id
            AND m.fee_plan_id = bookings.fee_plan_id
            AND m.id = (
              SELECT m2.id FROM memberships m2
              WHERE m2.user_id = m.user_id AND m2.fee_plan_id = m.fee_plan_id
              ORDER BY m2.created_at DESC, m2.id DESC
              LIMIT 1
            )
            AND (m.status = 'cancelled' OR (m.status = 'expired' AND m.end_date < CURRENT_DATE))
        )
      )
  `);
  console.log("Cancelled expired/rejected bookings.");

  // Release seats that have no active or pending bookings
  await pool.query(`
    UPDATE seats SET status = 'available'
    WHERE status IN ('booked', 'reserved')
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.seat_id = seats.id AND b.status IN ('active', 'pending')
      )
  `);
  console.log("Released seats with no active bookings.");

  // Mark seats as booked if they have an active booking
  await pool.query(`
    UPDATE seats s
    SET status = 'booked'
    WHERE s.status IN ('available', 'reserved')
      AND EXISTS (SELECT 1 FROM bookings b WHERE b.seat_id = s.id AND b.status = 'active')
  `);
  // Reserve seats held by a pending (awaiting payment verification) booking
  await pool.query(`
    UPDATE seats s
    SET status = 'reserved'
    WHERE s.status = 'available'
      AND EXISTS (SELECT 1 FROM bookings b WHERE b.seat_id = s.id AND b.status = 'pending')
      AND NOT EXISTS (SELECT 1 FROM bookings b2 WHERE b2.seat_id = s.id AND b2.status = 'active')
  `);
  console.log("Synced seat statuses with bookings.");

  // Log counts
  const tables = [
    "users", "rooms", "seats", "seat_layouts", "fee_plans",
    "memberships", "bookings", "payments", "notifications",
    "lost_found", "help_requests", "password_setup_otps", "payment_settings",
  ];

  console.log("\n--- Table Counts ---");
  for (const table of tables) {
    const { rows } = await pool.query(`SELECT COUNT(*) FROM ${table}`);
    console.log(`  ${table}: ${rows[0].count}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nMigration complete in ${elapsed}s.`);
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
