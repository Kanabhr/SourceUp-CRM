import { AsyncHandler } from "../Utils/AsyncHandler.js";
import { User } from "../MongoDB/Models/User.schema.js";
import { AuditLog } from "../MongoDB/Models/AuditLog.schema.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { ValidPassword, ValidEmail, ValidUserName, InputValidation } from "../Utils/Validation.js";

const ROLES = ["superadmin", "sales", "purchase", "manager"];

const createUser = AsyncHandler(async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!InputValidation(email) || !InputValidation(username) || !InputValidation(password) || !InputValidation(role)) {
    throw new ApiError(400, "One of the fields is empty");
  }
  if (!ROLES.includes(role)) {
    throw new ApiError(400, "Invalid role");
  }
  if (!ValidPassword(password) || !ValidUserName(username) || !ValidEmail(email)) {
    throw new ApiError(400, "Validation gone wrong");
  }

  const ExistingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (ExistingUser) {
    throw new ApiError(409, "User already Exists");
  }

  const user = await User.create({
    username,
    email,
    password,
    role,
  });

  const createdUser = await User.findById(user._id).select("-password -RefreshToken");
  if (!createdUser) {
    throw new ApiError(500, "Server error while creating user");
  }

  await AuditLog.create({
    userId: req.user._id,
    action: "CREATE_USER",
    entity: "User",
    entityId: createdUser._id,
    newValue: { username: createdUser.username, role: createdUser.role, email: createdUser.email },
  });

  res.status(201).json(new ApiResponse(201, createdUser, "User created successfully"));
});

const getUsers = AsyncHandler(async (req, res) => {
  const users = await User.find().select("-password -RefreshToken").sort({ createdAt: -1 });
  res.status(200).json(new ApiResponse(200, users, "Users fetched"));
});

/**
 * PATCH /api/v1/users/:id
 * Update a user's role and/or active status.
 * Body: { role?, isActive? }
 */
const updateUser = AsyncHandler(async (req, res) => {
  const { role, isActive } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");

  // Prevent self-deactivation
  if (req.user._id.toString() === user._id.toString() && isActive === false) {
    throw new ApiError(400, "You cannot deactivate your own account");
  }

  // Prevent demoting the last superadmin
  if (user.role === "superadmin" && role && role !== "superadmin") {
    const superadminCount = await User.countDocuments({ role: "superadmin", isActive: true });
    if (superadminCount <= 1) {
      throw new ApiError(400, "Cannot demote the last active superadmin");
    }
  }

  const oldRole = user.role;
  const oldActive = user.isActive;

  if (role !== undefined) {
    if (!ROLES.includes(role)) throw new ApiError(400, "Invalid role");
    user.role = role;
  }
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();

  const updated = await User.findById(user._id).select("-password -RefreshToken");

  await AuditLog.create({
    userId: req.user._id,
    action: "UPDATE_USER",
    entity: "User",
    entityId: user._id,
    oldValue: { role: oldRole, isActive: oldActive },
    newValue: { role: user.role, isActive: user.isActive },
  });

  res.status(200).json(new ApiResponse(200, updated, "User updated"));
});

export { createUser, getUsers, updateUser };
