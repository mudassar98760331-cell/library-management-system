import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import { mkdirSync } from "fs";

import authRoutes from "./routes/auth.js";
import studentRoutes from "./routes/student.js";
import adminRoutes from "./routes/admin.js";
import settingsRoutes from "./routes/settings.js";

dotenv.config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "your_jwt_secret_here") {
  process.env.JWT_SECRET = crypto.randomBytes(64).toString("hex");
  console.warn("WARNING: JWT_SECRET not set in .env. Generated a random secret. Sessions will NOT persist across server restarts. Set JWT_SECRET in .env for production.");
}

if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === "change_this_password") {
  process.env.ADMIN_PASSWORD = crypto.randomBytes(16).toString("base64url");
  console.warn("WARNING: ADMIN_PASSWORD not set in .env. Generated a random password. Run migration to apply it.");
}

mkdirSync("uploads", { recursive: true });
mkdirSync("uploads/screenshots/payment", { recursive: true });

const app = express();
const PORT = process.env.PORT || 5000;

app.set("trust proxy", 1);

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static("uploads"));

app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/settings", settingsRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request too large" });
  }
  if (err.message && err.message.includes("Only JPEG")) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
