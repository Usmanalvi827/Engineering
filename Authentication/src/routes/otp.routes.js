import express from "express";
import { otpGenerateController, verifyOtpController } from "../controllers/otp.controller.js";
const otpRoutes = express.Router();

otpRoutes.post("/generate-otp", otpGenerateController);
otpRoutes.get("/verify-otp", verifyOtpController);

export default otpRoutes;