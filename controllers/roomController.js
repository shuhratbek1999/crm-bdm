// controllers/roomController.js
const { Room, Group } = require("../models");
const { Op, fn, literal } = require("sequelize");

const getAllRooms = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status,
      floor,
      min_capacity,
      max_capacity,
    } = req.query;

    const whereClause = {};

    // Search qilish
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    // Filter by status
    if (status && status !== "all") {
      whereClause.status = status;
    }

    // Filter by floor
    if (floor && floor !== "all") {
      whereClause.floor = parseInt(floor);
    }

    // Filter by capacity range
    if (min_capacity || max_capacity) {
      whereClause.capacity = {};
      if (min_capacity) whereClause.capacity[Op.gte] = parseInt(min_capacity);
      if (max_capacity) whereClause.capacity[Op.lte] = parseInt(max_capacity);
    }

    const offset = (page - 1) * limit;

    const { count, rows: rooms } = await Room.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Group,
          as: "groups",
          attributes: ["id", "name", "status"],
          where: { status: "active" },
          required: false,
        },
      ],
      // MySQL uchun to'g'ri SQL syntax
      attributes: {
        include: [
          [
            literal(
              `(SELECT COUNT(*) FROM \`Groups\` WHERE \`Groups\`.\`room_id\` = \`Room\`.\`id\` AND \`Groups\`.\`status\` = 'active')`
            ),
            "active_groups_count",
          ],
        ],
      },
      order: [["name", "ASC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      data: rooms,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(count / limit),
        totalRecords: count,
      },
    });
  } catch (error) {
    console.error("Get rooms error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching rooms",
      error: error.message,
    });
  }
};

// Bitta xonani olish
const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;

    const room = await Room.findByPk(id, {
      include: [
        {
          model: Group,
          as: "groups",
          include: [
            {
              model: Course,
              as: "course",
              attributes: ["id", "name"],
            },
            {
              model: Teacher,
              as: "teacher",
              attributes: ["id", "full_name"],
            },
          ],
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    res.json({
      success: true,
      data: room,
    });
  } catch (error) {
    console.error("Get room error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching room",
      error: error.message,
    });
  }
};

// Yangi xona yaratish
const createRoom = async (req, res) => {
  try {
    const { name, description, capacity, floor, equipment, status, color } =
      req.body;
    console.log(req.body);

    // Nom takrorlanmasligini tekshirish
    const existingRoom = await Room.findOne({ where: { name } });
    if (existingRoom) {
      return res.status(400).json({
        success: false,
        message: "Room with this name already exists",
      });
    }

    const room = await Room.create({
      name,
      description,
      capacity,
      floor,
      equipment,
      status,
      color,
    });

    res.status(201).json({
      success: true,
      message: "Room created successfully",
      data: "room",
    });
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating room",
      error: error.message,
    });
  }
};

// Xonani yangilash
const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const room = await Room.findByPk(id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // Nom takrorlanmasligini tekshirish (agar yangilansa)
    if (updateData.name && updateData.name !== room.name) {
      const existingRoom = await Room.findOne({
        where: {
          name: updateData.name,
          id: { [Op.ne]: id },
        },
      });
      if (existingRoom) {
        return res.status(400).json({
          success: false,
          message: "Room with this name already exists",
        });
      }
    }

    await room.update(updateData);

    res.json({
      success: true,
      message: "Room updated successfully",
      data: room,
    });
  } catch (error) {
    console.error("Update room error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating room",
      error: error.message,
    });
  }
};

// Xonani o'chirish
const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;

    const room = await Room.findByPk(id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // Xonaga bog'langan active guruhlar borligini tekshirish
    const activeGroups = await Group.count({
      where: {
        room_id: id,
        status: "active",
      },
    });

    if (activeGroups > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete room with active groups",
      });
    }

    await room.destroy();

    res.json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    console.error("Delete room error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting room",
      error: error.message,
    });
  }
};

// Xona statistikasi
const getRoomStats = async (req, res) => {
  try {
    const totalRooms = await Room.count();
    const availableRooms = await Room.count({ where: { status: "available" } });
    const occupiedRooms = await Room.count({ where: { status: "occupied" } });
    const maintenanceRooms = await Room.count({
      where: { status: "maintenance" },
    });

    // Har bir qavatdagi xonalar soni
    const floors = await Room.findAll({
      attributes: ["floor", [fn("COUNT", col("id")), "room_count"]],
      group: ["floor"],
      order: [["floor", "ASC"]],
      raw: true,
    });

    // O'rtacha sig'im
    const avgCapacity = await Room.findOne({
      attributes: [[fn("AVG", col("capacity")), "avg_capacity"]],
      raw: true,
    });

    res.json({
      success: true,
      data: {
        totalRooms,
        availableRooms,
        occupiedRooms,
        maintenanceRooms,
        floors,
        avgCapacity: Math.round(avgCapacity.avg_capacity || 0),
      },
    });
  } catch (error) {
    console.error("Get room stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching room statistics",
      error: error.message,
    });
  }
};

// Bo'sh xonalarni olish (guruh uchun)
const getAvailableRooms = async (req, res) => {
  try {
    const { capacity, date, time } = req.query;

    const whereClause = {
      status: "available",
    };

    // Sig'im bo'yicha filter
    if (capacity) {
      whereClause.capacity = {
        [Op.gte]: parseInt(capacity),
      };
    }

    // Vaqt bo'yicha band xonalarni topish
    let occupiedRoomIds = [];
    if (date && time) {
      const occupiedRooms = await Group.findAll({
        where: {
          schedule: {
            [Op.like]: `%${date}%${time}%`,
          },
        },
        attributes: ["room_id"],
        raw: true,
      });
      occupiedRoomIds = occupiedRooms
        .map((room) => room.room_id)
        .filter((id) => id);
    }

    // Band xonalarni chiqarib tashlash
    if (occupiedRoomIds.length > 0) {
      whereClause.id = {
        [Op.notIn]: occupiedRoomIds,
      };
    }

    const rooms = await Room.findAll({
      where: whereClause,
      order: [["name", "ASC"]],
    });

    res.json({
      success: true,
      data: rooms,
    });
  } catch (error) {
    console.error("Get available rooms error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching available rooms",
      error: error.message,
    });
  }
};

module.exports = {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomStats,
  getAvailableRooms,
};
