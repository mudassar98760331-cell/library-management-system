import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { validateChangePassword } from "../middleware/validate.js";
import { uploadScreenshot } from "../middleware/upload.js";
import {
  getDashboard,
  getFeePlans,
  purchaseMembership,
  getSeats,
  bookSeat,
  cancelBooking,
  getPaymentHistory,
  uploadScreenshot as uploadScreenshotHandler,
  getProfile,
  updateProfile,
  getNotifications,
  markNotificationRead,
  submitLostFound,
  getLostFound,
  changePassword,
} from "../controllers/studentController.js";

const router = Router();

router.use(authenticate);

router.get("/dashboard", getDashboard);
router.get("/fee-plans", getFeePlans);
router.post("/membership", purchaseMembership);
router.get("/seats", getSeats);
router.post("/book-seat", bookSeat);
router.delete("/booking/:booking_id", cancelBooking);
router.get("/payment-history", getPaymentHistory);
router.post("/upload-screenshot", uploadScreenshot, uploadScreenshotHandler);
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/change-password", validateChangePassword, changePassword);
router.get("/notifications", getNotifications);
router.put("/notifications/:id/read", markNotificationRead);
router.post("/lost-found", submitLostFound);
router.get("/lost-found", getLostFound);

export default router;
