import { randomInt } from "node:crypto";
import redis from "../config/redis.js";
import userModel from "../models/users.model.js";

const OTP_TTL_SECONDS = 30;

function getOtpSessionKey(userId) {
  return `otpSession:${userId}`;
}

async function generateOtpController(req, res) {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({
        message: "OTP delivery is not configured for production.",
      });
    }

    const phonenumber =
      typeof req.body?.phonenumber === "string"
        ? req.body.phonenumber.trim()
        : "";

    if (!phonenumber) {
      return res.status(400).json({ message: "Phone number is required." });
    }

    const user = await userModel.findOne({ phonenumber });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const otp = String(randomInt(100000, 1000000));
    await redis.set(getOtpSessionKey(user._id), otp, "EX", OTP_TTL_SECONDS);

    return res.status(200).json({
      message: "OTP generated successfully.",
      otp,
      expiresIn: OTP_TTL_SECONDS,
    });
  } catch (error) {
    console.error("Generate OTP Error:", error.message);
    return res.status(500).json({ message: "Unable to generate OTP." });
  }
}

async function verifyOtpController(req, res) {
  try {
    const phonenumber =
      typeof req.body?.phonenumber === "string"
        ? req.body.phonenumber.trim()
        : "";
    const otp = String(req.body?.otp ?? "");

    if (!phonenumber || !/^\d{6}$/.test(otp)) {
      return res
        .status(400)
        .json({ message: "A phone number and six-digit OTP are required." });
    }

    const user = await userModel.findOne({ phonenumber });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const consumed = await redis.eval(
      "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
      1,
      getOtpSessionKey(user._id),
      otp,
    );

    if (consumed !== 1) {
      return res.status(400).json({ message: "OTP is invalid or expired." });
    }

    return res.status(200).json({ message: "OTP verified successfully." });
  } catch (error) {
    console.error("Verify OTP Error:", error.message);
    return res.status(500).json({ message: "Unable to verify OTP." });
  }
}

export { generateOtpController, verifyOtpController };
