// routes/studentRoutes.js
const express = require("express");
const router = express.Router();
const studentController = require("../controllers/StudentdashboardController");
const studentAuth = require("../middleware/auth.middleware");

// Barcha endpointlar authentication talab qiladi
router.use(studentAuth);

// Dashboard endpoints
router.get("/dashboard", studentController.getDashboardData);
router.get("/groups", studentController.getMyGroups);
router.get("/schedule", studentController.getSchedule);
router.get("/attendance", studentController.getAttendanceStats);
router.get("/payments", studentController.getPaymentHistory);
router.get("/profile", studentController.getProfile);
router.get("/notifications", studentController.getNotifications);

module.exports = router;
