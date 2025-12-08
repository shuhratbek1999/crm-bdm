const router = require("express").Router();
const attendanceController = require("../controllers/attendanceController");
const auth = require("../middleware/auth.middleware");
router.post("/", attendanceController.create);
router.get("/", attendanceController.all);
router.get("/:id", attendanceController.getById);
router.put("/:id", attendanceController.update);
router.delete("/:id", attendanceController.remove);

// Bulk operations
router.post("/bulk", attendanceController.bulkCreate);
router.put("/bulk/update", attendanceController.bulkUpdate);

// Filter
router.get("/filter/all", attendanceController.filter);

// By specific
router.get("/student/:student_id", attendanceController.byStudent);
router.get("/teacher/:teacher_id", attendanceController.byTeacher); // YANGI
router.get("/lesson/:lesson_id", attendanceController.byLesson);
router.get("/group/:group_id", attendanceController.byGroup);

// Statistics
router.get("/student/:student_id/stats", attendanceController.studentStats);
router.get("/teacher/:teacher_id/stats", attendanceController.teacherStats); // YANGI
router.get("/group/:group_id/stats", attendanceController.groupStats);

module.exports = router;
