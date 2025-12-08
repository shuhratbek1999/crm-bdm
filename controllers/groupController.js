// controllers/groupController.js
const {
  Group,
  Course,
  Teacher,
  Room,
  Student,
  Lesson,
  GroupStudent,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");

const getGroupStudents = async (req, res) => {
  try {
    const groupId = req.params.group_id;

    // 1. Group ni topish
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // 2. Group students ni topish (agar GroupStudent model bo'lsa)
    // Agar GroupStudent model bo'lsa:
    const groupStudents = await GroupStudent.findAll({
      where: { group_id: groupId },
      include: [
        {
          model: Student,
          as: "student",
          attributes: ["id", "full_name", "phone"],
        },
      ],
    });

    // Agar GroupStudent model bo'lmasa, barcha studentlarni qaytaramiz
    // va frontend filter qiladi
    let students = [];

    if (groupStudents && groupStudents.length > 0) {
      // GroupStudent modeli bo'lsa
      students = groupStudents.map((gs) => ({
        ...gs.student.toJSON(),
        joined_at: gs.createdAt, // talaba qo'shilgan sana
      }));
    } else {
      // Barcha studentlarni qaytarib, frontend filter qiladi
      const allStudents = await Student.findAll({
        attributes: ["id", "full_name", "phone"],
      });
      students = allStudents;
    }

    res.json({
      group_id: groupId,
      group_name: group.name,
      total_students: students.length,
      students: students,
    });
  } catch (error) {
    console.error("Get group students error:", error);
    res.status(500).json({
      message: "Error fetching group students",
      error: error.message,
    });
  }
};

// Barcha guruhlarni olish (yangi fieldlar bilan)
const getAllGroups = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status,
      teacher_id,
      course_id,
      has_schedule, // yangi filter
    } = req.query;

    const whereClause = {};

    // Search qilish (name va description bo'yicha)
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    // Filter by status
    if (status && status !== "all") {
      whereClause.status = status;
    }

    // Filter by teacher
    if (teacher_id) {
      whereClause.teacher_id = teacher_id;
    }

    // Filter by course
    if (course_id) {
      whereClause.course_id = course_id;
    }

    // Filter by schedule existence
    if (has_schedule === "true") {
      whereClause[Op.and] = [
        { schedule_days: { [Op.ne]: null } },
        { schedule_time: { [Op.ne]: null } },
      ];
    } else if (has_schedule === "false") {
      whereClause[Op.or] = [{ schedule_days: null }, { schedule_time: null }];
    }

    const offset = (page - 1) * limit;

    const { count, rows: groups } = await Group.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Course,
          as: "Course",
          attributes: ["id", "name", "description"],
        },
        {
          model: Teacher,
          as: "Teacher",
          attributes: ["id", "full_name", "phone"],
        },
        {
          model: Room,
          as: "Room",
          attributes: ["id", "name", "capacity"],
        },
      ],
      attributes: {
        include: [
          "schedule_days",
          "schedule_time",
          "description",
          [
            sequelize.literal(`(
              SELECT COUNT(*) 
              FROM Lessons 
              WHERE Lessons.group_id = Group.id
              AND Lessons.date >= CURDATE()
            )`),
            "upcoming_lessons",
          ],
          [
            sequelize.literal(`(
              SELECT COUNT(*) 
              FROM group_students 
              WHERE group_students.group_id = Group.id
              AND group_students.status = 'active'
            )`),
            "active_students_count",
          ],
        ],
      },
      order: [
        ["status", "ASC"],
        ["start_date", "ASC"],
        ["name", "ASC"],
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Format schedule info for frontend
    const formattedGroups = groups.map((group) => {
      const groupData = group.toJSON();

      // Format schedule days for display
      if (groupData.schedule_days && Array.isArray(groupData.schedule_days)) {
        groupData.schedule_days_formatted = groupData.schedule_days
          .map((day) => {
            const daysMap = {
              monday: "Mon",
              tuesday: "Tue",
              wednesday: "Wed",
              thursday: "Thu",
              friday: "Fri",
              saturday: "Sat",
              sunday: "Sun",
            };
            return daysMap[day] || day;
          })
          .join(", ");
      }

      // Format schedule time (remove seconds if present)
      if (groupData.schedule_time) {
        groupData.schedule_time_formatted = groupData.schedule_time
          .split(":")
          .slice(0, 2)
          .join(":");
      }

      // Calculate available seats
      groupData.available_seats = Math.max(
        0,
        groupData.max_students -
          (groupData.active_students_count || groupData.current_students || 0)
      );

      // Calculate fill percentage
      groupData.fill_percentage =
        groupData.max_students > 0
          ? Math.round(
              ((groupData.active_students_count ||
                groupData.current_students ||
                0) /
                groupData.max_students) *
                100
            )
          : 0;

      return groupData;
    });

    res.json({
      success: true,
      data: formattedGroups,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(count / limit),
        totalRecords: count,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get groups error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching groups",
      error: error.message,
    });
  }
};
const getAllGroupsTeacher = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status,
      course_id,
      has_schedule, // yangi filter
    } = req.query;

    const whereClause = {};

    // Search qilish (name va description bo'yicha)
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    // Filter by status
    if (status && status !== "all") {
      whereClause.status = status;
    }

    // Filter by teacher
    console.log(req.user);

    if (req.user && req.user?.role == "teacher") {
      whereClause.teacher_id = req.user.id;
    }

    // Filter by course
    if (course_id) {
      whereClause.course_id = course_id;
    }

    // Filter by schedule existence
    if (has_schedule === "true") {
      whereClause[Op.and] = [
        { schedule_days: { [Op.ne]: null } },
        { schedule_time: { [Op.ne]: null } },
      ];
    } else if (has_schedule === "false") {
      whereClause[Op.or] = [{ schedule_days: null }, { schedule_time: null }];
    }

    const offset = (page - 1) * limit;

    const { count, rows: groups } = await Group.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Course,
          as: "Course",
          attributes: ["id", "name", "description"],
        },
        {
          model: Teacher,
          as: "Teacher",
          attributes: ["id", "full_name", "phone"],
        },
        {
          model: Room,
          as: "Room",
          attributes: ["id", "name", "capacity"],
        },
      ],
      attributes: {
        include: [
          "schedule_days",
          "schedule_time",
          "description",
          [
            sequelize.literal(`(
              SELECT COUNT(*) 
              FROM Lessons 
              WHERE Lessons.group_id = Group.id
              AND Lessons.date >= CURDATE()
            )`),
            "upcoming_lessons",
          ],
          [
            sequelize.literal(`(
              SELECT COUNT(*) 
              FROM group_students 
              WHERE group_students.group_id = Group.id
              AND group_students.status = 'active'
            )`),
            "active_students_count",
          ],
        ],
      },
      order: [
        ["status", "ASC"],
        ["start_date", "ASC"],
        ["name", "ASC"],
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Format schedule info for frontend
    const formattedGroups = groups.map((group) => {
      const groupData = group.toJSON();

      // Format schedule days for display
      if (groupData.schedule_days && Array.isArray(groupData.schedule_days)) {
        groupData.schedule_days_formatted = groupData.schedule_days
          .map((day) => {
            const daysMap = {
              monday: "Mon",
              tuesday: "Tue",
              wednesday: "Wed",
              thursday: "Thu",
              friday: "Fri",
              saturday: "Sat",
              sunday: "Sun",
            };
            return daysMap[day] || day;
          })
          .join(", ");
      }

      // Format schedule time (remove seconds if present)
      if (groupData.schedule_time) {
        groupData.schedule_time_formatted = groupData.schedule_time
          .split(":")
          .slice(0, 2)
          .join(":");
      }

      // Calculate available seats
      groupData.available_seats = Math.max(
        0,
        groupData.max_students -
          (groupData.active_students_count || groupData.current_students || 0)
      );

      // Calculate fill percentage
      groupData.fill_percentage =
        groupData.max_students > 0
          ? Math.round(
              ((groupData.active_students_count ||
                groupData.current_students ||
                0) /
                groupData.max_students) *
                100
            )
          : 0;

      return groupData;
    });

    res.json({
      success: true,
      data: formattedGroups,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(count / limit),
        totalRecords: count,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get groups error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching groups",
      error: error.message,
    });
  }
};
// Bitta guruhni olish (to'liq ma'lumot bilan)
const getGroupById = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await Group.findByPk(id, {
      include: [
        {
          model: Course,
          as: "Course",
          attributes: ["id", "name", "description", "duration_hours", "price"],
        },
        {
          model: Teacher,
          as: "Teacher",
          attributes: [
            "id",
            "full_name",
            "phone",
            "email",
            "status",
            "specialty",
          ],
        },
        {
          model: Room,
          as: "Room",
          attributes: ["id", "name", "capacity", "description"],
        },
        {
          model: Student,
          as: "Students",
          through: {
            attributes: ["joined_date", "status", "notes"],
            where: { status: "active" }, // Faqat active studentlarni olish
          },
          attributes: ["id", "full_name", "phone", "status"],
        },
        {
          model: Lesson,
          as: "Lessons",
          limit: 10,
          order: [["date", "DESC"]],
          attributes: [
            "id",
            "date",
            "start_time",
            "end_time",
            "topic",
            "status",
          ],
        },
      ],
      attributes: {
        include: [
          "schedule_days",
          "schedule_time",
          "description",
          [
            sequelize.literal(`(
              SELECT COUNT(*) 
              FROM Lessons 
              WHERE Lessons.group_id = Group.id
              AND Lessons.status = 'scheduled'
              AND Lessons.date >= CURDATE()
            )`),
            "upcoming_lessons_count",
          ],
          [
            sequelize.literal(`(
              SELECT COUNT(*) 
              FROM Lessons 
              WHERE Lessons.group_id = Group.id
              AND Lessons.status = 'completed'
            )`),
            "completed_lessons_count",
          ],
          [
            sequelize.literal(`(
              SELECT AVG(Attendances.status = 'present') * 100
              FROM Lessons 
              LEFT JOIN Attendances ON Lessons.id = Attendances.lesson_id
              WHERE Lessons.group_id = Group.id
              AND Lessons.status = 'completed'
            )`),
            "attendance_rate",
          ],
        ],
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    const groupData = group.toJSON();

    // Format schedule data
    if (groupData.schedule_days) {
      const dayNames = {
        monday: "Monday",
        tuesday: "Tuesday",
        wednesday: "Wednesday",
        thursday: "Thursday",
        friday: "Friday",
        saturday: "Saturday",
        sunday: "Sunday",
      };

      groupData.schedule_days_display = groupData.schedule_days
        .map((day) => dayNames[day] || day)
        .join(", ");
    }

    if (groupData.schedule_time) {
      groupData.schedule_time_display = groupData.schedule_time
        .split(":")
        .slice(0, 2)
        .join(":");
    }

    // Calculate derived fields
    groupData.available_seats = Math.max(
      0,
      groupData.max_students -
        (groupData.Students?.length || groupData.current_students || 0)
    );

    groupData.total_lessons_planned =
      groupData.duration_months * 4.33 * groupData.lessons_per_week;

    res.json({
      success: true,
      data: groupData,
    });
  } catch (error) {
    console.error("Get group error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching group",
      error: error.message,
    });
  }
};

// Guruhni o'chirish (tekshiruvlar bilan)
const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await Group.findByPk(id, {
      include: [
        {
          model: Student,
          as: "Students",
          through: { where: { status: "active" } },
        },
      ],
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // Guruhda faol o'quvchilar borligini tekshirish
    const activeStudents = group.Students?.length || 0;
    if (activeStudents > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete group with ${activeStudents} active student(s)`,
        activeStudents,
      });
    }

    // Guruhda kelajakdagi darslar borligini tekshirish
    const upcomingLessons = await Lesson.count({
      where: {
        group_id: id,
        status: "scheduled",
        date: { [Op.gte]: new Date() },
      },
    });

    if (upcomingLessons > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete group with ${upcomingLessons} upcoming lesson(s)`,
        upcomingLessons,
      });
    }

    await group.destroy();

    res.json({
      success: true,
      message: "Group deleted successfully",
    });
  } catch (error) {
    console.error("Delete group error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting group",
      error: error.message,
    });
  }
};

// Guruh statistikasi (kengaytirilgan)
const getGroupStats = async (req, res) => {
  try {
    const stats = await sequelize.query(
      `
      SELECT 
        COUNT(*) as total_groups,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_groups,
        SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) as planned_groups,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_groups,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_groups,
        AVG(current_students) as avg_students_per_group,
        SUM(current_students) as total_students,
        SUM(max_students) as total_capacity,
        CASE 
          WHEN SUM(max_students) > 0 
          THEN ROUND(SUM(current_students) * 100.0 / SUM(max_students), 2)
          ELSE 0 
        END as overall_fill_rate,
        COUNT(CASE WHEN schedule_days IS NOT NULL AND schedule_time IS NOT NULL THEN 1 END) as groups_with_schedule
      FROM Groups
    `,
      { type: sequelize.QueryTypes.SELECT }
    );

    const courseStats = await sequelize.query(
      `
      SELECT 
        c.name as course_name,
        COUNT(g.id) as group_count,
        SUM(g.current_students) as total_students,
        ROUND(AVG(g.price), 2) as avg_price
      FROM Courses c
      LEFT JOIN Groups g ON c.id = g.course_id
      GROUP BY c.id, c.name
      ORDER BY group_count DESC
      LIMIT 5
    `,
      { type: sequelize.QueryTypes.SELECT }
    );

    const teacherStats = await sequelize.query(
      `
      SELECT 
        t.full_name,
        COUNT(g.id) as group_count,
        SUM(g.current_students) as total_students
      FROM Teachers t
      LEFT JOIN Groups g ON t.id = g.teacher_id
      WHERE g.status = 'active'
      GROUP BY t.id, t.full_name
      ORDER BY group_count DESC
      LIMIT 5
    `,
      { type: sequelize.QueryTypes.SELECT }
    );

    res.json({
      success: true,
      data: {
        overview: stats[0],
        top_courses: courseStats,
        top_teachers: teacherStats,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Get group stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching group statistics",
      error: error.message,
    });
  }
};

// Guruh schedule o'zgartirish (alohida endpoint)
const updateGroupSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { schedule_days, schedule_time, lesson_duration } = req.body;

    const group = await Group.findByPk(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // Validate schedule days
    if (schedule_days && !Array.isArray(schedule_days)) {
      return res.status(400).json({
        success: false,
        message: "Schedule days must be an array",
      });
    }

    // Check for conflicts with other groups (same teacher)
    if (schedule_days || schedule_time) {
      const teacherId = group.teacher_id;
      const daysToCheck = schedule_days || group.schedule_days;
      const timeToCheck = schedule_time || group.schedule_time;

      const conflictingGroups = await Group.findAll({
        where: {
          teacher_id: teacherId,
          id: { [Op.ne]: id },
          status: "active",
          schedule_days: { [Op.overlap]: daysToCheck },
          schedule_time: timeToCheck,
        },
        attributes: ["id", "name", "schedule_days", "schedule_time"],
      });

      if (conflictingGroups.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Schedule conflicts with other groups",
          conflicts: conflictingGroups.map((g) => ({
            group: g.name,
            schedule_days: g.schedule_days,
            schedule_time: g.schedule_time,
          })),
        });
      }
    }

    const updateData = {};
    if (schedule_days) updateData.schedule_days = schedule_days;
    if (schedule_time) updateData.schedule_time = schedule_time;
    if (lesson_duration) updateData.lesson_duration = lesson_duration;

    await group.update(updateData);

    res.json({
      success: true,
      message: "Group schedule updated successfully",
      data: {
        schedule_days: group.schedule_days,
        schedule_time: group.schedule_time,
        lesson_duration: group.lesson_duration,
      },
    });
  } catch (error) {
    console.error("Update group schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating group schedule",
      error: error.message,
    });
  }
};

// Guruhga student qo'shish (count update bilan)
const addStudentToGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { student_id } = req.body;

    const group = await Group.findByPk(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // Check if group has available seats
    if (group.current_students >= group.max_students) {
      return res.status(400).json({
        success: false,
        message: "Group is full",
        available_seats: 0,
      });
    }

    // Check if student exists
    const student = await Student.findByPk(student_id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Check if student is already in group
    const existingMembership = await sequelize.models.GroupStudent.findOne({
      where: {
        group_id: id,
        student_id: student_id,
        status: "active",
      },
    });

    if (existingMembership) {
      return res.status(400).json({
        success: false,
        message: "Student is already in this group",
      });
    }

    // Start transaction
    const transaction = await sequelize.transaction();

    try {
      // Add student to group
      await sequelize.models.GroupStudent.create(
        {
          group_id: id,
          student_id: student_id,
          joined_date: new Date(),
          status: "active",
        },
        { transaction }
      );

      // Update group student count
      await group.update(
        {
          current_students: sequelize.literal("current_students + 1"),
        },
        { transaction }
      );

      await transaction.commit();

      // Get updated group info
      const updatedGroup = await Group.findByPk(id, {
        include: [
          {
            model: Student,
            as: "Students",
            through: { where: { status: "active" } },
            attributes: ["id", "full_name"],
          },
        ],
      });

      res.json({
        success: true,
        message: "Student added to group successfully",
        data: {
          group_id: id,
          student_id: student_id,
          current_students: updatedGroup.current_students,
          available_seats:
            updatedGroup.max_students - updatedGroup.current_students,
        },
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Add student to group error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding student to group",
      error: error.message,
    });
  }
};
const checkRoomAvailabilityForGroup = async ({
  room_id,
  schedule_days,
  schedule_time,
  lesson_duration,
  group_id = null, // For updates, exclude current group
  start_date = new Date(),
  end_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
}) => {
  if (!room_id || !schedule_days || !schedule_time || !lesson_duration) {
    return { isAvailable: true, conflicts: [] };
  }

  const conflicts = [];
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);
  const current = new Date(startDate);

  // Day name map
  const dayMap = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const getDayName = (dayNumber) => {
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    return days[dayNumber];
  };

  // Check next 90 days
  while (current <= endDate) {
    const dayName = getDayName(current.getDay());

    if (schedule_days.includes(dayName)) {
      const dbDate = new Date(current);
      dbDate.setHours(0, 0, 0, 0);

      // Check for existing lessons in this room on this day
      const whereClause = {
        room_id,
        date: dbDate,
      };

      // Exclude current group if updating
      if (group_id) {
        whereClause.group_id = { [Op.ne]: group_id };
      }

      const existingLesson = await Lesson.findOne({
        where: whereClause,
        include: [
          {
            model: Group,
            as: "Group",
            attributes: ["id", "name", "schedule_time", "lesson_duration"],
            required: true,
          },
        ],
      });

      if (existingLesson && existingLesson.Group) {
        const existingGroup = existingLesson.Group;
        const existingTime = existingGroup.schedule_time || "09:00:00";
        const existingDuration = existingGroup.lesson_duration || 90;
        const newTime = schedule_time.substring(0, 5);
        const existingStartTime = existingTime.substring(0, 5);

        // Calculate end times
        const existingEndTime = calculateEndTime(
          existingStartTime,
          existingDuration
        );
        const newEndTime = calculateEndTime(newTime, lesson_duration);

        // Check if times overlap
        if (
          doTimesOverlap(
            newTime,
            newEndTime,
            existingStartTime,
            existingEndTime
          )
        ) {
          conflicts.push({
            date: current.toISOString().split("T")[0],
            day: dayName,
            conflict_type: "room_time",
            message: `Room is already occupied by group "${existingGroup.name}" at ${existingStartTime}-${existingEndTime} on ${dayName}`,
            existing_group: {
              id: existingGroup.id,
              name: existingGroup.name,
              time: `${existingStartTime}-${existingEndTime}`,
            },
          });
        }
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    conflicts,
    isAvailable: conflicts.length === 0,
    checked_days: schedule_days,
    checked_period: `${start_date} to ${end_date}`,
  };
};

/**
 * Check teacher availability for group schedule
 */
const checkTeacherAvailabilityForGroup = async ({
  teacher_id,
  schedule_days,
  schedule_time,
  lesson_duration,
  group_id = null, // For updates, exclude current group
  start_date = new Date(),
  end_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
}) => {
  if (!teacher_id || !schedule_days || !schedule_time || !lesson_duration) {
    return { isAvailable: true, conflicts: [] };
  }

  const conflicts = [];
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);
  const current = new Date(startDate);

  const getDayName = (dayNumber) => {
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    return days[dayNumber];
  };

  // Check next 90 days
  while (current <= endDate) {
    const dayName = getDayName(current.getDay());

    if (schedule_days.includes(dayName)) {
      const dbDate = new Date(current);
      dbDate.setHours(0, 0, 0, 0);

      // Check for existing lessons for this teacher on this day
      const whereClause = {
        teacher_id,
        date: dbDate,
      };

      // Exclude current group if updating
      if (group_id) {
        whereClause.group_id = { [Op.ne]: group_id };
      }

      const existingLesson = await Lesson.findOne({
        where: whereClause,
        include: [
          {
            model: Group,
            as: "Group",
            attributes: ["id", "name", "schedule_time", "lesson_duration"],
            required: true,
          },
        ],
      });

      if (existingLesson && existingLesson.Group) {
        const existingGroup = existingLesson.Group;
        const existingTime = existingGroup.schedule_time || "09:00:00";
        const existingDuration = existingGroup.lesson_duration || 90;
        const newTime = schedule_time.substring(0, 5);
        const existingStartTime = existingTime.substring(0, 5);

        // Calculate end times
        const existingEndTime = calculateEndTime(
          existingStartTime,
          existingDuration
        );
        const newEndTime = calculateEndTime(newTime, lesson_duration);

        // Check if times overlap
        if (
          doTimesOverlap(
            newTime,
            newEndTime,
            existingStartTime,
            existingEndTime
          )
        ) {
          conflicts.push({
            date: current.toISOString().split("T")[0],
            day: dayName,
            conflict_type: "teacher_time",
            message: `Teacher already has lesson with group "${existingGroup.name}" at ${existingStartTime}-${existingEndTime} on ${dayName}`,
            existing_group: {
              id: existingGroup.id,
              name: existingGroup.name,
              time: `${existingStartTime}-${existingEndTime}`,
            },
          });
        }
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    conflicts,
    isAvailable: conflicts.length === 0,
    checked_days: schedule_days,
    checked_period: `${start_date} to ${end_date}`,
  };
};
const calculateEndTime = (startTime, durationMinutes) => {
  const [hours, minutes] = startTime.split(":").map(Number);
  const startDate = new Date(2000, 0, 1, hours, minutes);
  startDate.setMinutes(startDate.getMinutes() + durationMinutes);

  return `${startDate.getHours().toString().padStart(2, "0")}:${startDate
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
};

/**
 * Check if two time ranges overlap
 */
const doTimesOverlap = (start1, end1, start2, end2) => {
  const timeToMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  return !(e1 <= s2 || s1 >= e2);
};

const createGroup = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      name,
      course_id,
      teacher_id,
      room_id,
      price,
      duration_months,
      lessons_per_week,
      lesson_duration = 90, // Default 90 minutes
      max_students,
      status = "planned",
      start_date,
      end_date,
      schedule_days = ["monday", "wednesday", "friday"],
      schedule_time = "09:00:00",
      description,
      schedule, // legacy field
    } = req.body;

    // Validatsiya
    if (!name || !course_id || !teacher_id || !start_date) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Name, course, teacher, and start date are required",
      });
    }

    // Teacher va Course mavjudligini tekshirish
    const [teacher, course] = await Promise.all([
      Teacher.findByPk(teacher_id, { transaction }),
      Course.findByPk(course_id, { transaction }),
    ]);

    if (!teacher) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Teacher not found",
      });
    }

    if (!course) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Course not found",
      });
    }

    // Room mavjudligini tekshirish (agar berilgan bo'lsa)
    if (room_id) {
      const room = await Room.findByPk(room_id, { transaction });
      if (!room) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Room not found",
        });
      }
    }

    // Schedule days validation
    if (schedule_days && Array.isArray(schedule_days)) {
      const validDays = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];
      const invalidDays = schedule_days.filter(
        (day) => !validDays.includes(day.toLowerCase())
      );

      if (invalidDays.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Invalid schedule days: ${invalidDays.join(
            ", "
          )}. Valid days are: ${validDays.join(", ")}`,
        });
      }
    }

    // Schedule time validation
    if (
      schedule_time &&
      !/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(schedule_time)
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid schedule time format. Use HH:MM or HH:MM:SS",
      });
    }

    // Auto-calculate end_date if not provided
    let calculatedEndDate = end_date;
    if (!end_date && duration_months) {
      const start = new Date(start_date);
      start.setMonth(start.getMonth() + duration_months);
      calculatedEndDate = start;
    }

    // Calculate end date for availability check (use 30 days if end date not provided)
    const checkEndDate =
      calculatedEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // ========== TEACHER AVAILABILITY CHECK ==========
    const teacherAvailability = await checkTeacherAvailabilityForGroup({
      teacher_id,
      schedule_days,
      schedule_time,
      lesson_duration,
      start_date,
      end_date: checkEndDate,
    });

    if (!teacherAvailability.isAvailable) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Teacher has conflicting schedule with existing lessons",
        conflicts: teacherAvailability.conflicts,
        suggestion:
          "Please choose different schedule days or time for this teacher",
      });
    }

    // ========== ROOM AVAILABILITY CHECK ==========
    if (room_id) {
      const roomAvailability = await checkRoomAvailabilityForGroup({
        room_id,
        schedule_days,
        schedule_time,
        lesson_duration,
        start_date,
        end_date: checkEndDate,
      });

      if (!roomAvailability.isAvailable) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: "Room has conflicting schedule with existing lessons",
          conflicts: roomAvailability.conflicts,
          suggestion: "Please choose different room, schedule days, or time",
        });
      }
    }

    const group = await Group.create(
      {
        name,
        course_id,
        teacher_id,
        room_id,
        price: price || 0,
        duration_months: duration_months || 3,
        lessons_per_week: lessons_per_week || 3,
        lesson_duration: lesson_duration,
        max_students: max_students || 15,
        status,
        start_date,
        end_date: calculatedEndDate,
        schedule_days,
        schedule_time,
        description,
        schedule, // legacy
        current_students: 0,
      },
      { transaction }
    );

    // Yangi yaratilgan guruhni relationlar bilan qaytarish
    const newGroup = await Group.findByPk(group.id, {
      include: [
        {
          model: Course,
          as: "Course",
          attributes: ["id", "name", "description"],
        },
        {
          model: Teacher,
          as: "Teacher",
          attributes: ["id", "full_name", "phone"],
        },
        {
          model: Room,
          as: "Room",
          attributes: ["id", "name", "capacity"],
        },
      ],
      attributes: {
        include: ["schedule_days", "schedule_time", "description"],
      },
      transaction,
    });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Group created successfully",
      data: newGroup,
      availability_check: {
        teacher: "available",
        room: room_id ? "available" : "not assigned",
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Create group error:", error);

    // Sequelize validation errors
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((err) => ({
          field: err.path,
          message: err.message,
        })),
      });
    }

    // Unique constraint error
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "A group with this name already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while creating group",
      error: error.message,
    });
  }
};

// Guruhni yangilash (yangi fieldlar bilan) - TO'G'RILANDI
const updateGroup = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const updateData = req.body;

    const group = await Group.findByPk(id, { transaction });
    if (!group) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // Teacher mavjudligini tekshirish (agar yangilansa)
    if (updateData.teacher_id) {
      const teacher = await Teacher.findByPk(updateData.teacher_id, {
        transaction,
      });
      if (!teacher) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Teacher not found",
        });
      }
    }

    // Course mavjudligini tekshirish (agar yangilansa)
    if (updateData.course_id) {
      const course = await Course.findByPk(updateData.course_id, {
        transaction,
      });
      if (!course) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Course not found",
        });
      }
    }

    // Room mavjudligini tekshirish (agar yangilansa)
    if (updateData.room_id) {
      const room = await Room.findByPk(updateData.room_id, { transaction });
      if (!room) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Room not found",
        });
      }
    }

    // Schedule validation
    if (updateData.schedule_days) {
      if (!Array.isArray(updateData.schedule_days)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Schedule days must be an array",
        });
      }

      const validDays = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];
      const invalidDays = updateData.schedule_days.filter(
        (day) => !validDays.includes(day.toLowerCase())
      );

      if (invalidDays.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Invalid schedule days: ${invalidDays.join(
            ", "
          )}. Valid days are: ${validDays.join(", ")}`,
        });
      }
    }

    // Schedule time validation
    if (
      updateData.schedule_time &&
      !/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(updateData.schedule_time)
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid schedule time format. Use HH:MM or HH:MM:SS",
      });
    }

    // Determine schedule parameters for availability check
    const scheduleDays = updateData.schedule_days || group.schedule_days;
    const scheduleTime = updateData.schedule_time || group.schedule_time;
    const lessonDuration = updateData.lesson_duration || group.lesson_duration;
    const teacherId = updateData.teacher_id || group.teacher_id;
    const roomId = updateData.room_id || group.room_id;
    const startDate = updateData.start_date || group.start_date;
    const endDate = updateData.end_date || group.end_date;

    // Calculate check end date
    const checkEndDate =
      endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // ========== TEACHER AVAILABILITY CHECK ==========
    const teacherAvailability = await checkTeacherAvailabilityForGroup({
      teacher_id: teacherId,
      schedule_days: scheduleDays,
      schedule_time: scheduleTime,
      lesson_duration: lessonDuration,
      group_id: id, // Exclude current group
      start_date: startDate,
      end_date: checkEndDate,
    });

    if (!teacherAvailability.isAvailable) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Teacher has conflicting schedule with existing lessons",
        conflicts: teacherAvailability.conflicts,
        suggestion:
          "Please choose different schedule days or time for this teacher",
      });
    }

    // ========== ROOM AVAILABILITY CHECK ==========
    if (roomId) {
      const roomAvailability = await checkRoomAvailabilityForGroup({
        room_id: roomId,
        schedule_days: scheduleDays,
        schedule_time: scheduleTime,
        lesson_duration: lessonDuration,
        group_id: id, // Exclude current group
        start_date: startDate,
        end_date: checkEndDate,
      });

      if (!roomAvailability.isAvailable) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: "Room has conflicting schedule with existing lessons",
          conflicts: roomAvailability.conflicts,
          suggestion: "Please choose different room, schedule days, or time",
        });
      }
    }

    // Auto-calculate end_date if duration_months is updated
    if (updateData.duration_months && !updateData.end_date) {
      const start = new Date(updateData.start_date || group.start_date);
      start.setMonth(start.getMonth() + updateData.duration_months);
      updateData.end_date = start;
    }

    // Prevent reducing max_students below current_students
    if (
      updateData.max_students !== undefined &&
      updateData.max_students < group.current_students
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot set max students below current students (${group.current_students})`,
      });
    }

    await group.update(updateData, { transaction });

    // Yangilangan guruhni relationlar bilan qaytarish
    const updatedGroup = await Group.findByPk(id, {
      include: [
        {
          model: Course,
          as: "Course",
          attributes: ["id", "name"],
        },
        {
          model: Teacher,
          as: "Teacher",
          attributes: ["id", "full_name", "phone"],
        },
        {
          model: Room,
          as: "Room",
          attributes: ["id", "name", "capacity"],
        },
      ],
      attributes: {
        include: ["schedule_days", "schedule_time", "description"],
      },
      transaction,
    });

    await transaction.commit();

    res.json({
      success: true,
      message: "Group updated successfully",
      data: updatedGroup,
      availability_check: {
        teacher: "available",
        room: roomId ? "available" : "not assigned",
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Update group error:", error);

    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((err) => ({
          field: err.path,
          message: err.message,
        })),
      });
    }

    // Unique constraint error
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "A group with this name already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while updating group",
      error: error.message,
    });
  }
};

const checkGroupAvailability = async (req, res) => {
  try {
    const {
      teacher_id,
      room_id,
      schedule_days,
      schedule_time,
      lesson_duration = 90,
      start_date = new Date(),
      end_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      exclude_group_id = null,
    } = req.body;

    // Validation
    if (!teacher_id || !schedule_days || !schedule_time) {
      return res.status(400).json({
        success: false,
        message: "teacher_id, schedule_days, and schedule_time are required",
      });
    }

    // Check teacher exists
    const teacher = await Teacher.findByPk(teacher_id);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    // Check room exists if provided
    let room = null;
    if (room_id) {
      room = await Room.findByPk(room_id);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room not found",
        });
      }
    }

    // Check teacher availability
    const teacherAvailability = await checkTeacherAvailabilityForGroup({
      teacher_id,
      schedule_days,
      schedule_time,
      lesson_duration,
      group_id: exclude_group_id,
      start_date,
      end_date,
    });

    // Check room availability if room provided
    let roomAvailability = { isAvailable: true, conflicts: [] };
    if (room_id) {
      roomAvailability = await checkRoomAvailabilityForGroup({
        room_id,
        schedule_days,
        schedule_time,
        lesson_duration,
        group_id: exclude_group_id,
        start_date,
        end_date,
      });
    }

    res.json({
      success: true,
      data: {
        teacher: {
          id: teacher_id,
          name: teacher.full_name,
          ...teacherAvailability,
        },
        room: room_id
          ? {
              id: room_id,
              name: room?.name,
              ...roomAvailability,
            }
          : null,
        schedule: {
          days: schedule_days,
          time: schedule_time,
          duration: lesson_duration,
          period: `${start_date} to ${end_date}`,
        },
        overall_available:
          teacherAvailability.isAvailable && roomAvailability.isAvailable,
        recommendations:
          !teacherAvailability.isAvailable || !roomAvailability.isAvailable
            ? [
                ...(!teacherAvailability.isAvailable
                  ? ["Consider changing teacher or schedule time"]
                  : []),
                ...(!roomAvailability.isAvailable
                  ? ["Consider changing room or schedule time"]
                  : []),
                "Try different schedule days",
                "Consider adjusting the schedule time by 30 minutes",
                "Consider adjusting lesson duration",
              ]
            : ["Schedule is fully available"],
      },
    });
  } catch (error) {
    console.error("Check group availability error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking availability",
      error: error.message,
    });
  }
};

module.exports = {
  getAllGroupsTeacher,
  getAllGroups,
  getGroupById,
  createGroup, // YANGILANDI
  updateGroup, // YANGILANDI
  deleteGroup,
  getGroupStats,
  updateGroupSchedule,
  addStudentToGroup,
  checkGroupAvailability,
  getGroupStudents,
};
