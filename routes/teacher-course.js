// routes/teacherRoutes.js
const express = require("express");
const router = express.Router();
const teacherController = require("../controllers/teacherCourseController");
const authenticate = require("../middleware/auth.middleware");

router.use(authenticate);

router.get("/courses", teacherController.getTeacherCourses);
router.get("/groups", teacherController.getTeacherGroups);
router.get("/groups/:groupId", teacherController.getGroupDetails);
router.get("/groups/:groupId/students", teacherController.getGroupStudents);

router.get("/schedule/weekly", teacherController.getWeeklySchedule);
router.get("/schedule/today", teacherController.getTodaySchedule);
router.get("/schedule/monthly", teacherController.getMonthlySchedule);

router.post("/groups/:groupId/attendance", teacherController.markAttendance);
router.get(
  "/groups/:groupId/attendance/:date",
  teacherController.getAttendanceForDate
);

router.get("/dashboard/stats", teacherController.getDashboardStats);

module.exports = router;
