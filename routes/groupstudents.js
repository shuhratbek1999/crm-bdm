const router = require("express").Router();
const ctrl = require("../controllers/groupStudentController");
const auth = require("../middleware/auth.middleware");
router.get("/", auth, ctrl.getAll);
router.post("/assign", auth, ctrl.assign);
router.post("/bulk-assign", auth, ctrl.bulkAssign);
router.put("/status", auth, ctrl.updateStatus);
router.delete("/remove", auth, ctrl.remove);
// check-bulk-conflicts
// Query operations
router.post("/check-bulk-conflicts", ctrl.checkBulkConflicts);
router.get("/group/:group_id", auth, ctrl.getByGroup);
router.get("/student/:student_id", auth, ctrl.getByStudent);
router.get("/search/:group_id", auth, ctrl.searchInGroup);

module.exports = router;
