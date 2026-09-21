import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "../../uploads/screenshots");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
};

export const uploadScreenshot = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("screenshot");

const qrDir = path.join(__dirname, "../../uploads/screenshots/payment");
if (!fs.existsSync(qrDir)) {
  fs.mkdirSync(qrDir, { recursive: true });
}

const qrStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, qrDir),
  filename: (_req, _file, cb) => cb(null, "active-qr.jpg"),
});

const qrFileFilter = (_req, file, cb) => {
  const allowedMime = ["image/jpeg", "image/png", "image/webp"];
  const allowedExt = [".jpg", ".jpeg", ".png", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedMime.includes(file.mimetype) || !allowedExt.includes(ext)) {
    return cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
  }
  cb(null, true);
};

export const uploadQR = multer({
  storage: qrStorage,
  fileFilter: qrFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("qr");
