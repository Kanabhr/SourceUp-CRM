import axiosService from "./axios.js";

const registerUser = (data) => axiosService.post("/auth/register", data);
const LoginUser = (data) => axiosService.post("/auth/login", data);
const LogoutUser = () => axiosService.post("/auth/logout");
const getCurrentUser = () => axiosService.get("/auth/me");

export { registerUser, LoginUser, LogoutUser, getCurrentUser };
