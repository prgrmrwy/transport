import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const isTauriBuild = !!process.env.TAURI_ENV_PLATFORM;
// @ts-expect-error process is a nodejs global
const isDev = process.env.NODE_ENV !== "production";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(isDev ? {
      babel: {
        plugins: [await import("@locator/babel-jsx").then((m) => m.default)],
      },
    } : {}),
    tailwindcss(),
  ],
  // dev server: base = / (直接访问 localhost:1420)
  // production build for axum: base = /app/
  // Tauri build: base = /
  base: isDev ? "/" : isTauriBuild ? "/" : "/app/",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || "0.0.0.0",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    // 代理 API 请求到 axum 后端
    proxy: {
      "/api": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
    },
  },
}));
