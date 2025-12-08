const router = require("express").Router();
const ctrl = require("../controllers/paymentController");
const auth = require("../middleware/auth.middleware");

// List all payments
router.get("/", auth, ctrl.all);

// Create payment
router.post("/", auth, ctrl.create);

// Get one payment
router.get("/:id", auth, ctrl.one);

// Update payment
router.put("/:id", auth, ctrl.update);

// Delete payment
router.delete("/:id", auth, ctrl.remove);

// Payments by student
router.get("/student/:student_id", auth, ctrl.byStudent);

module.exports = router;
