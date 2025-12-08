// middleware/validationMiddleware.js (qo'shimcha)
const { body } = require("express-validator");
const validateRoom = [
  body("name")
    .notEmpty()
    .withMessage("Room name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Room name must be between 2 and 50 characters"),

  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("capacity")
    .isInt({ min: 1, max: 500 })
    .withMessage("Capacity must be between 1 and 500"),

  body("floor")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Floor must be between 1 and 50"),

  body("status")
    .optional()
    .isIn(["available", "maintenance", "occupied", "unavailable"])
    .withMessage("Invalid status"),

  body("color")
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage("Color must be a valid hex color code"),
];

const validateRoomUpdate = [
  body("name")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("Room name must be between 2 and 50 characters"),

  body("capacity")
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage("Capacity must be between 1 and 500"),
];

module.exports = {
  // ... avvalgi exportlar
  validateRoom,
  validateRoomUpdate,
};
