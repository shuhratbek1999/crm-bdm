"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Attendances", {
      id: { autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },

      // Lesson reference
      lesson_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Lessons", key: "id" },
        onDelete: "CASCADE",
      },

      // Teacher reference - YANGI QO'SHILDI
      teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Teachers", key: "id" },
        onDelete: "CASCADE",
      },

      // Student reference
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Students", key: "id" },
        onDelete: "CASCADE",
      },

      // Davomat holati
      status: {
        type: Sequelize.ENUM("present", "absent", "late", "excused"),
        defaultValue: "present",
      },

      // Izoh
      comment: {
        type: Sequelize.TEXT,
      },

      // Qaysi o'qituvchi belgilagan
      marked_by_teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Teachers", key: "id" },
        onDelete: "SET NULL",
      },

      // Davomat sanasi
      attendance_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
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

    // Index qo'shish - tezroq qidirish uchun
    await queryInterface.addIndex("Attendances", ["lesson_id"]);
    await queryInterface.addIndex("Attendances", ["teacher_id"]);
    await queryInterface.addIndex("Attendances", ["student_id"]);
    await queryInterface.addIndex("Attendances", ["attendance_date"]);
    await queryInterface.addIndex("Attendances", ["status"]);

    // Unique constraint - bir student bir lesson uchun bir martalik attendance
    await queryInterface.addConstraint("Attendances", {
      fields: ["lesson_id", "student_id"],
      type: "unique",
      name: "unique_lesson_student_attendance",
    });
  },

  async down(queryInterface) {
    // Constraint'larni o'chirish
    await queryInterface.removeConstraint(
      "Attendances",
      "unique_lesson_student_attendance"
    );

    // Index'larni o'chirish
    await queryInterface.removeIndex("Attendances", ["lesson_id"]);
    await queryInterface.removeIndex("Attendances", ["teacher_id"]);
    await queryInterface.removeIndex("Attendances", ["student_id"]);
    await queryInterface.removeIndex("Attendances", ["attendance_date"]);
    await queryInterface.removeIndex("Attendances", ["status"]);

    // Jadvalni o'chirish
    await queryInterface.dropTable("Attendances");
  },
};
