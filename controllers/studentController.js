const {
  Student,
  Group,
  Course,
  Lesson,
  Payment,
  GroupStudent,
  sequelize,
} = require("../models");
const { Op, literal } = require("sequelize");
const bcrypt = require("bcryptjs");

// ===================== AUTH FUNCTIONS =====================

// Student login
exports.studentLogin = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Telefon raqam va parol kiritishingiz kerak",
      });
    }

    // Telefon raqamni tozalash
    const cleanPhone = phone.replace(/\D/g, "");

    // Studentni topish
    const student = await Student.findOne({
      where: {
        phone: cleanPhone,
        status: "active",
      },
      attributes: { include: ["password"] }, // Password ni ham olish uchun
    });

    if (!student) {
      return res.status(401).json({
        success: false,
        message: "Telefon raqam yoki parol noto'g'ri",
      });
    }

    // Parolni tekshirish
    const isPasswordValid = await student.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Telefon raqam yoki parol noto'g'ri",
      });
    }

    // Last login yangilash
    await student.update({ last_login: new Date() });

    // Student ma'lumotlari (password'siz)
    const studentData = student.toJSON();

    res.status(200).json({
      success: true,
      message: "Muvaffaqiyatli kirish",
      student: studentData,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server xatosi",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Student parolini o'zgartirish
exports.changeStudentPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Joriy va yangi parol kiritishingiz kerak",
      });
    }

    const student = await Student.findByPk(id, {
      attributes: { include: ["password"] },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student topilmadi",
      });
    }

    // Joriy parolni tekshirish
    const isPasswordValid = await student.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Joriy parol noto'g'ri",
      });
    }

    // Yangi parolni o'rnatish
    await student.update({ password: newPassword });

    res.status(200).json({
      success: true,
      message: "Parol muvaffaqiyatli yangilandi",
    });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({
      success: false,
      message: "Parolni yangilashda xatolik",
    });
  }
};

// Admin tomonidan student parolini qayta o'rnatish
exports.resetStudentPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "Yangi parol kiritishingiz kerak",
      });
    }

    const student = await Student.findByPk(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student topilmadi",
      });
    }

    // Yangi parolni o'rnatish
    await student.update({ password: newPassword });

    res.status(200).json({
      success: true,
      message: "Parol muvaffaqiyatli qayta o'rnatildi",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Parolni qayta o'rnatishda xatolik",
    });
  }
};
exports.createStudent = async (req, res) => {
  try {
    const {
      full_name,
      phone,
      parent_phone,
      birth_date,
      address,
      notes,
      status = "active",
    } = req.body;

    // Validatsiya
    if (!full_name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Ism va telefon raqam majburiy",
      });
    }

    // Telefon raqamni tekshirish
    const cleanPhone = phone.replace(/\D/g, "");
    const existingStudent = await Student.findOne({
      where: { phone: cleanPhone },
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: "Bu telefon raqam allaqachon ro'yxatdan o'tgan",
      });
    }

    // Parol avtomatik yaratish (telefon raqamning oxirgi 6 raqami)
    const defaultPassword = cleanPhone.slice(-6);

    // Yangi student yaratish
    const student = await Student.create({
      full_name,
      phone: cleanPhone,
      parent_phone: parent_phone ? parent_phone.replace(/\D/g, "") : null,
      birth_date,
      address,
      notes,
      status,
      password: defaultPassword,
    });

    res.status(201).json({
      success: true,
      message: "Student muvaffaqiyatli yaratildi",
      student: student.toJSON(),
      // Admin uchun parolni ko'rsatish (faqat yaratilgan paytda)
      temporaryPassword: defaultPassword,
    });
  } catch (error) {
    console.error("Error creating student:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "Bu telefon raqam allaqachon mavjud",
      });
    }

    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validatsiya xatosi",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Student yaratishda xatolik",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Barcha studentlarni olish (simple version)
exports.getStudentsSimple = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10, status } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    if (search) {
      where[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const { rows, count } = await Student.findAndCountAll({
      where,
      attributes: { exclude: ["password"] }, // Password ni olib tashlash
      limit: limitNum,
      offset: offset,
      order: [["id", "ASC"]],
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        totalCount: count,
        limit: limitNum,
      },
    });
  } catch (e) {
    console.error("Error fetching students:", e);
    res.status(500).json({
      success: false,
      message: "Studentlarni olishda xatolik",
    });
  }
};

// ID bo'yicha studentni olish
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id, {
      include: [
        {
          model: Group,
          as: "Group",
          attributes: ["id", "name", "price", "status"],
          through: { attributes: [] },
        },
        {
          model: Payment,
          as: "Payments",
          attributes: ["id", "amount", "method", "status"],
        },
      ],
      attributes: {
        include: [
          [
            literal(`
              COALESCE(
                (SELECT SUM(amount) FROM Payments as payments 
                 WHERE payments.student_id = Student.id 
                 AND payments.status = 'completed'), 0
              )
            `),
            "total_paid",
          ],
          [
            literal(`
              COALESCE(
                (SELECT SUM(price) FROM Groups as groups 
                 INNER JOIN group_students ON groups.id = group_students.group_id
                 WHERE group_students.student_id = Student.id), 0
              )
            `),
            "total_owed",
          ],
        ],
        exclude: ["password"], // Password ni olib tashlash
      },
      distinct: true,
    });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student topilmadi",
      });
    }
    // console.log(student.dataValues);

    const total_paid = parseFloat(student.dataValues.total_paid);
    const total_owed = parseFloat(student.dataValues.total_owed);
    student.dataValues.balance = total_paid - total_owed;

    res.json({
      success: true,
      data: student,
    });
  } catch (e) {
    console.error("Error fetching student:", e);
    res.status(500).json({
      success: false,
      message: "Studentni olishda xatolik",
    });
  }
};

// Studentni yangilash
exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Agar telefon raqam yangilansa, tekshirish
    if (updateData.phone) {
      updateData.phone = updateData.phone.replace(/\D/g, "");

      // Boshqa studentda shu telefon raqam borligini tekshirish
      const existingStudent = await Student.findOne({
        where: {
          phone: updateData.phone,
          id: { [Op.ne]: id },
        },
      });

      if (existingStudent) {
        return res.status(400).json({
          success: false,
          message: "Bu telefon raqam allaqachon boshqa studentda mavjud",
        });
      }
    }

    // Agar parent_phone yangilansa, tozalash
    if (updateData.parent_phone) {
      updateData.parent_phone = updateData.parent_phone.replace(/\D/g, "");
    }

    const student = await Student.findByPk(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student topilmadi",
      });
    }

    await student.update(updateData);

    res.json({
      success: true,
      message: "Student muvaffaqiyatli yangilandi",
      data: student.toJSON(),
    });
  } catch (e) {
    console.error("Error updating student:", e);

    if (e.name === "SequelizeValidationError") {
      const errors = e.errors.map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validatsiya xatosi",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Studentni yangilashda xatolik",
    });
  }
};

// Studentni o'chirish (soft delete - status'ni o'zgartirish)
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    const student = await Student.findByPk(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student topilmadi",
      });
    }

    if (permanent === "true") {
      // Haqiqiy o'chirish
      await student.destroy();
      return res.json({
        success: true,
        message: "Student butunlay o'chirildi",
      });
    } else {
      // Soft delete - faqat status'ni o'zgartirish
      await student.update({ status: "inactive" });
      return res.json({
        success: true,
        message: "Student faolligi o'chirildi",
      });
    }
  } catch (e) {
    console.error("Error deleting student:", e);
    res.status(500).json({
      success: false,
      message: "Studentni o'chirishda xatolik",
    });
  }
};

// Studentni qayta faollashtirish
exports.activateStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findByPk(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student topilmadi",
      });
    }

    await student.update({ status: "active" });

    res.json({
      success: true,
      message: "Student muvaffaqiyatli faollashtirildi",
      data: student.toJSON(),
    });
  } catch (e) {
    console.error("Error activating student:", e);
    res.status(500).json({
      success: false,
      message: "Studentni faollashtirishda xatolik",
    });
  }
};

// Barcha studentlarni advanced filterlar bilan olish
exports.getStudents = async (req, res) => {
  try {
    const {
      status,
      search,
      group_id,
      page = 1,
      limit = 20,
      sortBy = "created_at",
      sortOrder = "DESC",
    } = req.query;

    // Build query conditions
    const whereConditions = {};

    // Status filter
    if (status) {
      whereConditions.status = status;
    }

    // Search filter
    if (search) {
      const cleanSearch = search.replace(/\D/g, "");
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${cleanSearch}%` } }, // Faqat raqamlar bilan qidirish
        { parent_phone: { [Op.like]: `%${search}%` } },
      ];
    }

    // Group filter
    let groupFilter = {};
    if (group_id) {
      groupFilter = {
        model: Group,
        as: "Group",
        where: { id: group_id },
        through: { attributes: [] },
      };
    }

    // Pagination calculations
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Studentlarni olish
    const students = await Student.findAll({
      where: whereConditions,
      include: [
        groupFilter.model
          ? groupFilter
          : {
              model: Group,
              as: "Group",
              attributes: ["id", "name", "price"],
              through: { attributes: [] },
            },
        {
          model: Payment,
          as: "Payments",
          attributes: ["id", "amount", "method", "status"],
          separate: true,
          limit: 5,
        },
      ],
      attributes: {
        include: [
          [
            literal(`
              COALESCE(
                (SELECT SUM(amount) FROM Payments as payments 
                 WHERE payments.student_id = Student.id 
                 AND payments.status = 'completed'), 0
              )
            `),
            "total_paid",
          ],
          [
            literal(`
              COALESCE(
                (SELECT SUM(price) FROM Groups as groups 
                 INNER JOIN group_students ON groups.id = group_students.group_id
                 WHERE group_students.student_id = Student.id), 0
              )
            `),
            "total_owed",
          ],
        ],
        exclude: ["password"], // Password ni olib tashlash
      },
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: limitNum,
      offset: offset,
      distinct: true,
    });

    // Total count for pagination
    const total = await Student.count({
      where: whereConditions,
    });

    // Balance hisoblash va to'liq ma'lumotlarni qaytarish
    const studentsWithBalance = students.map((student) => {
      const studentData = student.toJSON();
      const totalPaid = parseFloat(studentData.total_paid) || 0;
      const totalOwed = parseFloat(studentData.total_owed) || 0;
      const balance = totalPaid - totalOwed;

      return {
        ...studentData,
        balance,
        total_paid: totalPaid,
        total_owed: totalOwed,
      };
    });

    res.status(200).json({
      success: true,
      data: studentsWithBalance,
      pagination: {
        count: studentsWithBalance.length,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({
      success: false,
      message: "Studentlarni olishda xatolik",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Faqat active studentlarni olish
exports.getActiveStudents = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;

    const whereConditions = {
      status: "active",
    };

    // Search filter
    if (search) {
      const cleanSearch = search.replace(/\D/g, "");
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${cleanSearch}%` } },
        { parent_phone: { [Op.like]: `%${search}%` } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Studentlarni olish
    const students = await Student.findAll({
      where: whereConditions,
      include: [
        {
          model: Group,
          as: "Group",
          attributes: ["id", "name", "price", "status"],
          through: { attributes: [] },
        },
        {
          model: Payment,
          as: "Payments",
          attributes: ["id", "amount", "method", "status"],
          where: { status: "completed" },
          required: false,
          separate: true,
        },
      ],
      attributes: {
        include: [
          [
            literal(`
              COALESCE(
                (SELECT SUM(amount) FROM Payments as payments 
                 WHERE payments.student_id = Student.id 
                 AND payments.status = 'completed'), 0
              ) - 
              COALESCE(
                (SELECT SUM(groups.price) FROM Groups as groups 
                 INNER JOIN group_students ON groups.id = group_students.group_id
                 WHERE group_students.student_id = Student.id), 0
              )
            `),
            "balance",
          ],
          [
            literal(`
              COALESCE(
                (SELECT COUNT(*) FROM group_students 
                 WHERE group_students.student_id = Student.id), 0
              )
            `),
            "total_groups",
          ],
          [
            literal(`
              COALESCE(
                (SELECT SUM(amount) FROM Payments as payments 
                 WHERE payments.student_id = Student.id 
                 AND payments.status = 'completed'), 0
              )
            `),
            "total_paid",
          ],
        ],
        exclude: ["password"],
      },
      order: [["createdAt", "DESC"]],
      limit: limitNum,
      offset: offset,
      distinct: true,
    });

    // Total count
    const total = await Student.count({
      where: whereConditions,
    });

    res.status(200).json({
      success: true,
      data: students,
      pagination: {
        count: students.length,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error fetching active students:", error);
    res.status(500).json({
      success: false,
      message: "Faol studentlarni olishda xatolik",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Studentni guruhga qo'shish
exports.addStudentToGroup = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { groupId } = req.body;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: "Guruh ID si kiritilishi kerak",
      });
    }

    const student = await Student.findByPk(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student topilmadi",
      });
    }

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Guruh topilmadi",
      });
    }

    // Check if student is already in the group
    const existing = await GroupStudent.findOne({
      where: { student_id: studentId, group_id: groupId },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Student allaqachon ushbu guruhda",
      });
    }

    // Add student to group
    await student.addGroup(group);

    res.status(200).json({
      success: true,
      message: "Student guruhga muvaffaqiyatli qo'shildi",
    });
  } catch (error) {
    console.error("Error adding student to group:", error);
    res.status(500).json({
      success: false,
      message: "Studentni guruhga qo'shishda xatolik",
    });
  }
};

// Studentni guruhdan o'chirish
exports.removeStudentFromGroup = async (req, res) => {
  try {
    const { studentId, groupId } = req.params;

    const result = await GroupStudent.destroy({
      where: { student_id: studentId, group_id: groupId },
    });

    if (result === 0) {
      return res.status(404).json({
        success: false,
        message: "Student guruhda topilmadi",
      });
    }

    res.status(200).json({
      success: true,
      message: "Student guruhdan muvaffaqiyatli o'chirildi",
    });
  } catch (error) {
    console.error("Error removing student from group:", error);
    res.status(500).json({
      success: false,
      message: "Studentni guruhdan o'chirishda xatolik",
    });
  }
};

// Studentning to'lovlarini olish
exports.getStudentPayments = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const where = { student_id: id };
    if (status) {
      where.status = status;
    }

    const { rows: payments, count } = await Payment.findAndCountAll({
      where,
      limit: limitNum,
      offset: offset,
    });

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        total: count,
        page: pageNum,
        pages: Math.ceil(count / limitNum),
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error fetching student payments:", error);
    res.status(500).json({
      success: false,
      message: "Student to'lovlarini olishda xatolik",
    });
  }
};

// Student statistikasini olish
exports.getStudentStats = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findByPk(id, {
      include: [
        {
          model: Group,
          as: "Group",
          attributes: ["id", "name", "price", "status"],
          through: { attributes: [] },
        },
        {
          model: Payment,
          as: "Payments",
          attributes: ["id", "amount", "method", "status"],
        },
      ],
      attributes: { exclude: ["password"] },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student topilmadi",
      });
    }

    // Calculate statistics
    const totalPaid = await Payment.sum("amount", {
      where: { student_id: id, status: "completed" },
    });

    const totalGroups = await GroupStudent.count({
      where: { student_id: id },
    });

    const upcomingLessons = await Lesson.count({
      include: [
        {
          model: Group,
          as: "group",
          include: [
            {
              model: Student,
              as: "students",
              where: { id: id },
              through: { attributes: [] },
            },
          ],
        },
      ],
      where: {
        date: { [Op.gte]: new Date() },
        status: "scheduled",
      },
    });

    const stats = {
      total_paid: totalPaid || 0,
      total_groups: totalGroups || 0,
      upcoming_lessons: upcomingLessons || 0,
      current_balance: (totalPaid || 0) - (student.total_owed || 0),
    };

    res.status(200).json({
      success: true,
      data: {
        student: student.toJSON(),
        stats,
      },
    });
  } catch (error) {
    console.error("Error fetching student stats:", error);
    res.status(500).json({
      success: false,
      message: "Student statistikasini olishda xatolik",
    });
  }
};

// Studentning guruhlarini olish
exports.getStudentGroups = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findByPk(id, {
      include: [
        {
          model: Group,
          as: "Group",
          attributes: [
            "id",
            "name",
            "price",
            "status",
            "start_date",
            "end_date",
          ],
          through: { attributes: ["created_at"] },
        },
      ],
      attributes: { exclude: ["password"] },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student topilmadi",
      });
    }

    res.status(200).json({
      success: true,
      data: student.Group || [],
    });
  } catch (error) {
    console.error("Error fetching student groups:", error);
    res.status(500).json({
      success: false,
      message: "Student guruhlarini olishda xatolik",
    });
  }
};

// Student ma'lumotlarini export qilish (o'zbekcha nomlar bilan)
exports.exportStudents = async (req, res) => {
  try {
    const { status, format = "json" } = req.query;

    const whereConditions = {};
    if (status) {
      whereConditions.status = status;
    }

    const students = await Student.findAll({
      where: whereConditions,
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]],
    });

    if (format === "csv") {
      // O'zbekcha nomlar bilan CSV
      const csvData = students.map((student) => ({
        ID: student.id,
        "To'liq ism": student.full_name,
        Telefon: student.phone,
        "Ota-ona telefoni": student.parent_phone || "",
        "Tug'ilgan sana": student.birth_date || "",
        Status:
          student.status === "active"
            ? "Faol"
            : student.status === "inactive"
            ? "Nofaol"
            : "Bloklangan",
        "Ro'yxatdan o'tgan sana": student.registered_at,
        Manzil: student.address || "",
        Izoh: student.notes || "",
        "Oxirgi kirish": student.last_login || "",
      }));

      // CSV header qatori
      const headers = Object.keys(csvData[0]);

      // CSV body qatorlari
      const rows = csvData.map((row) =>
        headers.map((header) => {
          let value = row[header];
          // Agar matn bo'lsa va vergul yoki qo'shtirnoq bo'lsa, escape qilamiz
          if (
            typeof value === "string" &&
            (value.includes(",") || value.includes('"'))
          ) {
            value = `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
      );

      // CSV ni yaratish
      const csvString = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");

      // UTF-8 BOM qo'shamiz (o'zbekcha harflar uchun)
      const bom = "\ufeff";
      const csvWithBom = bom + csvString;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=students_${
          new Date().toISOString().split("T")[0]
        }.csv`
      );
      return res.send(csvWithBom);
    }

    // JSON formatida qaytarish
    res.status(200).json({
      success: true,
      data: students,
      count: students.length,
    });
  } catch (error) {
    console.error("Error exporting students:", error);
    res.status(500).json({
      success: false,
      message: "Studentlarni export qilishda xatolik",
    });
  }
};
