import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { updatePaymentSettings } from "../controllers/adminController.js";
import pool from "../config/db.js";

const router = Router();

// Public GET - students need QR code info for payments
router.get("/", async (_req, res) => {
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
});

// GET payment QR image from PostgreSQL
router.get("/payment-qr", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT qr_image_data, qr_image_mime_type FROM payment_settings WHERE setting_key = 'qr_image_url' AND qr_image_data IS NOT NULL LIMIT 1"
    );
    if (rows.length === 0 || !rows[0].qr_image_data) {
      return res.status(404).json({ error: "QR code not configured" });
    }
    res.set("Content-Type", rows[0].qr_image_mime_type || "image/jpeg");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(rows[0].qr_image_data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin-only PUT
router.put("/", authenticate, authorize("admin"), updatePaymentSettings);

export default router;
