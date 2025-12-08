// migrations/YYYYMMDDHHMMSS-create-course.js
"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Courses", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      level: {
        type: Sequelize.ENUM("beginner", "intermediate", "advanced"),
        defaultValue: "beginner",
      },
      duration_months: {
        type: Sequelize.INTEGER,
        defaultValue: 3,
      },
      lessons_per_week: {
        type: Sequelize.INTEGER,
        defaultValue: 3,
      },
      lesson_duration: {
        type: Sequelize.INTEGER, // minutes
        defaultValue: 90,
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      color: {
        type: Sequelize.STRING,
        defaultValue: "#3B82F6", // blue
      },
      icon: {
        type: Sequelize.STRING,
        defaultValue: "BookOpen",
      },
      status: {
        type: Sequelize.ENUM("active", "inactive"),
        defaultValue: "active",
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("Courses", ["category"]);
    await queryInterface.addIndex("Courses", ["level"]);
    await queryInterface.addIndex("Courses", ["status"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Courses");
  },
};
