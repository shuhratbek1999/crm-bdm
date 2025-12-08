// migrations/XXXXXX-create-lessons.js
"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("lessons", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      group_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Groups",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Teachers",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      room_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Rooms",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      status: {
        type: Sequelize.ENUM("planned", "completed", "cancelled"),
        defaultValue: "planned",
        allowNull: false,
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

    // Indexes for better performance
    await queryInterface.addIndex("lessons", ["group_id"]);
    await queryInterface.addIndex("lessons", ["teacher_id"]);
    await queryInterface.addIndex("lessons", ["room_id"]);
    await queryInterface.addIndex("lessons", ["date"]);
    await queryInterface.addIndex("lessons", ["status"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("lessons");
  },
};
