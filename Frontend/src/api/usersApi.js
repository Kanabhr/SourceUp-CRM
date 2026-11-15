import axiosService from "./axios.js";

const getUsers = () => axiosService.get("/users");
const createUser = (data) => axiosService.post("/users", data);
const updateUser = (id, data) => axiosService.patch(`/users/${id}`, data);

export { getUsers, createUser, updateUser };
