"use strict";
const { Model } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  class Student extends Model {
    static associate(models) {
      // Group bilan many-to-many relation
      Student.belongsToMany(models.Group, {
        through: models.GroupStudent,
        foreignKey: "student_id",
        otherKey: "group_id",
        as: "Group",
      });

      // Payment bilan one-to-many relation
      Student.hasMany(models.Payment, {
        foreignKey: "student_id",
        as: "Payments",
      });

      // Attendance bilan one-to-many relation
      Student.hasMany(models.Attendance, {
        foreignKey: "student_id",
        as: "attendances",
      });
    }

    // Password'ni solishtirish methodi
    async comparePassword(password) {
      return await bcrypt.compare(password, this.password);
    }

    // Student ma'lumotlarini toJSON'ga o'tkazganda password'ni olib tashlash
    toJSON() {
      const values = Object.assign({}, this.get());
      delete values.password;
      return values;
    }
  }

  Student.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
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
        unique: true,
        validate: {
          notNull: { msg: "Phone number is required" },
          notEmpty: { msg: "Phone number cannot be empty" },
          len: {
            args: [9, 15],
            msg: "Phone number must be between 9 and 15 digits",
          },
        },
      },
      parent_phone: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          len: {
            args: [0, 15],
            msg: "Parent phone number is too long",
          },
        },
      },
      birth_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        validate: {
          isDate: { msg: "Invalid birth date format" },
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
            msg: "Password must be at least 6 characters long",
          },
        },
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive", "blocked"),
        allowNull: false,
        defaultValue: "active",
        validate: {
          isIn: {
            args: [["active", "inactive", "blocked"]],
            msg: "Status must be either active, inactive or blocked",
          },
        },
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      last_login: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      registered_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      reset_password_token: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      reset_password_expires: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "updated_at",
      },
    },
    {
      sequelize,
      modelName: "Student",
      tableName: "students",
      timestamps: true,
      underscored: false,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      indexes: [
        {
          unique: true,
          fields: ["phone"],
        },
        {
          fields: ["full_name"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["createdAt"],
        },
      ],
      hooks: {
        beforeCreate: async (student) => {
          // Telefon raqamni tozalash
          if (student.phone) {
            student.phone = student.phone.replace(/\D/g, "");
          }
          if (student.parent_phone) {
            student.parent_phone = student.parent_phone.replace(/\D/g, "");
          }

          // Password'ni hash qilish
          if (student.password) {
            const salt = await bcrypt.genSalt(10);
            student.password = await bcrypt.hash(student.password, salt);
          }
        },
        beforeUpdate: async (student) => {
          // Telefon raqamni tozalash
          if (student.phone && student.changed("phone")) {
            student.phone = student.phone.replace(/\D/g, "");
          }

          if (student.parent_phone && student.changed("parent_phone")) {
            student.parent_phone = student.parent_phone.replace(/\D/g, "");
          }

          // Password yangilansa, uni hash qilish
          if (student.password && student.changed("password")) {
            const salt = await bcrypt.genSalt(10);
            student.password = await bcrypt.hash(student.password, salt);
          }
        },
      },
    }
  );

  return Student;
};
