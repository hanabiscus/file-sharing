import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://dk7lvukl3cd5w.cloudfront.net",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
      },
    },
  },
});
