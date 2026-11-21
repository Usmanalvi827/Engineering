import express from "express";
import dotenv from "dotenv";
dotenv.config();
import authRouter from "./routes/auth.routes.js";
import connectDB from "./config/db.js";
import allUsersRoute from "./routes/users.routes.js";
import cookieParser from "cookie-parser";
import redis from "./config/redis.js";

const app = express();

app.use(express.json());
app.use(cookieParser()); 
app.use("/api/auth", authRouter);
app.use("/api/users", allUsersRoute); 

app.use((err, req, res, next) => {
  console.error("Global Error =>", err);
  res.status(500).json({ success: false, message: err.message });
});




// Connect DB first, then start server
connectDB()
  .then(() => {
    app.listen(3000, () => {
      console.log("Server is Running....");
    });
  })
  .catch((err) => {
    console.log("DB Failed:", err.message);
  });