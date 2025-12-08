// models/course.js
"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Course extends Model {
    static associate(models) {
      // Groups bilan bog'lash
      Course.hasMany(models.Group, {
        foreignKey: "course_id",
        as: "groups",
      });

      // User bilan bog'lash (creator)
      Course.belongsTo(models.User, {
        foreignKey: "created_by",
        as: "creator",
      });
      // Course.hasMany(models.Student, {
      //   foreignKey: "created_by",
      // });
    }
  }

  Course.init(
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
          notEmpty: { msg: "Course name is required" },
          len: {
            args: [2, 100],
            msg: "Course name must be between 2 and 100 characters",
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
      category: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Category is required" },
        },
      },
      level: {
        type: DataTypes.ENUM("beginner", "intermediate", "advanced"),
        defaultValue: "beginner",
        validate: {
          isIn: {
            args: [["beginner", "intermediate", "advanced"]],
            msg: "Level must be beginner, intermediate, or advanced",
          },
        },
      },
      duration_months: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
        validate: {
          min: { args: [1], msg: "Duration must be at least 1 month" },
          max: { args: [24], msg: "Duration cannot exceed 24 months" },
        },
      },
      lessons_per_week: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
        validate: {
          min: { args: [1], msg: "Lessons per week must be at least 1" },
          max: { args: [7], msg: "Lessons per week cannot exceed 7" },
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
            msg: "Lesson duration cannot exceed 240 minutes",
          },
        },
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: { args: [0], msg: "Price cannot be negative" },
        },
      },
      color: {
        type: DataTypes.STRING,
        defaultValue: "#3B82F6",
        validate: {
          is: {
            args: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
            msg: "Color must be a valid hex color code",
          },
        },
      },
      icon: {
        type: DataTypes.STRING,
        defaultValue: "BookOpen",
        validate: {
          isIn: {
            args: [
              [
                "BookOpen",
                "GraduationCap",
                "Code",
                "Languages",
                "Calculator",
                "Flask",
                "Music",
                "Palette",
                "Dumbbell",
              ],
            ],
            msg: "Invalid icon",
          },
        },
      },
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        defaultValue: "active",
        validate: {
          isIn: {
            args: [["active", "inactive"]],
            msg: "Status must be active or inactive",
          },
        },
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
      },
    },
    {
      sequelize,
      modelName: "Course",
      tableName: "Courses",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      hooks: {
        beforeValidate: (course) => {
          // Name ni trim qilish
          if (course.name) {
            course.name = course.name.trim();
          }

          // Category ni trim qilish
          if (course.category) {
            course.category = course.category.trim();
          }
        },
      },
    }
  );

  return Course;
};
