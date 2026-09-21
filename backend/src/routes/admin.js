import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { uploadQR } from "../middleware/upload.js";
import {
  getDashboard,
  getStudents,
  getSeats,
  updateSeatStatus,
  getPayments,
  approvePayment,
  rejectPayment,
  createOfflineBooking,
  cancelBooking,
  getAvailableSeats,
  assignSeat,
  deleteStudent,
  getFeePlans,
  updateFeePlan,
  getPaymentSettings,
  updatePaymentSettings,
  uploadQRCode,
  sendNotification,
  getNotifications,
  getLostFound,
  updateLostFound,
  getReports,
  renewMembership,
} from "../controllers/adminController.js";

const router = Router();

router.use(authenticate, authorize("admin"));

router.get("/dashboard", getDashboard);
router.get("/students", getStudents);
router.get("/seats", getSeats);
router.put("/seats/:id/status", updateSeatStatus);
router.get("/payments", getPayments);
router.put("/payments/:id/approve", approvePayment);
router.put("/payments/:id/reject", rejectPayment);
router.post("/offline-booking", createOfflineBooking);
router.put("/bookings/:id/cancel", cancelBooking);
router.get("/available-seats", getAvailableSeats);
router.post("/assign-seat", assignSeat);
router.delete("/students/:id", deleteStudent);
router.get("/fee-plans", getFeePlans);
router.put("/fee-plans/:id", updateFeePlan);
router.get("/settings", getPaymentSettings);
router.put("/settings", updatePaymentSettings);
router.post("/upload-qr", uploadQR, uploadQRCode);
router.post("/notifications", sendNotification);
router.get("/notifications", getNotifications);
router.get("/lost-found", getLostFound);
router.put("/lost-found/:id", updateLostFound);
router.get("/reports", getReports);
router.post("/renew-membership", renewMembership);

export default router;
