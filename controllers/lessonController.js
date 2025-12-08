// controllers/lessonController.js
const { Lesson, Group, Teacher, Room, sequelize } = require("../models");
const { Op } = require("sequelize");

const calculateLessonDates = ({
  start_date,
  end_date,
  schedule_days,
  exclude_dates = [],
  max_lessons = null,
}) => {
  const dates = [];
  const current = new Date(start_date);
  const end = new Date(end_date);

  // exclude_dates ni string formatga o'tkazamiz
  const excludeDateStrs = exclude_dates.map(
    (date) => new Date(date).toISOString().split("T")[0]
  );

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

  // Convert day names to numbers for faster comparison
  const scheduleDayNumbers = schedule_days.map(
    (day) => dayMap[day.toLowerCase()]
  );

  while (current <= end && (!max_lessons || dates.length < max_lessons)) {
    const dayNumber = current.getDay();

    // Check if day is in schedule
    if (scheduleDayNumbers.includes(dayNumber)) {
      const dateStr = current.toISOString().split("T")[0];

      // Check if not in excluded dates
      if (!excludeDateStrs.includes(dateStr)) {
        dates.push(new Date(current));
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return dates;
};

const combineDateTime = (date, timeStr) => {
  if (!timeStr) {
    // Default to 9:00 AM if no time specified
    const newDate = new Date(date);
    newDate.setHours(9, 0, 0, 0);
    return newDate;
  }

  // Remove seconds if present and parse hours and minutes
  let hours, minutes;

  if (typeof timeStr === "string") {
    const timeParts = timeStr.split(":");
    hours = parseInt(timeParts[0]) || 9;
    minutes = parseInt(timeParts[1]) || 0;
  } else {
    hours = 9;
    minutes = 0;
  }

  // Ensure valid hours (0-23) and minutes (0-59)
  hours = Math.max(0, Math.min(23, hours));
  minutes = Math.max(0, Math.min(59, minutes));

  const newDate = new Date(date);
  newDate.setHours(hours, minutes, 0, 0);
  return newDate;
};

const addDuration = (date, durationMinutes) => {
  const newDate = new Date(date);
  newDate.setMinutes(newDate.getMinutes() + durationMinutes);
  return newDate;
};

const checkConflicts = async ({
  dates,
  schedule_time,
  duration_minutes,
  teacher_id,
  room_id,
  group_id,
  check_group_conflict = true,
}) => {
  const conflicts = [];

  console.log("=== CONFLICT CHECK START ===");
  console.log("Config:", {
    datesCount: dates.length,
    schedule_time,
    duration_minutes,
    teacher_id,
    room_id,
    group_id,
    check_group_conflict,
  });

  // TIME formatni pars qilish (HH:MM:SS -> {hours, minutes})
  const parseTime = (timeStr) => {
    if (!timeStr) return { hours: 9, minutes: 0 };

    // "09:00:00" -> ["09", "00", "00"]
    const parts = timeStr.split(":");
    return {
      hours: parseInt(parts[0]) || 9,
      minutes: parseInt(parts[1]) || 0,
      seconds: parseInt(parts[2]) || 0,
    };
  };

  // Sanalarni string formatga o'tkazish
  const dateStrings = dates.map((date) => {
    const d = new Date(date);
    return d.toISOString().split("T")[0]; // "2024-01-15"
  });

  console.log("Dates to check:", dateStrings);

  // ========== 1. GURUH KONFLIKTLARI ==========
  if (check_group_conflict) {
    console.log("\n--- Checking GROUP conflicts ---");

    // Guruhning mavjud darslarini olish
    const existingGroupLessons = await sequelize.models.Lesson.findAll({
      where: { group_id },
      raw: true,
      attributes: ["id", "date"],
    });

    console.log(
      `Found ${existingGroupLessons.length} existing lessons for group ${group_id}`
    );

    // Har bir sana uchun tekshirish
    for (const dateStr of dateStrings) {
      const hasLessonOnDate = existingGroupLessons.some((lesson) => {
        if (!lesson.date) return false;

        // DATEONLY fieldni solishtirish
        const lessonDate = new Date(lesson.date);
        const lessonDateStr = lessonDate.toISOString().split("T")[0];

        return lessonDateStr === dateStr;
      });

      if (hasLessonOnDate) {
        conflicts.push({
          type: "group",
          date: dateStr,
          message: `❌ Group already has a lesson on ${dateStr}`,
          severity: "high",
          can_skip: false,
        });
        console.log(`Group conflict found: ${dateStr}`);
      }
    }
  }

  // ========== 2. O'QITUVCHI VA XONA KONFLIKTLARI ==========
  // Faqat guruh konflikti bo'lmagan sanalarni tekshiramiz
  const conflictDates = conflicts.map((c) => c.date);
  const datesToCheck = dateStrings.filter(
    (dateStr) => !conflictDates.includes(dateStr)
  );

  if (datesToCheck.length === 0) {
    console.log("No dates left to check after group conflicts");
    return conflicts;
  }

  console.log(
    `\n--- Checking TEACHER & ROOM conflicts for ${datesToCheck.length} dates ---`
  );

  // Yangi dars vaqtini hisoblash
  const newTime = parseTime(schedule_time);
  console.log(
    `New lesson time: ${newTime.hours}:${newTime.minutes} for ${duration_minutes} minutes`
  );

  // 2.1. O'QITUVCHI KONFLIKTLARI
  console.log("\n--- Teacher conflicts ---");

  // Teacherning barcha darslarini olish
  const teacherLessons = await sequelize.models.Lesson.findAll({
    where: { teacher_id },
    include: [
      {
        model: sequelize.models.Group,
        as: "Group",
        attributes: ["id", "name", "schedule_time", "lesson_duration"],
        required: true,
      },
    ],
    raw: true,
    nest: true,
  });

  console.log(`Teacher has ${teacherLessons.length} total lessons`);

  // Har bir sana uchun teacher konfliktini tekshirish
  for (const dateStr of datesToCheck) {
    // Bu sanadagi teacher darslarini filter
    const sameDayTeacherLessons = teacherLessons.filter((lesson) => {
      if (!lesson.date) return false;

      const lessonDate = new Date(lesson.date);
      const lessonDateStr = lessonDate.toISOString().split("T")[0];
      return lessonDateStr === dateStr && lesson.group_id !== group_id;
    });

    console.log(
      `Date ${dateStr}: Teacher has ${sameDayTeacherLessons.length} lessons on this day`
    );

    if (sameDayTeacherLessons.length === 0) continue;

    // Yangi dars vaqtini hisoblash
    const newStart = new Date(dateStr);
    newStart.setHours(newTime.hours, newTime.minutes, 0, 0);
    const newEnd = new Date(newStart);
    newEnd.setMinutes(newEnd.getMinutes() + duration_minutes);

    // Har bir mavjud darsni tekshirish
    for (const lesson of sameDayTeacherLessons) {
      if (!lesson.Group || !lesson.Group.schedule_time) continue;

      const existingTime = parseTime(lesson.Group.schedule_time);
      const existingDuration = lesson.Group.lesson_duration || 90;

      const existingStart = new Date(dateStr);
      existingStart.setHours(existingTime.hours, existingTime.minutes, 0, 0);
      const existingEnd = new Date(existingStart);
      existingEnd.setMinutes(existingEnd.getMinutes() + existingDuration);

      console.log(
        `  Existing lesson: ${existingStart.toTimeString()} - ${existingEnd.toTimeString()}`
      );
      console.log(
        `  New lesson: ${newStart.toTimeString()} - ${newEnd.toTimeString()}`
      );

      // Vaqt konfliktini tekshirish
      const hasConflict = !(newEnd <= existingStart || newStart >= existingEnd);

      if (hasConflict) {
        conflicts.push({
          type: "teacher",
          date: dateStr,
          message: `⏰ Teacher is busy with "${
            lesson.Group.name
          }" at ${lesson.Group.schedule_time.substring(0, 5)}`,
          severity: "medium",
          can_skip: true,
          existing_lesson: {
            id: lesson.id,
            group_name: lesson.Group.name,
            time: lesson.Group.schedule_time.substring(0, 5),
          },
        });
        console.log(`Teacher conflict found for ${dateStr}`);
        break;
      }
    }
  }

  // 2.2. XONA KONFLIKTLARI
  if (room_id) {
    console.log("\n--- Room conflicts ---");

    // Xonaning barcha darslarini olish
    const roomLessons = await sequelize.models.Lesson.findAll({
      where: { room_id },
      include: [
        {
          model: sequelize.models.Group,
          as: "Group",
          attributes: ["id", "name", "schedule_time", "lesson_duration"],
          required: true,
        },
      ],
      raw: true,
      nest: true,
    });

    console.log(`Room has ${roomLessons.length} total lessons`);

    // Faqat teacher konflikti bo'lmagan sanalarni tekshiramiz
    const teacherConflictDates = conflicts
      .filter((c) => c.type === "teacher")
      .map((c) => c.date);
    const roomDatesToCheck = datesToCheck.filter(
      (dateStr) => !teacherConflictDates.includes(dateStr)
    );

    for (const dateStr of roomDatesToCheck) {
      // Bu sanadagi xona darslarini filter
      const sameDayRoomLessons = roomLessons.filter((lesson) => {
        if (!lesson.date) return false;

        const lessonDate = new Date(lesson.date);
        const lessonDateStr = lessonDate.toISOString().split("T")[0];
        return lessonDateStr === dateStr && lesson.group_id !== group_id;
      });

      console.log(
        `Date ${dateStr}: Room has ${sameDayRoomLessons.length} lessons on this day`
      );

      if (sameDayRoomLessons.length === 0) continue;

      // Yangi dars vaqtini hisoblash
      const newStart = new Date(dateStr);
      newStart.setHours(newTime.hours, newTime.minutes, 0, 0);
      const newEnd = new Date(newStart);
      newEnd.setMinutes(newEnd.getMinutes() + duration_minutes);

      // Har bir mavjud darsni tekshirish
      for (const lesson of sameDayRoomLessons) {
        if (!lesson.Group || !lesson.Group.schedule_time) continue;

        const existingTime = parseTime(lesson.Group.schedule_time);
        const existingDuration = lesson.Group.lesson_duration || 90;

        const existingStart = new Date(dateStr);
        existingStart.setHours(existingTime.hours, existingTime.minutes, 0, 0);
        const existingEnd = new Date(existingStart);
        existingEnd.setMinutes(existingEnd.getMinutes() + existingDuration);

        console.log(
          `  Existing lesson: ${existingStart.toTimeString()} - ${existingEnd.toTimeString()}`
        );

        // Vaqt konfliktini tekshirish
        const hasConflict = !(
          newEnd <= existingStart || newStart >= existingEnd
        );

        if (hasConflict) {
          conflicts.push({
            type: "room",
            date: dateStr,
            message: `🚪 Room is occupied by "${
              lesson.Group.name
            }" at ${lesson.Group.schedule_time.substring(0, 5)}`,
            severity: "medium",
            can_skip: true,
            existing_lesson: {
              id: lesson.id,
              group_name: lesson.Group.name,
              time: lesson.Group.schedule_time.substring(0, 5),
            },
          });
          console.log(`Room conflict found for ${dateStr}`);
          break;
        }
      }
    }
  }

  console.log("\n=== CONFLICT CHECK END ===");
  console.log(`Total conflicts: ${conflicts.length}`);

  if (conflicts.length > 0) {
    console.log("Conflicts breakdown:");
    const byType = conflicts.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {});
    console.log(byType);
  }

  return conflicts;
};

module.exports = {
  // Create lesson - TO'G'RILANGAN
  async create(req, res) {
    try {
      const { group_id, date, teacher_id, room_id, status, topic, homework } =
        req.body;

      // Basic validation
      if (!group_id || !date || !teacher_id) {
        return res.status(400).json({
          message: "group_id, date, and teacher_id are required",
        });
      }

      // Get group to check schedule time
      const group = await Group.findByPk(group_id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Check if lesson already exists for this group on this date
      const existingLesson = await Lesson.findOne({
        where: {
          group_id,
          date: new Date(date),
        },
      });

      if (existingLesson) {
        return res.status(400).json({
          message: "Lesson already exists for this group on this date",
        });
      }

      // Create lesson WITHOUT start_time and end_time
      const lesson = await Lesson.create({
        group_id,
        date: new Date(date),
        teacher_id,
        room_id: room_id || null,
        topic: topic || "",
        homework: homework || "",
        status: status || "completed",
      });

      // Return with includes
      const createdLesson = await Lesson.findByPk(lesson.id, {
        include: [
          {
            model: Group,
            as: "Group",
            attributes: ["id", "name", "schedule_time", "lesson_duration"],
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
      });

      res.status(201).json(createdLesson);
    } catch (e) {
      console.error("Create lesson error:", e);
      res.status(500).json({
        message: "Create error",
        error: e.message,
      });
    }
  },

  // All lessons - TO'G'RILANGAN
  async all(req, res) {
    try {
      const { group_id, teacher_id, date, status, start_date, end_date } =
        req.query;

      const whereClause = {};

      if (group_id) whereClause.group_id = group_id;
      if (teacher_id) whereClause.teacher_id = teacher_id;
      if (date) {
        const searchDate = new Date(date);
        searchDate.setHours(0, 0, 0, 0);
        whereClause.date = searchDate;
      }
      if (status) whereClause.status = status;

      // Date range filter
      if (start_date && end_date) {
        const start = new Date(start_date);
        const end = new Date(end_date);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        whereClause.date = {
          [Op.between]: [start, end],
        };
      } else if (start_date) {
        const start = new Date(start_date);
        start.setHours(0, 0, 0, 0);
        whereClause.date = { [Op.gte]: start };
      } else if (end_date) {
        const end = new Date(end_date);
        end.setHours(23, 59, 59, 999);
        whereClause.date = { [Op.lte]: end };
      }

      const lessons = await Lesson.findAll({
        where: whereClause,
        include: [
          {
            model: Group,
            as: "Group",
            attributes: [
              "id",
              "name",
              "schedule_time",
              "lesson_duration",
              "schedule_days",
            ],
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
        order: [["date", "DESC"]],
      });

      res.json(lessons);
    } catch (e) {
      console.error("Get all lessons error:", e);
      res.status(500).json({
        message: "Error fetching lessons",
        error: e.message,
      });
    }
  },

  // Get by ID - TO'G'RILANGAN
  async getById(req, res) {
    try {
      const lesson = await Lesson.findByPk(req.params.id, {
        include: [
          {
            model: Group,
            as: "Group",
            attributes: ["id", "name", "schedule_time", "lesson_duration"],
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
      });

      if (!lesson) return res.status(404).json({ message: "Lesson not found" });
      res.json(lesson);
    } catch (e) {
      console.error("Get lesson by ID error:", e);
      res.status(500).json({
        message: "Error fetching lesson",
        error: e.message,
      });
    }
  },

  // Lessons by group - TO'G'RILANGAN
  async byGroup(req, res) {
    try {
      const group_id = req.params.group_id;
      const { date, status } = req.query;

      const whereClause = { group_id };

      if (date) {
        const searchDate = new Date(date);
        searchDate.setHours(0, 0, 0, 0);
        whereClause.date = searchDate;
      }

      if (status) whereClause.status = status;

      const lessons = await Lesson.findAll({
        where: whereClause,
        include: [
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
          {
            model: Group,
            as: "Group",
            attributes: ["id", "name", "start_date", "end_date"],
          },
        ],
        order: [["date", "ASC"]],
      });

      res.json(lessons);
    } catch (e) {
      console.error("Get lessons by group error:", e);
      res.status(500).json({
        message: "Error fetching group lessons",
        error: e.message,
      });
    }
  },

  // Lessons by teacher - TO'G'RILANGAN
  async byTeacher(req, res) {
    try {
      const teacher_id = req.params.teacher_id;
      const { date, status } = req.query;

      const whereClause = { teacher_id };

      if (date) {
        const searchDate = new Date(date);
        searchDate.setHours(0, 0, 0, 0);
        whereClause.date = searchDate;
      }

      if (status) whereClause.status = status;

      const lessons = await Lesson.findAll({
        where: whereClause,
        include: [
          {
            model: Group,
            as: "Group",
            attributes: ["id", "name", "schedule_time", "lesson_duration"],
          },
          {
            model: Room,
            as: "Room",
            attributes: ["id", "name"],
          },
        ],
        order: [["date", "ASC"]],
      });

      res.json(lessons);
    } catch (e) {
      console.error("Get lessons by teacher error:", e);
      res.status(500).json({
        message: "Error fetching teacher lessons",
        error: e.message,
      });
    }
  },

  // Update lesson - TO'G'RILANGAN
  async update(req, res) {
    try {
      const lesson = await Lesson.findByPk(req.params.id);
      if (!lesson) return res.status(404).json({ message: "Lesson not found" });

      // Don't allow updating date if lesson already has specific schedule
      const updateData = { ...req.body };
      if (updateData.date) {
        updateData.date = new Date(updateData.date);
      }

      await lesson.update(updateData);

      // Return updated with includes
      const updatedLesson = await Lesson.findByPk(lesson.id, {
        include: [
          {
            model: Group,
            as: "Group",
            attributes: ["id", "name", "schedule_time", "lesson_duration"],
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
      });

      res.json(updatedLesson);
    } catch (e) {
      console.error("Update lesson error:", e);
      res.status(500).json({
        message: "Error updating lesson",
        error: e.message,
      });
    }
  },

  // Delete lesson - TO'G'RILANGAN
  async remove(req, res) {
    try {
      const lesson = await Lesson.findByPk(req.params.id);
      if (!lesson) return res.status(404).json({ message: "Lesson not found" });

      await lesson.destroy();
      res.json({ message: "Lesson deleted" });
    } catch (e) {
      console.error("Delete lesson error:", e);
      res.status(500).json({
        message: "Error deleting lesson",
        error: e.message,
      });
    }
  },

  async generateLessons(req, res) {
    let transaction;
    try {
      const {
        group_id,
        start_date,
        end_date,
        exclude_dates = [],
        skip_conflicts = true,
        max_lessons = null,
        check_group_conflict = true,
      } = req.body;

      console.log("Request data:", {
        group_id,
        start_date,
        end_date,
        exclude_dates_count: exclude_dates.length,
        skip_conflicts,
        max_lessons,
        check_group_conflict,
      });

      // Validation
      if (!group_id || !start_date || !end_date) {
        return res.status(400).json({
          message: "group_id, start_date, and end_date are required",
        });
      }

      // Guruhni topish
      const group = await sequelize.models.Group.findByPk(group_id, {
        include: [
          {
            model: sequelize.models.Teacher,
            as: "Teacher",
            attributes: ["id", "full_name"],
          },
          {
            model: sequelize.models.Room,
            as: "Room",
            attributes: ["id", "name"],
          },
        ],
      });

      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Guruhning sozlamalarini tekshirish
      const missingSettings = [];
      if (!group.schedule_days || group.schedule_days.length === 0) {
        missingSettings.push("schedule_days");
      }
      if (!group.schedule_time) {
        missingSettings.push("schedule_time");
      }
      if (!group.lesson_duration) {
        missingSettings.push("lesson_duration");
      }
      if (!group.teacher_id) {
        missingSettings.push("teacher_id");
      }

      if (missingSettings.length > 0) {
        return res.status(400).json({
          message: "Group has missing settings",
          missing_settings: missingSettings,
          suggestion:
            "Please configure group settings before generating lessons",
        });
      }

      // Sanalarni hisoblash
      console.log("\n📅 Calculating lesson dates...");
      const allDates = calculateLessonDates({
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        schedule_days: group.schedule_days,
        exclude_dates: exclude_dates.map((d) => new Date(d)),
        max_lessons: max_lessons,
      });

      if (allDates.length === 0) {
        return res.json({
          success: false,
          message: "No valid dates found in the selected range",
          suggestions: [
            "Check if schedule_days are set correctly",
            "The date range might be too short",
            "All dates might be excluded",
          ],
        });
      }

      // Conflictlarni tekshirish
      console.log("\n🔍 Checking conflicts...");
      const conflictConfig = {
        dates: allDates,
        schedule_time: group.schedule_time,
        duration_minutes: group.lesson_duration,
        teacher_id: group.teacher_id,
        room_id: group.room_id,
        group_id: group.id,
        check_group_conflict: check_group_conflict,
      };

      const conflicts = await checkConflicts(conflictConfig);

      // Agar conflictlarni o'tkazib yubormasak va conflictlar bo'lsa
      if (!skip_conflicts && conflicts.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Conflicts found",
          total_dates: allDates.length,
          conflict_count: conflicts.length,
          conflicts_by_type: {
            group: conflicts.filter((c) => c.type === "group").length,
            teacher: conflicts.filter((c) => c.type === "teacher").length,
            room: conflicts.filter((c) => c.type === "room").length,
          },
          conflicts: conflicts.map((c) => ({
            date: c.date,
            type: c.type,
            message: c.message,
            existing_lesson: c.existing_lesson,
          })),
          suggestion: "Enable 'skip_conflicts' or adjust schedule",
        });
      }

      // Agar conflictlarni o'tkazib yuborsak, conflictli sanalarni olib tashlaymiz
      let datesToCreate = allDates;
      if (skip_conflicts && conflicts.length > 0) {
        const conflictDateStrs = conflicts.map((c) => c.date);
        datesToCreate = allDates.filter(
          (date) => !conflictDateStrs.includes(date.toISOString().split("T")[0])
        );
        console.log(`\n⏭️ Skipping ${conflicts.length} conflicts`);
        console.log(`Remaining dates to create: ${datesToCreate.length}`);
      }

      if (datesToCreate.length === 0) {
        return res.json({
          success: false,
          message: "No lessons generated",
          reason:
            conflicts.length > 0
              ? "All dates have conflicts"
              : "No valid dates",
          total_dates: allDates.length,
          conflicts: conflicts.length,
          suggestions: [
            "Try a different date range",
            "Adjust group schedule time",
            "Change teacher or room assignment",
          ],
        });
      }

      // Darslarni yaratish - TRANSACTION BOSHLANISHI
      console.log("\n💾 Creating lessons...");
      transaction = await sequelize.transaction();

      const createdLessons = [];
      for (let i = 0; i < datesToCreate.length; i++) {
        const date = datesToCreate[i];
        const dateStr = date.toISOString().split("T")[0];

        console.log(
          `Creating lesson ${i + 1}/${datesToCreate.length} for ${dateStr}`
        );

        const lesson = await sequelize.models.Lesson.create(
          {
            group_id: group.id,
            teacher_id: group.teacher_id,
            room_id: group.room_id,
            date: date, // DATEONLY field - faqat sana
            topic: `${group.name} - Lesson ${i + 1}`,
            status: "planned", // "completed" emas, "planned" bo'lishi kerak
            homework: "",
          },
          { transaction }
        );

        createdLessons.push(lesson);
      }

      // Transaction commit qilish
      await transaction.commit();
      transaction = null;

      console.log(`\n✅ Successfully created ${createdLessons.length} lessons`);

      // Response
      res.json({
        success: true,
        message: `${createdLessons.length} lessons generated successfully`,
        statistics: {
          total_possible_dates: allDates.length,
          generated: createdLessons.length,
          skipped_due_to_conflicts: conflicts.length,
          skipped_due_to_exclusions: exclude_dates.length,
          success_rate: `${Math.round(
            (createdLessons.length / allDates.length) * 100
          )}%`,
        },
        group_info: {
          id: group.id,
          name: group.name,
          teacher: {
            id: group.Teacher?.id,
            name: group.Teacher?.full_name || "Not assigned",
          },
          room: {
            id: group.Room?.id,
            name: group.Room?.name || "Not assigned",
          },
          schedule: {
            days: Array.isArray(group.schedule_days)
              ? group.schedule_days.join(", ")
              : String(group.schedule_days || "Not set"),
            time: group.schedule_time
              ? group.schedule_time.substring(0, 5)
              : "Not set",
            duration: `${group.lesson_duration || 0} minutes`,
          },
        },
        date_range: {
          start: start_date,
          end: end_date,
          total_days:
            Math.ceil(
              (new Date(end_date) - new Date(start_date)) /
                (1000 * 60 * 60 * 24)
            ) + 1,
        },
        lessons: createdLessons.map((lesson, index) => {
          // Date'ni xavfsiz o'qish va formatlash
          let lessonDate;

          if (lesson.date instanceof Date) {
            lessonDate = lesson.date;
          } else if (typeof lesson.date === "string") {
            lessonDate = new Date(lesson.date);
          } else if (lesson.date && typeof lesson.date.getDate === "function") {
            lessonDate = lesson.date;
          } else if (lesson.dataValues && lesson.dataValues.date) {
            const dateValue = lesson.dataValues.date;
            if (dateValue instanceof Date) {
              lessonDate = dateValue;
            } else if (typeof dateValue === "string") {
              lessonDate = new Date(dateValue);
            }
          } else {
            console.warn(`Lesson ${lesson.id} has invalid date:`, lesson.date);
            lessonDate = new Date();
          }

          // Date'ni formatlash
          let formattedDate;
          let dayName;

          try {
            formattedDate = lessonDate.toISOString().split("T")[0];
            dayName = lessonDate.toLocaleDateString("en-US", {
              weekday: "long",
            });
          } catch (dateError) {
            console.error(
              `Error formatting date for lesson ${lesson.id}:`,
              dateError
            );
            formattedDate = "Invalid date";
            dayName = "Unknown";
          }

          return {
            id: lesson.id,
            date: formattedDate,
            day: dayName,
            lesson_number: index + 1,
            status: lesson.status,
          };
        }),
        conflicts_skipped: conflicts.map((c) => ({
          date: c.date,
          type: c.type,
          message: c.message,
        })),
        generated_at: new Date().toISOString(),
      });

      console.log("\n🎉 ========== GENERATE LESSONS COMPLETED ========== 🎉");
    } catch (error) {
      console.error("\n❌ ========== GENERATE LESSONS ERROR ========== ❌");
      console.error("Error:", error.message);
      console.error("Stack:", error.stack);

      // Faqat transaction bo'lsa rollback qilish
      if (transaction && !transaction.finished) {
        try {
          console.log("Rolling back transaction...");
          await transaction.rollback();
          console.log("Transaction rolled back successfully");
        } catch (rollbackError) {
          console.error("Transaction rollback error:", rollbackError);
        }
      }

      res.status(500).json({
        success: false,
        message: "Error generating lessons",
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  },

  async bulkGenerate(req, res) {
    try {
      const {
        groups,
        start_date,
        end_date,
        exclude_dates = [],
        skip_conflicts = true,
      } = req.body;

      if (!groups || !Array.isArray(groups) || groups.length === 0) {
        return res.status(400).json({
          message: "Groups array is required",
        });
      }

      if (!start_date || !end_date) {
        return res.status(400).json({
          message: "start_date and end_date are required",
        });
      }

      const results = [];
      const errors = [];

      for (const groupId of groups) {
        try {
          const group = await Group.findByPk(groupId, {
            include: [
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
          });

          if (!group) {
            errors.push({
              group_id: groupId,
              error: "Group not found",
            });
            continue;
          }

          // Check if group has schedule
          if (!group.schedule_days || group.schedule_days.length === 0) {
            errors.push({
              group_id: groupId,
              group_name: group.name,
              error: "Group doesn't have schedule days",
            });
            continue;
          }

          if (!group.schedule_time) {
            errors.push({
              group_id: groupId,
              group_name: group.name,
              error: "Group doesn't have schedule time",
            });
            continue;
          }

          if (!group.teacher_id) {
            errors.push({
              group_id: groupId,
              group_name: group.name,
              error: "Group doesn't have assigned teacher",
            });
            continue;
          }

          // Calculate lesson dates
          const allDates = calculateLessonDates({
            start_date: new Date(start_date),
            end_date: new Date(end_date),
            schedule_days: group.schedule_days || [],
            exclude_dates: exclude_dates.map((d) => new Date(d)),
          });

          if (allDates.length === 0) {
            results.push({
              group_id: groupId,
              group_name: group.name,
              success: false,
              count: 0,
              message: "No valid dates found",
            });
            continue;
          }

          // Check conflicts
          const conflicts = await checkConflicts({
            dates: allDates,
            schedule_time: group.schedule_time,
            duration_minutes: group.lesson_duration,
            teacher_id: group.teacher_id,
            room_id: group.room_id,
            group_id: group.id,
          });

          // Filter out conflicts if skipping
          let datesToCreate = allDates;
          if (skip_conflicts && conflicts.length > 0) {
            const conflictDateStrs = conflicts.map((c) => c.date);
            datesToCreate = allDates.filter(
              (date) =>
                !conflictDateStrs.includes(date.toISOString().split("T")[0])
            );
          }

          if (datesToCreate.length === 0) {
            results.push({
              group_id: groupId,
              group_name: group.name,
              success: false,
              count: 0,
              message: "No lessons generated due to conflicts",
              conflicts: conflicts.length,
            });
            continue;
          }

          // Create lessons WITHOUT start_time and end_time
          const lessons = datesToCreate.map((date, index) => ({
            group_id: group.id,
            teacher_id: group.teacher_id,
            room_id: group.room_id,
            date: date,
            topic: `${group.name} - Lesson ${index + 1}`,
            status: "scheduled",
            homework: "",
          }));

          const createdLessons = await Lesson.bulkCreate(lessons);

          results.push({
            group_id: groupId,
            group_name: group.name,
            success: true,
            count: createdLessons.length,
            conflicts_skipped: conflicts.length,
            teacher: group.Teacher?.full_name || "Not assigned",
            room: group.Room?.name || "Not assigned",
            lessons: createdLessons.map((l) => ({
              id: l.id,
              date: l.date.toISOString().split("T")[0],
            })),
          });
        } catch (error) {
          errors.push({
            group_id: groupId,
            error: error.message,
          });
        }
      }

      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      res.json({
        summary: {
          total_groups: groups.length,
          successful: successful.length,
          failed: failed.length,
          errors: errors.length,
          total_lessons_generated: successful.reduce(
            (sum, r) => sum + r.count,
            0
          ),
          total_conflicts_skipped: successful.reduce(
            (sum, r) => sum + (r.conflicts_skipped || 0),
            0
          ),
        },
        results: successful,
        failed_groups: failed,
        errors: errors,
        date_range: {
          start: start_date,
          end: end_date,
        },
      });
    } catch (error) {
      console.error("Bulk generate error:", error);
      res.status(500).json({
        message: "Error in bulk generation",
        error: error.message,
      });
    }
  },

  // Get available dates for a group - YANGILANGAN
  async getAvailableDates(req, res) {
    try {
      const { group_id, start_date, end_date } = req.params;

      const group = await Group.findByPk(group_id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      if (!group.schedule_days || group.schedule_days.length === 0) {
        return res.json({
          group_id,
          start_date,
          end_date,
          dates: [],
          message: "Group has no schedule days configured",
        });
      }

      // Calculate all possible dates based on schedule
      const allDates = calculateLessonDates({
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        schedule_days: group.schedule_days || [],
        exclude_dates: [],
      });

      // Check which dates are already occupied
      const occupiedLessons = await Lesson.findAll({
        where: {
          group_id,
          date: {
            [Op.in]: allDates,
          },
        },
        attributes: ["id", "date", "status"],
      });

      const occupiedDateStrings = occupiedLessons.map(
        (d) => d.date.toISOString().split("T")[0]
      );

      // Check for conflicts
      const conflicts = await checkConflicts({
        dates: allDates,
        schedule_time: group.schedule_time,
        duration_minutes: group.lesson_duration,
        teacher_id: group.teacher_id,
        room_id: group.room_id,
        group_id: group.id,
      });

      const conflictDateStrings = conflicts.map((c) => c.date);

      // Prepare response
      const availableDates = allDates.map((date) => {
        const dateStr = date.toISOString().split("T")[0];
        const isOccupied = occupiedDateStrings.includes(dateStr);
        const hasConflict = conflictDateStrings.includes(dateStr);

        return {
          date: dateStr,
          day: date.toLocaleDateString("en-US", { weekday: "long" }),
          available: !isOccupied && !hasConflict,
          status: isOccupied
            ? "occupied"
            : hasConflict
            ? "conflict"
            : "available",
          details: {
            occupied: isOccupied,
            conflict: hasConflict,
            lesson: isOccupied
              ? occupiedLessons.find(
                  (l) => l.date.toISOString().split("T")[0] === dateStr
                )
              : null,
            conflict_info: hasConflict
              ? conflicts.find((c) => c.date === dateStr)
              : null,
          },
        };
      });

      res.json({
        group_id,
        group_name: group.name,
        start_date,
        end_date,
        statistics: {
          total_dates: allDates.length,
          available: availableDates.filter((d) => d.available).length,
          occupied: availableDates.filter((d) => d.status === "occupied")
            .length,
          conflicts: availableDates.filter((d) => d.status === "conflict")
            .length,
        },
        schedule_info: {
          days: group.schedule_days,
          time: group.schedule_time?.substring(0, 5) || "Not set",
          duration: group.lesson_duration || "Not set",
        },
        dates: availableDates,
        occupied_lessons: occupiedLessons.map((l) => ({
          id: l.id,
          date: l.date.toISOString().split("T")[0],
          status: l.status,
        })),
        conflicts: conflicts,
      });
    } catch (error) {
      console.error("Get available dates error:", error);
      res.status(500).json({
        message: "Error getting available dates",
        error: error.message,
      });
    }
  },

  // Preview lesson schedule without creating - YANGI FUNKSIYA
  async previewSchedule(req, res) {
    try {
      const { group_id, start_date, end_date, exclude_dates = [] } = req.body;

      if (!group_id || !start_date || !end_date) {
        return res.status(400).json({
          message: "group_id, start_date, and end_date are required",
        });
      }

      const group = await Group.findByPk(group_id, {
        include: [
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
      });

      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Check group configuration
      if (!group.schedule_days || group.schedule_days.length === 0) {
        return res.status(400).json({
          message: "Group doesn't have schedule days configured",
          suggestion: "Please configure schedule days first",
        });
      }

      if (!group.schedule_time) {
        return res.status(400).json({
          message: "Group doesn't have schedule time configured",
          suggestion: "Please configure schedule time first",
        });
      }

      if (!group.lesson_duration) {
        return res.status(400).json({
          message: "Group doesn't have lesson duration configured",
          suggestion: "Please configure lesson duration first",
        });
      }

      // Calculate dates
      const allDates = calculateLessonDates({
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        schedule_days: group.schedule_days,
        exclude_dates: exclude_dates.map((d) => new Date(d)),
      });

      // Check conflicts
      const conflicts = await checkConflicts({
        dates: allDates,
        schedule_time: group.schedule_time,
        duration_minutes: group.lesson_duration,
        teacher_id: group.teacher_id,
        room_id: group.room_id,
        group_id: group.id,
      });

      // Check existing lessons
      const existingLessons = await Lesson.findAll({
        where: {
          group_id,
          date: {
            [Op.in]: allDates,
          },
        },
        attributes: ["id", "date", "status", "topic"],
      });

      // Prepare schedule
      const schedule = allDates.map((date, index) => {
        const dateStr = date.toISOString().split("T")[0];
        const existingLesson = existingLessons.find(
          (l) => l.date.toISOString().split("T")[0] === dateStr
        );
        const conflict = conflicts.find((c) => c.date === dateStr);

        // Calculate start and end times
        const startTime = combineDateTime(date, group.schedule_time);
        const endTime = addDuration(startTime, group.lesson_duration);

        return {
          lesson_number: index + 1,
          date: dateStr,
          day: date.toLocaleDateString("en-US", { weekday: "long" }),
          time_range: {
            start: startTime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            end: endTime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            duration: group.lesson_duration,
          },
          status: existingLesson
            ? "existing"
            : conflict
            ? "conflict"
            : "available",
          details: {
            teacher: group.Teacher?.full_name || "Not assigned",
            teacher_id: group.teacher_id,
            room: group.Room?.name || "Not assigned",
            room_id: group.room_id,
            topic:
              existingLesson?.topic || `${group.name} - Lesson ${index + 1}`,
          },
          existing_lesson: existingLesson
            ? {
                id: existingLesson.id,
                status: existingLesson.status,
                topic: existingLesson.topic,
              }
            : null,
          conflict: conflict
            ? {
                type: conflict.type,
                message: conflict.message,
                existing_lesson: conflict.existing_lesson,
              }
            : null,
        };
      });

      // Group by status
      const byStatus = {
        available: schedule.filter((s) => s.status === "available"),
        existing: schedule.filter((s) => s.status === "existing"),
        conflict: schedule.filter((s) => s.status === "conflict"),
      };

      res.json({
        preview: true,
        group: {
          id: group.id,
          name: group.name,
          schedule_days: group.schedule_days,
          schedule_time: group.schedule_time.substring(0, 5),
          lesson_duration: group.lesson_duration,
          teacher: group.Teacher?.full_name || "Not assigned",
          room: group.Room?.name || "Not assigned",
        },
        date_range: {
          start: start_date,
          end: end_date,
          total_days:
            Math.ceil(
              (new Date(end_date) - new Date(start_date)) /
                (1000 * 60 * 60 * 24)
            ) + 1,
        },
        summary: {
          total_dates: allDates.length,
          available: byStatus.available.length,
          existing: byStatus.existing.length,
          conflicts: byStatus.conflict.length,
          excluded: exclude_dates.length,
        },
        schedule: schedule,
        statistics_by_status: byStatus,
        conflicts_summary: conflicts.reduce((acc, conflict) => {
          acc[conflict.type] = (acc[conflict.type] || 0) + 1;
          return acc;
        }, {}),
        generated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Preview schedule error:", error);
      res.status(500).json({
        message: "Error previewing schedule",
        error: error.message,
      });
    }
  },

  // Clear lessons for a group in date range - YANGI FUNKSIYA
  async clearLessons(req, res) {
    try {
      const { group_id, start_date, end_date } = req.body;

      if (!group_id || !start_date || !end_date) {
        return res.status(400).json({
          message: "group_id, start_date, and end_date are required",
        });
      }

      const group = await Group.findByPk(group_id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Date range
      const start = new Date(start_date);
      const end = new Date(end_date);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // Find and delete lessons
      const deletedLessons = await Lesson.destroy({
        where: {
          group_id,
          date: {
            [Op.between]: [start, end],
          },
        },
      });

      res.json({
        message: `${deletedLessons} lessons deleted successfully`,
        group_id,
        date_range: {
          start: start_date,
          end: end_date,
        },
        deleted_count: deletedLessons,
      });
    } catch (error) {
      console.error("Clear lessons error:", error);
      res.status(500).json({
        message: "Error clearing lessons",
        error: error.message,
      });
    }
  },
};
