import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  server: {
    proxy: {
      "/api/v1": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        secure: false,
      },
      // Reference photos (and other uploads) are served by the backend at the
      // root via express.static("public"), so /uploads/leads/<file> lives on
      // the API origin — proxy it in dev so thumbnails resolve.
      "/uploads": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
