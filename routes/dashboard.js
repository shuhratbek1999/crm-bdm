const router = require("express").Router();
const ctrl = require("../controllers/dashboardController");
const auth = require("../middleware/auth.middleware");

// Faqat admin va manager dashboardga kira oladi
router.get("/", auth, ctrl.stats);
router.get("/lessons", ctrl.getSchedule);

// // Oylik statistikalar
// router.get("/monthly", ctrl.monthlyStats);

// // Kurs bo'yicha statistikalar
// router.get("/courses", ctrl.courseStats);
module.exports = router;
