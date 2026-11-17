export type AdapterConfig = {
  catalogUrl: string;
  proxyToken?: string;
};

const storageKey = "pcs.adapter-config";

export function readAdapterConfig(storage?: Storage): AdapterConfig {
  const env = import.meta.env;
  const runtimeStorage = storage ?? (typeof sessionStorage !== "undefined" ? sessionStorage : undefined);
  let saved: Partial<AdapterConfig> = {};
  try { saved = JSON.parse(runtimeStorage?.getItem(storageKey) ?? "{}") as Partial<AdapterConfig>; } catch { saved = {}; }
  return {
    catalogUrl: saved.catalogUrl ?? "/catalog",
    proxyToken: saved.proxyToken ?? env.VITE_CATALOG_PROXY_TOKEN,
  };
}

export { storageKey as adapterConfigStorageKey };
