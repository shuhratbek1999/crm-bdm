// controllers/studentController.js - TO'LIQ TUZATILGAN VERSIYA
const {
  Student,
  Course,
  Group,
  GroupStudent,
  Lesson,
  Attendance,
  Payment,
  Teacher,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");
const calculateAttendanceStats = (attendanceStats) => {
  const stats = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    total: 0,
    attendance_rate: 0,
  };

  if (attendanceStats && Array.isArray(attendanceStats)) {
    attendanceStats.forEach((stat) => {
      if (stat && stat.status && stat.count) {
        stats[stat.status] = parseInt(stat.count) || 0;
        stats.total += parseInt(stat.count) || 0;
      }
    });
  }

  if (stats.total > 0) {
    const attended = stats.present + stats.late + stats.excused;
    stats.attendance_rate = ((attended / stats.total) * 100).toFixed(1);
  }

  return stats;
};

const getQuickActions = (groups) => {
  const actions = [
    {
      id: 1,
      title: "Schedule",
      icon: "calendar",
      route: "schedule",
      color: "#3B82F6",
    },
    {
      id: 2,
      title: "Attendance statistics",
      icon: "chart-bar",
      route: "attendance",
      color: "#10B981",
    },
    {
      id: 3,
      title: "Payment history",
      icon: "credit-card",
      route: "payments",
      color: "#8B5CF6",
    },
    {
      id: 4,
      title: "My profile",
      icon: "user",
      route: "profile",
      color: "#F59E0B",
    },
  ];

  // Agar faol guruhlar bo'lsa
  if (groups && Array.isArray(groups) && groups.length > 0) {
    groups.forEach((group, index) => {
      if (index < 2) {
        actions.push({
          id: actions.length + 1,
          title: `${group.Group?.Course?.name || "Guruh"} guruhi`,
          icon: "user-group",
          route: `/groups/${group.Group?.id || 0}`,
          color: group.Group?.Course?.color || "#6B7280",
        });
      }
    });
  }

  return actions;
};
class StudentController {
  getStudentGroupIds = async (studentId) => {
    try {
      const studentGroups = await GroupStudent.findAll({
        where: { student_id: studentId, status: "active" },
        include: [
          {
            model: Group,
            as: "Group",
            attributes: ["id"],
          },
        ],
      });

      return studentGroups.map((sg) => sg.Group?.id).filter(Boolean);
    } catch (error) {
      console.error("getStudentGroupIds error:", error);
      return [];
    }
  };
  async getDashboardData(req, res) {
    try {
      const studentId = req.user?.id;

      console.log(`📊 Student dashboard so'rovi: ${studentId}`);

      if (!studentId) {
        return res.status(401).json({
          success: false,
          message: "Avtorizatsiya talab qilinadi",
        });
      }

      // 1. Student ma'lumotlari
      const student = await Student.findByPk(studentId, {
        attributes: [
          "id",
          "full_name",
          "phone",
          "parent_phone",
          "birth_date",
          "address",
          "status",
          "last_login",
          "notes",
          "registered_at",
          "createdAt",
          "updatedAt",
        ],
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student topilmadi",
        });
      }

      console.log(`✅ Student topildi: ${student.full_name}`);
      const groups = await GroupStudent.findAll({
        where: { student_id: studentId, status: "active" },
        include: [
          {
            model: Group,
            as: "Group",
            include: [
              {
                model: Course,
                as: "Course",
                attributes: ["id", "name", "description", "icon", "color"],
              },
              {
                model: Teacher,
                as: "Teacher",
                attributes: ["id", "full_name", "phone", "specialization"],
              },
            ],
          },
        ],
        order: [["created_at", "DESC"]],
      });

      console.log(`📚 Student guruhlari soni: ${groups.length}`);

      // GURUHLARNI TO'G'RI OLISH
      const groupIds = groups.map((g) => g.Group?.id).filter(Boolean);
      // 1. Bugungi sanani olish
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      // 2. Keyingi 7 kun (bugundan boshlab)
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 7);
      const nextWeekDate = nextWeek.toISOString().split("T")[0];

      // 3. Kelajakdagi darslarni olish
      let upcomingLessons = [];
      if (groupIds.length > 0) {
        upcomingLessons = await Lesson.findAll({
          where: {
            group_id: { [Op.in]: groupIds },
            date: {
              [Op.gte]: today, // Bugun va undan keyingi
              [Op.lte]: nextWeekDate, // Keyingi 7 kungacha
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
                  attributes: ["name", "icon", "color"],
                },
              ],
            },
            {
              model: Teacher,
              as: "Teacher",
              attributes: ["full_name"],
            },
            {
              model: Attendance,
              as: "Attendances",
              where: { student_id: studentId },
              required: false,
            },
          ],
          order: [
            ["date", "ASC"],
            ["Group", "schedule_time", "ASC"],
          ],
          limit: 10,
        });
      }

      console.log(
        `📅 Kelajakdagi darslar (${today} - ${nextWeekDate}): ${upcomingLessons.length}`
      );

      // 4. Agar yaqin darslar bo'lmasa, eng yaqin dars haqida ma'lumot olish
      let nearestLessonInfo = null;
      if (upcomingLessons.length === 0) {
        const nearestLesson = await Lesson.findOne({
          where: {
            group_id: { [Op.in]: groupIds },
            date: { [Op.gte]: today },
            status: "planned",
          },
          order: [["date", "ASC"]],
          include: [
            {
              model: Group,
              as: "Group",
              attributes: ["name"],
              include: [
                {
                  model: Course,
                  as: "Course",
                  attributes: ["name"],
                },
              ],
            },
          ],
        });

        if (nearestLesson) {
          const lessonDate = new Date(nearestLesson.date);
          const daysUntil = Math.ceil(
            (lessonDate - now) / (1000 * 60 * 60 * 24)
          );
          nearestLessonInfo = {
            hasUpcoming: false,
            message: `Keyingi dars ${daysUntil} kundan keyin (${nearestLesson.date})`,
            nearest_date: nearestLesson.date,
            days_until: daysUntil,
          };
        }
      }
      // 4. Davomat statistikasi
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const attendanceStats = await Attendance.findAll({
        where: {
          student_id: studentId,
          attendance_date: {
            [Op.gte]: thirtyDaysAgo.toISOString().split("T")[0],
          },
        },
        attributes: [
          "status",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        group: ["status"],
        raw: true,
      });

      console.log("📈 Attendance stats:", attendanceStats);

      // 5. To'lovlar statistikasi
      const payments = await Payment.findAll({
        where: { student_id: studentId },
        attributes: [
          [sequelize.fn("SUM", sequelize.col("amount")), "total_paid"],
          [sequelize.fn("COUNT", sequelize.col("id")), "payment_count"],
        ],
        raw: true,
      });

      // Dashboard ma'lumotlarini formatlash
      const dashboardData = {
        student: {
          id: student.id,
          full_name: student.full_name,
          phone: student.phone,
          parent_phone: student.parent_phone || "",
          birth_date: student.birth_date || "",
          address: student.address || "",
          status: student.status || "active",
          balance: student.balance || 0,
          total_owed: student.total_owed || 0,
          total_paid: student.total_paid || 0,
          last_login: student.last_login,
          registered_at: student.registered_at,
        },
        groups: groups.map((g) => ({
          id: g.Group?.id || 0,
          name: g.Group?.name || "Noma'lum guruh",
          course: g.Group?.Course || { id: 0, name: "Noma'lum kurs" },
          teacher: g.Group?.Teacher || {
            id: 0,
            full_name: "Noma'lum o'qituvchi",
          },
          schedule_days: g.Group?.schedule_days || "",
          schedule_time: g.Group?.schedule_time || "",
          join_date: g.join_date || g.createdAt,
          status: g.status || "active",
        })),
        upcomingLessons: upcomingLessons.map((lesson) => ({
          id: lesson.id,
          date: lesson.date,
          group_name: lesson.Group?.name || "Noma'lum guruh",
          course_name: lesson.Group?.Course?.name || "Noma'lum kurs",
          teacher_name: lesson.Teacher?.full_name || "Noma'lum o'qituvchi",
          status: lesson.status,
          attendance:
            lesson.Attendances && lesson.Attendances.length > 0
              ? lesson.Attendances[0].status
              : null,
        })),
        nearestLessonInfo: nearestLessonInfo,
        stats: {
          attendance: calculateAttendanceStats(attendanceStats), // ✅ Class tashqarisidagi funksiya
          payments: {
            total_paid: payments[0]?.total_paid || 0,
            payment_count: payments[0]?.payment_count || 0,
          },
          active_groups: groups.length,
          upcoming_lessons: upcomingLessons.length,
        },
        quickActions: getQuickActions(groups), // ✅ Class tashqarisidagi funksiya
      };

      console.log("✅ Dashboard ma'lumotlari tayyor");

      res.json({
        success: true,
        message: "Dashboard ma'lumotlari muvaffaqiyatli yuklandi",
        data: dashboardData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Dashboard error:", error);
      res.status(500).json({
        success: false,
        message: "Dashboard ma'lumotlarini yuklashda xatolik",
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }

  // ========== GURUHLAR RO'YXATI ==========
  async getMyGroups(req, res) {
    try {
      const studentId = req.user?.id;
      const { status = "active" } = req.query;

      if (!studentId) {
        return res.status(401).json({
          success: false,
          message: "Avtorizatsiya talab qilinadi",
        });
      }

      const whereCondition = { student_id: studentId };
      if (status) {
        whereCondition.status = status;
      }

      const groups = await GroupStudent.findAll({
        where: whereCondition,
        include: [
          {
            model: Group,
            as: "Group",
            include: [
              {
                model: Course,
                as: "Course",
                attributes: [
                  "id",
                  "name",
                  "description",
                  "icon",
                  "color",
                  "level",
                  "duration",
                  "price",
                ],
              },
              {
                model: Teacher,
                as: "Teacher",
                attributes: [
                  "id",
                  "full_name",
                  "phone",
                  "email",
                  "specialization",
                  "profile_image",
                  "experience_years",
                ],
              },
            ],
          },
        ],
        order: [
          ["status", "ASC"],
          ["created_at", "DESC"],
        ],
      });

      const formattedGroups = groups.map((g) => ({
        id: g.Group?.id || 0,
        group_student_id: g.id,
        name: g.Group?.name || "Noma'lum guruh",
        course: g.Group?.Course || {
          id: 0,
          name: "Noma'lum kurs",
          color: "#6B7280",
        },
        teacher: g.Group?.Teacher || {
          id: 0,
          full_name: "Noma'lum o'qituvchi",
        },
        schedule: {
          days: g.Group?.schedule_days || "",
          time: g.Group?.schedule_time || "",
          duration: g.Group?.lesson_duration || "60 daqiqa",
        },
        status: g.status,
        join_date: g.join_date || g.createdAt,
        group_status: g.Group?.status || "active",
        start_date: g.Group?.start_date,
        end_date: g.Group?.end_date,
        student_count: g.Group?.current_students || 0,
        max_students: g.Group?.max_students || 20,
        room: g.Group?.room_id || "Noma'lum xona",
        description: g.Group?.description || "",
      }));

      res.json({
        success: true,
        message: "Guruhlar muvaffaqiyatli yuklandi",
        data: formattedGroups,
        total: formattedGroups.length,
      });
    } catch (error) {
      console.error("❌ Groups error:", error);
      res.status(500).json({
        success: false,
        message: "Guruhlarni yuklashda xatolik",
        error: error.message,
      });
    }
  }

  // ========== DARS JADVALI ==========
  async getSchedule(req, res) {
    try {
      const studentId = req.user?.id;
      const { startDate, endDate } = req.query;

      if (!studentId) {
        return res.status(401).json({
          success: false,
          message: "Avtorizatsiya talab qilinadi",
        });
      }

      // Studentning aktiv guruhlari
      const studentGroups = await GroupStudent.findAll({
        where: { student_id: studentId, status: "active" },
        include: [
          {
            model: Group,
            as: "Group",
            attributes: ["id"],
          },
        ],
      });

      const groupIds = studentGroups.map((sg) => sg.Group?.id).filter(Boolean);

      if (groupIds.length === 0) {
        return res.json({
          success: true,
          message: "Hech qanday guruh topilmadi",
          data: {},
          total: 0,
        });
      }

      // Jadval parametrlari
      const whereCondition = {
        group_id: groupIds,
        status: "planned",
      };

      if (startDate && endDate) {
        whereCondition.date = {
          [Op.between]: [startDate, endDate],
        };
      } else {
        // Agar sana berilmasa, keyingi 30 kunlik darslar
        const today = new Date();
        const nextMonth = new Date();
        nextMonth.setDate(today.getDate() + 30);

        whereCondition.date = {
          [Op.between]: [
            today.toISOString().split("T")[0],
            nextMonth.toISOString().split("T")[0],
          ],
        };
      }

      const schedule = await Lesson.findAll({
        where: whereCondition,
        include: [
          {
            model: Group,
            as: "Group",
            include: [
              {
                model: Course,
                as: "Course",
                attributes: ["name", "icon", "color"],
              },
              {
                model: Teacher,
                as: "Teacher",
                attributes: ["full_name", "phone"],
              },
            ],
          },
          {
            model: Attendance,
            as: "Attendances",
            where: { student_id: studentId },
            required: false,
            attributes: ["status", "comment", "score"],
          },
        ],
        order: [
          ["date", "ASC"],
          ["created_at", "ASC"],
        ],
      });

      // Kunlik guruhlash
      const groupedSchedule = schedule.reduce((acc, lesson) => {
        const date = lesson.date;
        if (!acc[date]) {
          acc[date] = [];
        }

        acc[date].push({
          id: lesson.id,
          group_id: lesson.group_id,
          group_name: lesson.Group?.name || "Noma'lum guruh",
          course_name: lesson.Group?.Course?.name || "Noma'lum kurs",
          course_color: lesson.Group?.Course?.color || "#6B7280",
          course_icon: lesson.Group?.Course?.icon || "book",
          teacher_name:
            lesson.Group?.Teacher?.full_name || "Noma'lum o'qituvchi",
          teacher_phone: lesson.Group?.Teacher?.phone || "",
          room_id: lesson.room_id || "Noma'lum xona",
          date: lesson.date,
          status: lesson.status,
          attendance:
            lesson.Attendances && lesson.Attendances.length > 0
              ? {
                  status: lesson.Attendances[0].status,
                  comment: lesson.Attendances[0].comment,
                  score: lesson.Attendances[0].score,
                }
              : null,
        });

        return acc;
      }, {});

      // Sana bo'yicha tartiblash
      const sortedSchedule = {};
      Object.keys(groupedSchedule)
        .sort()
        .forEach((date) => {
          sortedSchedule[date] = groupedSchedule[date];
        });

      res.json({
        success: true,
        message: "Dars jadvali muvaffaqiyatli yuklandi",
        data: sortedSchedule,
        total: schedule.length,
      });
    } catch (error) {
      console.error("❌ Schedule error:", error);
      res.status(500).json({
        success: false,
        message: "Jadvalni yuklashda xatolik",
        error: error.message,
      });
    }
  }

  // ========== DAVOMAT STATISTIKASI ==========
  async getAttendanceStats(req, res) {
    try {
      const studentId = req.user?.id;
      const { groupId, startDate, endDate } = req.query;

      if (!studentId) {
        return res.status(401).json({
          success: false,
          message: "Avtorizatsiya talab qilinadi",
        });
      }

      const whereCondition = { student_id: studentId };

      if (groupId) {
        // Lesson orqali guruh ID sini filter qilish
        const lessons = await Lesson.findAll({
          where: { group_id: groupId },
          attributes: ["id"],
        });

        whereCondition.lesson_id = {
          [Op.in]: lessons.map((l) => l.id),
        };
      }

      if (startDate && endDate) {
        whereCondition.attendance_date = {
          [Op.between]: [startDate, endDate],
        };
      } else {
        // Agar sana berilmasa, oxirgi 90 kun
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        whereCondition.attendance_date = {
          [Op.gte]: ninetyDaysAgo.toISOString().split("T")[0],
        };
      }

      const attendanceRecords = await Attendance.findAll({
        where: whereCondition,
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
                include: [
                  {
                    model: Course,
                    as: "Course",
                    attributes: ["name", "color"],
                  },
                ],
              },
            ],
          },
          {
            model: Teacher,
            as: "Teacher",
            attributes: ["full_name", "phone"],
          },
        ],
        order: [["attendance_date", "DESC"]],
      });

      // Statistikani hisoblash
      const total = attendanceRecords.length;
      const present = attendanceRecords.filter(
        (a) => a.status === "present"
      ).length;
      const absent = attendanceRecords.filter(
        (a) => a.status === "absent"
      ).length;
      const late = attendanceRecords.filter((a) => a.status === "late").length;
      const excused = attendanceRecords.filter(
        (a) => a.status === "excused"
      ).length;

      const stats = {
        total,
        present,
        absent,
        late,
        excused,
        attendance_rate:
          total > 0 ? (((present + late) / total) * 100).toFixed(1) : 0,
        present_percentage:
          total > 0 ? ((present / total) * 100).toFixed(1) : 0,
        absent_percentage: total > 0 ? ((absent / total) * 100).toFixed(1) : 0,
        late_percentage: total > 0 ? ((late / total) * 100).toFixed(1) : 0,
        excused_percentage:
          total > 0 ? ((excused / total) * 100).toFixed(1) : 0,
      };

      // Guruh bo'yicha guruhlash (agar guruh filter qo'llanilsa)
      let groupedByCourse = {};
      if (!groupId) {
        attendanceRecords.forEach((record) => {
          const courseName = record.Lesson?.Group?.Course?.name || "Noma'lum";
          if (!groupedByCourse[courseName]) {
            groupedByCourse[courseName] = {
              present: 0,
              absent: 0,
              late: 0,
              excused: 0,
              total: 0,
              color: record.Lesson?.Group?.Course?.color || "#3B82F6",
            };
          }

          groupedByCourse[courseName][record.status]++;
          groupedByCourse[courseName].total++;
        });
      }

      // Oylik statistikani hisoblash
      const monthlyStats = await Attendance.findAll({
        where: whereCondition,
        attributes: [
          [
            sequelize.fn(
              "DATE_FORMAT",
              sequelize.col("attendance_date"),
              "%Y-%m"
            ),
            "month",
          ],
          [sequelize.fn("COUNT", sequelize.col("id")), "total"],
          [
            sequelize.fn(
              "SUM",
              sequelize.literal(
                "CASE WHEN status = 'present' THEN 1 ELSE 0 END"
              )
            ),
            "present",
          ],
          [
            sequelize.fn(
              "SUM",
              sequelize.literal("CASE WHEN status = 'absent' THEN 1 ELSE 0 END")
            ),
            "absent",
          ],
        ],
        group: [
          sequelize.fn(
            "DATE_FORMAT",
            sequelize.col("attendance_date"),
            "%Y-%m"
          ),
        ],
        order: [["month", "DESC"]],
        raw: true,
        limit: 6,
      });

      res.json({
        success: true,
        message: "Davomat statistikasi muvaffaqiyatli yuklandi",
        data: {
          stats,
          records: attendanceRecords.map((record) => ({
            id: record.id,
            date: record.attendance_date,
            status: record.status,
            comment: record.comment || "",
            score: record.score || 0,
            group_name: record.Lesson?.Group?.name || "Noma'lum guruh",
            course_name: record.Lesson?.Group?.Course?.name || "Noma'lum kurs",
            teacher_name: record.Teacher?.full_name || "Noma'lum o'qituvchi",
            lesson_date: record.Lesson?.date,
          })),
          groupedByCourse,
          monthlyStats,
        },
        total: attendanceRecords.length,
      });
    } catch (error) {
      console.error("❌ Attendance stats error:", error);
      res.status(500).json({
        success: false,
        message: "Davomat statistikasini yuklashda xatolik",
        error: error.message,
      });
    }
  }

  // ========== TO'LOVLAR TARIXI ==========
  async getPaymentHistory(req, res) {
    try {
      const studentId = req.user?.id;
      const { page = 1, limit = 10, year, month, status } = req.query;

      if (!studentId) {
        return res.status(401).json({
          success: false,
          message: "Avtorizatsiya talab qilinadi",
        });
      }

      const offset = (page - 1) * limit;

      const whereCondition = { student_id: studentId };

      // Status filter
      if (status) {
        whereCondition.status = status;
      }

      // Yil/oy bo'yicha filter
      if (year) {
        whereCondition.createdAt = {
          [Op.between]: [new Date(`${year}-01-01`), new Date(`${year}-12-31`)],
        };
      }

      if (month && year) {
        const startDate = new Date(`${year}-${month.padStart(2, "0")}-01`);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(endDate.getDate() - 1);

        whereCondition.createdAt = {
          [Op.between]: [startDate, endDate],
        };
      }

      const { count, rows: payments } = await Payment.findAndCountAll({
        where: whereCondition,
        include: [
          {
            model: Student,
            as: "Student",
            attributes: ["full_name", "phone"],
          },
          {
            model: Teacher,
            as: "CreatedBy",
            attributes: ["full_name"],
          },
          {
            model: Group,
            as: "Group",
            attributes: ["name"],
            include: [
              {
                model: Course,
                as: "Course",
                attributes: ["name"],
              },
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      // Oylik statistikani hisoblash
      const monthlyStats = await Payment.findAll({
        where: { student_id: studentId },
        attributes: [
          [
            sequelize.fn("DATE_FORMAT", sequelize.col("createdAt"), "%Y-%m"),
            "month",
          ],
          [sequelize.fn("SUM", sequelize.col("amount")), "total"],
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        group: [
          sequelize.fn("DATE_FORMAT", sequelize.col("createdAt"), "%Y-%m"),
        ],
        order: [
          [
            sequelize.fn("DATE_FORMAT", sequelize.col("createdAt"), "%Y-%m"),
            "DESC",
          ],
        ],
        raw: true,
      });

      // To'lovlar statistikasi
      const totalStats = await Payment.findOne({
        where: { student_id: studentId },
        attributes: [
          [sequelize.fn("SUM", sequelize.col("amount")), "total_paid"],
          [sequelize.fn("COUNT", sequelize.col("id")), "total_count"],
          [
            sequelize.fn(
              "SUM",
              sequelize.literal(
                "CASE WHEN status = 'pending' THEN amount ELSE 0 END"
              )
            ),
            "pending_amount",
          ],
          [
            sequelize.fn(
              "COUNT",
              sequelize.literal("CASE WHEN status = 'pending' THEN 1 END")
            ),
            "pending_count",
          ],
        ],
        raw: true,
      });

      res.json({
        success: true,
        message: "To'lovlar tarixi muvaffaqiyatli yuklandi",
        data: {
          payments: payments.map((payment) => ({
            id: payment.id,
            amount: payment.amount,
            method: payment.method,
            status: payment.status,
            comment: payment.comment || "",
            created_at: payment.createdAt,
            updated_at: payment.updatedAt,
            created_by: payment.CreatedBy?.full_name || "Sistema",
            student_name: payment.Student?.full_name || "",
            group_name: payment.Group?.name || "",
            course_name: payment.Group?.Course?.name || "",
            payment_date: payment.payment_date || payment.createdAt,
          })),
          pagination: {
            total: count,
            page: parseInt(page),
            pages: Math.ceil(count / limit),
            limit: parseInt(limit),
          },
          stats: {
            total_paid: totalStats?.total_paid || 0,
            total_count: totalStats?.total_count || 0,
            pending_amount: totalStats?.pending_amount || 0,
            pending_count: totalStats?.pending_count || 0,
            monthly: monthlyStats.map((stat) => ({
              month: stat.month,
              total: stat.total,
              count: stat.count,
            })),
          },
        },
      });
    } catch (error) {
      console.error("❌ Payment history error:", error);
      res.status(500).json({
        success: false,
        message: "To'lovlar tarixini yuklashda xatolik",
        error: error.message,
      });
    }
  }

  // ========== PROFIL MA'LUMOTLARI ==========
  async getProfile(req, res) {
    try {
      const studentId = req.user?.id;

      if (!studentId) {
        return res.status(401).json({
          success: false,
          message: "Avtorizatsiya talab qilinadi",
        });
      }

      const student = await Student.findByPk(studentId, {
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
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student topilmadi",
        });
      }

      // Studentning guruhlari
      const groups = await GroupStudent.findAll({
        where: { student_id: studentId },
        include: [
          {
            model: Group,
            as: "Group",
            include: [
              {
                model: Course,
                as: "Course",
                attributes: ["name", "color"],
              },
            ],
          },
        ],
        limit: 5,
      });

      // Oxirgi to'lov
      const lastPayment = await Payment.findOne({
        where: { student_id: studentId },
        order: [["createdAt", "DESC"]],
        attributes: ["amount", "createdAt", "method"],
      });

      res.json({
        success: true,
        message: "Profil ma'lumotlari muvaffaqiyatli yuklandi",
        data: {
          ...student.toJSON(),
          groups: groups.map((g) => ({
            id: g.Group?.id,
            name: g.Group?.name,
            course: g.Group?.Course?.name,
            course_color: g.Group?.Course?.color,
            status: g.status,
            join_date: g.join_date,
          })),
          last_payment: lastPayment
            ? {
                amount: lastPayment.amount,
                date: lastPayment.createdAt,
                method: lastPayment.method,
              }
            : null,
        },
      });
    } catch (error) {
      console.error("❌ Profile error:", error);
      res.status(500).json({
        success: false,
        message: "Profil ma'lumotlarini yuklashda xatolik",
        error: error.message,
      });
    }
  }

  // ========== PROFILNI YANGILASH ==========
  async updateProfile(req, res) {
    try {
      const studentId = req.user?.id;
      const { full_name, parent_phone, birth_date, address, notes } = req.body;

      if (!studentId) {
        return res.status(401).json({
          success: false,
          message: "Avtorizatsiya talab qilinadi",
        });
      }

      const student = await Student.findByPk(studentId);

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student topilmadi",
        });
      }

      // Yangilash
      const updatedData = {};
      if (full_name) updatedData.full_name = full_name;
      if (parent_phone) updatedData.parent_phone = parent_phone;
      if (birth_date) updatedData.birth_date = birth_date;
      if (address) updatedData.address = address;
      if (notes !== undefined) updatedData.notes = notes;

      await student.update(updatedData);

      res.json({
        success: true,
        message: "Profil muvaffaqiyatli yangilandi",
        data: {
          id: student.id,
          full_name: student.full_name,
          parent_phone: student.parent_phone,
          birth_date: student.birth_date,
          address: student.address,
          notes: student.notes,
          updated_at: student.updatedAt,
        },
      });
    } catch (error) {
      console.error("❌ Update profile error:", error);
      res.status(500).json({
        success: false,
        message: "Profilni yangilashda xatolik",
        error: error.message,
      });
    }
  }

  // ========== NOTIFIKATSIYALAR ==========
  async getNotifications(req, res) {
    try {
      const studentId = req.user?.id;

      if (!studentId) {
        return res.status(401).json({
          success: false,
          message: "Avtorizatsiya talab qilinadi",
        });
      }

      const now = new Date();
      const twoDaysLater = new Date();
      twoDaysLater.setDate(now.getDate() + 2);

      // Studentning guruh ID'lari
      const groupIds = await this.getStudentGroupIds(studentId);

      let upcomingLessons = [];
      if (groupIds.length > 0) {
        upcomingLessons = await Lesson.findAll({
          where: {
            group_id: groupIds,
            date: {
              [Op.between]: [
                now.toISOString().split("T")[0],
                twoDaysLater.toISOString().split("T")[0],
              ],
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
                  attributes: ["name", "icon"],
                },
              ],
            },
          ],
          limit: 5,
        });
      }

      // Yangi to'lovlar (oxirgi 3 kun)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const recentPayments = await Payment.findAll({
        where: {
          student_id: studentId,
          createdAt: {
            [Op.gte]: threeDaysAgo,
          },
        },
        attributes: ["id", "amount", "method", "createdAt"],
        limit: 3,
      });

      // Yangi baholar (agar attendance modelida score bo'lsa)
      const recentScores = await Attendance.findAll({
        where: {
          student_id: studentId,
          score: {
            [Op.not]: null,
          },
          attendance_date: {
            [Op.gte]: threeDaysAgo.toISOString().split("T")[0],
          },
        },
        include: [
          {
            model: Lesson,
            as: "Lesson",
            attributes: ["date"],
            include: [
              {
                model: Group,
                as: "Group",
                attributes: ["name"],
                include: [
                  {
                    model: Course,
                    as: "Course",
                    attributes: ["name"],
                  },
                ],
              },
            ],
          },
        ],
        limit: 3,
      });

      const notifications = [];

      // Dars eslatmalari
      upcomingLessons.forEach((lesson) => {
        notifications.push({
          id: `lesson_${lesson.id}`,
          type: "lesson_reminder",
          title: "Yaqinlashayotgan dars",
          message: `${lesson.Group?.Course?.name} darsi ${lesson.date} sanada`,
          data: {
            lesson_id: lesson.id,
            date: lesson.date,
            course_name: lesson.Group?.Course?.name,
          },
          is_read: false,
          created_at: new Date(),
          icon: "calendar",
          color: "blue",
        });
      });

      // To'lov eslatmalari
      recentPayments.forEach((payment) => {
        notifications.push({
          id: `payment_${payment.id}`,
          type: "payment_received",
          title: "To'lov qabul qilindi",
          message: `${payment.amount} so'm ${payment.method} orqali to'landi`,
          data: {
            payment_id: payment.id,
            amount: payment.amount,
            method: payment.method,
          },
          is_read: false,
          created_at: payment.createdAt,
          icon: "credit-card",
          color: "green",
        });
      });

      // Baho eslatmalari
      recentScores.forEach((score) => {
        notifications.push({
          id: `score_${score.id}`,
          type: "new_score",
          title: "Yangi baho",
          message: `${score.Lesson?.Group?.Course?.name} fanidan ${score.score} baho oldingiz`,
          data: {
            attendance_id: score.id,
            score: score.score,
            course_name: score.Lesson?.Group?.Course?.name,
            date: score.Lesson?.date,
          },
          is_read: false,
          created_at: score.updatedAt,
          icon: "star",
          color: "yellow",
        });
      });

      // Notifikatsiyalarni vaqt bo'yicha tartiblash
      notifications.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      res.json({
        success: true,
        message: "Bildirishnomalar muvaffaqiyatli yuklandi",
        data: notifications,
        total: notifications.length,
      });
    } catch (error) {
      console.error("❌ Notifications error:", error);
      res.status(500).json({
        success: false,
        message: "Bildirishnomalarni yuklashda xatolik",
        error: error.message,
      });
    }
  }
}

module.exports = new StudentController();
