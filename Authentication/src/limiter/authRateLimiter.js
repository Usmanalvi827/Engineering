import redis from "../config/redis.js";

const authRateLimiter = async (req, res, next) => {
  const ip = req.ip;
  const key = await redis.incr(`authLimit:${ip}`);

  if (key >= 5) {
    res.status(429).json({
      message: "Too many login attempts from this IP",
    });
  }

  if (key === 1) {
    redis.expire(`authLimit:${ip}`, 10);
  }

  console.log(key);
};

export default authRateLimiter;
