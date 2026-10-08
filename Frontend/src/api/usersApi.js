import axiosService from "./axios.js";

const getUsers = () => axiosService.get("/users");
const createUser = (data) => axiosService.post("/users", data);

export { getUsers, createUser };
