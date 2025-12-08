// middleware/validationMiddleware.js
const { body } = require("express-validator");

const validateGroup = [
  body("name")
    .notEmpty()
    .withMessage("Group name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Group name must be between 2 and 100 characters"),

  body("course_id")
    .isInt({ min: 1 })
    .withMessage("Valid course ID is required"),

  body("teacher_id")
    .isInt({ min: 1 })
    .withMessage("Valid teacher ID is required"),

  body("price").isFloat({ min: 0 }).withMessage("Valid price is required"),

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

  body("max_students")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Max students must be between 1 and 50"),

  body("status")
    .optional()
    .isIn(["planned", "active", "completed", "inactive"])
    .withMessage("Invalid status"),

  body("start_date").isDate().withMessage("Valid start date is required"),

  body("end_date")
    .isDate()
    .withMessage("Valid end date is required")
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.start_date)) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),
];

const validateGroupUpdate = [
  body("name")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Group name must be between 2 and 100 characters"),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Valid price is required"),

  body("end_date")
    .optional()
    .isDate()
    .withMessage("Valid end date is required")
    .custom((value, { req }) => {
      if (
        req.body.start_date &&
        new Date(value) <= new Date(req.body.start_date)
      ) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),
];

module.exports = {
  validateGroup,
  validateGroupUpdate,
};
