import redis from "../config/redis.js";
import userModel from "../models/users.model.js";

async function otpGenerateController(phonenumber) {
  const redisOTP = Math.floor(100000 + Math.random() * 900000).toString();

  await redis.set(`otp:${phonenumber}`, JSON.stringify(redisOTP), "EX", 40);

  return redisOTP;
}

async function verifyOtpController(req, res) {
  try {
    const { phonenumber, otp } = req.body;

    let cleaned = String(phonenumber).replace(/[\s\-()]/g, "");
    if (cleaned.startsWith("+92")) {
      cleaned = "0" + cleaned.slice(3);
    }

    const savedOtp = await redis.get(`otp:${cleaned}`);
    console.log("savedOTP ==< ", savedOtp);

    if (!savedOtp) {
      return res.status(400).json({ message: "OTP expired" });
    }

    if (JSON.parse(savedOtp) !== String(otp)) {
      return res.status(400).json({ message: "Wrong OTP" });
    }

    const userDataString = await redis.get(`userRedis:${cleaned}`);
    if (!userDataString) {
      return res.status(400).json({ message: "Session expired, register again" });
    }

    // 2. String ko wapis object banaya
    const userData = JSON.parse(userDataString);

    const newUser = await userModel.create(userData);

    await redis.del(`otp:${cleaned}`);
    await redis.del(`userRedis:${cleaned}`);

    return res.status(201).json({
      message: "Account created successfully",
      user: {
        id: newUser._id,
        phoneNumber: newUser.phonenumber,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export { otpGenerateController, verifyOtpController };
