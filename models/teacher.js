"use strict";
const bcrypt = require("bcryptjs");
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Teacher extends Model {
    static associate(models) {
      // Teacher bilan bog'lanishlar
      Teacher.hasMany(models.Group, {
        foreignKey: "teacher_id",
        as: "groups",
      });

      Teacher.hasMany(models.Attendance, {
        foreignKey: "teacher_id",
        as: "attendances",
      });
      Teacher.hasMany(models.Lesson, {
        foreignKey: "teacher_id",
        as: "Lessons",
      });

      Teacher.hasMany(models.Payment, {
        foreignKey: "created_by",
        as: "payments",
      });
    }

    // Parolni tekshirish metodi
    async validPassword(password) {
      return await bcrypt.compare(password, this.password);
    }

    // O'quvchi qo'shish
    async addStudent(studentData) {
      // Teacher o'ziga student qo'sha oladi
    }

    // Davomat belgilash
    async markAttendance(groupId, studentId, status) {
      // Teacher davomat belgilaydi
    }
  }

  Teacher.init(
    {
      full_name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: { msg: "Full name is required" },
          notEmpty: { msg: "Full name cannot be empty" },
          len: {
            args: [2, 100],
            msg: "Full name must be between 2 and 100 characters",
          },
        },
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          msg: "Phone number already exists",
        },
        validate: {
          notNull: { msg: "Phone number is required" },
          notEmpty: { msg: "Phone number cannot be empty" },
          is: {
            args: /^\+?[1-9]\d{1,14}$/,
            msg: "Invalid phone number format",
          },
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: { msg: "Password is required" },
          notEmpty: { msg: "Password cannot be empty" },
          len: {
            args: [6, 100],
            msg: "Password must be between 6 and 100 characters",
          },
        },
      },
      role: {
        type: DataTypes.ENUM("admin", "teacher", "assistant"),
        defaultValue: "teacher",
        validate: {
          isIn: {
            args: [["admin", "teacher", "assistant"]],
            msg: "Invalid role",
          },
        },
      },
      specialization: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          len: {
            args: [0, 100],
            msg: "Specialization cannot exceed 100 characters",
          },
        },
      },
      experience_years: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: {
            args: [0],
            msg: "Experience years cannot be negative",
          },
          max: {
            args: [50],
            msg: "Experience years is too high",
          },
        },
      },
      birth_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        validate: {
          isDate: {
            msg: "Invalid birth date format",
          },
          isBefore: {
            args: new Date().toISOString().split("T")[0],
            msg: "Birth date must be in the past",
          },
        },
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
          len: {
            args: [0, 500],
            msg: "Address cannot exceed 500 characters",
          },
        },
      },
      last_login: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      verification_code: {
        type: DataTypes.STRING(6),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive", "blocked"),
        defaultValue: "active",
        validate: {
          isIn: {
            args: [["active", "inactive", "blocked"]],
            msg: "Invalid status",
          },
        },
      },
    },
    {
      sequelize,
      modelName: "Teacher",
      tableName: "Teachers",
      timestamps: true,
      underscored: false,
      paranoid: true,
      hooks: {
        beforeCreate: async (teacher) => {
          if (teacher.password) {
            const salt = await bcrypt.genSalt(10);
            teacher.password = await bcrypt.hash(teacher.password, salt);
          }
        },
        beforeUpdate: async (teacher) => {
          if (teacher.changed("password")) {
            const salt = await bcrypt.genSalt(10);
            teacher.password = await bcrypt.hash(teacher.password, salt);
          }
        },
      },
      indexes: [
        {
          fields: ["phone"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["role"],
        },
      ],
    }
  );

  return Teacher;
};
