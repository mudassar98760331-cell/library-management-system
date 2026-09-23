import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import { sendOtpEmail, isEmailConfigured, getOtpExpiryMinutes } from "../services/emailService.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const GENERIC_OTP_MESSAGE =
  "If an account with that email exists and requires activation, a verification code has been sent.";

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function generateSetupToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, purpose: "set_password" },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
}

export async function register(req, res) {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone ? phone.trim().replace(/\s+/g, "") : null;

    const { rows: existingEmail } = await pool.query(
      "SELECT id, name, email FROM users WHERE LOWER(email) = $1",
      [normalizedEmail]
    );
    if (existingEmail.length > 0) {
      return res.status(409).json({ error: "Student already exists with this email" });
    }

    if (normalizedPhone) {
      const { rows: existingPhone } = await pool.query(
        "SELECT id, name, phone FROM users WHERE REPLACE(REPLACE(phone, ' ', ''), '-', '') = $1",
        [normalizedPhone]
      );
      if (existingPhone.length > 0) {
        return res.status(409).json({ error: "Student already exists with this mobile number" });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, password, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, email, phone, role",
      [name, normalizedEmail, hash, normalizedPhone]
    );

    const user = rows[0];
    const token = generateToken(user);

    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { rows } = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [normalizedEmail]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];

    if (user.is_active === false) {
      return res.status(403).json({ error: "Your account has been deactivated. Please contact support." });
    }
    if (user.password_set === false) {
      return res.status(403).json({
        error: "Account not activated. Please set your password using the 'Set Password' option on the login page.",
      });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken(user);

    res.json({
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getMe(req, res) {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, phone, role, avatar, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

// --- Account activation / set password via email OTP ---
// Used only for admin-created offline students with password_set = false.

export async function requestOtp(req, res) {
  try {
    const { email } = req.body;
    if (!email || !EMAIL_RE.test(String(email).trim())) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    // Check config BEFORE any user lookup so unconfigured email never enumerates accounts.
    if (!isEmailConfigured()) {
      return res
        .status(503)
        .json({ error: "Email service is not configured. Please contact the administrator." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const { rows } = await pool.query(
      "SELECT id, password_set FROM users WHERE email = $1 AND role = 'student'",
      [normalizedEmail]
    );
    if (rows.length === 0 || rows[0].password_set !== false) {
      return res.json({ message: GENERIC_OTP_MESSAGE });
    }
    const userId = rows[0].id;

    // Resend cooldown: ignore requests within 60s of the last active OTP.
    // Compare entirely in SQL — TIMESTAMP columns are GMT while JS Date parses
    // them as local time, so Date.now() vs new Date(ts) is unreliable here.
    const { rows: recent } = await pool.query(
      `SELECT 1 FROM password_setup_otps
       WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()
         AND created_at > NOW() - ($2 * interval '1 millisecond')
       LIMIT 1`,
      [userId, OTP_RESEND_COOLDOWN_MS]
    );
    if (recent.length > 0) {
      return res.json({ message: GENERIC_OTP_MESSAGE });
    }

    // Generating a new OTP invalidates any previous unused OTP (single active code).
    await pool.query(
      "UPDATE password_setup_otps SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
      [userId]
    );

    const otp = String(crypto.randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otp, 10);
    await pool.query(
      `INSERT INTO password_setup_otps (user_id, otp_hash, expires_at, attempts, max_attempts)
       VALUES ($1, $2, NOW() + ($3 * interval '1 minute'), 0, $4)`,
      [userId, otpHash, getOtpExpiryMinutes(), OTP_MAX_ATTEMPTS]
    );

    try {
      await sendOtpEmail(normalizedEmail, otp);
    } catch (err) {
      // Do not log the OTP. Generic response prevents email-enumeration via send failures.
      console.error(`OTP email send failed: ${err.message}`);
    }

    return res.json({ message: GENERIC_OTP_MESSAGE });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !EMAIL_RE.test(String(email).trim()) || !otp || !/^\d{6}$/.test(String(otp).trim())) {
      return res.status(400).json({ error: "Valid email and 6-digit OTP are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const { rows: users } = await pool.query(
      "SELECT id, password_set FROM users WHERE email = $1 AND role = 'student'",
      [normalizedEmail]
    );
    if (users.length === 0 || users[0].password_set !== false) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }
    const userId = users[0].id;

    const { rows: otpRows } = await pool.query(
      `SELECT id, otp_hash, attempts, max_attempts, used_at, (expires_at <= NOW()) AS is_expired
       FROM password_setup_otps
       WHERE user_id = $1 AND used_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (otpRows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }
    const record = otpRows[0];

    if (record.is_expired) {
      return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    }
    if (record.attempts >= record.max_attempts) {
      await pool.query("UPDATE password_setup_otps SET used_at = NOW() WHERE id = $1", [record.id]);
      return res.status(400).json({ error: "Too many failed attempts. Please request a new OTP." });
    }

    await pool.query(
      "UPDATE password_setup_otps SET attempts = attempts + 1 WHERE id = $1",
      [record.id]
    );

    const valid = await bcrypt.compare(String(otp).trim(), record.otp_hash);
    if (!valid) {
      const remaining = record.max_attempts - (record.attempts + 1);
      if (remaining <= 0) {
        await pool.query("UPDATE password_setup_otps SET used_at = NOW() WHERE id = $1", [record.id]);
        return res.status(400).json({ error: "Too many failed attempts. Please request a new OTP." });
      }
      return res.status(400).json({ error: `Invalid OTP. ${remaining} attempt(s) remaining.` });
    }

    // Single-use: mark verified OTP consumed immediately.
    await pool.query("UPDATE password_setup_otps SET used_at = NOW() WHERE id = $1", [record.id]);

    const setupToken = generateSetupToken({ id: userId, email: normalizedEmail });
    res.json({
      message: "OTP verified. You can now set your password.",
      setup_token: setupToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function setPassword(req, res) {
  try {
    const { setup_token, password, confirm_password } = req.body;
    if (!setup_token || !password || !confirm_password) {
      return res.status(400).json({ error: "Setup token, password, and confirmation are required" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    let payload;
    try {
      payload = jwt.verify(setup_token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Session expired. Please start over." });
    }
    if (payload.purpose !== "set_password" || !payload.id) {
      return res.status(401).json({ error: "Invalid setup token" });
    }

    const userId = payload.id;
    const { rows } = await pool.query(
      "SELECT id, password_set FROM users WHERE id = $1 AND role = 'student'",
      [userId]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: "Session expired. Please start over." });
    }
    if (rows[0].password_set !== false) {
      return res.status(400).json({ error: "Password already set. Please log in." });
    }

    const hash = await bcrypt.hash(String(password), 10);
    await pool.query(
      "UPDATE users SET password = $1, password_set = true WHERE id = $2",
      [hash, userId]
    );
    // Invalidate any remaining OTP / activation sessions for this user.
    await pool.query(
      "UPDATE password_setup_otps SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
      [userId]
    );

    // Do NOT auto-login: student must use the normal Login page.
    res.json({
      message: "Password set successfully. You can now log in with your email and new password.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
