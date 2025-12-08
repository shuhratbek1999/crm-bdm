// migrations/xxxx-add-schedule-fields-to-groups.js
"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if columns exist before adding
    const tableInfo = await queryInterface.describeTable("Groups");

    if (!tableInfo.schedule_days) {
      await queryInterface.addColumn("Groups", "schedule_days", {
        type: Sequelize.JSON,
        defaultValue: JSON.stringify(["monday", "wednesday", "friday"]),
        allowNull: true,
      });
    }

    if (!tableInfo.schedule_time) {
      await queryInterface.addColumn("Groups", "schedule_time", {
        type: Sequelize.TIME,
        defaultValue: "09:00:00",
        allowNull: true,
      });
    }

    if (!tableInfo.description) {
      await queryInterface.addColumn("Groups", "description", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Groups", "schedule_days");
    await queryInterface.removeColumn("Groups", "schedule_time");
    await queryInterface.removeColumn("Groups", "description");
  },
};
