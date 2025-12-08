const router = require("express").Router();
const teacherController = require("../controllers/teacherController");
const auth = require("../middleware/auth.middleware");
router.post("/register", teacherController.register); // Teacher self-registration
// router.post("/login", teacherController.login); //
router.get("/profile", teacherController.getProfile);
router.put("/profile", teacherController.updateProfile);
router.post("/change-password", teacherController.changePassword);
router.get("/stats", teacherController.getTeacherStats);

router.use(auth);

// Admin teacher management
router.post("/", teacherController.createTeacher); // Create new teacher
router.get("/", teacherController.getAllTeachers); // Get all teachers with filters
router.get("/:id", teacherController.getTeacherById); // Get single teacher
router.put("/:id", teacherController.updateTeacher); // Update teacher
router.delete("/:id", teacherController.deleteTeacher); // Delete teacher
router.put("/:id/status", teacherController.updateTeacherStatus); // Update status
router.put("/:id/reset-password", teacherController.resetTeacherPassword); // Reset password
router.post(
  "/:id/generate-temp-password",
  teacherController.generateTempPassword
); // Generate temp password

module.exports = router;
