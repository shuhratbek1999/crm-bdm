const {
  Teacher,
  Group,
  Student,
  Lesson,
  Attendance,
  Course,
  GroupStudent,
  Room,
  Payment,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");

exports.getDashboard = async (req, res) => {
  try {
    const teacherId = req.teacherId || req.user.id; // Token'dan teacher id olish

    // Bugungi sana
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Keyingi 7 kun
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Jami guruhlar soni
    const totalGroups = await Group.count({
      where: { teacher_id: teacherId, status: "active" },
    });

    // Bugungi darslar
    const todaysLessons = await Lesson.findAll({
      where: {
        teacher_id: teacherId,
        date: todayStr,
        status: { [Op.ne]: "cancelled" },
      },
      include: [
        {
          model: Group,
          as: "Group",
          include: [
            {
              model: Course,
              as: "Course",
              attributes: ["id", "name", "color"],
            },
          ],
        },
        {
          model: Room,
          as: "Room",
          attributes: ["id", "name"],
        },
      ],
      order: [["date", "ASC"]],
    });

    // Keyingi darslar (7 kun ichida)
    const upcomingLessons = await Lesson.findAll({
      where: {
        teacher_id: teacherId,
        date: {
          [Op.between]: [todayStr, nextWeek.toISOString().split("T")[0]],
        },
        status: "planned",
      },
      include: [
        {
          model: Group,
          as: "Group",
          include: [
            {
              model: Course,
              as: "Course",
              attributes: ["id", "name"],
            },
          ],
        },
      ],
      order: [["date", "ASC"]],
      limit: 10,
    });

    // Jami o'quvchilar soni
    const totalStudents = await GroupStudent.count({
      include: [
        {
          model: Group,
          as: "Group",
          where: { teacher_id: teacherId, status: "active" },
        },
      ],
    });

    // Oxirgi 7 kun davomat statistikasi
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const attendanceStats = await Attendance.findAll({
      where: {
        teacher_id: teacherId,
        attendance_date: { [Op.between]: [sevenDaysAgo, today] },
      },
      attributes: [
        [sequelize.fn("DATE", sequelize.col("attendance_date")), "date"],
        [sequelize.fn("COUNT", sequelize.col("id")), "total"],
        [
          sequelize.literal(
            "SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)"
          ),
          "present",
        ],
        [
          sequelize.literal(
            "SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)"
          ),
          "absent",
        ],
      ],
      group: [sequelize.fn("DATE", sequelize.col("attendance_date"))],
      order: [[sequelize.fn("DATE", sequelize.col("attendance_date")), "DESC"]],
    });

    // Aktiv guruhlar ro'yxati
    const activeGroups = await Group.findAll({
      where: { teacher_id: teacherId, status: "active" },
      include: [
        {
          model: Course,
          as: "Course",
          attributes: ["id", "name", "color"],
        },
      ],
      limit: 5,
    });

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalGroups,
          totalStudents,
          todaysLessonsCount: todaysLessons.length,
          upcomingLessonsCount: upcomingLessons.length,
        },
        todaysLessons,
        upcomingLessons,
        attendanceStats,
        activeGroups,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getTeacherGroups = async (req, res) => {
  try {
    const teacherId = req.teacherId || req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const where = { teacher_id: teacherId };
    if (status) where.status = status;

    const offset = (page - 1) * limit;

    const { count, rows: groups } = await Group.findAndCountAll({
      where,
      include: [
        {
          model: Course,
          as: "Course",
          attributes: ["id", "name", "description", "color"],
        },
        {
          model: Room,
          as: "Room",
          attributes: ["id", "name"],
        },
        {
          model: Student,
          as: "Student",
          through: { attributes: [] },
          attributes: ["id", "full_name"],
          required: false,
        },
      ],
      distinct: true,
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [["created_at", "DESC"]],
    });

    // Har bir guruh uchun o'quvchilar soni
    const groupsWithStudentCount = await Promise.all(
      groups.map(async (group) => {
        const studentCount = await GroupStudent.count({
          where: { group_id: group.id },
        });

        const today = new Date().toISOString().split("T")[0];
        const todaysLesson = await Lesson.findOne({
          where: {
            group_id: group.id,
            date: today,
            status: "planned",
          },
        });

        return {
          ...group.toJSON(),
          studentCount,
          todaysLesson: todaysLesson
            ? {
                id: todaysLesson.id,
                date: todaysLesson.date,
                status: todaysLesson.status,
              }
            : null,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        groups: groupsWithStudentCount,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / limit),
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Get groups error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const teacherId = req.teacherId || req.user.id;

    // Guruh teacher'ga tegishli ekanligini tekshirish
    const group = await Group.findOne({
      where: { id: groupId, teacher_id: teacherId },
      include: [
        {
          model: Course,
          as: "Course",
          attributes: ["id", "name", "description", "duration_months"],
        },
        {
          model: Room,
          as: "Room",
          attributes: ["id", "name", "capacity"],
        },
        {
          model: Teacher,
          as: "Teacher",
          attributes: ["id", "full_name", "phone"],
        },
      ],
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found or access denied",
      });
    }

    // Guruhdagi o'quvchilar
    const students = await GroupStudent.findAll({
      where: { group_id: groupId },
      include: [
        {
          model: Student,
          as: "student",
          attributes: ["id", "full_name", "phone", "birth_date"],
        },
      ],
    });

    // Darslar tarixi
    const lessons = await Lesson.findAll({
      where: { group_id: groupId },
      include: [
        {
          model: Attendance,
          as: "Attendances",
          attributes: ["id", "status"],
          required: false,
        },
      ],
      order: [["date", "DESC"]],
      limit: 10,
    });

    // Davomat statistikasi
    const attendanceStats = await Attendance.findAll({
      where: {
        lesson_id: { [Op.in]: lessons.map((l) => l.id) },
      },
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "total"],
        [
          sequelize.literal(
            "SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)"
          ),
          "present",
        ],
        [
          sequelize.literal(
            "SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)"
          ),
          "absent",
        ],
        [
          sequelize.literal("SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END)"),
          "late",
        ],
      ],
      raw: true,
    });

    res.status(200).json({
      success: true,
      data: {
        group,
        students,
        lessons,
        attendanceStats: attendanceStats[0] || {},
      },
    });
  } catch (error) {
    console.error("Get group details error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getAttendancePage = async (req, res) => {
  try {
    const teacherId = req.teacherId || req.user.id;
    const { groupId, date } = req.query;
    const targetDate = date || new Date().toISOString().split("T")[0];

    // Teacherning guruhlari
    const groups = await Group.findAll({
      where: { teacher_id: teacherId, status: "active" },
      attributes: ["id", "name"],
      include: [
        {
          model: Course,
          as: "Course",
          attributes: ["id", "name"],
        },
      ],
    });

    let attendanceData = null;

    // Agar guruh tanlangan bo'lsa
    if (groupId) {
      // Darsni topish yoki yaratish
      let lesson = await Lesson.findOne({
        where: {
          group_id: groupId,
          date: targetDate,
          teacher_id: teacherId,
        },
      });

      if (!lesson) {
        // Dars mavjud bo'lmaganda yangi yaratish
        const group = await Group.findByPk(groupId, {
          include: [{ model: Room, as: "Room" }],
        });

        if (!group) {
          return res.status(404).json({
            success: false,
            message: "Group not found",
          });
        }

        lesson = await Lesson.create({
          group_id: groupId,
          date: targetDate,
          teacher_id: teacherId,
          room_id: group.room_id || null,
          status: "planned",
        });
      }

      // Guruhdagi o'quvchilar
      const students = await GroupStudent.findAll({
        where: { group_id: groupId },
        include: [
          {
            model: Student,
            as: "student",
            attributes: ["id", "full_name", "phone"],
          },
        ],
      });

      // Oldingi davomatlar
      const existingAttendance = await Attendance.findAll({
        where: {
          lesson_id: lesson.id,
          teacher_id: teacherId,
        },
        include: [
          {
            model: Student,
            as: "Student",
            attributes: ["id", "full_name"],
          },
        ],
      });

      // O'quvchilar ro'yxatini tayyorlash
      const studentList = students.map((studentObj) => {
        const existing = existingAttendance.find(
          (a) => a.student_id === studentObj.student.id
        );
        return {
          studentId: studentObj.student.id,
          fullName: studentObj.student.full_name,
          phone: studentObj.student.phone,
          status: existing ? existing.status : "present",
          comment: existing ? existing.comment : "",
          attendanceId: existing ? existing.id : null,
        };
      });

      attendanceData = {
        lessonId: lesson.id,
        date: targetDate,
        groupId,
        students: studentList,
      };
    }

    res.status(200).json({
      success: true,
      data: {
        groups,
        attendance: attendanceData,
        selectedDate: targetDate,
      },
    });
  } catch (error) {
    console.error("Attendance page error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.markAttendance = async (req, res) => {
  try {
    const teacherId = req.teacherId || req.user.id;
    const { lessonId, attendance } = req.body;

    if (!lessonId || !Array.isArray(attendance)) {
      return res.status(400).json({
        success: false,
        message: "Invalid data",
      });
    }

    // Darsni tekshirish
    const lesson = await Lesson.findOne({
      where: {
        id: lessonId,
        teacher_id: teacherId,
      },
    });

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found or access denied",
      });
    }

    // Har bir o'quvchi uchun davomatni saqlash/yangilash
    const results = await Promise.all(
      attendance.map(async (item) => {
        try {
          if (item.attendanceId) {
            // Mavjud davomatni yangilash
            return await Attendance.update(
              {
                status: item.status,
                comment: item.comment,
                marked_by_teacher_id: teacherId,
              },
              {
                where: {
                  id: item.attendanceId,
                  lesson_id: lessonId,
                  student_id: item.studentId,
                },
              }
            );
          } else {
            // Yangi davomat qo'shish
            return await Attendance.create({
              lesson_id: lessonId,
              teacher_id: teacherId,
              student_id: item.studentId,
              status: item.status,
              comment: item.comment,
              marked_by_teacher_id: teacherId,
              attendance_date: lesson.date,
            });
          }
        } catch (error) {
          console.error(
            `Attendance error for student ${item.studentId}:`,
            error
          );
          return null;
        }
      })
    );

    // Dars statusini updated qilish
    await lesson.update({ status: "completed" });

    res.status(200).json({
      success: true,
      message: "Attendance marked successfully",
      data: {
        markedCount: results.filter((r) => r !== null).length,
        totalCount: attendance.length,
      },
    });
  } catch (error) {
    console.error("Mark attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
exports.getAttendanceHistory = async (req, res) => {
  try {
    const teacherId = req.teacherId || req.user.id;
    const { groupId, startDate, endDate, page = 1, limit = 20 } = req.query;

    const where = {
      teacher_id: teacherId,
    };

    // Filterlar
    if (groupId) {
      const lessons = await Lesson.findAll({
        where: { group_id: groupId },
        attributes: ["id"],
      });
      where.lesson_id = { [Op.in]: lessons.map((l) => l.id) };
    }

    if (startDate && endDate) {
      where.attendance_date = { [Op.between]: [startDate, endDate] };
    }

    const offset = (page - 1) * limit;

    const { count, rows: attendanceRecords } = await Attendance.findAndCountAll(
      {
        where,
        include: [
          {
            model: Student,
            as: "Student",
            attributes: ["id", "full_name", "phone"],
          },
          {
            model: Lesson,
            as: "Lesson",
            attributes: ["id", "date"],
            include: [
              {
                model: Group,
                as: "Group",
                attributes: ["id", "name"],
                include: [
                  {
                    model: Course,
                    as: "Course",
                    attributes: ["id", "name"],
                  },
                ],
              },
            ],
          },
        ],
        distinct: true,
        offset: parseInt(offset),
        limit: parseInt(limit),
        order: [
          ["attendance_date", "DESC"],
          ["created_at", "DESC"],
        ],
      }
    );

    // Statistikani hisoblash
    const stats = await Attendance.findAll({
      where,
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "total"],
        [
          sequelize.literal(
            "SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)"
          ),
          "present",
        ],
        [
          sequelize.literal(
            "SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)"
          ),
          "absent",
        ],
        [
          sequelize.literal("SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END)"),
          "late",
        ],
      ],
      raw: true,
    });

    res.status(200).json({
      success: true,
      data: {
        records: attendanceRecords,
        stats: stats[0] || {},
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / limit),
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Attendance history error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getTeacherStudents = async (req, res) => {
  try {
    const teacherId = req.teacherId || req.user.id;
    const { search, status, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.status = status;

    if (search) {
      where[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    // Teacherning guruhlari
    const teacherGroups = await Group.findAll({
      where: { teacher_id: teacherId },
      attributes: ["id"],
    });
    const groupIds = teacherGroups.map((g) => g.id);

    // Guruhlardagi o'quvchilar
    const groupStudents = await GroupStudent.findAll({
      where: { group_id: { [Op.in]: groupIds } },
      attributes: ["student_id"],
    });
    const studentIds = [...new Set(groupStudents.map((gs) => gs.student_id))];

    // O'quvchilar ma'lumotlari
    const { count, rows: students } = await Student.findAndCountAll({
      where: {
        ...where,
        id: { [Op.in]: studentIds },
      },
      include: [
        {
          model: Group,
          as: "Group",
          through: { attributes: [] },
          attributes: ["id", "name"],
          required: false,
          include: [
            {
              model: Course,
              as: "Course",
              attributes: ["id", "name"],
            },
          ],
        },
        {
          model: Payment,
          as: "Payments",
          attributes: ["id", "amount", "createdAt", "method", "status"],
          required: false,
        },
      ],
      distinct: true,
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [["full_name", "ASC"]],
    });

    // Har bir o'quvchi uchun davomat statistikasi
    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        const attendanceStats = await Attendance.findAll({
          where: {
            student_id: student.id,
            teacher_id: teacherId,
          },
          attributes: [
            [sequelize.fn("COUNT", sequelize.col("id")), "total"],
            [
              sequelize.literal(
                "SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)"
              ),
              "present",
            ],
            [
              sequelize.literal(
                "SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)"
              ),
              "absent",
            ],
          ],
          raw: true,
        });

        return {
          ...student.toJSON(),
          attendanceStats: attendanceStats[0] || {
            total: 0,
            present: 0,
            absent: 0,
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        students: studentsWithStats,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / limit),
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Get students error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getStudentProfile = async (req, res) => {
  try {
    const { studentId } = req.params;
    const teacherId = req.teacherId || req.user.id;

    // O'quvchi teacher'ning guruhlarida borligini tekshirish
    const teacherGroups = await Group.findAll({
      where: { teacher_id: teacherId },
      attributes: ["id"],
    });
    const groupIds = teacherGroups.map((g) => g.id);

    const isInTeacherGroups = await GroupStudent.findOne({
      where: {
        student_id: studentId,
        group_id: { [Op.in]: groupIds },
      },
    });

    if (!isInTeacherGroups) {
      return res.status(403).json({
        success: false,
        message: "Access denied - Student not in your groups",
      });
    }

    // O'quvchi ma'lumotlari
    const student = await Student.findByPk(studentId, {
      include: [
        {
          model: Group,
          as: "Group",
          through: { attributes: ["join_date", "status"] },
          attributes: ["id", "name"],
          include: [
            {
              model: Course,
              as: "Course",
              attributes: ["id", "name"],
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

    // Davomat tarixi
    const attendanceHistory = await Attendance.findAll({
      where: {
        student_id: studentId,
        teacher_id: teacherId,
      },
      include: [
        {
          model: Lesson,
          as: "Lesson",
          attributes: ["id", "date"],
          include: [
            {
              model: Group,
              as: "Group",
              attributes: ["id", "name"],
            },
          ],
        },
      ],
      order: [["attendance_date", "DESC"]],
      limit: 20,
    });

    // To'lovlar tarixi (agar kerak bo'lsa)
    const paymentHistory = await Payment.findAll({
      where: { student_id: studentId },
      order: [["createdAt", "DESC"]],
      limit: 10,
    });

    // Davomat statistikasi
    const attendanceStats = await Attendance.findAll({
      where: {
        student_id: studentId,
        teacher_id: teacherId,
      },
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "total"],
        [
          sequelize.literal(
            "SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)"
          ),
          "present",
        ],
        [
          sequelize.literal(
            "SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)"
          ),
          "absent",
        ],
        [
          sequelize.literal("SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END)"),
          "late",
        ],
      ],
      raw: true,
    });

    res.status(200).json({
      success: true,
      data: {
        student,
        attendanceHistory,
        paymentHistory,
        attendanceStats: attendanceStats[0] || {},
        totalGroups: student.Group.length,
      },
    });
  } catch (error) {
    console.error("Get student profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.addStudentNote = async (req, res) => {
  try {
    const { studentId } = req.params;
    const teacherId = req.teacherId || req.user.id;
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({
        success: false,
        message: "Note is required",
      });
    }

    // O'quvchi teacher'ning guruhlarida borligini tekshirish
    const teacherGroups = await Group.findAll({
      where: { teacher_id: teacherId },
      attributes: ["id"],
    });
    const groupIds = teacherGroups.map((g) => g.id);

    const isInTeacherGroups = await GroupStudent.findOne({
      where: {
        student_id: studentId,
        group_id: { [Op.in]: groupIds },
      },
    });

    if (!isInTeacherGroups) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // O'quvchini topish
    const student = await Student.findByPk(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Eski izohlarni olish
    const currentNotes = student.notes || "";
    const timestamp = new Date().toLocaleString("uz-UZ");
    const teacherNote = `[${timestamp}] Teacher ${teacherId}: ${note}\n`;

    // Yangi izoh qo'shish
    const updatedNotes = teacherNote + currentNotes;

    await student.update({
      notes: updatedNotes,
    });

    res.status(200).json({
      success: true,
      message: "Note added successfully",
      data: {
        note: teacherNote.trim(),
      },
    });
  } catch (error) {
    console.error("Add note error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getTeacherLessons = async (req, res) => {
  try {
    const teacherId = req.teacherId || req.user.id;
    const {
      status,
      startDate,
      endDate,
      groupId,
      page = 1,
      limit = 20,
    } = req.query;

    const where = { teacher_id: teacherId };

    if (status) where.status = status;
    if (groupId) where.group_id = groupId;

    if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.date = { [Op.gte]: startDate };
    } else if (endDate) {
      where.date = { [Op.lte]: endDate };
    }

    const offset = (page - 1) * limit;

    const { count, rows: lessons } = await Lesson.findAndCountAll({
      where,
      include: [
        {
          model: Group,
          as: "Group",
          attributes: ["id", "name"],
          include: [
            {
              model: Course,
              as: "Course",
              attributes: ["id", "name", "color"],
            },
          ],
        },
        {
          model: Room,
          as: "Room",
          attributes: ["id", "name"],
        },
        {
          model: Attendance,
          as: "Attendances",
          attributes: ["id"],
          required: false,
        },
      ],
      distinct: true,
      offset: parseInt(offset),
      limit: parseInt(limit),
    });

    // Har bir dars uchun o'quvchilar soni
    const lessonsWithDetails = await Promise.all(
      lessons.map(async (lesson) => {
        const studentCount = await GroupStudent.count({
          where: { group_id: lesson.group_id },
        });

        const attendanceCount = await Attendance.count({
          where: { lesson_id: lesson.id },
        });

        return {
          ...lesson.toJSON(),
          studentCount,
          attendanceCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        lessons: lessonsWithDetails,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / limit),
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Get lessons error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.createLesson = async (req, res) => {
  try {
    const teacherId = req.teacherId || req.user.id;
    const { groupId, date, roomId } = req.body;

    if (!groupId || !date) {
      return res.status(400).json({
        success: false,
        message: "Group ID and date are required",
      });
    }

    // Guruh teacher'ga tegishli ekanligini tekshirish
    const group = await Group.findOne({
      where: { id: groupId, teacher_id: teacherId },
    });

    if (!group) {
      return res.status(403).json({
        success: false,
        message: "Access denied - Group not found or not yours",
      });
    }

    // Xona mavjudligini tekshirish (agar berilgan bo'lsa)
    if (roomId) {
      const room = await Room.findByPk(roomId);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room not found",
        });
      }
    }

    // Dars allaqachon mavjudligini tekshirish
    const existingLesson = await Lesson.findOne({
      where: {
        group_id: groupId,
        date: date,
        teacher_id: teacherId,
      },
    });

    if (existingLesson) {
      return res.status(400).json({
        success: false,
        message: "Lesson already exists for this date",
      });
    }

    // Yangi dars yaratish
    const lesson = await Lesson.create({
      group_id: groupId,
      date: date,
      teacher_id: teacherId,
      room_id: roomId || group.room_id,
      status: "planned",
    });

    // Guruhdagi barcha o'quvchilar uchun default davomat yaratish
    const students = await GroupStudent.findAll({
      where: { group_id: groupId },
      attributes: ["student_id"],
    });

    const attendancePromises = students.map((student) =>
      Attendance.create({
        lesson_id: lesson.id,
        teacher_id: teacherId,
        student_id: student.student_id,
        status: "present",
        attendance_date: date,
      })
    );

    await Promise.all(attendancePromises);

    res.status(201).json({
      success: true,
      message: "Lesson created successfully",
      data: { lesson },
    });
  } catch (error) {
    console.error("Create lesson error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getTeacherProfile = async (req, res) => {
  try {
    const teacherId = req.teacherId || req.user.id;

    const teacher = await Teacher.findByPk(teacherId, {
      attributes: [
        "id",
        "full_name",
        "phone",
        "role",
        "specialization",
        "experience_years",
        "birth_date",
        "address",
        "status",
        "last_login",
        "createdAt",
      ],
    });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    // Statistikalar
    const totalGroups = await Group.count({
      where: { teacher_id: teacherId },
    });

    const activeGroups = await Group.count({
      where: { teacher_id: teacherId, status: "active" },
    });

    const totalStudents = await GroupStudent.count({
      include: [
        {
          model: Group,
          as: "Group",
          where: { teacher_id: teacherId },
        },
      ],
    });

    const todaysLessons = await Lesson.count({
      where: {
        teacher_id: teacherId,
        date: new Date().toISOString().split("T")[0],
        status: { [Op.ne]: "cancelled" },
      },
    });

    res.status(200).json({
      success: true,
      data: {
        profile: teacher,
        stats: {
          totalGroups,
          activeGroups,
          totalStudents,
          todaysLessons,
        },
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.updateTeacherProfile = async (req, res) => {
  try {
    const teacherId = req.teacherId || req.user.id;
    const { full_name, specialization, experience_years, birth_date, address } =
      req.body;

    const teacher = await Teacher.findByPk(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    // Yangilash
    const updateData = {};
    if (full_name) updateData.full_name = full_name;
    if (specialization !== undefined)
      updateData.specialization = specialization;
    if (experience_years !== undefined)
      updateData.experience_years = experience_years;
    if (birth_date) updateData.birth_date = birth_date;
    if (address !== undefined) updateData.address = address;

    await teacher.update(updateData);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: { teacher },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
