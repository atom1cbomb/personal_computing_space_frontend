import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const forbidden = /credential|token|secret|password|private_key|kubeconfig|endpoint|url/i;
const detailFields = ["actions", "state", "plan", "run", "driver", "execution_id", "execution_epoch", "closure_version", "snapshot_digest", "schema", "dependencies", "package_id", "package_version"];
const actionFields = ["uri", "name", "description", "interaction", "mode", "permissions", "effect_class", "side_effects", "available", "unavailable_reason", "arguments_schema", "input_schema", "result_schema", "output_schema"];

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !forbidden.test(key)).map(([key, item]) => [key, scrub(item)]));
  return value;
}

function schema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(schema);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !["default", "examples", "const"].includes(key)).map(([key, item]) => [key, schema(item)]));
  return value;
}

function action(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(actionFields.filter((key) => value[key] !== undefined).map((key) => [key, key.endsWith("_schema") ? schema(value[key]) : scrub(value[key])]));
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const catalogTokenFile = env.CATALOG_TOKEN_FILE || "/opt/loom-production/catalog/secrets/catalog-api-token";
  const observerTokenFile = env.OBSERVER_TOKEN_FILE || "/opt/loom-production/observer/secrets/grip_token";
  const catalogToken = existsSync(catalogTokenFile) ? readFileSync(catalogTokenFile, "utf8").trim() : "";
  const observerToken = existsSync(observerTokenFile) ? readFileSync(observerTokenFile, "utf8").trim() : "";
  const observerUrl = env.OBSERVER_URL || "http://127.0.0.1:8080";
  const proxyToken = env.VITE_CATALOG_PROXY_TOKEN;
  const workspaceRoot = `grip://${env.GRIP_AUTHORITY || "loom.local"}/workspaces/${env.WORKSPACE_ID || "workspace-default"}/`;
  return {
    plugins: [react(), { name: "catalog-read-only-proxy", configureServer(server) {
      server.middlewares.use("/catalog", (request, response, next) => {
        if (!proxyToken || request.headers.authorization !== `Bearer ${proxyToken}`) {
          response.statusCode = 401;
          response.end("Catalog authentication required");
          return;
        }
        next();
      });
      server.middlewares.use("/observer/describe", async (request, response) => {
        response.setHeader("Content-Type", "application/json");
        if (!proxyToken || request.headers.authorization !== `Bearer ${proxyToken}`) {
          response.statusCode = 401;
          response.end(JSON.stringify({ error: "authentication_required" }));
          return;
        }
        if (request.method !== "GET") {
          response.statusCode = 405;
          response.end(JSON.stringify({ error: "method_not_allowed" }));
          return;
        }
        const uri = new URL(request.url || "", "http://localhost").searchParams.get("uri") || "";
        if (!uri.startsWith(workspaceRoot) || uri.length > 2048 || !observerToken) {
          response.statusCode = 400;
          response.end(JSON.stringify({ error: "invalid_resource" }));
          return;
        }
        const payload = {
          version: "grip.v1", request_id: randomUUID(), method: "DESCRIBE",
          auth: { scheme: "bearer", credential: observerToken }, target: uri,
          accepted_protocols: [observerUrl.startsWith("https:") ? "https-json.v1" : "loom-http-json.v1"],
          deadline: new Date(Date.now() + 15000).toISOString(),
        };
        try {
          const upstream = await fetch(`${observerUrl.replace(/\/$/, "")}/.well-known/grip`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(16000),
          });
          const message = await upstream.json() as any;
          if (!upstream.ok || message.kind !== "reply" || message.request_id !== payload.request_id || message.body?.resource?.uri !== uri) {
            response.statusCode = message.error_code === "not_found" ? 404 : 502;
            response.end(JSON.stringify({ error: message.error_code || "observer_unavailable" }));
            return;
          }
          const metadata = message.body.resource.metadata || {};
          const details = Object.fromEntries(detailFields.filter((key) => metadata[key] !== undefined).map((key) => [key, key === "actions" && Array.isArray(metadata.actions) ? metadata.actions.map(action) : scrub(metadata[key])]));
          response.end(JSON.stringify({ uri, mcue: message.body.resource.mcue, attributes: scrub(metadata.attributes || {}), details }));
        } catch {
          response.statusCode = 502;
          response.end(JSON.stringify({ error: "observer_unavailable" }));
        }
      });
    } }],
    server: {
      host: "0.0.0.0", port: 4173,
      proxy: {
        "/catalog": { target: env.CATALOG_URL || "http://127.0.0.1:18081", changeOrigin: true, rewrite: (path: string) => path.replace(/^\/catalog/, ""), headers: { authorization: `Bearer ${catalogToken}` } },
      },
    },
    test: { environment: "jsdom", setupFiles: "./src/test/setup.ts", globals: true },
  };
});
