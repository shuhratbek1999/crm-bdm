const router = require("express").Router();
const lessonController = require("../controllers/lessonController");
const auth = require("../middleware/auth.middleware");
// const auth = require("../middleware/auth.middleware");
router.post("/", lessonController.create);
router.get("/", lessonController.all);
router.get("/:id", lessonController.getById);
router.put("/:id", lessonController.update);
router.delete("/:id", lessonController.remove);

// Group and teacher specific
router.get("/group/:group_id", lessonController.byGroup);
router.get("/teacher/:teacher_id", lessonController.byTeacher);

// Generation endpoints
router.post("/generate", lessonController.generateLessons);
router.post("/bulk-generate", lessonController.bulkGenerate);
router.post("/preview-schedule", lessonController.previewSchedule);
router.post("/clear-lessons", lessonController.clearLessons);

// Utility endpoints
router.get(
  "/available-dates/:group_id/:start_date/:end_date",
  lessonController.getAvailableDates
);

module.exports = router;
