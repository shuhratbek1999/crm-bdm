// controllers/courseController.js
const { Course, Group, User, sequelize } = require("../models");
const { Op } = require("sequelize");

const getAllCourses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      category,
      level,
      status = "active",
    } = req.query;

    const whereClause = {};

    // Search qilish
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } }, // MySQL uchun [Op.like]
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    // Filter by category
    if (category && category !== "all") {
      whereClause.category = category;
    }

    // Filter by level
    if (level && level !== "all") {
      whereClause.level = level;
    }

    // Filter by status
    if (status && status !== "all") {
      whereClause.status = status;
    }

    const offset = (page - 1) * limit;

    const { count, rows: courses } = await Course.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "full_name", "phone"],
        },
        {
          model: Group,
          as: "groups",
          attributes: ["id", "name"],
          where: { status: "active" },
          required: false,
        },
      ],
      // MySQL uchun to'g'ri SQL syntax
      attributes: {
        include: [
          [
            sequelize.literal(
              `(SELECT COUNT(*) FROM groups Groups WHERE Groups.course_id = Course.id AND Groups.status = 'active')`
            ),
            "active_groups_count",
          ],
        ],
      },
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    // console.log(req.query);

    res.json({
      success: true,
      data: courses,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(count / limit),
        totalRecords: count,
      },
    });
  } catch (error) {
    console.error("Get courses error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching courses",
      error: error.message,
    });
  }
};

// Bitta kursni olish
const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findByPk(id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "full_name", "phone"],
        },
        {
          model: Group,
          as: "groups",
          include: [
            {
              model: Teacher,
              as: "teacher",
              attributes: ["id", "full_name"],
            },
          ],
        },
      ],
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.json({
      success: true,
      data: course,
    });
  } catch (error) {
    console.error("Get course error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching course",
      error: error.message,
    });
  }
};

// Yangi kurs yaratish
const createCourse = async (req, res) => {
  try {
    console.log(req.user);

    const {
      name,
      description,
      category,
      level,
      duration_months,
      lessons_per_week,
      lesson_duration,
      price,
      color,
      icon,
      status,
    } = req.body;

    // Nom takrorlanmasligini tekshirish
    const existingCourse = await Course.findOne({ where: { name } });
    if (existingCourse) {
      return res.status(400).json({
        success: false,
        message: "Course with this name already exists",
      });
    }

    const course = await Course.create({
      name,
      description,
      category,
      level,
      duration_months,
      lessons_per_week,
      lesson_duration,
      price,
      color,
      icon,
      status,
      created_by: req.user.id, // Auth middleware dan
    });

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: course,
    });
  } catch (error) {
    console.error("Create course error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating course",
      error: error.message,
    });
  }
};

// Kursni yangilash
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const course = await Course.findByPk(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Nom takrorlanmasligini tekshirish (agar yangilansa)
    if (updateData.name && updateData.name !== course.name) {
      const existingCourse = await Course.findOne({
        where: {
          name: updateData.name,
          id: { [Op.ne]: id },
        },
      });
      if (existingCourse) {
        return res.status(400).json({
          success: false,
          message: "Course with this name already exists",
        });
      }
    }

    await course.update(updateData);

    res.json({
      success: true,
      message: "Course updated successfully",
      data: course,
    });
  } catch (error) {
    console.error("Update course error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating course",
      error: error.message,
    });
  }
};

// Kursni o'chirish (soft delete emas)
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findByPk(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Kursga bog'langan active guruhlar borligini tekshirish
    const activeGroups = await Group.count({
      where: {
        course_id: id,
        status: "active",
      },
    });

    if (activeGroups > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete course with active groups",
      });
    }

    await course.destroy();

    res.json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Delete course error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting course",
      error: error.message,
    });
  }
};

// Kurs statistikasi
const getCourseStats = async (req, res) => {
  try {
    const totalCourses = await Course.count();
    const activeCourses = await Course.count({ where: { status: "active" } });

    // Har bir kategoriyadagi kurslar soni
    const categories = await Course.findAll({
      attributes: [
        "category",
        [sequelize.fn("COUNT", sequelize.col("id")), "course_count"],
      ],
      group: ["category"],
      raw: true,
    });

    // Har bir level dagi kurslar soni
    const levels = await Course.findAll({
      attributes: [
        "level",
        [sequelize.fn("COUNT", sequelize.col("id")), "course_count"],
      ],
      group: ["level"],
      raw: true,
    });

    res.json({
      success: true,
      data: {
        totalCourses,
        activeCourses,
        categories,
        levels,
      },
    });
  } catch (error) {
    console.error("Get course stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching course statistics",
      error: error.message,
    });
  }
};

// Kurs kategoriyalarini olish
const getCourseCategories = async (req, res) => {
  try {
    const categories = await Course.findAll({
      attributes: [
        "category",
        [sequelize.fn("COUNT", sequelize.col("id")), "course_count"],
      ],
      group: ["category"],
      order: [[sequelize.fn("COUNT", sequelize.col("id")), "DESC"]],
      raw: true,
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Get course categories error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching course categories",
      error: error.message,
    });
  }
};

module.exports = {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseStats,
  getCourseCategories,
};
