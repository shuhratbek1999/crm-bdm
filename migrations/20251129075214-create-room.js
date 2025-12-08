// migrations/YYYYMMDDHHMMSS-create-room.js
"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Room", {
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
      capacity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 20,
      },
      floor: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
      },
      equipment: {
        type: Sequelize.TEXT, // JSON formatda saqlanadi
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM(
          "available",
          "maintenance",
          "occupied",
          "unavailable"
        ),
        defaultValue: "available",
      },
      color: {
        type: Sequelize.STRING,
        defaultValue: "#6B7280", // gray
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

    await queryInterface.addIndex("Rooms", ["status"]);
    await queryInterface.addIndex("Rooms", ["floor"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Rooms");
  },
};
