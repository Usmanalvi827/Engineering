import jwt from "jsonwebtoken";

function authUser(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
 
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_KEY);
    // console.log(decoded);
    req.user = decoded.userId;
    next();
    // console.log("decoded ==> ", decoded);
  } catch (err) {
    // console.log(err.message);
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Access token expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
}

export default authUser;
