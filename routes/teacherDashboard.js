const express = require("express");
const router = express.Router();
const teacherController = require("../controllers/teacherDashboardController");
const authMiddleware = require("../middleware/auth.middleware");

// Barcha route'lar uchun authentication middleware
router.use(authMiddleware);
// router.use(authMiddleware.teacherOnly); // Faqat teacher'lar kirishi mumkin

// Dashboard
router.get("/dashboard", teacherController.getDashboard);

// Guruhlar
router.get("/groups", teacherController.getTeacherGroups);
router.get("/groups/:groupId", teacherController.getGroupDetails);

// Davomat
router.get("/attendance", teacherController.getAttendancePage);
router.post("/attendance/mark", teacherController.markAttendance);
router.get("/attendance/history", teacherController.getAttendanceHistory);

// O'quvchilar
router.get("/students", teacherController.getTeacherStudents);
router.get("/students/:studentId", teacherController.getStudentProfile);
router.post("/students/:studentId/notes", teacherController.addStudentNote);

// Darslar
router.get("/lessons", teacherController.getTeacherLessons);
router.post("/lessons", teacherController.createLesson);

// Profil
router.get("/profile", teacherController.getTeacherProfile);
router.put("/profile", teacherController.updateTeacherProfile);

module.exports = router;
