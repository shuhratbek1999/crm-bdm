// controllers/dashboardController.js
const {
  Student,
  Group,
  Teacher,
  Payment,
  Attendance,
  Lesson,
  Course,
} = require("../models");
const { Sequelize } = require("sequelize");
const { Op } = require("sequelize");

module.exports = {
  async stats(req, res) {
    try {
      // Bugunni boshlang'ich va oxirgi vaqti
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Oyni boshlang'ich va oxirgi vaqti
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // O'tgan oy
      const lastMonthStart = new Date();
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
      lastMonthStart.setDate(1);
      lastMonthStart.setHours(0, 0, 0, 0);

      const lastMonthEnd = new Date();
      lastMonthEnd.setMonth(lastMonthEnd.getMonth() - 1);
      lastMonthEnd.setDate(31);
      lastMonthEnd.setHours(23, 59, 59, 999);

      // 1. Barcha asosiy sonlar
      const [
        totalStudents,
        totalGroups,
        totalTeachers,
        totalCourses,
        totalLessons,
        totalPayments,
      ] = await Promise.all([
        Student.count(),
        Group.count(),
        Teacher.count(),
        Course.count(),
        Lesson.count(),
        Payment.sum("amount") || 0,
      ]);

      // 2. Student statuslari
      const studentStatuses = await Student.findAll({
        attributes: [
          "status",
          [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
        ],
        group: ["status"],
      });

      const studentStatus = {
        active: 0,
        inactive: 0,
        lead: 0,
      };

      studentStatuses.forEach((stat) => {
        const status = stat.status || "active";
        const count = parseInt(stat.get("count"), 10) || 0;
        if (studentStatus.hasOwnProperty(status)) {
          studentStatus[status] = count;
        }
      });

      // 3. Yangi studentlar (bugun)
      const newStudentsToday = await Student.count({
        where: {
          createdAt: {
            [Op.gte]: todayStart,
          },
        },
      });

      // 4. Faol guruhlar
      const activeGroups = await Group.count({
        where: { status: "active" },
      });

      // 5. Teacher faolligi (bugun darsi bor teacherlar)
      const teachersWithLessonsToday = await Lesson.findAll({
        attributes: [
          [Sequelize.fn("DISTINCT", Sequelize.col("teacher_id")), "teacher_id"],
        ],
        where: {
          date: {
            [Op.gte]: todayStart,
            [Op.lt]: todayEnd,
          },
        },
        raw: true,
      });

      const activeTeachers = teachersWithLessonsToday.length;

      // 6. Bugungi darslar
      const todayLessons = await Lesson.count({
        where: {
          date: {
            [Op.gte]: todayStart,
            [Op.lt]: todayEnd,
          },
        },
      });

      // 7. Tamomlangan darslar
      const completedLessons = await Lesson.count({
        where: { status: "completed" },
      });

      // 8. Rejalashtirilgan darslar
      const upcomingLessons = await Lesson.count({
        where: {
          date: { [Op.gt]: todayEnd },
          status: { [Op.ne]: "cancelled" },
        },
      });

      // 9. To'lovlar statistikasi
      const todayPayments =
        (await Payment.sum("amount", {
          where: {
            createdAt: {
              [Op.gte]: todayStart,
              [Op.lt]: todayEnd,
            },
            status: "completed",
          },
        })) || 0;

      const thisMonthPayments =
        (await Payment.sum("amount", {
          where: {
            createdAt: {
              [Op.gte]: monthStart,
            },
            status: "completed",
          },
        })) || 0;

      const pendingPayments =
        (await Payment.sum("amount", {
          where: { status: "pending" },
        })) || 0;

      // 10. Davomat statistikasi
      const attendanceStats = await Attendance.findAll({
        attributes: [
          "status",
          [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
        ],
        group: ["status"],
      });

      const attendanceByStatus = {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      };

      attendanceStats.forEach((stat) => {
        const status = stat.status || "present";
        const count = parseInt(stat.get("count"), 10) || 0;
        if (attendanceByStatus.hasOwnProperty(status)) {
          attendanceByStatus[status] = count;
        }
      });

      // 11. Bugungi davomat
      const todayAttendance = await Attendance.count({
        where: {
          createdAt: {
            [Op.gte]: todayStart,
            [Op.lt]: todayEnd,
          },
          status: "present",
        },
      });

      // 12. Davomat foizini hisoblash
      const totalAttendanceCount = Object.values(attendanceByStatus).reduce(
        (a, b) => a + b,
        0
      );
      const attendanceRate =
        totalAttendanceCount > 0
          ? Math.round(
              (attendanceByStatus.present / totalAttendanceCount) * 100
            )
          : 0;

      const todayAttendanceRate =
        todayLessons > 0
          ? Math.round((todayAttendance / todayLessons) * 100)
          : 0;

      // 13. Mashhur kurslar (Group orqali)
      const popularCourses = await Course.findAll({
        attributes: [
          "id",
          "name",
          [
            Sequelize.literal(`
            (SELECT COUNT(DISTINCT gs.student_id) 
             FROM groups g
             LEFT JOIN group_students gs ON g.id = gs.group_id
             WHERE g.course_id = Course.id AND g.status = 'active')
          `),
            "enrollment",
          ],
          [
            Sequelize.literal(`
            (SELECT COUNT(DISTINCT g.id) 
             FROM groups g
             WHERE g.course_id = Course.id AND g.status = 'active')
          `),
            "active_groups",
          ],
        ],
        order: [[Sequelize.literal("enrollment"), "DESC"]],
        limit: 5,
      });

      const popularCoursesFormatted = popularCourses.map((course) => ({
        id: course.id,
        name: course.name,
        enrollment: parseInt(course.get("enrollment"), 10) || 0,
        active_groups: parseInt(course.get("active_groups"), 10) || 0,
      }));

      // 14. Guruh statuslari
      const groupStatuses = await Group.findAll({
        attributes: [
          "status",
          [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
        ],
        group: ["status"],
      });

      const groupStatus = {
        active: 0,
        completed: 0,
        upcoming: 0,
      };

      groupStatuses.forEach((stat) => {
        const status = stat.status || "active";
        const count = parseInt(stat.get("count"), 10) || 0;
        if (groupStatus.hasOwnProperty(status)) {
          groupStatus[status] = count;
        }
      });

      // 15. Oylik o'sish
      const newStudentsThisMonth = await Student.count({
        where: {
          createdAt: {
            [Op.gte]: monthStart,
          },
        },
      });

      const newStudentsLastMonth = await Student.count({
        where: {
          createdAt: {
            [Op.gte]: lastMonthStart,
            [Op.lt]: lastMonthEnd,
          },
        },
      });

      const studentGrowth =
        newStudentsLastMonth > 0
          ? Math.round(
              ((newStudentsThisMonth - newStudentsLastMonth) /
                newStudentsLastMonth) *
                100
            )
          : newStudentsThisMonth > 0
          ? 100
          : 0;

      // 16. Kurslar bo'yicha studentlar soni
      const coursesWithStudents = await Course.findAll({
        attributes: [
          "id",
          "name",
          [
            Sequelize.literal(`
            (SELECT COUNT(DISTINCT gs.student_id) 
             FROM groups g
             LEFT JOIN group_students gs ON g.id = gs.group_id
             WHERE g.course_id = Course.id)
          `),
            "total_students",
          ],
        ],
        order: [[Sequelize.literal("total_students"), "DESC"]],
        limit: 10,
      });

      const courseDistribution = coursesWithStudents.map((course) => ({
        id: course.id,
        name: course.name,
        students: parseInt(course.get("total_students"), 10) || 0,
      }));

      res.json({
        // Asosiy raqamlar
        total_students: totalStudents,
        total_teachers: totalTeachers,
        total_groups: totalGroups,
        total_courses: totalCourses,
        total_lessons: totalLessons,
        total_payments: totalPayments || 0,

        // Studentlar
        students: {
          total: totalStudents,
          active: studentStatus.active,
          inactive: studentStatus.inactive,
          lead: studentStatus.lead,
          new_today: newStudentsToday,
          monthly_growth: studentGrowth,
          new_this_month: newStudentsThisMonth,
        },

        // O'qituvchilar
        teachers: {
          total: totalTeachers,
          active: activeTeachers,
          available: totalTeachers - activeTeachers,
        },

        // Guruhlar
        groups: {
          total: totalGroups,
          active: groupStatus.active,
          completed: groupStatus.completed,
          upcoming: groupStatus.upcoming,
        },

        // Darslar
        lessons: {
          total: totalLessons,
          completed: completedLessons,
          upcoming: upcomingLessons,
          today: todayLessons,
        },

        // To'lovlar
        payments: {
          total: totalPayments || 0,
          today: todayPayments || 0,
          this_month: thisMonthPayments || 0,
          pending: pendingPayments || 0,
        },

        // Davomat
        attendance: {
          total: totalAttendanceCount,
          by_status: attendanceByStatus,
          rate: attendanceRate,
          today_rate: todayAttendanceRate,
          today_present: todayAttendance,
        },

        // Mashhur kurslar
        popular_courses: popularCoursesFormatted,

        // Kurslar bo'yicha taqsimot
        course_distribution: courseDistribution,

        // Bugungi faollik
        today_activity: {
          lessons: todayLessons,
          new_students: newStudentsToday,
          payments: todayPayments,
          attendance: todayAttendance,
          active_teachers: activeTeachers,
        },
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching dashboard stats",
        error: error.message,
      });
    }
  },
};
