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
});

// Admin-only PUT
router.put("/", authenticate, authorize("admin"), updatePaymentSettings);

export default router;
