// models/lesson.js
module.exports = (sequelize, DataTypes) => {
  const Lesson = sequelize.define(
    "Lesson",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      group_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      teacher_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      room_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("planned", "completed", "cancelled"),
        defaultValue: "planned",
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "Lessons",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    }
  );

  Lesson.associate = function (models) {
    Lesson.belongsTo(models.Group, { foreignKey: "group_id", as: "Group" });
    Lesson.belongsTo(models.Teacher, {
      foreignKey: "teacher_id",
      as: "Teacher",
    });
    Lesson.belongsTo(models.Room, { foreignKey: "room_id", as: "Room" });
    Lesson.hasMany(models.Attendance, {
      foreignKey: "lesson_id",
      as: "Attendances",
    });
  };

  return Lesson;
};
