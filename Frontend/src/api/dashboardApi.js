import axiosService from "./axios.js";

/** GET /dashboard — returns { deals, leads } KPI snapshot for manager/superadmin */
const getDashboard = () => axiosService.get("/dashboard");

export { getDashboard };
