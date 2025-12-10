// models/room.js
"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Room extends Model {
    static associate(models) {
      // Groups bilan bog'lash
      Room.hasMany(models.Group, {
        foreignKey: "room_id",
        as: "groups",
      });
    }
  }

  Room.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Room name is required" },
          len: {
            args: [2, 50],
            msg: "Room name must be between 2 and 50 characters",
          },
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
          len: {
            args: [0, 500],
            msg: "Description cannot exceed 500 characters",
          },
        },
      },
      capacity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 20,
        validate: {
          min: { args: [1], msg: "Capacity must be at least 1" },
          max: { args: [500], msg: "Capacity cannot exceed 500" },
        },
      },
      floor: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
          min: { args: [1], msg: "Floor must be at least 1" },
          max: { args: [50], msg: "Floor cannot exceed 50" },
        },
      },
      equipment: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          const rawValue = this.getDataValue("equipment");
          return rawValue ? JSON.parse(rawValue) : [];
        },
        set(value) {
          this.setDataValue("equipment", value ? JSON.stringify(value) : null);
        },
      },
      status: {
        type: DataTypes.ENUM(
          "available",
          "maintenance",
          "occupied",
          "unavailable"
        ),
        defaultValue: "available",
        validate: {
          isIn: {
            args: [["available", "maintenance", "occupied", "unavailable"]],
            msg: "Invalid status",
          },
        },
      },
      color: {
        type: DataTypes.STRING,
        defaultValue: "#6B7280",
        validate: {
          is: {
            args: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
            msg: "Color must be a valid hex color code",
          },
        },
      },
    },
    {
      sequelize,
      modelName: "Room",
      tableName: "rooms",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      hooks: {
        beforeValidate: (room) => {
          // Name ni trim qilish
          if (room.name) {
            room.name = room.name.trim();
          }
        },
      },
    }
  );

  return Room;
};
