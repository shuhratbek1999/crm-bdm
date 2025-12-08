const { Teacher } = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

const teacherController = {
  createTeacher: async (req, res) => {
    try {
      const {
        full_name,
        phone,
        password,
        role = "teacher",
        specialization,
        experience_years,
        birth_date,
        address,
        status = "active",
      } = req.body;

      // Validation
      if (!full_name || !phone || !password) {
        return res.status(400).json({
          success: false,
          message: "Full name, phone and password are required",
        });
      }

      // Check if phone already exists
      const existingTeacher = await Teacher.findOne({ where: { phone } });
      if (existingTeacher) {
        return res.status(400).json({
          success: false,
          message: "Phone number already registered",
        });
      }

      // Create teacher
      const teacher = await Teacher.create({
        full_name,
        phone,
        password, // Password hash qilinadi (model hooks)
        role,
        specialization: specialization || null,
        experience_years: experience_years || null,
        birth_date: birth_date || null,
        address: address || null,
        status,
        is_verified: true, // Admin tomonidan yaratilgani uchun verified
      });

      // Don't send password in response
      const teacherResponse = teacher.toJSON();
      delete teacherResponse.password;
      delete teacherResponse.verification_code;

      res.status(201).json({
        success: true,
        message: "Teacher created successfully",
        data: teacherResponse,
      });
    } catch (error) {
      console.error("Create teacher error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create teacher",
      });
    }
  },

  getAllTeachers: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        status,
        role,
        sortBy = "createdAt",
        sortOrder = "DESC",
      } = req.query;

      const whereCondition = {};

      // Search filter
      if (search) {
        whereCondition[Op.or] = [
          { full_name: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } },
          { specialization: { [Op.like]: `%${search}%` } },
          { address: { [Op.like]: `%${search}%` } },
        ];
      }

      // Status filter
      if (status && status !== "all") {
        whereCondition.status = status;
      }

      // Role filter
      if (role && role !== "all") {
        whereCondition.role = role;
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      const { count, rows: teachers } = await Teacher.findAndCountAll({
        where: whereCondition,
        attributes: {
          exclude: ["password", "verification_code"],
        },
        limit: limitNum,
        offset: offset,
        order: [[sortBy, sortOrder]],
      });

      res.json({
        success: true,
        data: teachers,
        pagination: {
          total: count,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(count / limitNum),
        },
      });
    } catch (error) {
      console.error("Get all teachers error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get teachers",
      });
    }
  },

  getTeacherById: async (req, res) => {
    try {
      const { id } = req.params;

      const teacher = await Teacher.findByPk(id, {
        attributes: { exclude: ["password", "verification_code"] },
      });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      res.json({
        success: true,
        data: teacher,
      });
    } catch (error) {
      console.error("Get teacher by ID error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get teacher",
      });
    }
  },

  updateTeacher: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Check if teacher exists
      const teacher = await Teacher.findByPk(id);
      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      // If phone is being updated, check for duplicates
      if (updateData.phone && updateData.phone !== teacher.phone) {
        const existingTeacher = await Teacher.findOne({
          where: { phone: updateData.phone },
        });

        if (existingTeacher && existingTeacher.id !== parseInt(id)) {
          return res.status(400).json({
            success: false,
            message: "Phone number already registered to another teacher",
          });
        }
      }

      // Remove password if present (should use separate endpoint for password)
      if (updateData.password) {
        // If password update is needed, use changePassword endpoint
        delete updateData.password;
      }

      // Update teacher
      await Teacher.update(updateData, {
        where: { id },
      });

      // Get updated teacher
      const updatedTeacher = await Teacher.findByPk(id, {
        attributes: { exclude: ["password", "verification_code"] },
      });

      res.json({
        success: true,
        message: "Teacher updated successfully",
        data: updatedTeacher,
      });
    } catch (error) {
      console.error("Update teacher error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update teacher",
      });
    }
  },

  deleteTeacher: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if teacher exists
      const teacher = await Teacher.findByPk(id);
      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      // Soft delete (if paranoid is true in model)
      await Teacher.destroy({
        where: { id },
      });

      res.json({
        success: true,
        message: "Teacher deleted successfully",
      });
    } catch (error) {
      console.error("Delete teacher error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete teacher",
      });
    }
  },

  updateTeacherStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // Validate status
      const validStatuses = ["active", "inactive", "blocked"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status value",
        });
      }

      // Check if teacher exists
      const teacher = await Teacher.findByPk(id);
      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      // Update status
      await Teacher.update({ status }, { where: { id } });

      res.json({
        success: true,
        message: `Teacher status updated to ${status}`,
      });
    } catch (error) {
      console.error("Update teacher status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update teacher status",
      });
    }
  },

  resetTeacherPassword: async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({
          success: false,
          message: "New password is required",
        });
      }

      // Check if teacher exists
      const teacher = await Teacher.findByPk(id);
      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      // Update password (will be hashed by model hook)
      teacher.password = newPassword;
      await teacher.save();

      res.json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (error) {
      console.error("Reset teacher password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset password",
      });
    }
  },

  generateTempPassword: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if teacher exists
      const teacher = await Teacher.findByPk(id);
      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      // Generate 6-digit temporary password
      const tempPassword = Math.floor(
        100000 + Math.random() * 900000
      ).toString();

      // Update password
      teacher.password = tempPassword;
      await teacher.save();

      res.json({
        success: true,
        message: "Temporary password generated",
        data: {
          temporary_password: tempPassword,
          teacher_id: teacher.id,
          full_name: teacher.full_name,
          phone: teacher.phone,
        },
      });
    } catch (error) {
      console.error("Generate temp password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate temporary password",
      });
    }
  },
  register: async (req, res) => {
    try {
      const {
        full_name,
        phone,
        password,
        specialization,
        experience_years,
        birth_date,
        address,
        role = "teacher",
      } = req.body;

      // Check if phone already exists
      const existingTeacher = await Teacher.findOne({ where: { phone } });
      if (existingTeacher) {
        return res.status(400).json({
          success: false,
          message: "Phone number already registered",
        });
      }

      // Create teacher
      const teacher = await Teacher.create({
        full_name,
        phone,
        password,
        specialization,
        experience_years,
        birth_date,
        address,
        role,
        is_verified: false, // Admin tomonidan verify qilinishi kerak
        verification_code: Math.floor(
          100000 + Math.random() * 900000
        ).toString(),
      });

      // Token yaratish
      const token = jwt.sign(
        {
          id: teacher.id,
          phone: teacher.phone,
          role: teacher.role,
          user_type: "teacher",
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(201).json({
        success: true,
        message:
          "Teacher registered successfully. Please wait for admin verification.",
        data: {
          id: teacher.id,
          full_name: teacher.full_name,
          phone: teacher.phone,
          role: teacher.role,
          token,
        },
      });
    } catch (error) {
      console.error("Teacher registration error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to register teacher",
      });
    }
  },

  // Teacher profile ko'rish (Authenticated teacher)
  getProfile: async (req, res) => {
    try {
      const teacherId = req.user.id;

      const teacher = await Teacher.findByPk(teacherId, {
        attributes: { exclude: ["password", "verification_code"] },
      });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      res.json({
        success: true,
        data: teacher,
      });
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get profile",
      });
    }
  },

  // Teacher profile yangilash (Authenticated teacher)
  updateProfile: async (req, res) => {
    try {
      const teacherId = req.user.id;
      const updateData = req.body;

      // Remove sensitive fields
      delete updateData.password;
      delete updateData.role; // Role o'zgartirilmasin
      delete updateData.status; // Status o'zgartirilmasin
      delete updateData.is_verified; // Verification o'zgartirilmasin

      // Update qilish
      await Teacher.update(updateData, {
        where: { id: teacherId },
      });

      // Yangilangan teacher ni olish
      const teacher = await Teacher.findByPk(teacherId, {
        attributes: { exclude: ["password", "verification_code"] },
      });

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: teacher,
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update profile",
      });
    }
  },

  // Teacher parol yangilash (Authenticated teacher)
  changePassword: async (req, res) => {
    try {
      const teacherId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      const teacher = await Teacher.findByPk(teacherId);

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      // Hozirgi parolni tekshirish
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        teacher.password
      );

      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // Yangi parol bilan update qilish
      teacher.password = newPassword;
      await teacher.save();

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to change password",
      });
    }
  },

  // Get teacher statistics (Authenticated teacher)
  getTeacherStats: async (req, res) => {
    try {
      const teacherId = req.user.id;

      // Bu yerda teacher statistikalarini hisoblash
      // Masalan: guruhlar soni, studentlar soni, bugungi davomat, oylik to'lovlar

      const stats = {
        total_groups: 0,
        total_students: 0,
        active_groups: 0,
        upcoming_classes: 0,
        monthly_income: 0,
        attendance_rate: 0,
      };

      // Kelajakda Groups modeli bilan bog'lash kerak
      // const groups = await Group.count({ where: { teacher_id: teacherId } });
      // stats.total_groups = groups;

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Get teacher stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get teacher statistics",
      });
    }
  },
};

module.exports = teacherController;
