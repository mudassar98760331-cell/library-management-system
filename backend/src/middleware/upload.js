import multer from "multer";
import path from "path";

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
};

// Payment screenshots are kept in memory and stored in PostgreSQL (BYTEA).
// They must never touch Render's ephemeral local filesystem.
export const uploadScreenshot = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("screenshot");

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
  storage: multer.memoryStorage(),
  fileFilter: qrFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("qr");
