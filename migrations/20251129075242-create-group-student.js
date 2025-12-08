// migrations/XXXXXX-create-group-students.js
"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("group_students", {
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
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "students",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      join_date: {
        type: Sequelize.DATEONLY,
      },
      status: {
        type: Sequelize.ENUM("active", "inactive", "completed"),
        defaultValue: "active",
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

    // Composite unique key - bir student bir guruhga bir marta qo'shilishi
    await queryInterface.addIndex(
      "group_students",
      ["group_id", "student_id"],
      {
        unique: true,
        name: "unique_group_student",
      }
    );

    await queryInterface.addIndex("group_students", ["group_id"]);
    await queryInterface.addIndex("group_students", ["student_id"]);
    await queryInterface.addIndex("group_students", ["status"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("group_students");
  },
};
