"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Group, { foreignKey: "teacher_id" });
    }
  }

  User.init(
    {
      full_name: DataTypes.STRING,
      phone: DataTypes.STRING,
      password: DataTypes.STRING,
      role: DataTypes.ENUM("admin", "teacher", "cashier"),
    },
    {
      sequelize,
      modelName: "User",
    }
  );

  return User;
};
