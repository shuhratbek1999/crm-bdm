// controllers/teacherCourseController.js
const {
  Group,
  Course,
  Teacher,
  Student,
  Lesson,
  Attendance,
  Room,
  GroupStudent,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");

// Helper function - controller tashqarisida
const getWeekDatesHelper = (date = new Date()) => {
  const current = new Date(date);
  const weekStart = new Date(current);
  weekStart.setDate(current.getDate() - current.getDay() + 1); // Monday

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Sunday

  return {
    start: weekStart.toISOString().split("T")[0],
    end: weekEnd.toISOString().split("T")[0],
  };
};

class TeacherCourseController {
  // Method 1: Arrow function sifatida (shunchaki method)
  getWeekDates = (date = new Date()) => {
    return getWeekDatesHelper(date);
  };

  // Method 2: Class method sifatida (binding bilan ishlash)
  static getWeekDatesStatic(date = new Date()) {
    return getWeekDatesHelper(date);
  }

  async generateGroupLessons(group, startDate, endDate) {
    try {
      const lessons = [];
      const scheduleDays = group.schedule_days || [
        "monday",
        "wednesday",
        "friday",
      ];
      const scheduleTime = group.schedule_time || "09:00:00";

      const dayMap = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };

      const dayNumbers = scheduleDays.map((day) => dayMap[day.toLowerCase()]);

      let currentDate = new Date(startDate);
      const end = new Date(endDate);

      while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay();

        if (dayNumbers.includes(dayOfWeek)) {
          lessons.push({
            group_id: group.id,
            teacher_id: group.teacher_id,
            room_id: group.room_id || null,
            date: currentDate.toISOString().split("T")[0],
            status: currentDate < new Date() ? "completed" : "planned",
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return lessons;
    } catch (error) {
      console.error("Error generating lessons:", error);
      return [];
    }
  }

  async getTeacherCourses(req, res) {
    try {
      const teacherId = req.user.id;
      const { status = "", search = "" } = req.query;

      const whereClause = { teacher_id: teacherId };

      if (status && status !== "all") {
        whereClause.status = status;
      }

      if (search) {
        whereClause[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { "$Course.name$": { [Op.like]: `%${search}%` } },
        ];
      }

      const groups = await Group.findAll({
        where: whereClause,
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
              "price",
              "color",
              "icon",
            ],
          },
        ],
        order: [["start_date", "DESC"]],
      });

      const total_groups = groups.length;
      const active_groups = groups.filter((g) => g.status === "active").length;
      const total_students = groups.reduce(
        (sum, group) => sum + (group.current_students || 0),
        0
      );

      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      const upcomingLessons = await Lesson.count({
        where: {
          group_id: groups.map((g) => g.id),
          date: {
            [Op.between]: [today, nextWeek],
          },
          status: "planned",
        },
      });

      res.json({
        success: true,
        data: {
          total_groups,
          active_groups,
          total_students,
          upcoming_classes: upcomingLessons,
          groups: groups,
        },
      });
    } catch (error) {
      console.error("Get teacher courses error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch teacher courses",
        error: error.message,
      });
    }
  }

  async getTeacherGroups(req, res) {
    try {
      const teacherId = req.user.id;
      const {
        page = 1,
        limit = 10,
        search = "",
        status = "",
        course_id = "",
      } = req.query;

      const offset = (page - 1) * limit;
      const whereClause = { teacher_id: teacherId };

      if (status && status !== "all") {
        whereClause.status = status;
      }

      if (course_id && course_id !== "all") {
        whereClause.course_id = course_id;
      }

      if (search) {
        whereClause[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { "$Course.name$": { [Op.like]: `%${search}%` } },
        ];
      }

      const { count, rows: groups } = await Group.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Course,
            as: "Course",
            attributes: ["id", "name", "category", "level", "color", "icon"],
          },
          {
            model: Room,
            as: "Room",
            attributes: ["id", "name"],
          },
        ],
        order: [["start_date", "DESC"]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      const formattedGroups = groups.map((group) => ({
        ...group.toJSON(),
        available_seats: Math.max(
          0,
          group.max_students - (group.current_students || 0)
        ),
        fill_percentage:
          group.max_students > 0
            ? Math.round((group.current_students / group.max_students) * 100)
            : 0,
        total_lessons: group.calculateTotalLessons?.(),
        schedule_days_formatted:
          group.schedule_days
            ?.map((day) => day.charAt(0).toUpperCase() + day.slice(1))
            .join(", ") || "No schedule",
      }));

      res.json({
        success: true,
        data: {
          groups: formattedGroups,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit),
          },
        },
      });
    } catch (error) {
      console.error("Get teacher groups error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch teacher groups",
        error: error.message,
      });
    }
  }

  async getGroupDetails(req, res) {
    try {
      const teacherId = req.user.id;
      const { groupId } = req.params;

      const group = await Group.findOne({
        where: {
          id: groupId,
          teacher_id: teacherId,
        },
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
              "price",
              "color",
              "icon",
            ],
          },
          {
            model: Room,
            as: "Room",
            attributes: ["id", "name", "capacity"],
          },
          {
            model: Student,
            as: "Student",
            attributes: [
              "id",
              "full_name",
              "phone",
              "parent_phone",
              "birth_date",
              "status",
            ],
            through: { attributes: ["join_date", "status"] },
          },
        ],
      });

      if (!group) {
        return res.status(404).json({
          success: false,
          message: "Group not found or access denied",
        });
      }

      const attendanceStats = await Attendance.findOne({
        where: {
          lesson_id: {
            [Op.in]: sequelize.literal(`(
              SELECT id FROM Lessons lessons 
              WHERE group_id = ${groupId}
            )`),
          },
        },
        attributes: [
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
          [
            sequelize.fn(
              "SUM",
              sequelize.literal("CASE WHEN status = 'late' THEN 1 ELSE 0 END")
            ),
            "late",
          ],
        ],
        raw: true,
      });

      const upcomingLessons = await Lesson.findAll({
        where: {
          group_id: groupId,
          date: { [Op.gte]: new Date() },
          status: "planned",
        },
        attributes: ["id", "date", "status"],
        include: [
          {
            model: Room,
            as: "Room",
            attributes: ["name"],
          },
        ],
        order: [["date", "ASC"]],
        limit: 5,
      });

      const completedLessons = await Lesson.count({
        where: {
          group_id: groupId,
          status: "completed",
        },
      });

      res.json({
        success: true,
        data: {
          ...group.toJSON(),
          attendance_stats: attendanceStats || {
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
          },
          upcoming_lessons: upcomingLessons,
          total_completed_lessons: completedLessons,
          total_upcoming_lessons: upcomingLessons.length,
          average_attendance:
            attendanceStats?.total > 0
              ? Math.round(
                  (attendanceStats.present / attendanceStats.total) * 100
                )
              : 0,
        },
      });
    } catch (error) {
      console.error("Get group details error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch group details",
        error: error.message,
      });
    }
  }
  async getWeeklySchedule(req, res) {
    try {
      const teacherId = req.user.id;
      const { week_start } = req.query;

      const weekDates = week_start
        ? getWeekDatesHelper(new Date(week_start))
        : getWeekDatesHelper();

      console.log("Teacher ID:", teacherId);
      console.log("Week range:", weekDates);

      // FIX 1: Faqat oralikni tekshirish, to'liq sanani emas
      const groups = await Group.findAll({
        where: {
          teacher_id: teacherId,
          status: "active",
        },
        include: [
          {
            model: Course,
            as: "Course",
            attributes: ["id", "name", "color"],
          },
          {
            model: Room,
            as: "Room",
            attributes: ["id", "name"],
          },
        ],
      });

      console.log("Found groups count:", groups.length);

      // Generate schedule for the week
      const days = [];
      const dayMap = {
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday",
        5: "friday",
        6: "saturday",
        0: "sunday",
      };

      const startDate = new Date(weekDates.start);

      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);

        const dateStr = currentDate.toISOString().split("T")[0];
        const dayOfWeek = currentDate.getDay();
        const dayName = dayMap[dayOfWeek];

        // Find groups that have classes on this day
        const dayClasses = [];

        for (const group of groups) {
          // FIX 2: schedule_days ni to'g'ri olish
          let scheduleDays = [];

          if (typeof group.schedule_days === "string") {
            try {
              // JSON string bo'lsa
              scheduleDays = JSON.parse(group.schedule_days);
            } catch {
              // Comma separated string bo'lsa
              scheduleDays = group.schedule_days
                .split(",")
                .map((d) => d.trim().toLowerCase());
            }
          } else if (Array.isArray(group.schedule_days)) {
            scheduleDays = group.schedule_days.map((d) => d.toLowerCase());
          }

          // DEBUG
          console.log(`Group ${group.id} schedule days:`, scheduleDays);
          console.log(`Today day name: ${dayName}`);

          if (scheduleDays.includes(dayName.toLowerCase())) {
            // FIX 3: Date'lar bilan to'g'ri solishtirish
            const groupStart = new Date(group.start_date);
            const groupEnd = new Date(group.end_date);

            // Faqat sanalarni solishtirish (vaqtni hisobga olmasdan)
            groupStart.setHours(0, 0, 0, 0);
            groupEnd.setHours(23, 59, 59, 999);
            currentDate.setHours(0, 0, 0, 0);

            console.log(
              `Checking dates - Current: ${currentDate}, Group Start: ${groupStart}, Group End: ${groupEnd}`
            );

            if (currentDate >= groupStart && currentDate <= groupEnd) {
              console.log(`Group ${group.id} has class on ${dateStr}`);

              // Check if lesson exists
              const lesson = await Lesson.findOne({
                where: {
                  group_id: group.id,
                  date: dateStr,
                },
                attributes: ["id", "status"],
              });

              // Check if attendance is marked
              const attendanceMarked = lesson
                ? (await Attendance.count({
                    where: { lesson_id: lesson.id },
                  })) > 0
                : false;

              // Calculate end time
              const [hours, minutes] = (
                group.schedule_time || "09:00:00"
              ).split(":");
              const startTime = new Date(currentDate);
              startTime.setHours(parseInt(hours), parseInt(minutes));

              const endTime = new Date(startTime);
              endTime.setMinutes(
                endTime.getMinutes() + (group.lesson_duration || 90)
              );

              dayClasses.push({
                id: lesson?.id || null,
                group_id: group.id,
                group_name: group.name,
                course_name: group.Course.name,
                course_color: group.Course.color || "#3B82F6",
                start_time: `${hours}:${minutes}`,
                end_time: `${endTime
                  .getHours()
                  .toString()
                  .padStart(2, "0")}:${endTime
                  .getMinutes()
                  .toString()
                  .padStart(2, "0")}`,
                duration_minutes: group.lesson_duration || 90,
                room_name: group.Room?.name,
                students_count: group.current_students || 0,
                status: lesson?.status || "planned",
              });
            }
          }
        }

        days.push({
          date: dateStr,
          day_name: dayName.charAt(0).toUpperCase() + dayName.slice(1),
          day_number: currentDate.getDate(),
          is_today: currentDate.toDateString() === new Date().toDateString(),
          classes: dayClasses,
        });
      }

      // Calculate total classes
      const total_classes = days.reduce(
        (sum, day) => sum + day.classes.length,
        0
      );

      res.json({
        success: true,
        data: {
          week_start: weekDates.start,
          week_end: weekDates.end,
          week_number: Math.ceil((new Date(weekDates.start).getDate() + 1) / 7),
          total_classes,
          days,
        },
      });
    } catch (error) {
      console.error("Get weekly schedule error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch weekly schedule",
        error: error.message,
      });
    }
  }

  async getTodaySchedule(req, res) {
    try {
      const teacherId = req.user.id;
      const today = new Date().toISOString().split("T")[0];
      const dayOfWeek = new Date().getDay();
      const dayMap = {
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday",
        5: "friday",
        6: "saturday",
        0: "sunday",
      };
      const todayDayName = dayMap[dayOfWeek];

      // MySQL/MariaDB uchun to'g'ri query - JSON_CONTAINS ishlatamiz
      const groups = await Group.findAll({
        where: {
          teacher_id: teacherId,
          status: "active",
          start_date: { [Op.lte]: today },
          end_date: { [Op.gte]: today },
          // MySQL/MariaDB uchun JSON_CONTAINS ishlatamiz
          [Op.and]: [
            sequelize.where(
              sequelize.fn(
                "JSON_CONTAINS",
                sequelize.col("schedule_days"),
                sequelize.literal(`'"${todayDayName}"'`)
              ),
              true
            ),
          ],
        },
        include: [
          {
            model: Course,
            as: "Course",
            attributes: ["id", "name", "color"],
          },
          {
            model: Room,
            as: "Room",
            attributes: ["id", "name"],
          },
        ],
      });

      const classes = [];
      const now = new Date();

      for (const group of groups) {
        // Check if lesson exists
        const lesson = await Lesson.findOne({
          where: {
            group_id: group.id,
            date: today,
          },
          attributes: ["id", "status"],
        });

        // Check attendance
        const attendanceMarked = lesson
          ? (await Attendance.count({
              where: { lesson_id: lesson.id },
            })) > 0
          : false;

        // Calculate times
        const [hours, minutes] = (group.schedule_time || "09:00:00").split(":");
        const startTime = new Date();
        startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        const endTime = new Date(startTime);
        endTime.setMinutes(
          endTime.getMinutes() + (group.lesson_duration || 90)
        );

        // Determine status
        let status = "upcoming";
        if (now >= startTime && now <= endTime) {
          status = "ongoing";
        } else if (now > endTime) {
          status = "completed";
        }

        // Time until start
        let timeUntilStart = null;
        if (status === "upcoming") {
          const diffMs = startTime - now;
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffMinutes = Math.floor(
            (diffMs % (1000 * 60 * 60)) / (1000 * 60)
          );

          if (diffHours > 0) {
            timeUntilStart = `in ${diffHours}h ${diffMinutes}m`;
          } else if (diffMinutes > 0) {
            timeUntilStart = `in ${diffMinutes} minutes`;
          } else {
            timeUntilStart = "now";
          }
        }

        classes.push({
          id: lesson?.id || null,
          group_id: group.id,
          group_name: group.name,
          course_name: group.Course.name,
          course_color: group.Course.color || "#3B82F6",
          start_time: `${hours}:${minutes}`,
          end_time: `${endTime.getHours().toString().padStart(2, "0")}:${endTime
            .getMinutes()
            .toString()
            .padStart(2, "0")}`,
          duration_minutes: group.lesson_duration || 90,
          room_name: group.Room?.name,
          students_count: group.current_students || 0,
          status,
          time_until_start: timeUntilStart,
        });
      }

      // Sort by start time
      classes.sort((a, b) => {
        const [aHours, aMinutes] = a.start_time.split(":");
        const [bHours, bMinutes] = b.start_time.split(":");
        return (
          parseInt(aHours) * 60 +
          parseInt(aMinutes) -
          (parseInt(bHours) * 60 + parseInt(bMinutes))
        );
      });

      // Calculate statistics
      const total_classes = classes.length;
      const upcoming_classes = classes.filter(
        (c) => c.status === "upcoming"
      ).length;
      const ongoing_classes = classes.filter(
        (c) => c.status === "ongoing"
      ).length;
      const completed_classes = classes.filter(
        (c) => c.status === "completed"
      ).length;

      res.json({
        success: true,
        data: {
          date: today,
          total_classes,
          upcoming_classes,
          ongoing_classes,
          completed_classes,
          classes,
        },
      });
    } catch (error) {
      console.error("Get today schedule error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch today schedule",
        error: error.message,
      });
    }
  }

  async getMonthlySchedule(req, res) {
    try {
      const teacherId = req.user.id;
      const {
        year = new Date().getFullYear(),
        month = new Date().getMonth() + 1,
      } = req.query;

      // Get first and last day of month
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);

      // Get teacher's active groups in this month
      const groups = await Group.findAll({
        where: {
          teacher_id: teacherId,
          status: "active",
          [Op.or]: [
            {
              start_date: { [Op.lte]: lastDay },
              end_date: { [Op.gte]: firstDay },
            },
          ],
        },
        attributes: [
          "id",
          "name",
          "schedule_days",
          "schedule_time",
          "lesson_duration",
          "start_date",
          "end_date",
        ],
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
              "price",
              "color",
              "icon",
            ],
          },
          {
            model: Room,
            as: "Room",
            attributes: ["id", "name", "capacity"],
          },
          {
            model: Student,
            as: "Student",
            attributes: [
              "id",
              "full_name",
              "phone",
              "parent_phone",
              "birth_date",
              "status",
            ],
            through: { attributes: ["join_date", "status"] },
          },
        ],
      });

      // Create array of days for the month
      const days = [];
      const currentDate = new Date(firstDay);

      while (currentDate <= lastDay) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const dayOfWeek = currentDate.getDay();
        const dayMap = {
          1: "monday",
          2: "tuesday",
          3: "wednesday",
          4: "thursday",
          5: "friday",
          6: "saturday",
          0: "sunday",
        };
        const dayName = dayMap[dayOfWeek];

        // Count classes for this day
        let classes_count = 0;
        let has_attendance_pending = false;

        for (const group of groups) {
          const scheduleDays = group.schedule_days || [];

          if (scheduleDays.includes(dayName)) {
            // Check if date is within group's duration
            const groupStart = new Date(group.start_date);
            const groupEnd = new Date(group.end_date);

            if (currentDate >= groupStart && currentDate <= groupEnd) {
              classes_count++;

              // Check if attendance is pending
              const lesson = await Lesson.findOne({
                where: {
                  group_id: group.id,
                  date: dateStr,
                },
              });

              if (lesson && lesson.status === "completed") {
                const attendanceCount = await Attendance.count({
                  where: { lesson_id: lesson.id },
                });

                if (attendanceCount === 0) {
                  has_attendance_pending = true;
                }
              }
            }
          }
        }

        days.push({
          date: dateStr,
          day_number: currentDate.getDate(),
          is_current_month: true,
          classes_count,
          has_attendance_pending,
          groups,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Get month name
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const month_name = monthNames[month - 1];

      // Calculate total classes
      const total_classes = days.reduce(
        (sum, day) => sum + day.classes_count,
        0
      );

      res.json({
        success: true,
        data: {
          year: parseInt(year),
          month: parseInt(month),
          month_name,
          total_classes,
          days,
        },
      });
    } catch (error) {
      console.error("Get monthly schedule error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch monthly schedule",
        error: error.message,
      });
    }
  }

  async markAttendance(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const teacherId = req.user.id;
      const { groupId } = req.params;
      const { date, attendances } = req.body;

      // Check if teacher owns this group
      const group = await Group.findOne({
        where: { id: groupId, teacher_id: teacherId },
        transaction,
      });

      if (!group) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Find or create lesson
      let lesson = await Lesson.findOne({
        where: {
          group_id: groupId,
          date: date,
        },
        transaction,
      });

      if (!lesson) {
        // Create lesson if it doesn't exist
        lesson = await Lesson.create(
          {
            group_id: groupId,
            teacher_id: teacherId,
            room_id: group.room_id || null,
            date: date,
            status: "completed",
          },
          { transaction }
        );
      } else {
        // Update lesson status
        await lesson.update({ status: "completed" }, { transaction });
      }

      // Mark attendance for each student
      for (const attendance of attendances) {
        await Attendance.upsert(
          {
            lesson_id: lesson.id,
            teacher_id: teacherId,
            student_id: attendance.student_id,
            status: attendance.status,
            comment: attendance.reason,
            attendance_date: date,
            marked_by_teacher_id: teacherId,
          },
          {
            transaction,
            conflictFields: ["lesson_id", "student_id"],
          }
        );
      }

      await transaction.commit();

      res.json({
        success: true,
        message: "Attendance marked successfully",
      });
    } catch (error) {
      await transaction.rollback();
      console.error("Mark attendance error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark attendance",
        error: error.message,
      });
    }
  }

  async getAttendanceForDate(req, res) {
    try {
      const teacherId = req.user.id;
      const { groupId, date } = req.params;

      // Check if teacher owns this group
      const group = await Group.findOne({
        where: { id: groupId, teacher_id: teacherId },
        include: [
          {
            model: Student,
            as: "Student",
            attributes: ["id", "full_name", "phone"],
          },
        ],
      });

      if (!group) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Find lesson for this date
      const lesson = await Lesson.findOne({
        where: {
          group_id: groupId,
          date: date,
        },
      });

      // Get existing attendances
      const existingAttendances = lesson
        ? await Attendance.findAll({
            where: { lesson_id: lesson.id },
            attributes: ["student_id", "status", "comment"],
          })
        : [];

      // Create attendance records for all students
      const attendanceRecords = group.Student.map((student) => {
        const existing = existingAttendances.find(
          (a) => a.student_id === student.id
        );

        return {
          student_id: student.id,
          full_name: student.full_name,
          phone: student.phone,
          status: existing?.status || "not_marked",
          reason: existing?.comment,
        };
      });

      // Calculate statistics
      const present_count = attendanceRecords.filter(
        (r) => r.status === "present"
      ).length;
      const absent_count = attendanceRecords.filter(
        (r) => r.status === "absent"
      ).length;
      const late_count = attendanceRecords.filter(
        (r) => r.status === "late"
      ).length;
      const total_students = attendanceRecords.length;

      res.json({
        success: true,
        data: {
          date,
          attendances: attendanceRecords,
          total_students,
          present_count,
          absent_count,
          late_count,
        },
      });
    } catch (error) {
      console.error("Get attendance error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch attendance",
        error: error.message,
      });
    }
  }

  // ========== DASHBOARD STATS ==========

  async getDashboardStats(req, res) {
    try {
      const teacherId = req.user.id;
      const today = new Date().toISOString().split("T")[0];

      // Get teacher's active groups
      const groups = await Group.findAll({
        where: {
          teacher_id: teacherId,
          status: "active",
        },
        attributes: ["id", "current_students"],
      });

      const groupIds = groups.map((g) => g.id);
      const total_groups = groups.length;
      const total_students = groups.reduce(
        (sum, group) => sum + (group.current_students || 0),
        0
      );

      // Get today's classes count
      const dayOfWeek = new Date().getDay();
      const dayMap = {
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday",
        5: "friday",
        6: "saturday",
        0: "sunday",
      };
      const todayDayName = dayMap[dayOfWeek];

      const todayClasses = await Group.count({
        where: {
          teacher_id: teacherId,
          status: "active",
          start_date: { [Op.lte]: today },
          end_date: { [Op.gte]: today },
          schedule_days: {
            [Op.contains]: [todayDayName],
          },
        },
      });

      // Calculate attendance rate
      const attendanceStats = await Attendance.findOne({
        where: {
          lesson_id: {
            [Op.in]: groupIds.length > 0 ? groupIds : [0],
          },
        },
        attributes: [
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
        ],
        raw: true,
      });

      const attendance_rate =
        attendanceStats?.total > 0
          ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
          : 0;

      // Get upcoming classes for next week
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStart = nextWeek.toISOString().split("T")[0];

      const upcoming_classes_next_week = await Lesson.count({
        where: {
          group_id: groupIds.length > 0 ? groupIds : [0],
          date: {
            [Op.between]: [today, nextWeekStart],
          },
          status: "planned",
        },
      });

      res.json({
        success: true,
        data: {
          total_groups,
          active_groups: total_groups, // Since we're only getting active groups
          total_students,
          today_classes: todayClasses,
          attendance_rate,
          upcoming_classes_next_week,
        },
      });
    } catch (error) {
      console.error("Get dashboard stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch dashboard statistics",
        error: error.message,
      });
    }
  }

  async getGroupStudents(req, res) {
    try {
      const teacherId = req.user.id;
      const { groupId } = req.params;

      // Check if teacher owns this group
      const group = await Group.findOne({
        where: { id: groupId, teacher_id: teacherId },
        attributes: ["id"],
      });

      if (!group) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Get group students
      const students = await Student.findAll({
        include: [
          {
            model: Group,
            as: "Group",
            where: { id: groupId },
            attributes: [],
            through: {
              attributes: ["join_date", "status as group_status"],
            },
          },
        ],
        attributes: ["id", "full_name", "phone", "status", "registered_at"],
      });

      // Add attendance information for each student
      const studentsWithAttendance = await Promise.all(
        students.map(async (student) => {
          // Get student's attendance for this group
          const attendanceStats = await Attendance.findOne({
            where: {
              student_id: student.id,
              lesson_id: {
                [Op.in]: sequelize.literal(`(
                  SELECT id FROM Lessons lessons 
                  WHERE group_id = ${groupId}
                )`),
              },
            },
            attributes: [
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
                  sequelize.literal(
                    "CASE WHEN status = 'absent' THEN 1 ELSE 0 END"
                  )
                ),
                "absent",
              ],
              [
                sequelize.fn(
                  "SUM",
                  sequelize.literal(
                    "CASE WHEN status = 'late' THEN 1 ELSE 0 END"
                  )
                ),
                "late",
              ],
            ],
            raw: true,
          });

          // Get last attendance date
          const lastAttendance = await Attendance.findOne({
            where: {
              student_id: student.id,
              lesson_id: {
                [Op.in]: sequelize.literal(`(
                  SELECT id FROM Lessons lessons 
                  WHERE group_id = ${groupId}
                )`),
              },
            },
            attributes: ["attendance_date"],
            order: [["attendance_date", "DESC"]],
            raw: true,
          });

          // Get join date from GroupStudent
          const groupStudent = await GroupStudent.findOne({
            where: {
              group_id: groupId,
              student_id: student.id,
            },
            attributes: ["join_date"],
            raw: true,
          });

          return {
            id: student.id,
            full_name: student.full_name,
            phone: student.phone,
            status: student.status,
            registered_at: student.registered_at,
            group_member_since: groupStudent?.join_date,
            attendance_percentage:
              attendanceStats?.total > 0
                ? Math.round(
                    (attendanceStats.present / attendanceStats.total) * 100
                  )
                : 0,
            last_attendance: lastAttendance?.attendance_date || "Never",
            total_present: parseInt(attendanceStats?.present) || 0,
            total_absent: parseInt(attendanceStats?.absent) || 0,
            total_late: parseInt(attendanceStats?.late) || 0,
          };
        })
      );

      res.json({
        success: true,
        data: studentsWithAttendance,
      });
    } catch (error) {
      console.error("Get group students error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch group students",
        error: error.message,
      });
    }
  }
}

module.exports = new TeacherCourseController();
