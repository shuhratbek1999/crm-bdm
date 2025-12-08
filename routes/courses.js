// routes/courses.js
const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courseController");
const authMiddleware = require("../middleware/auth.middleware");
const validationMiddleware = require("../middleware/courseMiddleware");

// Barcha route'larda autentifikatsiya
router.use(authMiddleware);

// GET /api/courses - Barcha kurslarni olish
router.get("/", authMiddleware, courseController.getAllCourses);

// GET /api/courses/stats - Kurs statistikasi
router.get("/stats", authMiddleware, courseController.getCourseStats);

// GET /api/courses/categories - Kurs kategoriyalari
router.get("/categories", authMiddleware, courseController.getCourseCategories);

// GET /api/courses/:id - Bitta kursni olish
router.get("/:id", authMiddleware, courseController.getCourseById);

// POST /api/courses - Yangi kurs yaratish
router.post(
  "/",
  authMiddleware,
  validationMiddleware.validateCourse,
  courseController.createCourse
);

// PUT /api/courses/:id - Kursni yangilash
router.patch(
  "/:id",
  authMiddleware,
  validationMiddleware.validateCourseUpdate,
  courseController.updateCourse
);

// DELETE /api/courses/:id - Kursni o'chirish
router.delete("/:id", authMiddleware, courseController.deleteCourse);

module.exports = router;
