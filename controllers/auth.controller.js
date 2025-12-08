// controllers/authController.js - TO'LIQ TUZATILGAN VERSION
const { User, Teacher, Student } = require("../models");
const { Sequelize, Op } = require("sequelize"); // Sequelize import qo'shildi
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

require("dotenv").config();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("❌ XAVFLI: JWT_SECRET muhim emas yoki juda qisqa!");
  console.error("✅ .env faylingizga quyidagini qo'shing:");
  console.error(
    "   JWT_SECRET=your_very_long_and_secure_secret_key_min_32_chars"
  );
}
module.exports = {
  // Eski login
  login: async (req, res) => {
    try {
      console.log("🔐 Login so'rovi keldi");
      console.log("Body:", req.body);

      const { identifier, password } = req.body;

      // Validatsiya
      if (!identifier || !password) {
        return res.status(400).json({
          success: false,
          message: "Telefon va parol kiritishingiz kerak",
        });
      }

      console.log("🔍 User qidirilmoqda...");

      // User ni topish
      const user = await User.findOne({
        where: {
          phone: identifier,
        },
      });

      if (!user) {
        console.log("❌ User topilmadi:", identifier);
        return res.status(404).json({
          success: false,
          message: "Foydalanuvchi topilmadi",
        });
      }

      console.log("✅ User topildi:", user.id, user.full_name);

      // Parolni tekshirish
      console.log("🔑 Parol tekshirilmoqda...");
      const valid = await bcrypt.compare(password, user.password);

      if (!valid) {
        console.log("❌ Parol noto'g'ri");
        return res.status(400).json({
          success: false,
          message: "Parol noto'g'ri!",
        });
      }

      console.log("✅ Parol to'g'ri");

      // JWT token yaratish - TO'G'RI VERSIYA
      const tokenPayload = {
        id: user.id,
        role: user.role,
        phone: user.phone,
        full_name: user.full_name,
        email: user.email || "",
        createdAt: new Date().toISOString(),
      };

      console.log("🎫 Token payload:", tokenPayload);

      // TOKEN YARATISH
      const token = jwt.sign(
        tokenPayload,
        JWT_SECRET || "fallback_secret_key_for_development_only_change_this",
        {
          expiresIn: "7d",
          algorithm: "HS256", // Aniq algoritmni ko'rsatish
        }
      );

      console.log("🔐 Token yaratildi:");
      console.log("   Uzunligi:", token.length);
      console.log(
        "   Format:",
        token.split(".").length === 3 ? "JWT" : "Not JWT"
      );
      console.log("   Birinchi 50 belgi:", token.substring(0, 50) + "...");

      // Agar token JWT formatida bo'lmasa
      if (token.split(".").length !== 3) {
        console.error("❌ XATO: Token JWT formatida emas!");
        console.error("   Token:", token);
        return res.status(500).json({
          success: false,
          message: "Server error: Invalid token format",
          debug: token,
        });
      }

      // Response jo'natish
      const response = {
        success: true,
        message: "Login muvaffaqiyatli",
        token: token,
        user: {
          id: user.id,
          full_name: user.full_name,
          phone: user.phone,
          role: user.role,
          email: user.email || "",
        },
      };

      console.log("✅ Login muvaffaqiyatli:", user.full_name);
      res.json(response);
    } catch (error) {
      console.error("❌ Login xatosi:", error);
      console.error("   Error stack:", error.stack);

      res.status(500).json({
        success: false,
        message: "Server xatosi",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  universalLogin: async (req, res) => {
    try {
      console.log("🔐 Universal login so'rovi keldi");
      console.log("Body:", req.body);

      const { identifier, password, role } = req.body;

      // Validatsiya
      if (!identifier || !password) {
        return res.status(400).json({
          success: false,
          message: "Identifikator va parol kiritishingiz kerak",
        });
      }

      if (!role || !["admin", "teacher", "student"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Role noto'g'ri. admin, teacher yoki student bo'lishi kerak",
        });
      }

      console.log(`🔍 ${role} sifatida login qilish: ${identifier}`);

      let user = null;
      let userData = null;
      let userModel = null;

      const cleanedIdentifier = identifier.replace(/\s/g, "");
      const isPhoneNumber = /^\+?\d{7,15}$/.test(cleanedIdentifier);
      console.log("   Identifikator telefon raqami?", isPhoneNumber);

      // Role bo'yicha qidirish
      switch (role) {
        case "admin":
          console.log("   Admin qidirilmoqda...");

          const adminWhereClause = isPhoneNumber
            ? { phone: identifier, role: "admin" }
            : {
                [Op.or]: [{ phone: identifier }, { email: identifier }],
                role: "admin",
              };

          user = await User.findOne({ where: adminWhereClause });

          if (user) {
            console.log("   ✅ Admin topildi:", user.id);
            userData = {
              id: user.id,
              full_name: user.full_name,
              phone: user.phone,
              role: "admin",
              model: "User",
            };
            userModel = user;
          } else {
            console.log("   ❌ Admin topilmadi");
          }
          break;

        case "teacher":
          console.log("   Teacher qidirilmoqda...");

          const teacherWhereClause = isPhoneNumber
            ? { phone: identifier }
            : { email: identifier };

          user = await Teacher.findOne({ where: teacherWhereClause });

          if (user) {
            console.log("   ✅ Teacher topildi:", user.id);
            userData = {
              id: user.id,
              full_name: user.full_name,
              phone: user.phone,
              role: "teacher",
              email: user.email || "",
              specialization: user.specialization,
              experience_years: user.experience_years,
              status: user.status,
              model: "Teacher",
            };
            userModel = user;
          } else {
            console.log("   ❌ Teacher topilmadi");
          }
          break;
        case "student":
          console.log("   Student qidirilmoqda...");

          // ✅ 1. Avval telefon raqam sifatida qidirish
          if (isPhoneNumber) {
            console.log(
              "   Student telefon raqam bilan qidirish:",
              cleanedIdentifier
            );

            // '+' belgisini olib tashlash
            const phoneWithoutPlus = cleanedIdentifier.replace(/^\+/, "");

            // Telefon raqam bilan qidirish
            user = await Student.findOne({
              where: {
                phone: {
                  [Op.or]: [
                    cleanedIdentifier, // +998993941226
                    phoneWithoutPlus, // 998993941226
                    `+${phoneWithoutPlus}`, // +998993941226 (agar plus bo'lmasa)
                    phoneWithoutPlus.replace(/^998/, ""), // 993941226
                  ],
                },
              },
            });

            if (user) {
              console.log(
                "   ✅ Student telefon raqam bilan topildi:",
                user.id
              );
            }
          }

          // ✅ 2. Agar telefon bilan topilmasa, email bilan qidirish
          if (!user && !isPhoneNumber) {
            console.log("   Student email bilan qidirish:", cleanedIdentifier);
            user = await Student.findOne({
              where: {
                email: cleanedIdentifier,
              },
            });

            if (user) {
              console.log("   ✅ Student email bilan topildi:", user.id);
            }
          }

          // ✅ 3. Agar hali topilmasa, ID bilan qidirish (faqat kichik raqamlar uchun)
          if (!user) {
            // Faqat 1-6 xonali raqamlarni ID sifatida qabul qilish
            const studentId = parseInt(cleanedIdentifier);
            if (!isNaN(studentId) && studentId > 0 && studentId < 1000000) {
              console.log("   Student ID bilan qidirish:", studentId);
              user = await Student.findByPk(studentId);

              if (user) {
                console.log("   ✅ Student ID bilan topildi:", user.id);
              }
            }
          }

          // ✅ 4. Agar hali topilmasa, full_name bilan qidirish (agar kerak bo'lsa)
          if (!user) {
            console.log("   Student ism bilan qidirish:", cleanedIdentifier);
            user = await Student.findOne({
              where: {
                full_name: {
                  [Op.like]: `%${cleanedIdentifier}%`,
                },
              },
            });

            if (user) {
              console.log("   ✅ Student ism bilan topildi:", user.id);
            }
          }

          if (user) {
            console.log("   ✅ Student topildi:", user.id);
            userData = {
              id: user.id,
              full_name: user.full_name,
              phone: user.phone,
              email: user.email || "",
              parent_phone: user.parent_phone || "",
              role: "student",
              status: user.status,
              balance: user.balance || 0,
              total_owed: user.total_owed || 0,
              total_paid: user.total_paid || 0,
              model: "Student",
            };
            userModel = user;
          } else {
            console.log("   ❌ Student topilmadi");
            // Database'dagi barcha student'lar telefon raqamlarini chiqarish
            try {
              const allStudents = await Student.findAll({
                attributes: ["id", "full_name", "phone"],
                limit: 10,
              });
              console.log(
                "   Available students:",
                allStudents.map((s) => ({
                  id: s.id,
                  name: s.full_name,
                  phone: s.phone,
                }))
              );
            } catch (err) {
              console.log("   Could not fetch student list");
            }
          }
          break;
      }

      // User topilmadi
      if (!user) {
        return res.status(401).json({
          success: false,
          message: `${role} topilmadi`,
        });
      }

      console.log("✅ User topildi:", {
        id: user.id,
        name: user.full_name,
        hasPassword: !!user.password,
      });

      // PAROLNI TEKSHIRISH - TO'G'RI VERSIYA
      console.log("🔑 Parol tekshirilmoqda...");
      let isValidPassword = false;

      if (!userModel.password) {
        console.log("❌ Userda parol yo'q");
        return res.status(401).json({
          success: false,
          message: "Parol o'rnatilmagan",
        });
      }

      try {
        // 1. BCrypt hash bilan solishtirish
        if (
          userModel.password.startsWith("$2a$") ||
          userModel.password.startsWith("$2b$")
        ) {
          console.log("   Parol BCrypt hash formatida");
          isValidPassword = await bcrypt.compare(password, userModel.password);
        }
        // 2. MD5 yoki boshqa hash bo'lsa (agar mavjud bo'lsa)
        else if (userModel.password.length === 32) {
          console.log("   Parol MD5 formatida bo'lishi mumkin");
          // Siz MD5 compare qilishingiz kerak
          // isValidPassword = md5(password) === userModel.password;
          // Hozircha faqat development uchun plain text
          isValidPassword = password === userModel.password;
        }
        // 3. Plain text (faqat development)
        else {
          console.log("⚠️  Parol plain text - faqat development uchun!");
          isValidPassword = password === userModel.password;
        }
      } catch (compareError) {
        console.error("Parol solishtirish xatosi:", compareError);
        isValidPassword = false;
      }

      if (!isValidPassword) {
        console.log("❌ Parol noto'g'ri");
        return res.status(401).json({
          success: false,
          message: "Parol noto'g'ri",
        });
      }

      console.log("✅ Parol to'g'ri");

      // Status tekshirish
      if (userModel.status && userModel.status !== "active") {
        return res.status(403).json({
          success: false,
          message: `Hisob ${userModel.status} holatida. Administrator bilan bog'laning.`,
        });
      }

      // Last login yangilash
      try {
        if (userModel.update) {
          await userModel.update({ last_login: new Date() });
          console.log("   Last login yangilandi");
        }
      } catch (updateError) {
        console.log("   Last login yangilashda xatolik:", updateError.message);
      }

      // JWT TOKEN YARATISH - ASOSIY QISMI
      const tokenPayload = {
        id: user.id,
        role: role,
        model: userData.model,
        phone: user.phone,
        full_name: user.full_name || userData.full_name,
        email: user.email || "",
        iat: Math.floor(Date.now() / 1000), // Issued at
        // exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 kun
      };

      console.log("🎫 Token payload:", tokenPayload);

      // TOKEN YARATISH
      const token = jwt.sign(
        tokenPayload,
        JWT_SECRET || "fallback_secret_key_for_development_only_change_this",
        {
          expiresIn: "7d",
          algorithm: "HS256",
        }
      );

      console.log("🔐 Token yaratildi:");
      console.log("   Uzunligi:", token.length);
      console.log(
        "   Format:",
        token.split(".").length === 3 ? "JWT ✅" : "JWT emas ❌"
      );
      console.log("   Namuna:", token.substring(0, 30) + "...");

      // Token JWT formatida ekanligini tekshirish
      if (token.split(".").length !== 3) {
        console.error("❌ XATO: Token JWT formatida emas!");
        console.error("   Token:", token);

        // Emergency token yaratish
        const emergencyToken = jwt.sign(
          tokenPayload,
          "emergency_secret_key_for_debugging_only",
          { expiresIn: "1h" }
        );

        return res.json({
          success: true,
          message: `Xush kelibsiz, ${user.full_name}!`,
          token: emergencyToken,
          user: userData,
          warning: "Emergency token used",
        });
      }

      // Muvaffaqiyatli response
      const response = {
        success: true,
        message: `Xush kelibsiz, ${user.full_name || userData.full_name}!`,
        token: token,
        user: userData,
        debug:
          process.env.NODE_ENV === "development"
            ? {
                tokenLength: token.length,
                tokenPreview: token.substring(0, 50) + "...",
                payload: tokenPayload,
              }
            : undefined,
      };

      console.log("✅ Universal login muvaffaqiyatli!");
      res.json(response);
    } catch (error) {
      console.error("❌ Universal login xatosi:", error);
      console.error("   Error stack:", error.stack);

      res.status(500).json({
        success: false,
        message: "Server xatosi",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  // AUTO LOGIN - TO'LIQ TUZATILGAN
  autoLogin: async (req, res) => {
    try {
      console.log("🔐 Auto login so'rovi keldi");
      console.log("Body:", req.body);

      const { identifier, password } = req.body;

      if (!identifier || !password) {
        return res.status(400).json({
          success: false,
          message: "Identifikator va parol kiritishingiz kerak",
        });
      }

      console.log(`🔍 Auto login: ${identifier}`);

      let user = null;
      let role = null;
      let userData = null;
      let userModel = null;

      // Telefon raqam formatini aniqlash
      const isPhoneNumber = /^\+?\d{7,15}$/.test(identifier.replace(/\s/g, ""));
      console.log("   Identifikator telefon raqami?", isPhoneNumber);

      // 1. Avval Admin ni tekshirish
      console.log("   Admin qidirilmoqda...");
      const adminWhereClause = isPhoneNumber
        ? { phone: identifier, role: "admin" }
        : {
            [Op.or]: [{ phone: identifier }, { email: identifier }],
            role: "admin",
          };

      user = await User.findOne({ where: adminWhereClause });

      if (user) {
        console.log("   ✅ Admin topildi:", user.id);
        role = "admin";
        userData = {
          id: user.id,
          full_name: user.full_name,
          phone: user.phone,
          email: user.email || "",
          role: "admin",
          model: "User",
        };
        userModel = user;
      }

      // 2. Teacher ni tekshirish
      if (!user) {
        console.log("   Teacher qidirilmoqda...");
        const teacherWhereClause = isPhoneNumber
          ? { phone: identifier }
          : { email: identifier };

        user = await Teacher.findOne({ where: teacherWhereClause });

        if (user) {
          console.log("   ✅ Teacher topildi:", user.id);
          role = "teacher";
          userData = {
            id: user.id,
            full_name: user.full_name,
            phone: user.phone,
            email: user.email || "",
            role: "teacher",
            model: "Teacher",
          };
          userModel = user;
        }
      }

      // 3. Student ni tekshirish
      if (!user) {
        console.log("   Student qidirilmoqda...");

        // ID bilan
        const studentId = parseInt(identifier);
        if (!isNaN(studentId) && studentId > 0) {
          user = await Student.findByPk(studentId);
        }

        // Phone/email bilan
        if (!user) {
          const studentWhereClause = isPhoneNumber
            ? { phone: identifier }
            : { email: identifier };

          user = await Student.findOne({ where: studentWhereClause });
        }

        if (user) {
          console.log("   ✅ Student topildi:", user.id);
          role = "student";
          userData = {
            id: user.id,
            full_name: user.full_name,
            phone: user.phone,
            email: user.email || "",
            role: "student",
            model: "Student",
          };
          userModel = user;
        }
      }

      // User topilmadi
      if (!user) {
        console.log("❌ Hech qanday user topilmadi");
        return res.status(401).json({
          success: false,
          message: "Foydalanuvchi topilmadi",
        });
      }

      console.log("✅ User topildi:", {
        role: role,
        id: user.id,
        name: user.full_name,
      });

      // Parol tekshirish
      console.log("🔑 Parol tekshirilmoqda...");
      let isValidPassword = false;

      if (!userModel.password) {
        return res.status(401).json({
          success: false,
          message: "Parol o'rnatilmagan",
        });
      }

      try {
        // BCrypt hash
        if (userModel.password.startsWith("$2")) {
          isValidPassword = await bcrypt.compare(password, userModel.password);
        } else {
          // Plain text (development)
          isValidPassword = password === userModel.password;
        }
      } catch (compareError) {
        console.error("Parol solishtirish xatosi:", compareError);
        isValidPassword = false;
      }

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: "Parol noto'g'ri",
        });
      }

      console.log("✅ Parol to'g'ri");

      // Token yaratish
      const tokenPayload = {
        id: user.id,
        role: role,
        model: userData.model,
        phone: user.phone,
        full_name: user.full_name,
        email: user.email || "",
      };

      const token = jwt.sign(
        tokenPayload,
        JWT_SECRET || "fallback_secret_key_for_development_only_change_this",
        { expiresIn: "7d" }
      );

      console.log("✅ Token yaratildi, uzunligi:", token.length);

      res.json({
        success: true,
        message: `Xush kelibsiz, ${user.full_name}!`,
        token: token,
        user: userData,
      });
    } catch (error) {
      console.error("❌ Auto login xatosi:", error);
      res.status(500).json({
        success: false,
        message: "Server xatosi",
      });
    }
  },

  // PROFILE - TO'LIQ TUZATILGAN
  getProfile: async (req, res) => {
    try {
      console.log("👤 Profile so'rovi");
      console.log("   User:", req.user);

      if (!req.user || !req.user.id || !req.user.model) {
        return res.status(401).json({
          success: false,
          message: "Avtorizatsiya talab qilinadi",
        });
      }

      const { id, model } = req.user;
      let user = null;
      let userData = null;

      switch (model) {
        case "User":
          user = await User.findByPk(id);
          if (user) {
            userData = {
              id: user.id,
              full_name: user.full_name,
              phone: user.phone,
              email: user.email || "",
              role: "admin",
              created_at: user.createdAt,
            };
          }
          break;

        case "Teacher":
          user = await Teacher.findByPk(id);
          if (user) {
            userData = {
              id: user.id,
              full_name: user.full_name,
              phone: user.phone,
              email: user.email || "",
              role: "teacher",
              specialization: user.specialization,
              experience_years: user.experience_years,
              status: user.status,
              last_login: user.last_login,
            };
          }
          break;

        case "Student":
          user = await Student.findByPk(id);
          if (user) {
            userData = {
              id: user.id,
              full_name: user.full_name,
              phone: user.phone,
              email: user.email || "",
              parent_phone: user.parent_phone || "",
              role: "student",
              status: user.status,
              balance: user.balance || 0,
              total_owed: user.total_owed || 0,
              total_paid: user.total_paid || 0,
            };
          }
          break;

        default:
          return res.status(400).json({
            success: false,
            message: "Yaroqsiz user model",
          });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Foydalanuvchi topilmadi",
        });
      }

      res.json({
        success: true,
        user: userData,
      });
    } catch (error) {
      console.error("❌ Profile xatosi:", error);
      res.status(500).json({
        success: false,
        message: "Server xatosi",
      });
    }
  },

  // TOKEN VERIFY - TO'LIQ TUZATILGAN
  verifyToken: async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1] || req.body.token;

      if (!token) {
        return res.status(400).json({
          valid: false,
          message: "Token talab qilinadi",
        });
      }

      console.log("🔍 Token verify:", token.substring(0, 30) + "...");

      // JWT formatini tekshirish
      const parts = token.split(".");
      if (parts.length !== 3) {
        return res.json({
          valid: false,
          message: "Token JWT formatida emas",
          debug: { length: token.length },
        });
      }

      // JWT verify
      const decoded = jwt.verify(
        token,
        JWT_SECRET || "fallback_secret_key_for_development_only_change_this"
      );

      // User ma'lumotlarini olish
      let user = null;
      switch (decoded.model) {
        case "User":
          user = await User.findByPk(decoded.id);
          break;
        case "Teacher":
          user = await Teacher.findByPk(decoded.id);
          break;
        case "Student":
          user = await Student.findByPk(decoded.id);
          break;
      }

      if (!user) {
        return res.json({
          valid: false,
          message: "Foydalanuvchi topilmadi",
        });
      }

      res.json({
        valid: true,
        user: {
          id: user.id,
          full_name: user.full_name,
          role: decoded.role,
          model: decoded.model,
        },
      });
    } catch (error) {
      console.error("❌ Token verify xatosi:", error.message);

      if (error.name === "JsonWebTokenError") {
        return res.json({
          valid: false,
          message: "Yaroqsiz token",
        });
      }

      res.json({
        valid: false,
        message: "Token tekshirishda xatolik",
      });
    }
  },
};
