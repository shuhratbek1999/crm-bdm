const router = require("express").Router();
const AuthController = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");
router.post("/login", AuthController.login); // Eski login (faqat admin)
router.post("/universal-login", AuthController.universalLogin); // Yangi universal login
router.post("/auto-login", AuthController.autoLogin); // Auto login
router.post("/verify", AuthController.verifyToken); // Token verify

// Protected routes (token talab qilinadi)
router.get("/profile", authMiddleware, AuthController.getProfile);

module.exports = router;
