const router = require("express").Router();
const ctrl = require("../controllers/studentController");
const auth = require("../middleware/auth.middleware");

router.get("/", auth, ctrl.getStudents);
router.get("/simple", auth, ctrl.getStudentsSimple);
router.get("/active", auth, ctrl.getActiveStudents);
router.get("/:id", auth, ctrl.getStudentById);
router.get("/:id/payments", auth, ctrl.getStudentPayments);
router.get("/:id/stats", auth, ctrl.getStudentStats);
router.post("/", auth, ctrl.createStudent);
router.put("/:id", auth, ctrl.updateStudent);
router.delete("/:id", auth, ctrl.deleteStudent);
router.post("/:studentId/add-to-group", auth, ctrl.addStudentToGroup);
router.delete(
  "/:studentId/remove-from-group/:groupId",
  auth,
  ctrl.removeStudentFromGroup
);

module.exports = router;
