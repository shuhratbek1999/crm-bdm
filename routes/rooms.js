// routes/rooms.js
const express = require("express");
const router = express.Router();
const roomController = require("../controllers/roomController");
const authMiddleware = require("../middleware/auth.middleware");
const validationMiddleware = require("../middleware/roomMiddleware");

// Barcha route'larda autentifikatsiya
router.use(authMiddleware);

// GET /api/rooms - Barcha xonalarni olish
router.get("/", roomController.getAllRooms);

// GET /api/rooms/stats - Xona statistikasi
router.get("/stats", roomController.getRoomStats);

// GET /api/rooms/available - Bo'sh xonalarni olish
router.get("/available", roomController.getAvailableRooms);

// GET /api/rooms/:id - Bitta xonani olish
router.get("/:id", roomController.getRoomById);

// POST /api/rooms - Yangi xona yaratish
router.post("/", validationMiddleware.validateRoom, roomController.createRoom);

// PUT /api/rooms/:id - Xonani yangilash
router.put(
  "/:id",
  validationMiddleware.validateRoomUpdate,
  roomController.updateRoom
);

// DELETE /api/rooms/:id - Xonani o'chirish
router.delete("/:id", roomController.deleteRoom);

module.exports = router;
