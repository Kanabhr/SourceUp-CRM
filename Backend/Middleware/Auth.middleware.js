import { AsyncHandler } from "../Utils/AsyncHandler.js";
import { ApiError } from "../Utils/ApiError.js";
import { User } from "../MongoDB/Models/User.schema.js";
import jwt from "jsonwebtoken";

const VerifyJWT = AsyncHandler(async (req, _res, next) => {
  try {
    const Token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
    if (!Token) {
      throw new ApiError(401, "Unauthorized user");
    }
    const DecodedToken = jwt.verify(Token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(DecodedToken?._id).select("-password -RefreshToken");
    if (!user) {
      throw new ApiError(401, "Invalid Token");
    }
    if (!user.isActive) {
      throw new ApiError(403, "Account is inactive");
    }
    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(error.statuscode || 401, error.message || "Invalid Access Token");
  }
});

const requireRole = (...roles) =>
  AsyncHandler(async (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ApiError(403, "You do not have permission to access this resource");
    }
    next();
  });

export { VerifyJWT, requireRole };
