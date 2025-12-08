// controllers/attendanceController.js - YANGILANGAN VERSIYA
const {
  Attendance,
  Student,
  Lesson,
  Group,
  Teacher,
  GroupStudent,
} = require("../models");
const { Op, fn, col } = require("sequelize");

module.exports = {
  // Create attendance record - YANGILANGAN
  async create(req, res) {
    try {
      const { student_id, lesson_id, status, comment, teacher_id } = req.body;

      if (!student_id || !lesson_id || !status) {
        return res.status(400).json({
          message: "student_id, lesson_id and status are required",
        });
      }

      // Lesson ni topish (teacher_id olish uchun)
      const lesson = await Lesson.findByPk(lesson_id, {
        include: [
          {
            model: Group,
            as: "Group",
            attributes: ["id", "name"],
          },
          {
            model: Teacher,
            as: "Teacher",
            attributes: ["id", "full_name"],
          },
        ],
      });

      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }

      // Teacher id ni aniqlash (agar body'da kelsa, yoki lesson'dan olish)
      const finalTeacherId = teacher_id || lesson.teacher_id;

      if (!finalTeacherId) {
        return res.status(400).json({
          message:
            "Teacher ID is required. Either provide teacher_id or ensure lesson has a teacher assigned",
        });
      }

      // Teacher borligini tekshirish
      const teacher = await Teacher.findByPk(finalTeacherId);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      const existingAttendance = await Attendance.findOne({
        where: { student_id, lesson_id },
      });

      if (existingAttendance) {
        return res
          .status(400)
          .json({ message: "Attendance already exists for this lesson" });
      }

      // Attendance yaratish teacher_id bilan
      const att = await Attendance.create({
        student_id,
        lesson_id,
        teacher_id: finalTeacherId, // YANGI: teacher_id qo'shildi
        marked_by_teacher_id: finalTeacherId, // YANGI: kim belgilagan
        status,
        comment,
        attendance_date: new Date(), // YANGI: attendance sanasi
      });

      const createdAtt = await Attendance.findByPk(att.id, {
        include: [
          {
            model: Student,
            as: "Student",
            attributes: ["id", "full_name"],
          },
          {
            model: Lesson,
            as: "Lesson",
            include: [
              {
                model: Group,
                as: "Group",
                attributes: ["id", "name"],
              },
              {
                model: Teacher,
                as: "Teacher",
                attributes: ["id", "full_name"],
              },
            ],
          },
          {
            model: Teacher,
            as: "Teacher",
            attributes: ["id", "full_name"],
          },
          {
            model: Teacher,
            as: "MarkedByTeacher",
            attributes: ["id", "full_name"],
          },
        ],
      });

      res.status(201).json(createdAtt);
    } catch (e) {
      console.log("Create attendance error:", e);
      res.status(500).json({
        message: "Create error",
        error: e.message,
      });
    }
  },

  // All attendance - YANGILANGAN
  async all(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        start_date,
        end_date,
        teacher_id,
        student_id,
        status,
      } = req.query;

      const where = {};
      const offset = (page - 1) * limit;

      // Date range filter
      if (start_date && end_date) {
        where.attendance_date = {
          [Op.between]: [start_date, end_date],
        };
      }

      // Teacher filter
      if (teacher_id) {
        where.teacher_id = teacher_id;
      }

      // Student filter
      if (student_id) {
        where.student_id = student_id;
      }

      // Status filter
      if (status) {
        where.status = status;
      }

      const { count, rows: attendances } = await Attendance.findAndCountAll({
        where,
        include: [
          {
            model: Student,
            as: "Student",
            attributes: ["id", "full_name"],
          },
          {
            model: Lesson,
            as: "Lesson",
            include: [
              {
                model: Group,
                as: "Group",
                attributes: ["id", "name"],
              },
              {
                model: Teacher,
                as: "Teacher",
                attributes: ["id", "full_name"],
              },
            ],
          },
          {
            model: Teacher,
            as: "Teacher",
            attributes: ["id", "full_name"],
          },
        ],
        order: [
          ["attendance_date", "DESC"],
          ["createdAt", "DESC"],
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        distinct: true,
      });

      res.json({
        data: attendances,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (e) {
      console.log("All attendances error:", e);
      res.status(500).json({
        message: "Error fetching attendances",
        error: e.message,
      });
    }
  },

  // Attendance by student - YANGILANGAN
  async byStudent(req, res) {
    try {
      const student_id = req.params.student_id;
      const { start_date, end_date, status } = req.query;

      const where = { student_id };

      // Date range filter
      if (start_date && end_date) {
        where.attendance_date = {
          [Op.between]: [start_date, end_date],
        };
      }

      // Status filter
      if (status) {
        where.status = status;
      }

      const attendances = await Attendance.findAll({
        where,
        include: [
          {
            model: Lesson,
            as: "Lesson",
            include: [
              {
                model: Group,
                as: "Group",
                attributes: ["id", "name"],
              },
              {
                model: Teacher,
                as: "Teacher",
                attributes: ["id", "full_name"],
              },
            ],
          },
          {
            model: Teacher,
            as: "Teacher",
            attributes: ["id", "full_name"],
          },
        ],
        order: [
          ["attendance_date", "DESC"],
          ["Lesson", "date", "DESC"],
        ],
      });

      // Calculate statistics
      const stats = await Attendance.findAll({
        where,
        attributes: ["status", [fn("COUNT", col("status")), "count"]],
        group: ["status"],
        raw: true,
      });

      const total = stats.reduce((sum, item) => sum + parseInt(item.count), 0);
      const statsWithPercent = stats.map((item) => ({
        status: item.status,
        count: parseInt(item.count),
        percentage:
          total > 0 ? ((parseInt(item.count) / total) * 100).toFixed(1) : 0,
      }));

      res.json({
        student_id,
        attendances,
        statistics: {
          total_attendances: total,
          breakdown: statsWithPercent,
        },
      });
    } catch (e) {
      console.log("By student error:", e);
      res.status(500).json({
        message: "Error fetching student attendances",
        error: e.message,
      });
    }
  },

  // Attendance by teacher - YANGI METHOD
  async byTeacher(req, res) {
    try {
      const teacher_id = req.params.teacher_id;
      const { start_date, end_date, status, page = 1, limit = 50 } = req.query;

      const where = { teacher_id };
      const offset = (page - 1) * limit;

      // Date range filter
      if (start_date && end_date) {
        where.attendance_date = {
          [Op.between]: [start_date, end_date],
        };
      }

      // Status filter
      if (status) {
        where.status = status;
      }

      const { count, rows: attendances } = await Attendance.findAndCountAll({
        where,
        include: [
          {
            model: Student,
            as: "Student",
            attributes: ["id", "full_name"],
          },
          {
            model: Lesson,
            as: "Lesson",
            include: [
              {
                model: Group,
                as: "Group",
                attributes: ["id", "name"],
              },
            ],
          },
        ],
        order: [
          ["attendance_date", "DESC"],
          ["createdAt", "DESC"],
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        distinct: true,
      });

      // Teacher statistics
      const stats = await Attendance.findAll({
        where,
        attributes: ["status", [fn("COUNT", col("status")), "count"]],
        group: ["status"],
        raw: true,
      });

      const total = stats.reduce((sum, item) => sum + parseInt(item.count), 0);
      const statsWithPercent = stats.map((item) => ({
        status: item.status,
        count: parseInt(item.count),
        percentage:
          total > 0 ? ((parseInt(item.count) / total) * 100).toFixed(1) : 0,
      }));

      res.json({
        teacher_id,
        data: attendances,
        statistics: {
          total_attendances: total,
          breakdown: statsWithPercent,
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (e) {
      console.log("By teacher error:", e);
      res.status(500).json({
        message: "Error fetching teacher attendances",
        error: e.message,
      });
    }
  },

  // Teacher attendance statistics - YANGI METHOD
  async teacherStats(req, res) {
    try {
      const teacher_id = req.params.teacher_id;
      const { start_date, end_date, group_by = "month" } = req.query;

      const where = { teacher_id };

      // Date range filter
      if (start_date && end_date) {
        where.attendance_date = {
          [Op.between]: [start_date, end_date],
        };
      }

      let groupByClause, attributes;

      switch (group_by) {
        case "day":
          groupByClause = [fn("DATE", col("attendance_date"))];
          attributes = [
            [fn("DATE", col("attendance_date")), "date"],
            [fn("COUNT", col("id")), "total"],
          ];
          break;
        case "week":
          groupByClause = [
            fn("YEAR", col("attendance_date")),
            fn("WEEK", col("attendance_date")),
          ];
          attributes = [
            [fn("YEAR", col("attendance_date")), "year"],
            [fn("WEEK", col("attendance_date")), "week"],
            [fn("COUNT", col("id")), "total"],
          ];
          break;
        case "month":
        default:
          groupByClause = [
            fn("YEAR", col("attendance_date")),
            fn("MONTH", col("attendance_date")),
          ];
          attributes = [
            [fn("YEAR", col("attendance_date")), "year"],
            [fn("MONTH", col("attendance_date")), "month"],
            [fn("COUNT", col("id")), "total"],
          ];
          break;
      }

      const stats = await Attendance.findAll({
        where,
        attributes: [
          ...attributes,
          [
            fn(
              "SUM",
              fn("CASE", { when: { status: "present" }, then: 1, else: 0 })
            ),
            "present",
          ],
          [
            fn(
              "SUM",
              fn("CASE", { when: { status: "absent" }, then: 1, else: 0 })
            ),
            "absent",
          ],
          [
            fn(
              "SUM",
              fn("CASE", { when: { status: "late" }, then: 1, else: 0 })
            ),
            "late",
          ],
          [
            fn(
              "SUM",
              fn("CASE", { when: { status: "excused" }, then: 1, else: 0 })
            ),
            "excused",
          ],
        ],
        group: groupByClause,
        order: groupByClause,
        raw: true,
      });

      // Overall statistics
      const overallStats = await Attendance.findAll({
        where,
        attributes: ["status", [fn("COUNT", col("status")), "count"]],
        group: ["status"],
        raw: true,
      });

      const total = overallStats.reduce(
        (sum, item) => sum + parseInt(item.count),
        0
      );

      res.json({
        teacher_id,
        date_range: { start_date, end_date },
        group_by,
        overall_statistics: {
          total_attendances: total,
          breakdown: overallStats.map((item) => ({
            status: item.status,
            count: parseInt(item.count),
            percentage:
              total > 0 ? ((parseInt(item.count) / total) * 100).toFixed(1) : 0,
          })),
        },
        detailed_statistics: stats.map((stat) => ({
          period:
            group_by === "day"
              ? stat.date
              : group_by === "week"
              ? `${stat.year}-W${stat.week.toString().padStart(2, "0")}`
              : `${stat.year}-${stat.month.toString().padStart(2, "0")}`,
          total: parseInt(stat.total),
          present: parseInt(stat.present || 0),
          absent: parseInt(stat.absent || 0),
          late: parseInt(stat.late || 0),
          excused: parseInt(stat.excused || 0),
          attendance_rate:
            parseInt(stat.total) > 0
              ? (
                  ((parseInt(stat.present || 0) + parseInt(stat.excused || 0)) /
                    parseInt(stat.total)) *
                  100
                ).toFixed(1)
              : 0,
        })),
      });
    } catch (e) {
      console.log("Teacher stats error:", e);
      res.status(500).json({
        message: "Error calculating teacher statistics",
        error: e.message,
      });
    }
  },

  // Attendance by lesson - YANGILANGAN
  async byLesson(req, res) {
    try {
      const lesson_id = req.params.lesson_id;

      const attendances = await Attendance.findAll({
        where: { lesson_id },
        include: [
          {
            model: Student,
            as: "Student",
            attributes: ["id", "full_name"],
          },
          {
            model: Teacher,
            as: "Teacher",
            attributes: ["id", "full_name"],
          },
          {
            model: Lesson,
            as: "Lesson",
            include: [
              {
                model: Group,
                as: "Group",
                attributes: ["id", "name", "start_date", "end_date"],
              },
              {
                model: Teacher,
                as: "Teacher",
                attributes: ["id", "full_name"],
              },
            ],
          },
        ],
        order: [["Student", "full_name", "ASC"]],
      });

      // Lesson details
      const lesson = await Lesson.findByPk(lesson_id, {
        include: [
          {
            model: Group,
            as: "Group",
            attributes: ["id", "name", "start_date", "end_date"],
          },
          {
            model: Teacher,
            as: "Teacher",
            attributes: ["id", "full_name"],
          },
        ],
      });

      // Statistics for this lesson
      const stats = await Attendance.findAll({
        where: { lesson_id },
        attributes: ["status", [fn("COUNT", col("status")), "count"]],
        group: ["status"],
        raw: true,
      });

      const total = stats.reduce((sum, item) => sum + parseInt(item.count), 0);

      res.json({
        lesson: lesson,
        attendances: attendances,
        statistics: {
          total_students: total,
          breakdown: stats.map((item) => ({
            status: item.status,
            count: parseInt(item.count),
            percentage:
              total > 0 ? ((parseInt(item.count) / total) * 100).toFixed(1) : 0,
          })),
          attendance_rate:
            total > 0
              ? (
                  ((parseInt(
                    stats.find((s) => s.status === "present")?.count || 0
                  ) +
                    parseInt(
                      stats.find((s) => s.status === "excused")?.count || 0
                    )) /
                    total) *
                  100
                ).toFixed(1)
              : 0,
        },
      });
    } catch (e) {
      console.log("By lesson error:", e);
      res.status(500).json({
        message: "Error fetching lesson attendances",
        error: e.message,
      });
    }
  },

  // Bulk create - YANGILANGAN
  async bulkCreate(req, res) {
    try {
      const {
        lesson_id,
        attendances,
        teacher_id,
        mark_completed = false,
      } = req.body; // ✅ YANGI: mark_completed param

      if (!lesson_id || !attendances || !Array.isArray(attendances)) {
        return res.status(400).json({
          message:
            "Missing required fields: lesson_id and attendances array are required",
        });
      }

      const lesson = await Lesson.findByPk(lesson_id, {
        include: [
          {
            model: Group,
            as: "Group",
            attributes: ["id", "name", "start_date", "end_date"],
          },
          {
            model: Teacher,
            as: "Teacher",
            attributes: ["id", "full_name"],
          },
        ],
      });

      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }

      // ✅ Dars statusini tekshirish
      if (lesson.status !== "planned") {
        return res.status(400).json({
          message: `Dars allaqachon ${lesson.status} holatida`,
          current_status: lesson.status,
        });
      }

      // Determine teacher ID
      const finalTeacherId = teacher_id || lesson.teacher_id;

      if (!finalTeacherId) {
        return res.status(400).json({
          message:
            "Teacher ID is required. Either provide teacher_id or ensure lesson has a teacher assigned",
        });
      }

      // Check for existing attendances
      const existingAttendances = await Attendance.findAll({
        where: {
          lesson_id,
          student_id: { [Op.in]: attendances.map((r) => r.student_id) },
        },
      });

      if (existingAttendances.length > 0) {
        return res.status(400).json({
          message: "Some attendances already exist for this lesson",
          existing: existingAttendances.map((att) => att.student_id),
        });
      }

      // Prepare records with teacher_id
      const records = attendances.map((att) => ({
        student_id: att.student_id,
        lesson_id,
        teacher_id: finalTeacherId,
        marked_by_teacher_id: finalTeacherId,
        status: att.status || "present",
        comment: att.comment || "",
        attendance_date: new Date(),
      }));

      const created = await Attendance.bulkCreate(records, {
        validate: true,
        returning: true,
      });

      // ✅ DARSNI TUGATISH (agar mark_completed = true bo'lsa)
      let completedLesson = null;
      if (mark_completed === true) {
        // Guruhdagi faol o'quvchilar sonini olish
        const groupStudents = await GroupStudent.findAll({
          where: {
            group_id: lesson.group_id,
            status: "active",
          },
        });

        // Joriy dars uchun davomatlar soni
        const attendanceCount = await Attendance.count({
          where: { lesson_id },
        });

        // ✅ Minimal talab: kamida 1 ta davomat bo'lsa ham darsni tugatish mumkin
        // Yoki: Barcha o'quvchilar uchun davomat olingan bo'lsa
        if (attendanceCount > 0) {
          completedLesson = await lesson.update({
            status: "completed",
            completed_at: new Date(),
            completed_by: finalTeacherId,
          });
        }
      }

      // Fetch created records with includes
      const createdIds = created.map((att) => att.id);
      const createdWithIncludes = await Attendance.findAll({
        where: { id: { [Op.in]: createdIds } },
        include: [
          {
            model: Student,
            as: "Student",
            attributes: ["id", "full_name"],
          },
          {
            model: Lesson,
            as: "Lesson",
            include: [
              {
                model: Group,
                as: "Group",
                attributes: ["id", "name", "start_date", "end_date"],
              },
              {
                model: Teacher,
                as: "Teacher",
                attributes: ["id", "full_name"],
              },
            ],
          },
          {
            model: Teacher,
            as: "Teacher",
            attributes: ["id", "full_name"],
          },
        ],
      });

      // Calculate statistics for the bulk operation
      const stats = await Attendance.findAll({
        where: { lesson_id },
        attributes: ["status", [fn("COUNT", col("status")), "count"]],
        group: ["status"],
        raw: true,
      });

      const total = stats.reduce((sum, item) => sum + parseInt(item.count), 0);

      res.json({
        message: `Successfully created ${created.length} attendance records`,
        attendances: createdWithIncludes,
        statistics: {
          lesson_id,
          total_attendances: total,
          breakdown: stats.map((item) => ({
            status: item.status,
            count: parseInt(item.count),
            percentage:
              total > 0 ? ((parseInt(item.count) / total) * 100).toFixed(1) : 0,
          })),
        },
        // ✅ YANGI: Dars holati haqida ma'lumot
        lesson_status: {
          before: "planned",
          after: completedLesson ? "completed" : "planned",
          completed_at: completedLesson?.completed_at,
          attendance_count: total,
          mark_completed_requested: mark_completed,
        },
      });
    } catch (e) {
      console.log("Bulk create error:", e);
      res.status(500).json({
        message: "Bulk create error",
        error: e.message,
      });
    }
  },

  // Update attendance - YANGILANGAN
  async update(req, res) {
    try {
      const att = await Attendance.findByPk(req.params.id);
      if (!att) {
        return res.status(404).json({ message: "Attendance not found" });
      }

      // If updating teacher_id, verify teacher exists
      if (req.body.teacher_id) {
        const teacher = await Teacher.findByPk(req.body.teacher_id);
        if (!teacher) {
          return res.status(404).json({ message: "Teacher not found" });
        }
      }

      await att.update(req.body);

      const updatedAtt = await Attendance.findByPk(att.id, {
        include: [
          {
            model: Student,
            as: "Student",
            attributes: ["id", "full_name"],
          },
          {
            model: Lesson,
            as: "Lesson",
            include: [
              {
                model: Group,
                as: "Group",
                attributes: ["id", "name", "start_date", "end_date"],
              },
              {
                model: Teacher,
                as: "Teacher",
                attributes: ["id", "full_name"],
              },
            ],
          },
          {
            model: Teacher,
            as: "Teacher",
            attributes: ["id", "full_name"],
          },
          {
            model: Teacher,
            as: "MarkedByTeacher",
            attributes: ["id", "full_name"],
          },
        ],
      });

      res.json(updatedAtt);
    } catch (e) {
      console.log("Update error:", e);
      res.status(500).json({
        message: "Error updating attendance",
        error: e.message,
      });
    }
  },

  async remove(req, res) {
    try {
      const att = await Attendance.findByPk(req.params.id);
      if (!att)
        return res.status(404).json({ message: "Attendance not found" });

      await att.destroy();
      res.json({ message: "Attendance deleted successfully" });
    } catch (e) {
      console.log(e);
      res.status(500).json({ message: "Error deleting attendance" });
    }
  },

  // Filter attendances - TUZATILGAN
  async filter(req, res) {
    try {
      const { group_id, student_id, start_date, end_date, status, lesson_id } =
        req.query;

      const where = {};

      if (group_id) where["$Lesson.group_id$"] = group_id;
      if (student_id) where.student_id = student_id;
      if (lesson_id) where.lesson_id = lesson_id;
      if (status) where.status = status;

      if (start_date && end_date) {
        where["$Lesson.date$"] = {
          [Op.between]: [start_date, end_date],
        };
      }

      const attendances = await Attendance.findAll({
        where,
        include: [
          {
            model: Student,
            attributes: ["id", "full_name"],
          },
          {
            model: Lesson,
            as: "Lesson",
            include: [
              {
                model: Group,
                as: "Group",
                attributes: ["id", "name", "start_date", "end_date"],
              },
              {
                model: Teacher,
                as: "Teacher",
                attributes: ["id", "full_name"],
              },
            ],
          },
        ],
        order: [
          ["Lesson", "date", "DESC"], // TO'G'RI SYNTAX
          ["Student", "full_name", "ASC"],
        ],
      });

      res.json(attendances);
    } catch (e) {
      console.log(e);
      res.status(500).json({ message: "Error filtering attendances" });
    }
  },

  // Student attendance statistics
  async studentStats(req, res) {
    try {
      const student_id = req.params.student_id;
      const { start_date, end_date } = req.query;

      const where = { student_id };

      // Add date range if provided
      if (start_date && end_date) {
        where["$Lesson.date$"] = {
          [Op.between]: [start_date, end_date],
        };
      }

      const stats = await Attendance.findAll({
        where,
        attributes: ["status", [fn("COUNT", col("status")), "count"]],
        include: [
          {
            model: Lesson,
            as: "Lesson",
            attributes: [],
          },
        ],
        group: ["status"],
        raw: true,
      });

      // Calculate totals and percentages
      const total = stats.reduce((sum, item) => sum + parseInt(item.count), 0);

      const statsWithPercent = stats.map((item) => ({
        status: item.status,
        count: parseInt(item.count),
        percentage:
          total > 0 ? ((parseInt(item.count) / total) * 100).toFixed(1) : 0,
      }));

      res.json({
        student_id,
        date_range: { start_date, end_date },
        total_attendances: total,
        statistics: statsWithPercent,
      });
    } catch (e) {
      console.log(e);
      res.status(500).json({ message: "Error calculating student statistics" });
    }
  },

  // Group attendance statistics
  async groupStats(req, res) {
    try {
      const group_id = req.params.group_id;
      const { start_date, end_date } = req.query;

      const where = {};

      // Add date range if provided
      if (start_date && end_date) {
        where["$Lesson.date$"] = {
          [Op.between]: [start_date, end_date],
        };
      }

      const stats = await Attendance.findAll({
        where,
        include: [
          {
            model: Lesson,
            as: "Lesson",
            where: { group_id },
            attributes: [],
          },
        ],
        attributes: [
          "status",
          [fn("COUNT", col("Attendance.status")), "count"],
        ],
        group: ["status"],
        raw: true,
      });

      // Calculate totals and percentages
      const total = stats.reduce((sum, item) => sum + parseInt(item.count), 0);

      const statsWithPercent = stats.map((item) => ({
        status: item.status,
        count: parseInt(item.count),
        percentage:
          total > 0 ? ((parseInt(item.count) / total) * 100).toFixed(1) : 0,
      }));

      res.json({
        group_id,
        date_range: { start_date, end_date },
        total_attendances: total,
        statistics: statsWithPercent,
      });
    } catch (e) {
      console.log(e);
      res.status(500).json({ message: "Error calculating group statistics" });
    }
  },

  // Bulk update attendance records
  async bulkUpdate(req, res) {
    try {
      const { attendances } = req.body;

      if (!attendances || !Array.isArray(attendances)) {
        return res.status(400).json({
          message: "Attendances array is required",
        });
      }

      const updatePromises = attendances.map((att) =>
        Attendance.update(
          { status: att.status, comment: att.comment },
          { where: { id: att.id } }
        )
      );

      await Promise.all(updatePromises);

      // Fetch updated records
      const updatedIds = attendances.map((att) => att.id);
      const updatedAttendances = await Attendance.findAll({
        where: { id: { [Op.in]: updatedIds } },
        include: [
          {
            model: Student,
            as: "student",
            attributes: ["id", "full_name"],
          },
          {
            model: Lesson,
            as: "Lesson",
            include: [
              {
                model: Group,
                as: "Group",
                attributes: ["id", "name", "start_date", "end_date"],
              },
              {
                model: Teacher,
                as: "Teacher",
                attributes: ["id", "full_name"],
              },
            ],
          },
        ],
      });

      res.json({
        message: `Successfully updated ${attendances.length} attendance records`,
        attendances: updatedAttendances,
      });
    } catch (e) {
      console.log(e);
      res.status(500).json({ message: "Bulk update error" });
    }
  },
  async byGroup(req, res) {
    try {
      const group_id = req.params.group_id;
      const { start_date, end_date, status } = req.query;

      const where = {};

      if (start_date && end_date) {
        where["$Lesson.date$"] = {
          [Op.between]: [start_date, end_date],
        };
      }

      if (status) {
        where.status = status;
      }

      const attendances = await Attendance.findAll({
        where,
        include: [
          {
            model: Student,
            attributes: ["id", "full_name"],
          },
          {
            model: Lesson,
            as: "Lesson",
            where: { group_id },
            include: [
              {
                model: Group,
                as: "Group",
                attributes: ["id", "name", "start_date", "end_date"],
              },
              {
                model: Teacher,
                as: "Teacher",
                attributes: ["id", "full_name"],
              },
            ],
          },
        ],
        order: [
          ["Lesson", "date", "DESC"], // TO'G'RI SYNTAX
          ["Student", "full_name", "ASC"],
        ],
      });
      res.json(attendances);
    } catch (e) {
      console.log(e);
      res.status(500).json({ message: "Error fetching group attendances" });
    }
  },
  // Get by ID - YANGILANGAN
  async getById(req, res) {
    try {
      const attendance = await Attendance.findByPk(req.params.id, {
        include: [
          {
            model: Student,
            as: "Student",
            attributes: ["id", "full_name", "phone"],
          },
          {
            model: Teacher,
            as: "Teacher",
            attributes: ["id", "full_name", "phone"],
          },
          {
            model: Teacher,
            as: "MarkedByTeacher",
            attributes: ["id", "full_name", "phone"],
          },
          {
            model: Lesson,
            as: "Lesson",
            include: [
              {
                model: Group,
                as: "Group",
                attributes: ["id", "name", "start_date", "end_date"],
              },
              {
                model: Teacher,
                as: "Teacher",
                attributes: ["id", "full_name"],
              },
            ],
          },
        ],
      });

      if (!attendance) {
        return res.status(404).json({ message: "Attendance not found" });
      }

      res.json(attendance);
    } catch (e) {
      console.log("Get by ID error:", e);
      res.status(500).json({
        message: "Error fetching attendance",
        error: e.message,
      });
    }
  },
};
