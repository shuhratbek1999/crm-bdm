// migrations/xxxx-create-groups.js
"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Groups", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      course_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Courses",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Teachers",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      room_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Rooms",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
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
        type: Sequelize.INTEGER,
        defaultValue: 90,
        comment: "Lesson duration in minutes",
      },
      max_students: {
        type: Sequelize.INTEGER,
        defaultValue: 15,
      },
      current_students: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM("planned", "active", "completed", "inactive"),
        defaultValue: "planned",
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      schedule_days: {
        type: Sequelize.JSON,
        defaultValue: JSON.stringify(["monday", "wednesday", "friday"]),
      },
      schedule_time: {
        type: Sequelize.TIME,
        defaultValue: "09:00:00",
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      schedule: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Legacy schedule field (JSON string)",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Add indexes for better performance
    await queryInterface.addIndex("Groups", ["course_id"]);
    await queryInterface.addIndex("Groups", ["teacher_id"]);
    await queryInterface.addIndex("Groups", ["room_id"]);
    await queryInterface.addIndex("Groups", ["status"]);
    await queryInterface.addIndex("Groups", ["start_date"]);
    await queryInterface.addIndex("Groups", ["end_date"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Groups");
  },
};
