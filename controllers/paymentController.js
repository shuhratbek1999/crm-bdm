// controllers/paymentController.js - Soddalashtirilgan versiya
const { Payment, Student } = require("../models");

module.exports = {
  // Create payment
  async create(req, res) {
    try {
      const { student_id, amount, method, comment } = req.body;

      // Validation
      if (!student_id || !amount) {
        return res.status(400).json({
          success: false,
          message: "student_id and amount are required",
        });
      }

      const payment = await Payment.create({
        student_id,
        amount,
        method: method || "cash",
        comment,
        created_by: req.user.id, // Auth middleware dan keladi
      });

      // Fetch with student info
      const paymentWithStudent = await Payment.findByPk(payment.id, {
        include: [
          {
            model: Student,
            as: "student",
            attributes: ["id", "full_name", "phone"],
          },
        ],
      });

      res.status(201).json({
        success: true,
        data: paymentWithStudent,
      });
    } catch (e) {
      console.error("Create payment error:", e);
      res.status(500).json({
        success: false,
        message: "Create error",
        error: process.env.NODE_ENV === "development" ? e.message : undefined,
      });
    }
  },

  // All payments
  async all(req, res) {
    try {
      const payments = await Payment.findAll({
        include: [
          {
            model: Student,
            as: "student",
            attributes: ["id", "full_name", "phone"],
          },
        ],
        order: [["id", "DESC"]],
      });

      res.json({
        success: true,
        count: payments.length,
        data: payments,
      });
    } catch (e) {
      console.error("Get all payments error:", e);
      res.status(500).json({
        success: false,
        message: "Error fetching payments",
      });
    }
  },

  // One payment
  async one(req, res) {
    try {
      const payment = await Payment.findByPk(req.params.id, {
        include: [
          {
            model: Student,
            as: "student",
            attributes: ["id", "full_name", "phone"],
          },
        ],
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      res.json({
        success: true,
        data: payment,
      });
    } catch (e) {
      console.error("Get payment error:", e);
      res.status(500).json({
        success: false,
        message: "Error fetching payment",
      });
    }
  },

  // Update payment
  async update(req, res) {
    try {
      const payment = await Payment.findByPk(req.params.id);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      await payment.update(req.body);

      // Fetch updated payment with student info
      const updatedPayment = await Payment.findByPk(payment.id, {
        include: [
          {
            model: Student,
            as: "student",
            attributes: ["id", "full_name", "phone"],
          },
        ],
      });

      res.json({
        success: true,
        data: updatedPayment,
      });
    } catch (e) {
      console.error("Update payment error:", e);
      res.status(500).json({
        success: false,
        message: "Error updating payment",
      });
    }
  },

  // Delete payment
  async remove(req, res) {
    try {
      const payment = await Payment.findByPk(req.params.id);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      await payment.destroy();

      res.json({
        success: true,
        message: "Payment deleted successfully",
      });
    } catch (e) {
      console.error("Delete payment error:", e);
      res.status(500).json({
        success: false,
        message: "Error deleting payment",
      });
    }
  },

  // All payments for a student
  async byStudent(req, res) {
    try {
      const student_id = req.params.student_id;

      // Check if student exists
      const student = await Student.findByPk(student_id);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student not found",
        });
      }

      const payments = await Payment.findAll({
        where: { student_id },
        include: [
          {
            model: Student,
            as: "student",
            attributes: ["id", "full_name", "phone"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      // Calculate total
      const totalAmount = payments.reduce(
        (sum, payment) => sum + parseInt(payment.amount),
        0
      );

      res.json({
        success: true,
        student: {
          id: student.id,
          full_name: student.full_name,
          phone: student.phone,
        },
        payments: {
          count: payments.length,
          total: totalAmount,
          data: payments,
        },
      });
    } catch (e) {
      console.error("Get payments by student error:", e);
      res.status(500).json({
        success: false,
        message: "Error fetching student payments",
      });
    }
  },
};
