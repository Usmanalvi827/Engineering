import express from "express";
import {
  getMyProfile,
  loginController,
  logoutController,
  refreshTokenController,
  registerController,
} from "../controllers/auth.controller.js";
import authUser from "../middleware/auth.middleware.js";
const authRouter = express.Router();

authRouter.post("/register", registerController);
authRouter.post("/login", loginController);
authRouter.post("/refreshToken", refreshTokenController);
authRouter.get("/get-me", authUser, getMyProfile);
authRouter.post("/logout", logoutController);

export default authRouter;
