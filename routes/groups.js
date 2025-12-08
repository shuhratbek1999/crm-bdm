// routes/groups.js
const express = require("express");
const router = express.Router();
const groupController = require("../controllers/groupController");
const authMiddleware = require("../middleware/auth.middleware");
const validationMiddleware = require("../middleware/validationMiddleware");

// Barcha route'larda autentifikatsiya
router.use(authMiddleware);

// GET /api/groups - Barcha guruhlarni olish
router.get("/", groupController.getAllGroups);
router.get("/teacher", groupController.getAllGroupsTeacher);

// GET /api/groups/stats - Guruh statistikasi
router.get("/stats", groupController.getGroupStats);
router.get("/:group_id/students", groupController.getGroupStudents);
// GET /api/groups/:id - Bitta guruhni olish
router.get("/:id", groupController.getGroupById);

// POST /api/groups - Yangi guruh yaratish
router.post(
  "/",
  validationMiddleware.validateGroup,
  groupController.createGroup
);

// PUT /api/groups/:id - Guruhni yangilash
router.patch(
  "/:id",
  validationMiddleware.validateGroupUpdate,
  groupController.updateGroup
);
router.post("/check-availability", groupController.checkGroupAvailability);
// DELETE /api/groups/:id - Guruhni o'chirish
router.delete("/:id", groupController.deleteGroup);

module.exports = router;
