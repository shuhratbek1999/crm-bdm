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
          attributes: ["id", "full_name", "phone", "email"],
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
          attributes: ["id", "full_name", "phone", "email", "status"],
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
