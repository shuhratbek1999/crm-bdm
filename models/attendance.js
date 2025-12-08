// models/attendance.js
module.exports = (sequelize, DataTypes) => {
  const Attendance = sequelize.define(
    "Attendance",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      lesson_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Lessons",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      teacher_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Teachers",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      student_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Students",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      status: {
        type: DataTypes.ENUM("present", "absent", "late", "excused"),
        defaultValue: "present",
      },
      comment: {
        type: DataTypes.TEXT,
      },
      marked_by_teacher_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Teachers",
          key: "id",
        },
        onDelete: "SET NULL",
      },
      attendance_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "Attendances",
      timestamps: true,
      underscored: false,
      indexes: [
        {
          fields: ["lesson_id"],
        },
        {
          fields: ["teacher_id"],
        },
        {
          fields: ["student_id"],
        },
        {
          fields: ["attendance_date"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["lesson_id", "student_id"],
          unique: true,
          name: "unique_lesson_student_attendance",
        },
      ],
    }
  );

  Attendance.associate = function (models) {
    Attendance.belongsTo(models.Lesson, {
      foreignKey: "lesson_id",
      as: "Lesson",
    });

    Attendance.belongsTo(models.Teacher, {
      foreignKey: "teacher_id",
      as: "Teacher",
    });

    Attendance.belongsTo(models.Student, {
      foreignKey: "student_id",
      as: "Student",
    });

    Attendance.belongsTo(models.Teacher, {
      foreignKey: "marked_by_teacher_id",
      as: "MarkedByTeacher",
    });
  };

  return Attendance;
};
