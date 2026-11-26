import userModel from "../models/users.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import redis from "../config/redis.js";
import { json } from "express";
import {
  otpGenerateController,
  verifyOtpController,
} from "./otp.controller.js";

async function registerController(req, res) {
  try {
    let {
      firstname,
      lastname,
      username,
      phonenumber,
      email,
      password,
      confirmPassword,
    } = req.body;

    if (
      !firstname ||
      !lastname ||
      !username ||
      !phonenumber ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (!phonenumber) {
      return res.status(400).json({
        message: "Phone number is required",
      });
    }

    let cleaned = String(phonenumber).replace(/[\s\-()]/g, "");

    if (cleaned.startsWith("+92")) {
      cleaned = "0" + cleaned.slice(3);
    } else if (cleaned.startsWith("92") && cleaned.length === 12) {
      cleaned = "0" + cleaned.slice(2);
    }

    const pakistaniRegex = /^03\d{9}$/;

    if (!pakistaniRegex.test(cleaned)) {
      return res.status(400).json({
        message: "Please enter a correct phone number like 03001234567",
      });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const isUserExist = await userModel.findOne({
      $or: [{ email }, { phonenumber: cleaned }],
    });

    if (isUserExist) {
      return res
        .status(400)
        .json({ message: "PhoneNumber or email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    redis.set(
      `userRedis:${cleaned}`,
      JSON.stringify({
        firstname,
        lastname,
        username,
        phonenumber: cleaned,
        email,
        password: hashedPassword,
      }),
      "EX",
      300,
    );

    const otp = await otpGenerateController(cleaned);
    console.log("OTP FROM controller", otp);
    return res.json({ message: "OTP sent to your number", phonenumber: cleaned });

  } catch (error) {
    await redis.del(`otp:${cleaned}`);
    console.error("Register Error Details:", error.message);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on our end. Please try again later.",
    });
  }
}

async function loginController(req, res) {
  try {
    const { phonenumber, password } = req.body;

    if (!phonenumber || !password) {
      return res.status(400).json({ message: "All Fileds Are Required" });
    }

    const user = await userModel.findOne({ phonenumber });

    if (!user) {
      return res.status(400).json({ message: "Please Create Account" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }

    const accessToken = jwt.sign(
      { userId: user._id, phoneNumber: user.phonenumber },
      process.env.ACCESS_TOKEN_KEY,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign(
      { userId: user._id, phoneNumber: user.phonenumber },
      process.env.REFRESH_TOKEN_KEY,
      { expiresIn: "7d" },
    );

    const sessionLoginRefreshToken = {
      refreshToken,
      createdAt: new Date().toISOString(),
      device: req.headers["user-agent"] || "Unknown",
      ipAddress: req.ip || req.connection.remoteAddress || "Unknown",
    };

    await redis.set(
      `authSession:${user._id}`,
      JSON.stringify(sessionLoginRefreshToken),
      { EX: 10 }, // 10 seconds
    );
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, // JS can't access it
      secure: true,
      sameSite: "strict", // prevents CSRF attack
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days expiry
    });

    return res.status(201).json({
      message: "Login successful.",
      user: {
        id: user._id,
        firstName: user.firstname,
        lastName: user.lastname,
        username: user.username,
        phonenumber: user.phonenumber,
        email: user.email,
      },
      accessToken: accessToken,
    });
  } catch (error) {
    console.error("Login Error Details:", error.message);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on our end. Please try again later.",
    });
  }
}

async function refreshTokenController(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: "No token provided!" });
    }

    const decodeRefreshToken = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_KEY,
    );

    const newAccessToken = jwt.sign(
      {
        userId: decodeRefreshToken.userId,
        phonenumber: decodeRefreshToken.phonenumber,
      },
      process.env.ACCESS_TOKEN_KEY,
      { expiresIn: "15m" },
    );

    return res.status(200).json({
      message: "Token refreshed successfully.",
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Refresh-Token Error Details:", error.message);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on our end. Please try again later.",
    });
  }
}

async function getMyProfile(req, res) {
  try {
    const userId = req.user;

    const cacheKey = `user:${userId}`;
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      console.log("Cache HITT");

      const data = JSON.parse(cachedData);

      return res.json({
        data: data,
      });
    } else {
      const user = await userModel.findById(userId).select("-password");

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await redis.set(cacheKey, JSON.stringify(user), "EX", 60);

      return res.status(200).json({
        message: "Registration Details Fetched Successfully!!",
        data: user,
      });
    }
  } catch (error) {
    console.error("Get-me Error Details:", error.message);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on our end. Please try again later.",
    });
  }
}

async function logoutController(req, res) {
  try {
    const token = req.cookies.refreshToken;
    console.log(token);

    if (!token) {
      return res.status(200).json({ message: "Already logged out" });
    }

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false, // set true in production with https
      sameSite: "strict",
    });

    return res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout Error Details:", error.message);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on our end. Please try again later.",
    });
  }
}

export {
  registerController,
  loginController,
  refreshTokenController,
  getMyProfile,
  logoutController,
};
