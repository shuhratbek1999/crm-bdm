"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("payments", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "students",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
      },
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      method: {
        type: Sequelize.ENUM(
          "cash",
          "card",
          "bank_transfer",
          "online",
          "other"
        ),
        allowNull: false,
        defaultValue: "cash",
      },
      status: {
        type: Sequelize.ENUM("completed", "pending", "failed", "refunded"),
        allowNull: false,
        defaultValue: "completed",
      },
      comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Index qo'shish (ixtiyoriy, lekin tavsiya etiladi)
    await queryInterface.addIndex("payments", ["student_id"]);
    await queryInterface.addIndex("payments", ["status"]);
    await queryInterface.addIndex("payments", ["createdAt"]);
    await queryInterface.addIndex("payments", ["method"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("payments");
  },
};
