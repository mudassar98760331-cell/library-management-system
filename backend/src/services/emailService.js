import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// EMAIL_PROVIDER: "smtp" (production) | "test" (local outbox for smoke tests) | "" (disabled)
const provider = (process.env.EMAIL_PROVIDER || "").trim().toLowerCase();

function otpExpiryMinutes() {
  const n = Number(process.env.OTP_EXPIRY_MINUTES);
  return Number.isFinite(n) && n > 0 && n <= 60 ? Math.floor(n) : 10;
}

export function isEmailConfigured() {
  if (provider === "test") return true;
  if (provider === "smtp") {
    return Boolean(
      process.env.EMAIL_HOST &&
      process.env.EMAIL_FROM &&
      process.env.EMAIL_USER &&
      (process.env.EMAIL_PASS || process.env.EMAIL_API_KEY)
    );
  }
  return false;
}

export function getOtpExpiryMinutes() {
  return otpExpiryMinutes();
}

function buildOtpEmail(to, otp) {
  const minutes = otpExpiryMinutes();
  const subject = "Your Lakshya Library verification code";
  const text =
    `Your Lakshya Library verification code is: ${otp}\n\n` +
    `This code expires in ${minutes} minute(s).\n` +
    `Do not share this OTP with anyone. Lakshya Library will never ask for your password or OTP.\n\n` +
    `Lakshya Library`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#0a0e1a">` +
    `<h2 style="color:#3b82f6">Lakshya Library</h2>` +
    `<p>Your Lakshya Library verification code is:</p>` +
    `<p style="font-size:28px;letter-spacing:6px;font-weight:bold;margin:16px 0">${otp}</p>` +
    `<p style="color:#64748b;font-size:14px">This code expires in ${minutes} minute(s).</p>` +
    `<p style="color:#b45309;font-size:14px"><strong>Do not share this OTP with anyone.</strong> ` +
    `Lakshya Library will never ask for your password or OTP.</p>` +
    `<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />` +
    `<p style="color:#64748b;font-size:13px">Lakshya Library</p>` +
    `</div>`;
  return { to, subject, text, html };
}

async function sendSmtp(message) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS || process.env.EMAIL_API_KEY || "",
    },
  });
  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || "Lakshya Library"}" <${process.env.EMAIL_FROM}>`,
    ...message,
  });
}

// EMAIL_PROVIDER=test writes the "email" to a gitignored local outbox so the
// full OTP flow can be smoke-tested without real credentials. Never used in
// production (EMAIL_PROVIDER must be "smtp" there). The OTP never hits app logs.
async function sendTestOutbox(message) {
  const dir = path.join(__dirname, "../../../.otp-outbox");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
  );
  fs.writeFileSync(
    file,
    JSON.stringify({ ...message, sentAt: new Date().toISOString() }, null, 2)
  );
}

export async function sendOtpEmail(to, otp) {
  const message = buildOtpEmail(to, otp);
  if (provider === "test") {
    await sendTestOutbox(message);
    return;
  }
  await sendSmtp(message);
}
