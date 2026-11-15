import axiosService from "./axios.js";

/**
 * Export CRM data as a file download (blob).
 *
 * @param {string} entity    - leads | deals | vendors | quotations
 * @param {string} format    - csv | json
 * @param {string} startDate - ISO date string (optional)
 * @param {string} endDate   - ISO date string (optional)
 * @returns {Promise<AxiosResponse>} response with responseType: "blob"
 */
const exportData = (entity, format, startDate, endDate) =>
  axiosService.get("/export", {
    params: { entity, format, startDate, endDate },
    responseType: "blob",
    // Increase timeout for large data sets
    timeout: 60000,
  });

export { exportData };
