// models/groupstudent.js
"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class GroupStudent extends Model {
    static associate(models) {
      GroupStudent.belongsTo(models.Group, {
        foreignKey: "group_id",
        as: "Group", // ✅ AS qo'shildi
      });
      GroupStudent.belongsTo(models.Student, {
        foreignKey: "student_id",
        as: "student", // ✅ AS qo'shildi
      });
    }
  }

  GroupStudent.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      group_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Groups",
          key: "id",
        },
      },
      student_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Students",
          key: "id",
        },
      },
      join_date: {
        // ✅ joined_at -> join_date
        type: DataTypes.DATEONLY,
        defaultValue: DataTypes.NOW,
      },
      status: {
        // ✅ Yangi field qo'shildi
        type: DataTypes.ENUM("active", "inactive", "completed"),
        defaultValue: "active",
      },
    },
    {
      sequelize,
      modelName: "GroupStudent",
      tableName: "group_students", // ✅ Table nomi aniqlandi
      underscored: true, // ✅ underscored mode
      timestamps: true, // ✅ created_at va updated_at
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return GroupStudent;
};
