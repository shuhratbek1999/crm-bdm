"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Teachers", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      full_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM("admin", "teacher", "assistant"),
        defaultValue: "teacher",
      },
      specialization: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      experience_years: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      birth_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      profile_image: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      last_login: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      is_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      verification_code: {
        type: Sequelize.STRING(6),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("active", "inactive", "blocked"),
        defaultValue: "active",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Indexlar qo'shish
    await queryInterface.addIndex("Teachers", ["phone"]);
    await queryInterface.addIndex("Teachers", ["status"]);
    await queryInterface.addIndex("Teachers", ["role"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Teachers");
  },
};
