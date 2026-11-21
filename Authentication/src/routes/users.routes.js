import express from "express";
import authUser from "../middleware/auth.middleware.js";
const allUsersRoute = express.Router();

allUsersRoute.get("/", authUser, (req, res) => {
    // console.log("testingggg")


    
  res.json({
    message: "All Services",
  });
});

export default allUsersRoute;