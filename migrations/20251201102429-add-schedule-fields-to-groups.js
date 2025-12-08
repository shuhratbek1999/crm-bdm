// migrations/xxxx-add-schedule-fields-to-groups.js
"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if columns exist before adding
    const tableInfo = await queryInterface.describeTable("groups");

    if (!tableInfo.schedule_days) {
      await queryInterface.addColumn("groups", "schedule_days", {
        type: Sequelize.JSON,
        defaultValue: JSON.stringify(["monday", "wednesday", "friday"]),
        allowNull: true,
      });
    }

    if (!tableInfo.schedule_time) {
      await queryInterface.addColumn("groups", "schedule_time", {
        type: Sequelize.TIME,
        defaultValue: "09:00:00",
        allowNull: true,
      });
    }

    if (!tableInfo.description) {
      await queryInterface.addColumn("groups", "description", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("groups", "schedule_days");
    await queryInterface.removeColumn("groups", "schedule_time");
    await queryInterface.removeColumn("groups", "description");
  },
};
