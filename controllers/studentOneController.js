const {
  Student,
  Group,
  Course,
  Payment,
  Lesson,
  Teacher,
  Room,
  Attendance,
  GroupStudent,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");

exports.getPaymentSummary = async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Student not authenticated",
      });
    }

    // Get total paid amount (completed payments)
    const totalPaid = await Payment.sum("amount", {
      where: {
        student_id: studentId,
        status: "completed",
      },
    });

    // Get pending amount
    const pendingAmount = await Payment.sum("amount", {
      where: {
        student_id: studentId,
        status: "pending",
      },
    });

    // Get total transactions count
    const totalTransactions = await Payment.count({
      where: {
        student_id: studentId,
      },
    });

    // Calculate upcoming payments (active groups' total price minus paid)
    const activeGroups = await GroupStudent.findAll({
      where: {
        student_id: studentId,
        status: "active",
      },
      include: [
        {
          model: Group,
          as: "Group",
          where: {
            status: "active",
          },
          attributes: ["id", "price"],
        },
      ],
    });

    let upcomingPayments = 0;

    // For each active group, calculate remaining payment
    for (const groupStudent of activeGroups) {
      if (groupStudent.Group) {
        const groupId = groupStudent.Group.id;
        const groupPrice = parseFloat(groupStudent.Group.price) || 0;

        // Get total paid for this group
        const paidForGroup =
          (await Payment.sum("amount", {
            where: {
              student_id: studentId,
              // status: 'completed', // Faqat completed to'lovlarni hisoblash
              comment: {
                [Op.like]: `%group:${groupId}%`,
              },
            },
          })) || 0;

        const remaining = Math.max(0, groupPrice - paidForGroup);
        upcomingPayments += remaining;
      }
    }

    // Alternative: Simple calculation based on active groups
    // const upcomingPayments = activeGroups.reduce((sum, gs) => {
    //   return sum + (parseFloat(gs.Group?.price) || 0);
    // }, 0);

    res.status(200).json({
      success: true,
      data: {
        totalPaid: totalPaid || 0,
        pendingAmount: pendingAmount || 0,
        upcomingPayments: upcomingPayments || 0,
        totalTransactions: totalTransactions || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching payment summary:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
function generateLessonSchedule(group, days, time, start, end) {
  const schedule = [];
  const currentDate = new Date(start);

  while (currentDate <= end) {
    const dayName = currentDate
      .toLocaleDateString("en-US", { weekday: "long" })
      .toLowerCase();

    if (days.includes(dayName)) {
      const lessonDate = new Date(currentDate);
      const [hours, minutes] = time.split(":");
      lessonDate.setHours(parseInt(hours), parseInt(minutes), 0);
      // console.log(group.Course, group.Teacher, group.Room);

      schedule.push({
        id: `temp_${group.id}_${currentDate.getTime()}`,
        group_id: group.id,
        group_name: group.name,
        date: lessonDate.toISOString().split("T")[0],
        time: time,
        day: dayName,
        full_date: lessonDate,
        type: "scheduled",
        teacher_name: group.Teacher?.full_name,
        room_name: group.Room?.name,
        course_name: group.Course?.name,
        course_color: group.Course?.color,
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return schedule;
}
exports.getMyCourses = async (req, res) => {
  try {
    const studentId = req.user.id || req.student.id;

    // Studentning guruhlarini olish
    const student = await Student.findOne({
      where: { id: studentId },
      include: [
        {
          model: Group,
          as: "Group",
          through: { attributes: [] }, // GroupStudent jadvalidan ma'lumot olinmasin
          include: [
            {
              model: Course,
              as: "Course",
              attributes: [
                "id",
                "name",
                "description",
                "category",
                "level",
                "icon",
                "color",
              ],
            },
            {
              model: Teacher,
              as: "Teacher",
              attributes: ["id", "full_name", "phone"],
            },
            {
              model: Room,
              as: "Room",
              attributes: ["id", "name"],
            },
          ],
          attributes: [
            "id",
            "name",
            "price",
            "duration_months",
            "lessons_per_week",
            "lesson_duration",
            "status",
            "start_date",
            "end_date",
            "schedule_days",
            "schedule_time",
            "current_students",
            "max_students",
          ],
        },
      ],
      attributes: ["id", "full_name", "phone"],
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Kurslarni formatlash
    const courses = student.Group.map((group) => ({
      id: group.id,
      name: group.name,
      course: {
        id: group.Course.id,
        name: group.Course.name,
        description: group.Course.description,
        category: group.Course.category,
        level: group.Course.level,
        icon: group.Course.icon,
        color: group.Course.color,
      },
      teacher: group.Teacher,
      room: group.Room,
      price: group.price,
      duration_months: group.duration_months,
      lessons_per_week: group.lessons_per_week,
      lesson_duration: group.lesson_duration,
      status: group.status,
      start_date: group.start_date,
      end_date: group.end_date,
      schedule: {
        days: group.schedule_days,
        time: group.schedule_time,
      },
      students: {
        current: group.current_students,
        max: group.max_students,
      },
      progress: calculateProgress(group.start_date, group.end_date),
    }));

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    console.error("Error getting student courses:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getMySchedule = async (req, res) => {
  try {
    // console.log("ishladiii", req.user.id, req.query);

    const studentId = req.user.id || req.student.id;
    const { startDate, endDate } = req.query;

    // Studentning aktiv guruhlarini olish
    const student = await Student.findOne({
      where: { id: studentId },
      include: [
        {
          model: Group,
          as: "Group",
          through: {
            attributes: [],
          },
          where: {
            status: "active",
          },
          attributes: ["id", "name", "schedule_days", "schedule_time"],
          include: [
            {
              model: Course,
              as: "Course",
              attributes: ["id", "name", "color"],
            },
            { model: Teacher, as: "Teacher", attributes: ["id", "full_name"] },
            { model: Room, as: "Room", attributes: ["id", "name"] },
          ],
        },
      ],
    });
    // console.log(student, "student", studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found or no active groups",
      });
    }

    // Kunlik darslar jadvalini yaratish
    let schedule = [];
    const today = new Date();
    const start = startDate ? new Date(startDate) : today;
    const end = endDate
      ? new Date(endDate)
      : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 kun

    // Har bir guruh uchun darslar jadvalini yaratish
    for (const group of student.Group) {
      const groupSchedule = generateLessonSchedule(
        group,
        group.schedule_days,
        group.schedule_time,
        start,
        end
      );
      schedule = [...schedule, ...groupSchedule];
    }

    // Sana bo'yicha tartiblash
    schedule.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Kelayotgan darslar (keyingi 7 kun)
    const upcomingLessons = schedule.filter(
      (lesson) =>
        new Date(lesson.date) >= today &&
        new Date(lesson.date) <=
          new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    );
    // console.log(schedule, "salommm");

    res.status(200).json({
      success: true,
      data: {
        schedule,
        upcomingLessons,
        currentWeek: getWeekSchedule(schedule),
      },
    });
  } catch (error) {
    console.error("Error getting student schedule:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get student's payments
 * @route   GET /api/students/payments
 * @access  Private (Student only)
 */
exports.getMyPayments = async (req, res) => {
  try {
    const studentId = req.user.id || req.student.id;
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;

    // Filter object yaratish
    const where = { student_id: studentId };

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    // Pagination
    const offset = (page - 1) * limit;

    // To'lovlarni olish
    const { count, rows: payments } = await Payment.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
      attributes: [
        "id",
        "amount",
        "method",
        "status",
        "comment",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: Student,
          as: "student",
          attributes: ["id", "full_name", "phone"],
        },
      ],
    });

    // To'lov statistikasi
    const totalPaid = await Payment.sum("amount", {
      where: {
        student_id: studentId,
        status: "completed",
      },
    });

    const pendingPayments = await Payment.sum("amount", {
      where: {
        student_id: studentId,
        status: "pending",
      },
    });

    res.status(200).json({
      success: true,
      data: {
        data: payments,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit),
        },
        summary: {
          totalPaid: totalPaid || 0,
          pendingAmount: pendingPayments || 0,
          totalTransactions: count,
        },
      },
    });
  } catch (error) {
    console.error("Error getting student payments:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getMyAttendance = async (req, res) => {
  try {
    const studentId = req.user.id || req.student.id;
    const { groupId, month, year } = req.query;

    console.log("📅 Student ID:", studentId, "Group ID:", groupId);

    // Studentning guruhlarini olish
    const student = await Student.findOne({
      where: { id: studentId },
      include: [
        {
          model: Group,
          as: "Group",
          through: {
            where: { status: "active" },
            attributes: ["id", "status", "join_date"],
          },
          where: groupId ? { id: groupId } : undefined,
          attributes: [
            "id",
            "name",
            "schedule_days",
            "schedule_time", // ⭐ "10:00-12:00" formatida
            "start_date", // ⭐ guruh boshlanish sanasi
            "end_date", // ⭐ guruh tugash sanasi
          ],
          include: [
            {
              model: Course,
              as: "Course",
              attributes: ["id", "name", "color", "icon"],
            },
            {
              model: Teacher,
              as: "Teacher",
              attributes: ["id", "full_name", "phone"],
            },
          ],
        },
      ],
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (!student.Group || student.Group.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No active groups found",
        data: {
          groups: [],
          overallStats: {
            totalGroups: 0,
            totalLessons: 0,
            attendedLessons: 0,
            attendanceRate: 0,
          },
        },
      });
    }

    // Har bir guruh uchun davomat ma'lumotlarini olish
    const attendanceData = [];

    for (const group of student.Group) {
      // Guruhning darslarini olish (oy yoki sana filter)
      let whereCondition = { group_id: group.id };

      if (month && year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        whereCondition.date = {
          [Op.between]: [startDate, endDate],
        };
      }

      const lessons = await Lesson.findAll({
        where: whereCondition,
        attributes: ["id", "date", "status"],
        order: [["date", "ASC"]],
        include: [
          {
            model: Room,
            as: "Room",
            attributes: ["id", "name"],
          },
          {
            model: Teacher,
            as: "Teacher",
            attributes: ["id", "full_name"],
          },
        ],
      });

      // Lesson ID lar
      const lessonIds = lessons.map((lesson) => lesson.id);

      // Studentning davomati
      const attendances = await Attendance.findAll({
        where: {
          student_id: studentId,
          lesson_id: lessonIds,
        },
        attributes: [
          "id",
          "lesson_id",
          "status",
          "comment",
          "attendance_date",
          "createdAt",
        ],
        include: [
          {
            model: Teacher,
            as: "Teacher",
            attributes: ["id", "full_name"],
          },
        ],
      });

      // Attendance'ni lesson_id bo'yicha map qilish
      const attendanceMap = {};
      attendances.forEach((att) => {
        attendanceMap[att.lesson_id] = att;
      });

      // ⭐ Dars vaqtini Group'dan olamiz
      // schedule_time formatini tekshirish (masalan: "10:00-12:00" yoki "10:00")
      let lessonTime = "N/A";
      if (group.schedule_time) {
        // Agar "-" bo'lsa, "10:00-12:00" -> "10:00 - 12:00"
        if (group.schedule_time.includes("-")) {
          const [start, end] = group.schedule_time.split("-");
          lessonTime = `${start.trim()} - ${end.trim()}`;
        } else {
          lessonTime = group.schedule_time;
        }
      }

      // Darslar ro'yxatini tayyorlash
      const lessonAttendance = lessons.map((lesson) => {
        const attendance = attendanceMap[lesson.id];
        return {
          id: lesson.id,
          date: lesson.date,
          status: lesson.status,
          time: lessonTime, // ⭐ Group'dan olingan vaqt
          room: lesson.Room ? lesson.Room.name : "N/A",
          lessonTeacher: lesson.Teacher ? lesson.Teacher.full_name : null,
          attendance: attendance
            ? {
                status: attendance.status,
                comment: attendance.comment,
                markedBy: attendance.Teacher
                  ? attendance.Teacher.full_name
                  : "System",
                markedAt: attendance.createdAt,
              }
            : {
                status: "not_marked",
                comment: null,
                markedBy: null,
                markedAt: null,
              },
        };
      });

      // Statistikalar
      const totalLessons = lessons.length;
      const attendedLessons = attendances.filter(
        (a) => a.status === "present" || a.status === "late"
      ).length;
      const absentLessons = attendances.filter(
        (a) => a.status === "absent"
      ).length;
      const excusedLessons = attendances.filter(
        (a) => a.status === "excused"
      ).length;
      const lateLessons = attendances.filter((a) => a.status === "late").length;

      const attendanceRate =
        totalLessons > 0
          ? Math.round((attendedLessons / totalLessons) * 100)
          : 0;

      attendanceData.push({
        group: {
          id: group.id,
          name: group.name,
          course: group.Course,
          teacher: group.Teacher,
          schedule: {
            days: group.schedule_days,
            time: group.schedule_time, // ⭐ asl format
            formattedTime: lessonTime, // ⭐ formatlangan vaqt
          },
          dates: {
            start: group.start_date,
            end: group.end_date,
          },
        },
        statistics: {
          totalLessons,
          attendedLessons,
          absentLessons,
          excusedLessons,
          lateLessons,
          notMarked: totalLessons - attendances.length,
          attendanceRate,
        },
        lessons: lessonAttendance,
        // Oy bo'yicha statistikalar
        monthlyStats: calculateMonthlyStats(lessonAttendance),
      });
    }

    // Umumiy statistikalar
    const overallStats = {
      totalGroups: attendanceData.length,
      totalLessons: attendanceData.reduce(
        (sum, g) => sum + g.statistics.totalLessons,
        0
      ),
      totalAttended: attendanceData.reduce(
        (sum, g) => sum + g.statistics.attendedLessons,
        0
      ),
      totalAbsent: attendanceData.reduce(
        (sum, g) => sum + g.statistics.absentLessons,
        0
      ),
      totalExcused: attendanceData.reduce(
        (sum, g) => sum + g.statistics.excusedLessons,
        0
      ),
      totalLate: attendanceData.reduce(
        (sum, g) => sum + g.statistics.lateLessons,
        0
      ),
      overallAttendanceRate:
        attendanceData.length > 0
          ? Math.round(
              attendanceData.reduce(
                (sum, g) => sum + g.statistics.attendanceRate,
                0
              ) / attendanceData.length
            )
          : 0,
    };

    // Oylik davomat statistikasi
    const monthlyAttendance = calculateOverallMonthlyStats(attendanceData);

    res.status(200).json({
      success: true,
      data: {
        groups: attendanceData,
        overallStats,
        monthlyAttendance,
        filter: {
          groupId: groupId || "all",
          month: month || "all",
          year: year || new Date().getFullYear(),
        },
      },
    });
  } catch (error) {
    console.error("❌ Error getting student attendance:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
exports.getMyProfile = async (req, res) => {
  try {
    const studentId = req.user.id;

    console.log("📋 Fetching profile for student ID:", studentId);

    const student = await Student.findOne({
      where: { id: studentId },
      attributes: [
        "id",
        "full_name",
        "phone",
        "parent_phone",
        "birth_date",
        "address",
        "status",
        "notes",
        "last_login",
        "registered_at",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: Group,
          as: "Group",
          through: {
            attributes: ["status", "join_date"],
          },
          attributes: ["id", "name"],
          include: [
            {
              model: Course,
              as: "Course",
              attributes: ["id", "name", "icon", "color"],
            },
          ],
        },
      ],
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Calculate statistics
    const totalGroups = student.Group ? student.Group.length : 0;

    // Get attendance statistics
    const attendanceStats = await calculateAttendanceStats(studentId);

    // Get payment summary
    const paymentStats = await calculatePaymentStats(studentId);

    res.status(200).json({
      success: true,
      data: {
        profile: student,
        statistics: {
          totalGroups,
          attendance: attendanceStats,
          payments: paymentStats,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error getting student profile:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const studentId = req.user.id;
    const updateData = req.body;

    console.log("🔄 Updating profile for student ID:", studentId);
    console.log("📝 Update data:", updateData);

    // Fields that can be updated (model'da mavjud field'lar)
    const allowedFields = [
      "full_name",
      "phone",
      "parent_phone",
      "birth_date",
      "address",
      "notes",
    ];

    // Filter allowed fields
    const filteredData = {};
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });

    // Check if phone is being updated and if it already exists
    if (filteredData.phone) {
      const existingStudent = await Student.findOne({
        where: {
          phone: filteredData.phone,
          id: { [Op.ne]: studentId },
        },
      });

      if (existingStudent) {
        return res.status(400).json({
          success: false,
          message: "This phone number is already registered",
        });
      }
    }

    // Validate phone format
    if (filteredData.phone && !/^[0-9]{9,15}$/.test(filteredData.phone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must contain only digits (9-15 characters)",
      });
    }

    // Validate parent phone format
    if (
      filteredData.parent_phone &&
      !/^[0-9]{0,15}$/.test(filteredData.parent_phone)
    ) {
      return res.status(400).json({
        success: false,
        message: "Parent phone must contain only digits (max 15 characters)",
      });
    }

    // Validate birth date
    if (filteredData.birth_date) {
      const birthDate = new Date(filteredData.birth_date);
      if (isNaN(birthDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid birth date format",
        });
      }

      // Check if birth date is not in future
      const today = new Date();
      if (birthDate > today) {
        return res.status(400).json({
          success: false,
          message: "Birth date cannot be in the future",
        });
      }
    }

    // Update student
    const [updated] = await Student.update(filteredData, {
      where: { id: studentId },
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Get updated student
    const updatedStudent = await Student.findByPk(studentId, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Group,
          as: "Group",
          through: {
            attributes: ["status", "join_date"],
          },
          attributes: ["id", "name"],
          include: [
            {
              model: Course,
              as: "Course",
              attributes: ["id", "name", "icon", "color"],
            },
          ],
        },
      ],
    });

    console.log("✅ Profile updated successfully");

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        profile: updatedStudent,
      },
    });
  } catch (error) {
    console.error("❌ Error updating student profile:", error);

    // Handle Sequelize validation errors
    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors,
      });
    }

    // Handle unique constraint error
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "Phone number already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    console.log("🔐 Changing password for student ID:", studentId);

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    // Get student with password
    const student = await Student.findByPk(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      student.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await Student.update(
      { password: hashedPassword },
      { where: { id: studentId } }
    );

    console.log("✅ Password changed successfully");

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("❌ Error changing password:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
exports.updateLastLogin = async (req, res) => {
  try {
    const studentId = req.user.id;

    await Student.update(
      { last_login: new Date() },
      { where: { id: studentId } }
    );

    res.status(200).json({
      success: true,
      message: "Last login updated",
    });
  } catch (error) {
    console.error("❌ Error updating last login:", error);
    // Don't send error response for this, it's not critical
  }
};

async function calculateAttendanceStats(studentId) {
  try {
    // Count total lessons for student
    const totalLessons = await Lesson.count({
      include: [
        {
          model: Group,
          as: "Group",
          include: [
            {
              model: Student,
              as: "Student",
              where: { id: studentId },
              through: { where: { status: "active" } },
            },
          ],
        },
      ],
    });

    // Count attended lessons
    const attendedLessons = await Attendance.count({
      where: {
        student_id: studentId,
        status: ["present", "late"],
      },
    });

    return {
      totalLessons: totalLessons || 0,
      attendedLessons: attendedLessons || 0,
      attendanceRate:
        totalLessons > 0
          ? Math.round((attendedLessons / totalLessons) * 100)
          : 0,
    };
  } catch (error) {
    console.error("Error calculating attendance stats:", error);
    return { totalLessons: 0, attendedLessons: 0, attendanceRate: 0 };
  }
}

async function calculatePaymentStats(studentId) {
  try {
    // Sum completed payments
    const totalPaid = await Payment.sum("amount", {
      where: {
        student_id: studentId,
        status: "completed",
      },
    });

    // Get pending payments
    const pendingPayments = await Payment.findAll({
      where: {
        student_id: studentId,
        status: "pending",
      },
      attributes: ["id", "amount"],
    });

    // Calculate total pending amount
    const totalPending = pendingPayments.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0
    );

    return {
      totalPaid: totalPaid || 0,
      totalPending: totalPending || 0,
      pendingPayments: pendingPayments.length || 0,
    };
  } catch (error) {
    console.error("Error calculating payment stats:", error);
    return { totalPaid: 0, totalPending: 0, pendingPayments: 0 };
  }
}

// ⭐ Yordamchi funksiyalar
function calculateMonthlyStats(lessons) {
  const monthlyStats = {};

  lessons.forEach((lesson) => {
    const date = new Date(lesson.date);
    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;

    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = {
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      };
    }

    monthlyStats[monthKey].total++;

    if (lesson.attendance.status === "present")
      monthlyStats[monthKey].present++;
    else if (lesson.attendance.status === "absent")
      monthlyStats[monthKey].absent++;
    else if (lesson.attendance.status === "late") monthlyStats[monthKey].late++;
    else if (lesson.attendance.status === "excused")
      monthlyStats[monthKey].excused++;
  });

  return Object.entries(monthlyStats).map(([month, stats]) => ({
    month,
    ...stats,
    rate: Math.round((stats.present / stats.total) * 100) || 0,
  }));
}

function calculateOverallMonthlyStats(attendanceData) {
  const monthlyMap = {};

  attendanceData.forEach((groupData) => {
    groupData.monthlyStats.forEach((monthStat) => {
      if (!monthlyMap[monthStat.month]) {
        monthlyMap[monthStat.month] = {
          month: monthStat.month,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        };
      }

      monthlyMap[monthStat.month].total += monthStat.total;
      monthlyMap[monthStat.month].present += monthStat.present;
      monthlyMap[monthStat.month].absent += monthStat.absent;
      monthlyMap[monthStat.month].late += monthStat.late;
      monthlyMap[monthStat.month].excused += monthStat.excused;
    });
  });

  return Object.values(monthlyMap)
    .map((stat) => ({
      ...stat,
      rate: Math.round((stat.present / stat.total) * 100) || 0,
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

function calculateProgress(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  if (now < start) return 0;
  if (now > end) return 100;

  const totalDuration = end - start;
  const elapsedDuration = now - start;

  return Math.min(100, Math.round((elapsedDuration / totalDuration) * 100));
}

function getWeekSchedule(schedule) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

  const weekSchedule = {};

  // Har bir kun uchun array yaratish
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    const dayName = day
      .toLocaleDateString("en-US", { weekday: "long" })
      .toLowerCase();
    weekSchedule[dayName] = [];
  }

  // Darslarni kunlarga joylash
  schedule.forEach((lesson) => {
    const lessonDate = new Date(lesson.date);
    if (lessonDate >= startOfWeek && lessonDate <= endOfWeek) {
      const dayName = lessonDate
        .toLocaleDateString("en-US", { weekday: "long" })
        .toLowerCase();
      weekSchedule[dayName].push(lesson);
    }
  });

  return weekSchedule;
}

exports.getDashboardStats = async (req, res) => {
  try {
    const studentId = req.user.id || req.student.id;

    // Parallel queries for better performance
    const [
      activeGroupsCount,
      upcomingLessonsCount,
      totalPaid,
      recentPayments,
      attendanceStats,
    ] = await Promise.all([
      // Active groups count
      GroupStudent.count({
        where: {
          student_id: studentId,
          status: "active",
        },
        include: [
          {
            model: Group,
            as: "Group",
            where: { status: "active" },
          },
        ],
      }),

      // Upcoming lessons (next 7 days)
      getUpcomingLessonsCount(studentId),

      // Total payments
      Payment.sum("amount", {
        where: {
          student_id: studentId,
          status: "completed",
        },
      }),

      // Recent payments
      Payment.findAll({
        where: { student_id: studentId },
        limit: 5,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "amount", "method", "status", "createdAt"],
      }),

      // Attendance statistics
      getAttendanceStatistics(studentId),
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          activeCourses: activeGroupsCount || 0,
          upcomingLessons: upcomingLessonsCount || 0,
          totalPaid: totalPaid || 0,
          attendanceRate: attendanceStats.rate || 0,
        },
        recentPayments: recentPayments || [],
        attendance: attendanceStats.details || [],
      },
    });
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

async function getUpcomingLessonsCount(studentId) {
  const student = await Student.findOne({
    where: { id: studentId },
    include: [
      {
        model: Group,
        as: "Group",
        through: { where: { status: "active" } },
        where: { status: "active" },
      },
    ],
  });

  if (!student || !student.Group) return 0;

  let count = 0;
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const group of student.Group) {
    const schedule = generateLessonSchedule(
      group,
      group.schedule_days,
      group.schedule_time,
      today,
      nextWeek
    );
    count += schedule.length;
  }

  return count;
}

async function getAttendanceStatistics(studentId) {
  const attendances = await Attendance.findAll({
    where: { student_id: studentId },
    include: [
      {
        model: Lesson,
        as: "Lesson",
        attributes: ["date"],
      },
    ],
  });

  const total = attendances.length;
  const present = attendances.filter((a) => a.status === "present").length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  return {
    rate,
    details: attendances
      .map((a) => ({
        date: a.Lesson.date,
        status: a.status,
        grade: a.grade,
      }))
      .slice(0, 10), // Last 10 records
  };
}
