const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentOneController");
const auth = require("../middleware/auth.middleware");

// Apply student authorization middleware
// const studentAuth = [protect, authorize('student')];

router.get("/my-courses", auth, studentController.getMyCourses);

router.get("/schedule", auth, studentController.getMySchedule);

router.get("/payments", auth, studentController.getMyPayments);

router.get("/attendance", auth, studentController.getMyAttendance);
router.get("/payments/summary", auth, studentController.getPaymentSummary);
router.get("/dashboard", auth, studentController.getDashboardStats);
router.get("/profile", auth, studentController.getMyProfile);
router.put("/profile", auth, studentController.updateProfile);
router.post("/change-password", auth, studentController.changePassword);
router.post("/update-last-login", auth, studentController.updateLastLogin);
module.exports = router;
