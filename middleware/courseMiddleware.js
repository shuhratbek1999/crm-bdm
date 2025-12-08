// middleware/validationMiddleware.js (qo'shimcha)
const { body } = require("express-validator");
const validateCourse = [
  body("name")
    .notEmpty()
    .withMessage("Course name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Course name must be between 2 and 100 characters"),

  body("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Category must be between 2 and 50 characters"),

  body("level")
    .optional()
    .isIn(["beginner", "intermediate", "advanced"])
    .withMessage("Level must be beginner, intermediate, or advanced"),

  body("duration_months")
    .optional()
    .isInt({ min: 1, max: 24 })
    .withMessage("Duration must be between 1 and 24 months"),

  body("lessons_per_week")
    .optional()
    .isInt({ min: 1, max: 7 })
    .withMessage("Lessons per week must be between 1 and 7"),

  body("lesson_duration")
    .optional()
    .isInt({ min: 30, max: 240 })
    .withMessage("Lesson duration must be between 30 and 240 minutes"),

  body("price").isFloat({ min: 0 }).withMessage("Valid price is required"),

  body("color")
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage("Color must be a valid hex color code"),

  body("icon")
    .optional()
    .isIn([
      "BookOpen",
      "GraduationCap",
      "Code",
      "Languages",
      "Calculator",
      "Flask",
      "Music",
      "Palette",
      "Dumbbell",
    ])
    .withMessage("Invalid icon"),

  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Status must be active or inactive"),
];

const validateCourseUpdate = [
  body("name")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Course name must be between 2 and 100 characters"),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Valid price is required"),
];

module.exports = {
  // ... avvalgi exportlar
  validateCourse,
  validateCourseUpdate,
};
