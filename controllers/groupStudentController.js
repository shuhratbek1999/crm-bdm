const { GroupStudent, Student, Group, Course, Teacher } = require("../models");
const { Op } = require("sequelize");

async function checkBulkConflictsForAssign(group_id, student_ids, group) {
  const conflicts = [];

  const newGroupTime = parseTimeToMinutes(group.schedule_time);
  const newGroupDuration = group.lesson_duration || 90;
  const newGroupEnd = newGroupTime + newGroupDuration;
  const newGroupDays = group.schedule_days || [];

  for (const student_id of student_ids) {
    const student = await Student.findByPk(student_id);
    if (!student) continue;

    const studentGroups = await GroupStudent.findAll({
      where: {
        student_id,
        status: "active",
        group_id: { [Op.ne]: group_id },
      },
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
      ],
    });

    for (const studentGroup of studentGroups) {
      const existingGroup = studentGroup.Group;

      if (
        !existingGroup ||
        !existingGroup.schedule_days ||
        !existingGroup.schedule_time
      ) {
        continue;
      }

      const existingDays = existingGroup.schedule_days || [];
      const commonDays = newGroupDays.filter((day) =>
        existingDays.includes(day)
      );

      if (commonDays.length > 0) {
        const existingTime = parseTimeToMinutes(existingGroup.schedule_time);
        const existingDuration = existingGroup.lesson_duration || 90;
        const existingEnd = existingTime + existingDuration;

        const hasConflict = !(
          newGroupEnd <= existingTime || existingEnd <= newGroupTime
        );

        if (hasConflict) {
          conflicts.push({
            student: {
              id: student.id,
              name: student.full_name,
            },
            conflicting_group: {
              id: existingGroup.id,
              name: existingGroup.name,
              schedule: {
                days: existingDays,
                time: existingGroup.schedule_time,
                duration: existingDuration,
              },
            },
            overlap: {
              days: commonDays,
              minutes:
                Math.min(newGroupEnd, existingEnd) -
                Math.max(newGroupTime, existingTime),
            },
          });
          break; // Bir konflikt topilsa, qolganlarini tekshirish shart emas
        }
      }
    }
  }

  return { conflicts };
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 540; // Default 9:00

  const parts = timeStr.split(":");
  const hours = parseInt(parts[0]) || 9;
  const minutes = parseInt(parts[1]) || 0;

  return hours * 60 + minutes;
}
module.exports = {
  // Studentni guruhga qo'shish
  async assign(req, res) {
    try {
      console.log("salomm");

      const { student_id, group_id, join_date, status } = req.body;

      // Validate required fields
      if (!student_id || !group_id) {
        return res
          .status(400)
          .json({ message: "Student ID and Group ID are required" });
      }

      // Check if student exists
      const student = await Student.findByPk(student_id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Check if group exists
      const group = await Group.findByPk(group_id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Check if already assigned
      const existing = await GroupStudent.findOne({
        where: { student_id, group_id },
      });

      if (existing) {
        return res.status(400).json({
          message: "Student is already assigned to this group",
          data: existing,
        });
      }

      // Check group capacity
      const currentStudentsCount = await GroupStudent.count({
        where: { group_id, status: "active" },
      });

      if (currentStudentsCount >= group.max_students) {
        return res.status(400).json({
          message: "Group has reached maximum capacity",
          max_students: group.max_students,
          current_students: currentStudentsCount,
        });
      }

      // Create assignment
      const groupStudent = await GroupStudent.create({
        student_id,
        group_id,
        join_date: join_date || new Date(),
        status: status || "active",
      });

      // Update group's current students count
      await Group.update(
        { current_students: currentStudentsCount + 1 },
        { where: { id: group_id } }
      );

      // Return with includes
      const created = await GroupStudent.findByPk(groupStudent.id, {
        include: [
          {
            model: Student,
            as: "student",
          },
          {
            model: Group,
            as: "Group",
            include: [
              {
                model: Course,
                as: "Course",
                attributes: ["id", "name"],
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

      res.status(201).json({
        message: "Student successfully assigned to group",
        data: created,
      });
    } catch (e) {
      console.error("Assign error:", e);
      res.status(500).json({ message: "Failed to assign student to group" });
    }
  },
  async getByGroup(req, res) {
    try {
      const group_id = req.params.group_id;
      const { status } = req.query;
      console.log(req.params.group_id);

      const where = { group_id };
      if (status) {
        where.status = status;
      }

      const groupStudents = await GroupStudent.findAll({
        where,
        include: [
          {
            model: Student,
            as: "student",
          },
        ],
        order: [["created_at", "DESC"]],
      });

      res.json({
        group_id,
        total_students: groupStudents.length,
        students: groupStudents,
      });
    } catch (e) {
      console.error("Get by group error:", e);
      res.status(500).json({ message: "Failed to fetch group students" });
    }
  },
  async getByStudent(req, res) {
    try {
      const student_id = req.params.student_id;
      const { status } = req.query;

      const where = { student_id };
      if (status) {
        where.status = status;
      }

      const studentGroups = await GroupStudent.findAll({
        where,
        include: [
          {
            model: Group,
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
            ],
            attributes: ["id", "name", "status", "start_date", "end_date"],
          },
        ],
        order: [["join_date", "DESC"]],
      });

      res.json({
        student_id,
        total_groups: studentGroups.length,
        groups: studentGroups,
      });
    } catch (e) {
      console.error("Get by student error:", e);
      res.status(500).json({ message: "Failed to fetch student groups" });
    }
  },
  async getAll(req, res) {
    try {
      const model = await GroupStudent.findAll({
        include: [
          {
            model: Group,
            as: "Group",
            attributes: ["id", "name"],
            include: [
              { model: Course, as: "Course", attributes: ["id", "name"] },
            ],
          },
          {
            model: Student,
            as: "student",
            attributes: ["id", "full_name", "phone"],
          },
        ],
      });
      res.json({ data: model });
    } catch (err) {
      console.error("Get by student error:", err);
      res.status(500).json({ message: "Failed to fetch student groups" });
    }
  },
  async remove(req, res) {
    try {
      const { student_id, group_id } = req.body;

      if (!student_id || !group_id) {
        return res
          .status(400)
          .json({ message: "Student ID and Group ID are required" });
      }

      const groupStudent = await GroupStudent.findOne({
        where: { student_id, group_id },
      });

      if (!groupStudent) {
        return res
          .status(404)
          .json({ message: "Student is not assigned to this group" });
      }

      // Get current students count before deletion
      const currentStudentsCount = await GroupStudent.count({
        where: { group_id, status: "active" },
      });

      await groupStudent.destroy();

      // Update group's current students count
      await Group.update(
        { current_students: Math.max(0, currentStudentsCount - 1) },
        { where: { id: group_id } }
      );

      res.json({
        message: "Student successfully removed from group",
        removed: groupStudent,
      });
    } catch (e) {
      console.error("Remove error:", e);
      res.status(500).json({ message: "Failed to remove student from group" });
    }
  },

  async updateStatus(req, res) {
    try {
      const { student_id, group_id, status } = req.body;

      if (!student_id || !group_id || !status) {
        return res.status(400).json({
          message: "Student ID, Group ID and Status are required",
        });
      }

      const groupStudent = await GroupStudent.findOne({
        where: { student_id, group_id },
      });

      if (!groupStudent) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      await groupStudent.update({ status });

      res.json({
        message: "Student status updated successfully",
        data: groupStudent,
      });
    } catch (e) {
      console.error("Update status error:", e);
      res.status(500).json({ message: "Failed to update student status" });
    }
  },
  async checkBulkConflicts(req, res) {
    try {
      const { group_id, student_ids, check_only = true } = req.body;

      console.log("🔍 Checking bulk conflicts for:", {
        group_id,
        student_count: student_ids?.length || 0,
        check_only,
      });

      // Validatsiya
      if (!group_id || !student_ids || !Array.isArray(student_ids)) {
        return res.status(400).json({
          success: false,
          message: "Group ID and Student IDs array are required",
        });
      }

      if (student_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Student IDs array cannot be empty",
        });
      }

      // Guruh ma'lumotlarini olish
      const group = await Group.findByPk(group_id, {
        attributes: [
          "id",
          "name",
          "schedule_time",
          "lesson_duration",
          "schedule_days",
        ],
      });

      if (!group) {
        return res.status(404).json({
          success: false,
          message: "Group not found",
        });
      }

      // Guruh vaqtini hisoblash
      const newGroupTime = parseTimeToMinutes(group.schedule_time);
      const newGroupDuration = group.lesson_duration || 90;
      const newGroupEnd = newGroupTime + newGroupDuration;
      const newGroupDays = group.schedule_days || [];

      console.log(
        `Group schedule: ${newGroupDays.join(", ")} at ${
          group.schedule_time
        } (${newGroupDuration} mins)`
      );

      const conflicts = [];
      const validStudents = [];
      const conflictStudentIds = [];

      // Har bir student uchun konflikt tekshirish
      for (const student_id of student_ids) {
        // Student ma'lumotlarini olish
        const student = await Student.findByPk(student_id, {
          attributes: ["id", "full_name"],
        });

        if (!student) {
          console.log(`Student ${student_id} not found, skipping...`);
          continue;
        }

        // Studentning boshqa faol guruhlarini olish
        const studentGroups = await GroupStudent.findAll({
          where: {
            student_id,
            status: "active",
            group_id: { [Op.ne]: group_id },
          },
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
          ],
        });

        if (studentGroups.length === 0) {
          // Konflikt yo'q
          validStudents.push({
            id: student.id,
            name: student.full_name,
            can_be_added: true,
          });
          continue;
        }

        console.log(
          `Student ${student.full_name} has ${studentGroups.length} other groups`
        );

        let hasConflict = false;
        const studentConflictDetails = [];

        // Har bir mavjud guruh bilan solishtirish
        for (const studentGroup of studentGroups) {
          const existingGroup = studentGroup.Group;

          if (
            !existingGroup ||
            !existingGroup.schedule_days ||
            !existingGroup.schedule_time
          ) {
            continue;
          }

          // Kunlarni solishtirish
          const existingDays = existingGroup.schedule_days || [];
          const commonDays = newGroupDays.filter((day) =>
            existingDays.includes(day)
          );

          if (commonDays.length > 0) {
            // Vaqt konfliktini tekshirish
            const existingTime = parseTimeToMinutes(
              existingGroup.schedule_time
            );
            const existingDuration = existingGroup.lesson_duration || 90;
            const existingEnd = existingTime + existingDuration;

            const hasTimeConflict = !(
              newGroupEnd <= existingTime || existingEnd <= newGroupTime
            );

            if (hasTimeConflict) {
              hasConflict = true;

              studentConflictDetails.push({
                existing_group: {
                  id: existingGroup.id,
                  name: existingGroup.name,
                },
                schedule: {
                  days: existingDays,
                  time: existingGroup.schedule_time,
                  duration: existingDuration,
                },
                conflict_days: commonDays,
                overlap_minutes:
                  Math.min(newGroupEnd, existingEnd) -
                  Math.max(newGroupTime, existingTime),
              });
            }
          }
        }

        if (hasConflict) {
          conflictStudentIds.push(student.id);

          conflicts.push({
            student: {
              id: student.id,
              name: student.full_name,
            },
            conflicts: studentConflictDetails,
            cannot_be_added: true,
            reason: "Schedule overlap with existing group(s)",
          });
        } else {
          validStudents.push({
            id: student.id,
            name: student.full_name,
            can_be_added: true,
          });
        }
      }

      // Response tayyorlash
      const response = {
        success: true,
        group: {
          id: group.id,
          name: group.name,
          schedule: {
            days: newGroupDays,
            time: group.schedule_time,
            duration: newGroupDuration,
          },
        },
        statistics: {
          total_students: student_ids.length,
          valid_students: validStudents.length,
          conflicting_students: conflicts.length,
          valid_percentage:
            Math.round((validStudents.length / student_ids.length) * 100) || 0,
        },
        valid_students: validStudents,
        conflicts: conflicts,
      };

      // Agar faqat tekshirish bo'lsa (check_only)
      if (check_only) {
        response.action_required = conflicts.length > 0;
        response.suggestions =
          conflicts.length > 0
            ? [
                `Skip ${conflicts.length} students with conflicts`,
                "Adjust group schedules to avoid conflicts",
                "Manually review each conflict case",
              ]
            : ["All students can be added without conflicts"];
      }

      console.log(
        `Conflict check complete: ${conflicts.length} conflicts found`
      );

      res.json(response);
    } catch (error) {
      console.error("❌ Error in checkBulkConflicts:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check schedule conflicts",
        error: error.message,
      });
    }
  },
  async bulkAssign(req, res) {
    try {
      const {
        group_id,
        student_ids,
        skip_conflicts = true,
        force_add = false,
      } = req.body;

      console.log("🎯 Bulk assign request:", {
        group_id,
        student_count: student_ids?.length || 0,
        skip_conflicts,
        force_add,
      });

      // Validatsiya
      if (!group_id || !student_ids || !Array.isArray(student_ids)) {
        return res.status(400).json({
          success: false,
          message: "Group ID and Student IDs array are required",
        });
      }

      if (student_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Student IDs array cannot be empty",
        });
      }

      // Guruhni tekshirish
      const group = await Group.findByPk(group_id);
      if (!group) {
        return res.status(404).json({
          success: false,
          message: "Group not found",
        });
      }

      // Guruh sig'imini tekshirish
      const currentStudentsCount = await GroupStudent.count({
        where: { group_id, status: "active" },
      });

      if (currentStudentsCount + student_ids.length > group.max_students) {
        return res.status(400).json({
          success: false,
          message: "Group capacity exceeded",
          max_students: group.max_students,
          current_students: currentStudentsCount,
          trying_to_add: student_ids.length,
        });
      }

      // Mavjud assignmentlarni tekshirish
      const existingAssignments = await GroupStudent.findAll({
        where: {
          group_id,
          student_id: { [Op.in]: student_ids },
        },
      });

      if (existingAssignments.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Some students are already assigned to this group",
          existing: existingAssignments.map((a) => a.student_id),
        });
      }

      // KONFLIKT TEKSHIRISH
      let studentsToAdd = student_ids;
      let conflicts = [];

      if (!force_add) {
        // Konflikt tekshirish
        const conflictResult = await checkBulkConflictsForAssign(
          group_id,
          student_ids,
          group
        );

        conflicts = conflictResult.conflicts || [];

        if (conflicts.length > 0) {
          if (skip_conflicts) {
            // Konfliktli studentlarni olib tashlash
            const conflictStudentIds = conflicts.map((c) => c.student.id);
            studentsToAdd = student_ids.filter(
              (id) => !conflictStudentIds.includes(id)
            );

            if (studentsToAdd.length === 0) {
              return res.status(409).json({
                success: false,
                message: "All students have schedule conflicts",
                conflicts: conflicts,
                suggestion: "Disable skip_conflicts or adjust schedules",
              });
            }
          } else {
            // Konflikt bor, lekin skip yo'q
            return res.status(409).json({
              success: false,
              message: "Schedule conflicts detected",
              conflicts: conflicts,
              options: {
                skip_conflicts:
                  "Set skip_conflicts: true to skip conflicting students",
                force_add: "Set force_add: true to add despite conflicts",
              },
            });
          }
        }
      }

      // Studentlarni qo'shish
      const assignments = studentsToAdd.map((student_id) => ({
        group_id,
        student_id,
        join_date: new Date(),
        status: "active",
      }));

      const created = await GroupStudent.bulkCreate(assignments, {
        validate: true,
      });

      // Guruh studentlar sonini yangilash
      await Group.update(
        { current_students: currentStudentsCount + studentsToAdd.length },
        { where: { id: group_id } }
      );

      // Response
      const response = {
        success: true,
        message: `Successfully assigned ${created.length} students to "${group.name}"`,
        statistics: {
          total_requested: student_ids.length,
          successfully_added: created.length,
          skipped_due_to_conflicts: student_ids.length - studentsToAdd.length,
          new_group_total: currentStudentsCount + studentsToAdd.length,
        },
        added_students: studentsToAdd,
      };

      // Agar konfliktlar bo'lsa, ularni ham qo'shamiz
      if (conflicts.length > 0) {
        response.conflicts_info = {
          note: skip_conflicts
            ? `${conflicts.length} students were skipped due to schedule conflicts`
            : `${conflicts.length} conflicts were ignored (force_add mode)`,
          conflict_count: conflicts.length,
        };
      }

      res.status(201).json(response);
    } catch (error) {
      console.error("❌ Bulk assign error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to assign students to group",
        error: error.message,
      });
    }
  },

  // Search students in group
  async searchInGroup(req, res) {
    try {
      const group_id = req.params.group_id;
      const { query } = req.query;

      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }

      const groupStudents = await GroupStudent.findAll({
        where: { group_id },
        include: [
          {
            model: Student,
            as: "student",
            where: {
              [Op.or]: [
                { full_name: { [Op.like]: `%${query}%` } },
                { phone: { [Op.like]: `%${query}%` } },
                { email: { [Op.like]: `%${query}%` } },
              ],
            },
            attributes: ["id", "full_name", "phone", "email"],
          },
        ],
      });

      res.json({
        group_id,
        search_query: query,
        total_results: groupStudents.length,
        students: groupStudents,
      });
    } catch (e) {
      console.error("Search error:", e);
      res.status(500).json({ message: "Failed to search students" });
    }
  },
};
