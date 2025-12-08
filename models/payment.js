"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    static associate(models) {
      // Student bilan bog'lanish
      Payment.belongsTo(models.Student, {
        foreignKey: "student_id",
        as: "student",
      });

      // User bilan bog'lanish
      Payment.belongsTo(models.User, {
        foreignKey: "created_by",
        as: "createdBy",
      });
    }
  }

  Payment.init(
    {
      student_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          notNull: { msg: "Student ID is required" },
          notEmpty: { msg: "Student ID cannot be empty" },
          isInt: { msg: "Student ID must be an integer" },
        },
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false, // Migrationga qarang: allowNull: false
        validate: {
          isInt: { msg: "Created by must be an integer" },
        },
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          notNull: { msg: "Amount is required" },
          notEmpty: { msg: "Amount cannot be empty" },
          min: {
            args: [0],
            msg: "Amount cannot be negative",
          },
          max: {
            args: [1000000],
            msg: "Amount is too large",
          },
        },
      },
      method: {
        type: DataTypes.ENUM(
          "cash",
          "card",
          "bank_transfer",
          "online",
          "other"
        ),
        allowNull: false,
        defaultValue: "cash",
        validate: {
          isIn: {
            args: [["cash", "card", "bank_transfer", "online", "other"]],
            msg: "Invalid payment method",
          },
        },
      },
      status: {
        type: DataTypes.ENUM("completed", "pending", "failed", "refunded"),
        allowNull: false,
        defaultValue: "completed",
        validate: {
          isIn: {
            args: [["completed", "pending", "failed", "refunded"]],
            msg: "Invalid payment status",
          },
        },
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
          len: {
            args: [0, 1000],
            msg: "Comment cannot exceed 1000 characters",
          },
        },
      },
      // ⚠️ created_by bu yerda ikkinchi marta takrorlanmagan bo'lishi kerak
      // Yuqorida allaqachon bor
    },
    {
      sequelize,
      modelName: "Payment",
      tableName: "Payments", // ✅ Migration bilan bir xil: "Payments"
      timestamps: true,
      underscored: false,
      defaultScope: {
        attributes: {
          exclude: ["group_id"], // group_id ni har doim exclude qilish
        },
      },
    }
  );

  return Payment;
};
