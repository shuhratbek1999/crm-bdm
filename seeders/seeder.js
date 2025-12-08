"use strict";
const bcrypt = require("bcrypt");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const passwordHash = await bcrypt.hash("12345678", 10); // default password

    return queryInterface.bulkInsert(
      "Users",
      [
        {
          full_name: "Admin",
          phone: "+998901234567",
          password: passwordHash,
          role: "admin", // example roles: admin, user, manager
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          full_name: "Jane Smith",
          phone: "+998901234568",
          password: passwordHash,
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete("Users", null, {});
  },
};
