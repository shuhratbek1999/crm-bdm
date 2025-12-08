"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("students", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      full_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING(15),
        allowNull: false,
        unique: true,
      },
      parent_phone: {
        type: Sequelize.STRING(15),
        allowNull: true,
      },
      birth_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("active", "inactive", "blocked"),
        allowNull: false,
        defaultValue: "active",
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      last_login: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      registered_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      reset_password_token: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      reset_password_expires: {
        type: Sequelize.DATE,
        allowNull: true,
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

    // Additional indexes
    await queryInterface.addIndex("students", ["phone"], {
      name: "students_phone_idx",
      unique: true,
    });

    await queryInterface.addIndex("students", ["full_name"], {
      name: "students_full_name_idx",
    });

    await queryInterface.addIndex("students", ["status"], {
      name: "students_status_idx",
    });

    await queryInterface.addIndex("students", ["created_at"], {
      name: "students_created_at_idx",
    });

    await queryInterface.addIndex("students", ["registered_at"], {
      name: "students_registered_at_idx",
    });

    // Agar email maydoni keyinroq qo'shilishi kerak bo'lsa, unga alohida migration yozish mumkin
    // await queryInterface.addColumn("students", "email", {
    //   type: Sequelize.STRING(100),
    //   allowNull: true,
    //   unique: true,
    // });
  },

  async down(queryInterface, Sequelize) {
    // Indexlarni o'chirish
    await queryInterface.removeIndex("students", "students_phone_idx");
    await queryInterface.removeIndex("students", "students_full_name_idx");
    await queryInterface.removeIndex("students", "students_status_idx");
    await queryInterface.removeIndex("students", "students_created_at_idx");
    await queryInterface.removeIndex("students", "students_registered_at_idx");

    // Jadvalni o'chirish
    await queryInterface.dropTable("students");
  },
};
