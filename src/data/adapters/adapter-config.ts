export type AdapterConfig = {
  mode: "fixture" | "observer";
  observerUrl?: string;
  catalogUrl?: string;
  catalogToken?: string;
  useProxy: boolean;
  workspaceId: string;
  gripAuthority: string;
  token?: string;
  allowInsecureHttp: boolean;
};

const storageKey = "pcs.adapter-config";

export function readAdapterConfig(storage?: Storage): AdapterConfig {
  const env = import.meta.env;
  const runtimeStorage = storage ?? (typeof sessionStorage !== "undefined" ? sessionStorage : undefined);
  let saved: Partial<AdapterConfig> = {};
  try { saved = JSON.parse(runtimeStorage?.getItem(storageKey) ?? "{}") as Partial<AdapterConfig>; } catch { saved = {}; }
  const mode = saved.mode ?? env.VITE_DATA_MODE ?? "observer";
  const useProxy = saved.useProxy ?? env.VITE_OBSERVER_PROXY === "true";
  return {
    mode: mode === "observer" ? "observer" : "fixture",
    observerUrl: saved.observerUrl ?? (env.VITE_OBSERVER_PROXY === "true" ? "" : env.VITE_OBSERVER_URL) ?? "",
    catalogUrl: saved.catalogUrl ?? (env.VITE_OBSERVER_PROXY === "true" ? "/catalog" : env.VITE_CATALOG_URL) ?? "/catalog",
    catalogToken: saved.catalogToken ?? env.VITE_CATALOG_TOKEN,
    useProxy,
    workspaceId: saved.workspaceId ?? env.VITE_WORKSPACE_ID ?? "workspace-default",
    gripAuthority: saved.gripAuthority ?? env.VITE_GRIP_AUTHORITY ?? "loom.local",
    token: saved.token ?? env.VITE_OBSERVER_TOKEN,
    allowInsecureHttp: saved.allowInsecureHttp ?? env.VITE_ALLOW_INSECURE_HTTP === "true",
  };
}

export { storageKey as adapterConfigStorageKey };
