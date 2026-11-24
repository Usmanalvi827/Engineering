import express from "express";
import {
  generateOtpController,
  verifyOtpController,
} from "../controllers/otp.controller.js";

const otpRoutes = express.Router();

otpRoutes.post("/generate", generateOtpController);
otpRoutes.post("/verify", verifyOtpController);

export default otpRoutes;