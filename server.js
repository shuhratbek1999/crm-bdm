const app = require("./app");
const { sequelize } = require("./models");

const PORT = process.env.PORT || 5000;

// DB bilan ulanish va serverni ishga tushirish
sequelize
  .authenticate()
  .then(() => {
    console.log("Database connected...");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });
