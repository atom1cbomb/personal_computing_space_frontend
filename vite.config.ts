import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const catalogTokenFile = env.CATALOG_TOKEN_FILE || "/opt/loom-production/catalog/secrets/catalog-api-token";
  const catalogToken = existsSync(catalogTokenFile) ? readFileSync(catalogTokenFile, "utf8").trim() : "";
  return {
  plugins: [react(), { name: "catalog-auth", configureServer(server) {
    server.middlewares.use("/catalog", (request, response, next) => {
      if (!env.VITE_OBSERVER_TOKEN || request.headers.authorization !== `Bearer ${env.VITE_OBSERVER_TOKEN}`) {
        response.statusCode = 401;
        response.end("Catalog authentication required");
        return;
      }
      next();
    });
  } }],
  server: {
    host: "0.0.0.0",
    port: 4173,
    proxy: {
      "/api": { target: env.VITE_OBSERVER_URL, changeOrigin: true, secure: false },
      "/.well-known": { target: env.VITE_OBSERVER_URL, changeOrigin: true, secure: false },
      "/catalog": { target: env.CATALOG_URL || "http://127.0.0.1:18081", changeOrigin: true, rewrite: (path: string) => path.replace(/^\/catalog/, ""), headers: { authorization: `Bearer ${catalogToken}` } },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
  },
  };
});
