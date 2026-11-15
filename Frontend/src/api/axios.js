import axios from "axios";

const axiosService = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  // Render's free tier can take ~50s to wake from sleep on the first request
  timeout: 60000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// A 401 on these URLs is a real answer (bad credentials / refresh failed),
// so never try to refresh for them.
const NO_REFRESH_URLS = ["/auth/login", "/auth/register", "/auth/refresh"];
// A failed /auth/me just means "not logged in" — no redirect needed.
const NO_REDIRECT_URLS = ["/auth/me"];

const matches = (url, list) => list.some((u) => url.includes(u));

// Share one in-flight refresh between all requests that 401 at the same time
let refreshPromise = null;
const refreshSession = () => {
  if (!refreshPromise) {
    refreshPromise = axiosService
      .post("/auth/refresh")
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

axiosService.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const url = original?.url || "";

    if (
      error.response?.status !== 401 ||
      !original ||
      original._retried ||
      matches(url, NO_REFRESH_URLS)
    ) {
      return Promise.reject(error);
    }

    // Access token (30 min) probably expired: refresh it once, then replay
    // the original request. Only if that fails do we send the user to login.
    original._retried = true;
    try {
      await refreshSession();
      return axiosService(original);
    } catch {
      if (!matches(url, NO_REDIRECT_URLS)) {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }
  },
);

export default axiosService;
