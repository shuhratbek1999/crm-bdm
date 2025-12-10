// controllers/dashboardController.js
const {
  Student,
  Group,
  Teacher,
  Payment,
  Attendance,
  Lesson,
  Course,
  Room,
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
  // controllers/dashboardController.js
  async getSchedule(req, res) {
    try {
      // generateTimeSlots funksiyasi
      const generateTimeSlots = () => {
        const slots = [];
        for (let hour = 7; hour <= 18; hour++) {
          for (let minute = 0; minute < 60; minute += 30) {
            // 18:30 ni o'tkazib yuborish
            if (!(hour === 18 && minute === 30)) {
              slots.push({
                time: `${hour.toString().padStart(2, "0")}:${minute
                  .toString()
                  .padStart(2, "0")}`,
                hour: hour,
                minute: minute,
                display: `${hour}:${minute === 0 ? "00" : minute}`,
              });
            }
          }
        }
        return slots;
      };

      const { day_type, date } = req.query;

      // Agar date berilmasa, bugungi sana
      const targetDate = date ? new Date(date) : new Date();

      // Day type aniqlash
      let dayType = day_type;
      if (!dayType) {
        // Juft/toq kunni aniqlash
        const dayOfMonth = targetDate.getDate();
        dayType = dayOfMonth % 2 === 0 ? "even" : "odd";
      }

      // Weekday aniqlash (1-7, Dushanba-Yakshanba)
      const dayOfWeek = targetDate.getDay(); // 0-6, Yakshanba=0
      const weekDays = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const weekdayName = weekDays[dayOfWeek];

      console.log("📅 Schedule params:", {
        targetDate: targetDate.toISOString().split("T")[0],
        dayType,
        weekdayName,
        dayOfWeek,
        dayOfMonth: targetDate.getDate(),
      });

      try {
        // Group lar uchun schedule_days ni tekshirish - JSON query ni o'zgartiramiz
        const groupsWithSchedule = await Group.findAll({
          where: {
            status: ["active", "planned"],
            // JSON query ni soddalashtiramiz
            [Op.or]: [
              // schedule_days da bu kun bo'lishi kerak
              {
                schedule_days: {
                  [Op.like]: `%${weekdayName}%`, // JSON formatni soddalashtirdik
                },
              },
              // Yoki schedule field bo'yicha tekshirish
              {
                schedule: {
                  [Op.like]: `%${weekdayName}%`,
                },
              },
            ],
          },
          include: [
            {
              model: Teacher,
              as: "Teacher",
              attributes: ["id", "full_name", "phone", "specialization"],
              required: false, // Teacher bo'lmasa ham
            },
            {
              model: Room,
              as: "Room",
              attributes: ["id", "name", "capacity", "floor"],
              required: false, // Room bo'lmasa ham
            },
            {
              model: Course,
              as: "Course",
              attributes: ["id", "name", "color", "icon"],
              required: false, // Course bo'lmasa ham
            },
          ],
        });

        console.log(
          `✅ Found ${groupsWithSchedule.length} groups for ${weekdayName}`
        );

        // Agar date berilgan bo'lsa, aniq kun uchun darslarni olish
        let lessons = [];

        if (date) {
          // Aniq sana uchun Lesson larni olish
          try {
            lessons = await Lesson.findAll({
              where: {
                date: targetDate.toISOString().split("T")[0],
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
                    {
                      model: Teacher,
                      as: "Teacher",
                      attributes: ["id", "full_name"],
                    },
                    {
                      model: Room,
                      as: "Room",
                      attributes: ["id", "name"],
                    },
                  ],
                },
              ],
              order: [["date", "ASC"]],
            });

            console.log(`✅ Found ${lessons.length} lessons for date ${date}`);
          } catch (lessonError) {
            console.log("⚠️ Lesson table error:", lessonError.message);
            lessons = [];
          }

          // Agar aniq kun uchun dars bo'lmasa, group schedule dan generatsiya qilish
          if (lessons.length === 0) {
            console.log("📝 Generating lessons from group schedule");
            lessons = groupsWithSchedule.map((group) => ({
              id: null,
              date: targetDate.toISOString().split("T")[0],
              group_id: group.id,
              room_id: group.room_id || 1, // Default room
              teacher_id: group.teacher_id || 1, // Default teacher
              status: "planned",
              Group: group,
              Room: group.Room || { id: 1, name: "Xona-1", capacity: 20 },
              Teacher: group.Teacher || { id: 1, full_name: "O'qituvchi" },
            }));
          }
        } else {
          // 7 kunlik jadval (bugundan boshlab)
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 7);

          try {
            lessons = await Lesson.findAll({
              where: {
                date: {
                  [Op.between]: [
                    startDate.toISOString().split("T")[0],
                    endDate.toISOString().split("T")[0],
                  ],
                },
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
                    {
                      model: Teacher,
                      as: "Teacher",
                      attributes: ["id", "full_name"],
                    },
                    {
                      model: Room,
                      as: "Room",
                      attributes: ["id", "name"],
                    },
                  ],
                },
              ],
              order: [
                ["date", "ASC"],
                ["created_at", "ASC"],
              ],
            });
          } catch (lessonError) {
            console.log("⚠️ Lessons fetch error:", lessonError.message);
            lessons = [];
          }
        }

        // Jadval formatini tayyorlash
        const schedule = lessons.map((lesson) => {
          const group = lesson.Group || {};
          const course = group.Course || {};
          const teacher = group.Teacher || lesson.Teacher || {};
          const room = group.Room || lesson.Room || {};

          // Vaqtni formatlash
          let startTime = "09:00";
          let endTime = "10:30";

          if (group.schedule_time) {
            const timeParts = group.schedule_time.split(":");
            const startHour = parseInt(timeParts[0]);
            const startMinute = parseInt(timeParts[1]);
            const duration = group.lesson_duration || 90;

            const startDate = new Date();
            startDate.setHours(startHour, startMinute, 0, 0);

            const endDate = new Date(startDate.getTime() + duration * 60000);

            startTime = `${startHour.toString().padStart(2, "0")}:${startMinute
              .toString()
              .padStart(2, "0")}`;
            endTime = `${endDate
              .getHours()
              .toString()
              .padStart(2, "0")}:${endDate
              .getMinutes()
              .toString()
              .padStart(2, "0")}`;
          }

          // Day type aniqlash
          const lessonDate = new Date(lesson.date || targetDate);
          const lessonDayType = lessonDate.getDate() % 2 === 0 ? "even" : "odd";

          return {
            id: lesson.id || `temp_${group.id}`,
            room_id: room.id || 1,
            room_name: room.name || `Xona-${group.id || 1}`,
            group_id: group.id,
            group_name: group.name || `Guruh-${group.id}`,
            course_id: course.id || 1,
            course_name: course.name || "Kurs",
            course_color: course.color || "#3B82F6",
            teacher_id: teacher.id || 1,
            teacher_name: teacher.full_name || "O'qituvchi",
            start_time: startTime,
            end_time: endTime,
            date: lesson.date || targetDate.toISOString().split("T")[0],
            day_type: lessonDayType,
            status: lesson.status || "planned",
            color: course.color || "#3B82F6",
          };
        });

        // Xonalar ro'yxati
        let rooms = [];
        try {
          rooms = await Room.findAll({
            where: {
              status: "available",
            },
            attributes: ["id", "name", "capacity"],
            order: [["name", "ASC"]],
          });
          console.log(`✅ Found ${rooms.length} rooms`);
        } catch (roomError) {
          console.log(
            "⚠️ Rooms fetch error, using mock data:",
            roomError.message
          );
          rooms = [
            { id: 1, name: "Xona-1", capacity: 25 },
            { id: 2, name: "Xona-2", capacity: 20 },
            { id: 3, name: "Xona-3", capacity: 15 },
            { id: 4, name: "Xona-4", capacity: 30 },
          ];
        }

        // Time slots (07:00 dan 18:00 gacha, 30 daqiqalik interval)
        const timeSlots = generateTimeSlots();

        res.json({
          success: true,
          day_type: dayType,
          date: targetDate.toISOString().split("T")[0],
          rooms: rooms.map((room) => ({
            id: room.id,
            name: room.name,
            capacity: room.capacity,
          })),
          time_slots: timeSlots,
          schedule: schedule,
          groups: groupsWithSchedule.map((group) => ({
            id: group.id,
            name: group.name,
            course_name: group.Course?.name,
            teacher_name: group.Teacher?.full_name,
            room_name: group.Room?.name,
            schedule_days: group.schedule_days,
            schedule_time: group.schedule_time,
          })),
        });
      } catch (groupError) {
        console.error("❌ Group query error:", groupError);

        // Agar group query xato bersa, minimal data qaytaramiz
        const timeSlots = generateTimeSlots();

        res.json({
          success: true,
          day_type: dayType,
          date: targetDate.toISOString().split("T")[0],
          rooms: [
            { id: 1, name: "Xona-1", capacity: 25 },
            { id: 2, name: "Xona-2", capacity: 20 },
          ],
          time_slots: timeSlots,
          schedule: [], // Bo'sh jadval
          groups: [],
        });
      }
    } catch (error) {
      console.error("❌ Schedule fetch error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching schedule",
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  },
};
