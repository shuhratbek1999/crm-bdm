// backend/middleware/auth.middleware.js - FIXED VERSION
const jwt = require("jsonwebtoken");

// Faqat middleware funksiyasini export qilish
module.exports = function authMiddleware(req, res, next) {
  console.log("🔄 Auth middleware is executing...");

  // req va res mavjudligini tekshirish
  if (!req || !res) {
    console.error("❌ req or res is undefined in middleware");

    // Agar next funksiya bo'lsa, error bilan chaqiramiz
    if (typeof next === "function") {
      return next(new Error("Middleware initialization error"));
    }

    // Next ham undefined bo'lsa, to'xtatamiz
    console.error("❌ next function is also undefined");
    return;
  }

  try {
    // 1. Header'dan tokenni olish
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      console.log("❌ No authorization header");
      return res.status(401).json({
        success: false,
        message: "Authorization header is required",
      });
    }

    // 2. Bearer token formatini tekshirish
    if (!authHeader.startsWith("Bearer ")) {
      console.log("❌ Invalid authorization format:", authHeader);
      return res.status(401).json({
        success: false,
        message: "Authorization format should be: Bearer <token>",
      });
    }

    // 3. Token'ni ajratib olish
    const token = authHeader.split(" ")[1];

    if (!token) {
      console.log("❌ Token is empty");
      return res.status(401).json({
        success: false,
        message: "Token is required",
      });
    }

    console.log("✅ Token received, length:", token.length);

    // 4. Token'ni verify qilish
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ JWT verified, user ID:", decoded.userId || decoded.id);

    // 5. User ma'lumotlarini request'ga qo'shish
    req.user = decoded;

    // 6. Keyingi middleware/controller'ga o'tish
    next();
  } catch (error) {
    console.error("❌ JWT Verification Error:", error.name, error.message);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid or malformed token",
        error: error.message,
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication failed",
      error: error.message,
    });
  }
};
