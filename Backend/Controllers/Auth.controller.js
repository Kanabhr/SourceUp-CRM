import { AsyncHandler } from "../Utils/AsyncHandler.js";
import { User } from "../MongoDB/Models/User.schema.js";
import { AuditLog } from "../MongoDB/Models/AuditLog.schema.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { ValidPassword, ValidEmail, ValidUserName, InputValidation } from "../Utils/Validation.js";
import bcrypt from "bcrypt";

const generateAccessandRefreshToken = async (userid) => {
  try {
    const user = await User.findById(userid);
    const accesstoken = user.generateAccessToken();
    const refreshtoken = user.generateRefreshToken();
    user.RefreshToken = refreshtoken;
    await user.save({ validateBeforeSave: false });
    return { accesstoken, refreshtoken };
  } catch (error) {
    throw new ApiError(500, "Error while token generation");
  }
};

const register = AsyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!InputValidation(email) || !InputValidation(username) || !InputValidation(password)) {
    throw new ApiError(400, "One of the fields is empty");
  }

  const existingUsers = await User.countDocuments();
  // Allow multiple superadmin accounts during development.
  // TODO: re-enable this check before production deployment.
  // if (existingUsers > 0) {
  //   throw new ApiError(403, "Registration is closed. Ask a SuperAdmin to create your account.");
  // }

  if (!ValidPassword(password) || !ValidUserName(username) || !ValidEmail(email)) {
    throw new ApiError(400, "Validation gone wrong");
  }

  const user = await User.create({
    username,
    email,
    password,
    role: "superadmin",
  });

  const createdUser = await User.findById(user._id).select("-password -RefreshToken");
  if (!createdUser) {
    throw new ApiError(500, "Server error while registering user");
  }

  await AuditLog.create({
    userId: createdUser._id,
    action: "REGISTER",
    entity: "User",
    entityId: createdUser._id,
    newValue: { username: createdUser.username, role: createdUser.role },
  });

  res.status(201).json(new ApiResponse(201, createdUser, "User Registered Successfully"));
});

const login = AsyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if ([username, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "One of the fields is empty");
  }
  const CheckUser = await User.findOne({ username });
  if (!CheckUser) {
    throw new ApiError(404, "User doesn't exist please register first");
  }
  if (!CheckUser.isActive) {
    throw new ApiError(403, "Account is inactive");
  }
  const IsPasswordCorrect = await bcrypt.compare(password, CheckUser.password);
  if (!IsPasswordCorrect) {
    throw new ApiError(401, "Wrong user credentials entered");
  }
  const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};
  const safeUser = await User.findById(CheckUser._id).select("-password -RefreshToken");
  const { accesstoken, refreshtoken } = await generateAccessandRefreshToken(CheckUser._id);

  await AuditLog.create({
    userId: CheckUser._id,
    action: "LOGIN",
    entity: "User",
    entityId: CheckUser._id,
  });

  return res
    .status(200)
    .cookie("accessToken", accesstoken, cookieOptions)
    .cookie("refreshToken", refreshtoken, cookieOptions)
    .json({
      message: "User Logged In",
      user: safeUser,
    });
});

const logout = AsyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { RefreshToken: 1 },
    },
    { new: true },
  );

  await AuditLog.create({
    userId: req.user._id,
    action: "LOGOUT",
    entity: "User",
    entityId: req.user._id,
  });
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};
  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User Logged Out"));
});

const getCurrentUser = AsyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, req.user, "User fetched"));
});

export { register, login, logout, getCurrentUser };
