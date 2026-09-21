import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
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
