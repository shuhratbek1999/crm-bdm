// models/group.js
"use strict";
const { Model, Op } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Group extends Model {
    static associate(models) {
      // Course bilan bog'lash
      Group.belongsTo(models.Course, {
        foreignKey: "course_id",
        as: "Course",
      });

      // Teacher bilan bog'lash
      Group.belongsTo(models.Teacher, {
        foreignKey: "teacher_id",
        as: "Teacher",
      });

      // Room bilan bog'lash
      Group.belongsTo(models.Room, {
        foreignKey: "room_id",
        as: "Room",
      });

      // Students bilan bog'lash (through GroupStudent)
      Group.belongsToMany(models.Student, {
        through: models.GroupStudent,
        foreignKey: "group_id",
        otherKey: "student_id",
        as: "Student",
      });

      // Lessons bilan bog'lash
      Group.hasMany(models.Lesson, {
        foreignKey: "group_id",
        as: "Lessons",
      });

      // Payments bilan bog'lash
      Group.hasMany(models.Payment, {
        foreignKey: "group_id",
        as: "Payments",
      });
    }

    /**
     * Instance method: Get schedule info
     */
    getScheduleInfo() {
      const scheduleDays = this.schedule_days || [
        "monday",
        "wednesday",
        "friday",
      ];
      const scheduleTime = this.schedule_time || "09:00:00";
      const lessonDuration = this.lesson_duration || 90;

      return {
        days: scheduleDays,
        time: scheduleTime,
        duration: lessonDuration,
        durationHours: (lessonDuration / 60).toFixed(1) + " hours",
      };
    }

    /**
     * Instance method: Check if group is active
     */
    isActive() {
      const now = new Date();
      const startDate = new Date(this.start_date);
      const endDate = new Date(this.end_date);

      return this.status === "active" && now >= startDate && now <= endDate;
    }

    /**
     * Instance method: Get available seats
     */
    getAvailableSeats() {
      return Math.max(0, this.max_students - (this.current_students || 0));
    }

    /**
     * Instance method: Calculate total lessons
     */
    calculateTotalLessons() {
      const months = this.duration_months || 3;
      const lessonsPerWeek = this.lessons_per_week || 3;
      const weeks = months * 4.33; // Average weeks per month
      return Math.round(weeks * lessonsPerWeek);
    }
  }

  Group.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Group name is required",
          },
          len: {
            args: [2, 100],
            msg: "Group name must be between 2 and 100 characters",
          },
        },
      },
      course_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          notNull: { msg: "Course is required" },
        },
        references: {
          model: "Courses",
          key: "id",
        },
      },
      teacher_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          notNull: { msg: "Teacher is required" },
        },
        references: {
          model: "Teachers",
          key: "id",
        },
      },
      room_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Rooms",
          key: "id",
        },
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        validate: {
          min: {
            args: [0],
            msg: "Price cannot be negative",
          },
          isDecimal: {
            msg: "Price must be a valid decimal number",
          },
        },
      },
      duration_months: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
        validate: {
          min: {
            args: [1],
            msg: "Duration must be at least 1 month",
          },
          max: {
            args: [36],
            msg: "Duration cannot exceed 3 years",
          },
        },
      },
      lessons_per_week: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
        validate: {
          min: {
            args: [1],
            msg: "Lessons per week must be at least 1",
          },
          max: {
            args: [7],
            msg: "Lessons per week cannot exceed 7",
          },
        },
      },
      lesson_duration: {
        type: DataTypes.INTEGER,
        defaultValue: 90,
        validate: {
          min: {
            args: [30],
            msg: "Lesson duration must be at least 30 minutes",
          },
          max: {
            args: [240],
            msg: "Lesson duration cannot exceed 4 hours",
          },
        },
      },
      max_students: {
        type: DataTypes.INTEGER,
        defaultValue: 15,
        validate: {
          min: {
            args: [1],
            msg: "Max students must be at least 1",
          },
          max: {
            args: [100],
            msg: "Max students cannot exceed 100",
          },
        },
      },
      current_students: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
          min: {
            args: [0],
            msg: "Current students cannot be negative",
          },
          customValidator(value) {
            if (value > this.max_students) {
              throw new Error("Current students cannot exceed max students");
            }
          },
        },
      },
      status: {
        type: DataTypes.ENUM("planned", "active", "completed", "inactive"),
        defaultValue: "planned",
        validate: {
          isIn: {
            args: [["planned", "active", "completed", "inactive"]],
            msg: "Invalid status value",
          },
        },
      },
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Start date is required" },
          isDate: { msg: "Start date must be a valid date" },
          isAfter: {
            args: [new Date().toISOString().split("T")[0]],
            msg: "Start date cannot be in the past",
          },
        },
      },
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          notEmpty: { msg: "End date is required" },
          isDate: { msg: "End date must be a valid date" },
          isAfterStartDate(value) {
            if (new Date(value) <= new Date(this.start_date)) {
              throw new Error("End date must be after start date");
            }
          },
        },
      },
      schedule_days: {
        type: DataTypes.JSON,
        defaultValue: ["monday", "wednesday", "friday"],
        validate: {
          isValidScheduleDays(value) {
            if (!Array.isArray(value)) {
              throw new Error("Schedule days must be an array");
            }
            if (value.length === 0) {
              throw new Error("At least one schedule day is required");
            }
            if (value.length > 7) {
              throw new Error("Cannot have more than 7 schedule days");
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

            value.forEach((day) => {
              if (!validDays.includes(day.toLowerCase())) {
                throw new Error(
                  `Invalid day: ${day}. Valid days are: ${validDays.join(", ")}`
                );
              }
            });
          },
        },
        get() {
          const rawValue = this.getDataValue("schedule_days");
          try {
            if (typeof rawValue === "string") {
              return JSON.parse(rawValue);
            }
            return rawValue || ["monday", "wednesday", "friday"];
          } catch (error) {
            return ["monday", "wednesday", "friday"];
          }
        },
        set(value) {
          if (Array.isArray(value)) {
            this.setDataValue("schedule_days", value);
          } else {
            this.setDataValue("schedule_days", [
              "monday",
              "wednesday",
              "friday",
            ]);
          }
        },
      },
      schedule_time: {
        type: DataTypes.TIME,
        defaultValue: "09:00:00",
        validate: {
          isTimeFormat(value) {
            if (!/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(value)) {
              throw new Error("Invalid time format. Use HH:MM or HH:MM:SS");
            }
          },
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
          len: {
            args: [0, 1000],
            msg: "Description cannot exceed 1000 characters",
          },
        },
      },
      // Legacy schedule field for backward compatibility
      schedule: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          const rawValue = this.getDataValue("schedule");
          if (!rawValue) return [];

          try {
            if (typeof rawValue === "string") {
              return JSON.parse(rawValue);
            }
            return rawValue;
          } catch (error) {
            console.error("Error parsing schedule:", error);
            return [];
          }
        },
        set(value) {
          if (value && Array.isArray(value)) {
            this.setDataValue("schedule", JSON.stringify(value));
          } else {
            this.setDataValue("schedule", null);
          }
        },
      },
    },
    {
      sequelize,
      modelName: "Group",
      tableName: "groups",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      hooks: {
        beforeValidate: (group) => {
          // Ensure schedule_days is always an array
          if (!group.schedule_days || !Array.isArray(group.schedule_days)) {
            group.schedule_days = ["monday", "wednesday", "friday"];
          }

          // Ensure schedule_time has seconds if missing
          if (group.schedule_time && !group.schedule_time.includes(":")) {
            group.schedule_time = group.schedule_time + ":00";
          }

          // Auto-calculate end date if not provided
          if (group.start_date && !group.end_date && group.duration_months) {
            const startDate = new Date(group.start_date);
            startDate.setMonth(startDate.getMonth() + group.duration_months);
            group.end_date = startDate;
          }
        },

        beforeCreate: (group) => {
          // Set current_students to 0 for new groups
          if (!group.current_students) {
            group.current_students = 0;
          }
        },

        beforeUpdate: (group) => {
          // If status changed to completed, update end date
          if (group.changed("status") && group.status === "completed") {
            group.end_date = new Date();
          }
        },

        afterSave: async (group) => {
          // If schedule field is updated, also update schedule_days and schedule_time
          if (
            group.changed("schedule") &&
            group.schedule &&
            Array.isArray(group.schedule)
          ) {
            try {
              // Extract days and times from legacy schedule
              const days = [
                ...new Set(group.schedule.map((slot) => slot.day_of_week)),
              ].filter(Boolean);
              const times = group.schedule
                .map((slot) => slot.start_time)
                .filter(Boolean);

              if (days.length > 0) {
                await group.update({
                  schedule_days: days,
                  schedule_time: times[0] || "09:00:00",
                });
              }
            } catch (error) {
              console.error("Error updating schedule fields:", error);
            }
          }
        },
      },

      // Scopes for common queries
      scopes: {
        active: {
          where: {
            status: "active",
          },
        },
        planned: {
          where: {
            status: "planned",
          },
        },
        withTeacher: {
          include: [
            {
              model: sequelize.models.Teacher,
              as: "Teacher",
              attributes: ["id", "full_name", "phone"],
            },
          ],
        },
        withCourse: {
          include: [
            {
              model: sequelize.models.Course,
              as: "Course",
              attributes: ["id", "name", "description"],
            },
          ],
        },
        withRoom: {
          include: [
            {
              model: sequelize.models.Room,
              as: "Room",
              attributes: ["id", "name", "capacity"],
            },
          ],
        },
        upcoming: {
          where: {
            start_date: {
              [Op.gte]: new Date(),
            },
          },
        },
        hasAvailableSeats: {
          where: sequelize.where(
            sequelize.col("max_students"),
            ">",
            sequelize.col("current_students")
          ),
        },
      },

      // Indexes definition
      indexes: [
        {
          fields: ["course_id"],
        },
        {
          fields: ["teacher_id"],
        },
        {
          fields: ["room_id"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["start_date"],
        },
        {
          fields: ["end_date"],
        },
        {
          fields: ["name"],
        },
      ],
    }
  );

  return Group;
};
