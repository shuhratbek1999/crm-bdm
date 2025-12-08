// utils/studentConflict.js
const checkStudentConflicts = async (studentId, startDate, endDate) => {
  console.log(`\n👨‍🎓 Checking conflicts for student ${studentId}`);

  // 1. Studentning barcha guruhlarini olish
  const student = await sequelize.models.Student.findByPk(studentId, {
    include: [
      {
        model: sequelize.models.Group,
        as: "Group",
        attributes: [
          "id",
          "name",
          "schedule_time",
          "lesson_duration",
          "schedule_days",
        ],
        include: [
          {
            model: sequelize.models.Lesson,
            as: "Lessons",
            where: {
              date: {
                [Op.between]: [startDate, endDate],
              },
            },
            attributes: ["id", "date", "status"],
            required: false,
          },
        ],
      },
    ],
  });

  if (!student || !student.Group || student.Group.length === 0) {
    return [];
  }

  console.log(
    `Student "${student.full_name}" is in ${student.Group.length} groups`
  );

  // 2. Barcha darslarni yig'ish
  const allLessons = [];
  student.Group.forEach((group) => {
    if (group.Lessons && group.Lessons.length > 0) {
      group.Lessons.forEach((lesson) => {
        allLessons.push({
          lesson_id: lesson.id,
          group_id: group.id,
          group_name: group.name,
          date: lesson.date,
          schedule_time: group.schedule_time,
          lesson_duration: group.lesson_duration,
          status: lesson.status,
        });
      });
    }
  });

  // 3. Darslarni sana bo'yicha guruhlash
  const lessonsByDate = {};
  allLessons.forEach((lesson) => {
    const dateStr = new Date(lesson.date).toISOString().split("T")[0];
    if (!lessonsByDate[dateStr]) {
      lessonsByDate[dateStr] = [];
    }
    lessonsByDate[dateStr].push(lesson);
  });

  // 4. Konfliktlarni aniqlash
  const conflicts = [];

  Object.keys(lessonsByDate).forEach((dateStr) => {
    const lessons = lessonsByDate[dateStr];

    if (lessons.length > 1) {
      // Vaqt bo'yicha konfliktlarni tekshirish
      for (let i = 0; i < lessons.length; i++) {
        for (let j = i + 1; j < lessons.length; j++) {
          const lesson1 = lessons[i];
          const lesson2 = lessons[j];

          // Vaqtni hisoblash
          const timeToMinutes = (timeStr) => {
            const [hours, minutes] = (timeStr || "09:00:00")
              .split(":")
              .map(Number);
            return hours * 60 + minutes;
          };

          const start1 = timeToMinutes(lesson1.schedule_time);
          const end1 = start1 + (lesson1.lesson_duration || 90);

          const start2 = timeToMinutes(lesson2.schedule_time);
          const end2 = start2 + (lesson2.lesson_duration || 90);

          // Vaqtlar ustma-ust tushadimi?
          const hasTimeConflict = !(end1 <= start2 || end2 <= start1);

          if (hasTimeConflict) {
            conflicts.push({
              student_id: studentId,
              student_name: student.full_name,
              date: dateStr,
              type: "student_schedule",
              message: `Student has overlapping lessons on ${dateStr}`,
              severity: "high",
              lessons: [
                {
                  group: lesson1.group_name,
                  time: `${lesson1.schedule_time.substring(0, 5)} (${
                    lesson1.lesson_duration
                  }min)`,
                },
                {
                  group: lesson2.group_name,
                  time: `${lesson2.schedule_time.substring(0, 5)} (${
                    lesson2.lesson_duration
                  }min)`,
                },
              ],
              conflict_time: `${Math.max(start1, start2)}-${Math.min(
                end1,
                end2
              )}`,
            });
          }
        }
      }
    }
  });

  console.log(`Found ${conflicts.length} schedule conflicts for student`);
  return conflicts;
};
