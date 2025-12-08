const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/students", require("./routes/student"));
app.use("/api/studentOne", require("./routes/studentOne"));
app.use("/api/teachers", require("./routes/teachers"));
app.use("/api/teachersDashboard", require("./routes/teacherDashboard"));
app.use("/api/teacher_course", require("./routes/teacher-course"));
app.use("/api/courses", require("./routes/courses"));
app.use("/api/groups", require("./routes/groups"));
app.use("/api/groupstudents", require("./routes/groupstudents"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/attendances", require("./routes/attendances"));
app.use("/api/rooms", require("./routes/rooms"));
app.use("/api/lessons", require("./routes/lesson"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/dashboardStudent", require("./routes/dashboardStudent"));

app.get("/", (req, res) => {
  res.send("CRM Backend RUNNING!");
});

module.exports = app;
