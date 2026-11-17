import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CatalogAdapter, UnavailableCatalogAdapter } from "../data/adapters/catalog-adapter";
import { readAdapterConfig } from "../data/adapters/adapter-config";
import { CatalogClient } from "../data/catalog/client";
import type { CapabilityPackage, Resource, Activation } from "../domain/models";
import { getStatusLabel, getStatusTone } from "../domain/status";

const config = readAdapterConfig();
const catalogReady = Boolean(config.proxyToken);
const adapter = catalogReady
  ? new CatalogAdapter(new CatalogClient({ catalogUrl: config.catalogUrl, proxyToken: config.proxyToken! }))
  : new UnavailableCatalogAdapter("Resource Catalog proxy token is required.");

type View = "overview" | "resources" | "packages" | "activations";
type ResourceScope = "all" | "compute" | "driver" | "slave" | "vm" | "plan" | "run";
type LifecycleFilter = "all" | "active" | "retired" | "archived" | "expired";
type ResourceMarker = { label: string; colorClass: string };

function markerForIndex(index: number): ResourceMarker {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return { label, colorClass: `marker-color-${index % 8}` };
}

type CatalogSnapshot = { resources: Resource[]; packages: CapabilityPackage[]; activations: Activation[] };
const snapshotStorageKey = "pcs.catalog-snapshot";
let snapshotCache: CatalogSnapshot | undefined;
let snapshotRequest: Promise<CatalogSnapshot> | null = null;

try {
  const stored = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(snapshotStorageKey) : null;
  if (stored) snapshotCache = JSON.parse(stored) as CatalogSnapshot;
} catch {
  snapshotCache = undefined;
}

function loadCatalogSnapshot(): Promise<CatalogSnapshot> {
  if (snapshotRequest) return snapshotRequest;
  snapshotRequest = Promise.all([adapter.listResources(), adapter.listPackages(), adapter.listActivations()])
    .then(([resources, packages, activations]) => {
      const next = { resources, packages, activations };
      snapshotCache = next;
      try {
        sessionStorage.setItem(snapshotStorageKey, JSON.stringify(next));
      } catch {
        /* cache is optional */
      }
      return next;
    })
    .finally(() => {
      snapshotRequest = null;
    });
  return snapshotRequest;
}

function Badge({ status }: { status: string }) {
  const tone = getStatusTone(status as never);
  const label = getStatusLabel(status as never) || status;
  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore clipboard error */
    }
  };
  return (
    <button className="copy-btn" onClick={handleCopy} title="Copy to clipboard" type="button">
      {copied ? "✓ Copied" : label}
    </button>
  );
}

function ActionCard({
  action,
}: {
  action: CapabilityPackage["actions"][number];
}) {
  const effectClass =
    action.sideEffects === "destructive"
      ? "tag-danger"
      : action.sideEffects === "write"
      ? "tag-warning"
      : "tag-info";

  return (
    <article className="action-card">
      <div className="action-head">
        <div>
          <div className="action-title-row">
            <strong>{action.name}</strong>
            {action.sideEffects && <span className={`tag ${effectClass}`}>{action.sideEffects} effect</span>}
            {action.interaction && <span className="tag tag-neutral">{action.interaction}</span>}
          </div>
          {action.description && <p>{action.description}</p>}
          <code className="detail-uri">{action.id}</code>
        </div>
      </div>
      {action.permissions.length > 0 && (
        <div className="action-meta">
          <span className="action-meta-label">Permissions:</span>
          {action.permissions.map((perm) => (
            <span key={perm} className="tag tag-dim">
              {perm}
            </span>
          ))}
        </div>
      )}
      {action.inputSchema && (
        <pre className="json-block action-schema">{JSON.stringify(action.inputSchema, null, 2)}</pre>
      )}
      {action.available === false && <p className="notice">{action.unavailableReason ?? "Unavailable"}</p>}
      <p className="muted detail-empty">Displayed for discovery only. Actions are executed outside this console.</p>
    </article>
  );
}

function NavGroup({
  id,
  label,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="nav-section" data-section={id}>
      <button className="nav-group-trigger" onClick={onToggle} aria-expanded={expanded}>
        <span>
          <i className={`nav-chevron ${expanded ? "expanded" : ""}`}>›</i>
          {label}
        </span>
      </button>
      {expanded && <div className="nav-children">{children}</div>}
    </section>
  );
}

type MapTarget = "packages" | "activations" | "driver" | "slave" | "vm" | "plan" | "run";

export function packageLabel(packageId: string, packages: CapabilityPackage[]): string {
  const pkg = packages.find((item) => item.id === packageId);
  if (pkg) return `${pkg.name} · ${pkg.version}`;
  const match = packageId.match(/\/packages\/([^/]+)\/([^/]+)$/);
  if (match) return `${decodeURIComponent(match[1])} · ${decodeURIComponent(match[2])}`;
  return packageId === "unknown-package" ? "Unknown package" : packageId;
}

function routeFromHash(): { view: View; scope: ResourceScope } {
  const path = typeof window === "undefined" ? "" : window.location.hash;
  if (path === "#/packages" || path === "#/activations") return { view: path.slice(2) as View, scope: "all" };
  const scope = path.match(/^#\/resources\/(driver|slave|vm|plan|run)$/)?.[1] as ResourceScope | undefined;
  return scope ? { view: "resources", scope } : { view: "overview", scope: "all" };
}

function WorkspaceMap({
  packages,
  activations,
  resources,
  onNavigate,
}: {
  packages: CapabilityPackage[];
  activations: Activation[];
  resources: Resource[];
  onNavigate: (target: MapTarget) => void;
}) {
  const count = (kind: string) => resources.filter((item) => item.kind === kind).length;

  const node = (target: MapTarget, label: string, value: number, icon: string) => (
    <a
      className="map-node"
      href={target === "packages" || target === "activations" ? `#/${target}` : `#/resources/${target}`}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(target);
      }}
      aria-label={`Open ${label}, ${value} resources`}
    >
      <span className="map-node-icon">{icon}</span>
      <div className="map-node-info">
        <span className="map-node-label">{label}</span>
        <strong className="map-node-value">{value}</strong>
      </div>
      <span className="map-node-arrow" aria-hidden="true">
        →
      </span>
    </a>
  );

  return (
    <section className="content overview-content" aria-label="Workspace resource map">
      <div className="workspace-map">
        {/* Capability Group (Left) */}
        <div className="map-group map-capability">
          <div className="map-group-header">
            <div className="map-group-icon">◇</div>
            <div className="map-group-label">CAPABILITY</div>
          </div>
          <div className="map-group-nodes">
            {node("packages", "Packages", packages.length, "◫")}
            {node("activations", "Activations", activations.length, "⚡")}
          </div>
        </div>

        {/* Center Hub */}
        <div className="map-center">
          <div className="map-hub-glow" />
          <div className="map-hub">
            <div className="map-hub-rings">
              <div className="map-ring ring-outer" />
              <div className="map-ring ring-inner" />
            </div>
            <span className="map-center-kicker">WORKSPACE</span>
            <strong>
              PERSONAL
              <br />
              COMPUTING SPACE
            </strong>
            <span className="map-hub-status">
              <span className="online-dot" />
              ONLINE
            </span>
          </div>
        </div>

        {/* Compute Group (Right) */}
        <div className="map-group map-compute">
          <div className="map-group-header">
            <div className="map-group-icon">⬡</div>
            <div className="map-group-label">COMPUTE</div>
          </div>
          <div className="map-group-nodes">
            {node("driver", "Drivers", count("computing/driver"), "⊞")}
            {node("slave", "Slaves", count("computing/slave"), "⊟")}
            {node("vm", "VMs", count("computing/vm"), "▣")}
          </div>
        </div>

        {/* Execution Group (Bottom) */}
        <div className="map-group map-execution">
          <div className="map-group-header">
            <div className="map-group-icon">▷</div>
            <div className="map-group-label">EXECUTION</div>
          </div>
          <div className="map-execution-nodes">
            {node("plan", "Plans", count("execution/plan"), "◈")}
            {node("run", "Runs", count("execution/run"), "▶")}
          </div>
        </div>
      </div>
    </section>
  );
}

function ResourceDetail({
  selectedRes,
  packages,
}: {
  selectedRes: Resource;
  packages: CapabilityPackage[];
}) {
  const isExec = selectedRes.catalogCategory === "execution" || selectedRes.kind.startsWith("execution/");
  return (
    <div className="detail-wrapper">
      <div className="detail-heading">
        <div className="detail-title-block">
          <div className="detail-kicker-row">
            <span className="eyebrow">{isExec ? "RECORD" : "RESOURCE"}</span>
            <span className="tag tag-dim">{selectedRes.kind}</span>
          </div>
          <h2>{selectedRes.name}</h2>
          <div className="detail-uri-bar">
            <code className="detail-uri">{selectedRes.id}</code>
            <CopyButton text={selectedRes.id} label="Copy ID" />
          </div>
        </div>
        {!isExec && <Badge status={selectedRes.status} />}
      </div>

      {/* Relations Strip */}
      <div className="detail-section">
        <h3 className="section-label">Topology Relations</h3>
        {Object.keys(selectedRes.relations ?? {}).length === 0 ? (
          <p className="muted">No direct peer relations defined.</p>
        ) : (
          <div className="relation-strip">
            {Object.entries(selectedRes.relations ?? {})
              .filter(([, value]) => Boolean(value))
              .map(([key, value]) => (
                <div key={key} className="relation-card">
                  <small>{key.replace(/_/g, " ")}</small>
                  <strong>{value ? value.split("/").pop() : "—"}</strong>
                  <code className="relation-full-id">{value}</code>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Attributes Grid */}
      <div className="detail-section">
        <h3 className="section-label">{isExec ? "Record Attributes" : "Resource Attributes & Lifecycle"}</h3>
        <div className="attribute-grid">
          {!isExec && (
            <>
              <div>
                <small>lifecycle</small>
                <strong>{selectedRes.lifecycle ?? "unknown"}</strong>
              </div>
              <div>
                <small>available</small>
                <strong>{selectedRes.available ? "yes" : "no"}</strong>
              </div>
            </>
          )}
          {Object.entries(selectedRes.attributes)
            .filter(([key, value]) => value !== null && value !== undefined && value !== "")
            .map(([key, value]) => (
              <div key={key}>
                <small>{key.replaceAll("_", " ")}</small>
                <strong>{typeof value === "object" ? JSON.stringify(value) : String(value)}</strong>
              </div>
            ))}
        </div>
      </div>

      {/* Runtime Actions */}
      <div className="detail-section">
        <div className="panel-title panel-title-plain">
          <span>Available Runtime Actions ({selectedRes.actionIds.length})</span>
        </div>
        {selectedRes.actionIds.length === 0 ? (
          <p className="muted detail-empty">No runtime actions are advertised for this resource.</p>
        ) : (
          packages
            .flatMap((pkg) =>
              pkg.actions
                .filter((action) => selectedRes.actionIds.includes(action.id))
                .map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                  />
                ))
            )
        )}
      </div>
    </div>
  );
}

function Empty({ title, text, actionText, onAction }: { title: string; text: string; actionText?: string; onAction?: () => void }) {
  return (
    <div className="empty">
      <div className="empty-icon">⌁</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {actionText && onAction && (
        <button className="button button-primary empty-action" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
}

function ListView({
  title,
  items,
  selected,
  onSelect,
  detail,
  filterNode,
}: {
  title: string;
  items: {
    id: string;
    name: string;
    detail: string;
    status: string;
    hideStatus?: boolean;
    marker?: ResourceMarker;
    badgeExtra?: string;
  }[];
  selected?: string;
  onSelect: (id: string) => void;
  detail: ReactNode;
  filterNode?: ReactNode;
}) {
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(q) || item.detail.toLowerCase().includes(q) || item.id.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <section className="content catalog-content">
      <div className="list-layout">
        <section className="panel list-panel">
          <div className="panel-title">
            <div className="panel-title-main">
              <span>{filteredItems.length} {title}</span>
              {search && <small className="search-count-hint">filtered from {items.length}</small>}
            </div>
            {filterNode}
          </div>
          <div className="list-search-bar">
            <input
              type="text"
              placeholder={`Search ${title}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="list-search-input"
            />
            {search && (
              <button className="search-clear-btn" onClick={() => setSearch("")} title="Clear search">
                ×
              </button>
            )}
          </div>
          <div className="list-rows-scroll">
            {filteredItems.length === 0 ? (
              <div className="list-no-match">
                <span>No matching {title}</span>
              </div>
            ) : (
              filteredItems.map((item) => (
                <button
                  className={`list-row ${selected === item.id ? "selected" : ""}`}
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                >
                  <div className={`resource-icon ${item.marker?.colorClass ?? ""}`}>
                    {item.marker?.label ?? "✦"}
                  </div>
                  <div className="list-row-content">
                    <strong className="list-row-title">{item.name}</strong>
                    <small className="list-row-detail">{item.detail}</small>
                  </div>
                  <div className="list-row-meta">
                    {!item.hideStatus && <Badge status={item.status} />}
                  </div>
                  <span className="list-row-chevron">›</span>
                </button>
              ))
            )}
          </div>
        </section>
        <section className="panel detail-panel">{detail}</section>
      </div>
    </section>
  );
}

export function App() {
  const [view, setView] = useState<View>(() => routeFromHash().view);
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>("all");
  const [expandedNav, setExpandedNav] = useState<Record<string, boolean>>({ capability: true, compute: true, execution: true });
  const [resourceScope, setResourceScope] = useState<ResourceScope>(() => routeFromHash().scope);
  const [resources, setResources] = useState<Resource[]>([]);
  const [packages, setPackages] = useState<CapabilityPackage[]>([]);
  const [activations, setActivations] = useState<Activation[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>();
  const [selectedResource, setSelectedResource] = useState<string>();
  const [activationFilter, setActivationFilter] = useState<
    "all" | "ready" | "pending_auth" | "stopped" | "starting" | "stopping" | "degraded" | "failed"
  >("all");
  const [activationSearch, setActivationSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [notice, setNotice] = useState("Connecting to Loom…");
  const refreshInFlight = useRef<Promise<void> | null>(null);

  function applySnapshot(next: CatalogSnapshot) {
    setResources(next.resources);
    setPackages(next.packages);
    setActivations(next.activations);
  }

  function refresh() {
    if (refreshInFlight.current) return refreshInFlight.current;
    if (snapshotCache) {
      applySnapshot(snapshotCache);
      setConnectionError(false);
      setNotice("Connected to Loom");
    }
    const request = (async () => {
      setConnectionError(false);
      try {
        const next = await loadCatalogSnapshot();
        applySnapshot(next);
        setNotice("Connected to Loom");
      } catch (error) {
        setConnectionError(true);
        setNotice(`Connection error · ${error instanceof Error ? error.message : "request failed"}`);
      }
    })();
    refreshInFlight.current = request;
    void request.finally(() => {
      if (refreshInFlight.current === request) refreshInFlight.current = null;
    });
    return request;
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const route = routeFromHash();
      setView(route.view);
      setResourceScope(route.scope);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    setSelectedResource(undefined);
    setSelectedPackage(undefined);
  }, [view, resourceScope]);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    setNotice("Refreshing snapshot…");
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  const selectedPkg = packages.find((item) => item.id === selectedPackage);

  const visibleResources = resources.filter((item) => {
    const matchesScope =
      resourceScope === "all" ||
      (resourceScope === "compute" && item.catalogCategory === "compute") ||
      (resourceScope === "plan" && item.kind === "execution/plan") ||
      (resourceScope === "run" && item.kind === "execution/run") ||
      (["driver", "slave", "vm"].includes(resourceScope) && item.kind === `computing/${resourceScope}`);
    return (lifecycleFilter === "all" || item.lifecycle === lifecycleFilter) && matchesScope;
  });

  const selectedRes = visibleResources.find((item) => item.id === selectedResource);

  const visibleActivations = activations
    .filter((item) => activationFilter === "all" || item.status === activationFilter)
    .filter((item) => lifecycleFilter === "all" || item.lifecycle === lifecycleFilter)
    .filter((item) => {
      if (!activationSearch.trim()) return true;
      const q = activationSearch.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.packageId.toLowerCase().includes(q) ||
        item.slaveId.toLowerCase().includes(q)
      );
    });

  return (
    <div className="console-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">⌁</div>
          <div className="brand">
            <strong>LOOM</strong>
          </div>
        </div>

        <nav>
          <button
            className={`nav-item nav-home ${view === "overview" ? "active" : ""}`}
            onClick={() => {
              window.location.hash = "";
              setView("overview");
            }}
          >
            <span>Overview</span>
            <span className="nav-tag">Map</span>
          </button>

          <NavGroup
            id="capability"
            label="Capability Resources"
            expanded={expandedNav.capability}
            onToggle={() => setExpandedNav((state) => ({ ...state, capability: !state.capability }))}
          >
            <button
              className={`nav-item nav-child ${view === "packages" ? "active" : ""}`}
              onClick={() => {
                window.location.hash = "#/packages";
                setView("packages");
              }}
            >
              <span>Packages</span>
              <small>{packages.length}</small>
            </button>
            <button
              className={`nav-item nav-child ${view === "activations" ? "active" : ""}`}
              onClick={() => {
                window.location.hash = "#/activations";
                setView("activations");
              }}
            >
              <span>Activations</span>
              <small>{activations.length}</small>
            </button>
          </NavGroup>

          <NavGroup
            id="compute"
            label="Compute Resources"
            expanded={expandedNav.compute}
            onToggle={() => setExpandedNav((state) => ({ ...state, compute: !state.compute }))}
          >
            {(["driver", "slave", "vm"] as const).map((kind) => (
              <button
                key={kind}
                className={`nav-item nav-child ${view === "resources" && resourceScope === kind ? "active" : ""}`}
                onClick={() => {
                  window.location.hash = `#/resources/${kind}`;
                  setResourceScope(kind);
                  setView("resources");
                }}
              >
                <span>{kind === "vm" ? "VMs" : `${kind[0].toUpperCase()}${kind.slice(1)}s`}</span>
                <small>{resources.filter((item) => item.kind === `computing/${kind}`).length}</small>
              </button>
            ))}
          </NavGroup>

          <NavGroup
            id="execution"
            label="Execution Resources"
            expanded={expandedNav.execution}
            onToggle={() => setExpandedNav((state) => ({ ...state, execution: !state.execution }))}
          >
            <button
              className={`nav-item nav-child ${view === "resources" && resourceScope === "plan" ? "active" : ""}`}
              onClick={() => {
                window.location.hash = "#/resources/plan";
                setResourceScope("plan");
                setView("resources");
              }}
            >
              <span>Plans</span>
              <small>{resources.filter((item) => item.kind === "execution/plan").length}</small>
            </button>
            <button
              className={`nav-item nav-child ${view === "resources" && resourceScope === "run" ? "active" : ""}`}
              onClick={() => {
                window.location.hash = "#/resources/run";
                setResourceScope("run");
                setView("resources");
              }}
            >
              <span>Runs</span>
              <small>{resources.filter((item) => item.kind === "execution/run").length}</small>
            </button>
          </NavGroup>
        </nav>

        <div className="sidebar-foot">
          <span className={`online-dot ${connectionError ? "dot-error" : ""}`} />
          <div className="sidebar-foot-copy">
            <strong>Loom workspace</strong>
            <small>{config.catalogUrl}</small>
          </div>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">PERSONAL COMPUTING SPACE</span>
            <h1>
              {view === "overview"
                ? "Your resource space"
                : view === "activations"
                ? "Capability activations"
                : view === "resources"
                ? resourceScope === "compute"
                  ? "Compute"
                  : resourceScope === "driver"
                  ? "Drivers"
                  : resourceScope === "slave"
                  ? "Slaves"
                  : resourceScope === "vm"
                  ? "VMs"
                  : resourceScope === "plan"
                  ? "Plans"
                  : resourceScope === "run"
                  ? "Runs"
                  : "Resources"
                : view[0].toUpperCase() + view.slice(1)}
            </h1>
          </div>
          <div className="topbar-actions">
            <span className="mode-pill">LOOM LIVE</span>
            <button className="button refresh-btn" disabled={refreshing} onClick={() => void handleRefresh()}>
              <span className={`refresh-icon ${refreshing ? "spinning" : ""}`}>↻</span>
              <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
            </button>
          </div>
        </header>

        <div className={`notice-bar ${connectionError ? "notice-bar-error" : ""}`}>
          <span className={`pulse ${connectionError ? "pulse-error" : ""}`} />
          <span>{notice}</span>
        </div>

        {/* ── View 1: Overview Map ── */}
        {view === "overview" && (
          <WorkspaceMap
            packages={packages}
            activations={activations}
            resources={resources}
            onNavigate={(target) => {
              if (target === "packages" || target === "activations") {
                window.location.hash = `#/${target}`;
                setView(target);
              } else {
                window.location.hash = `#/resources/${target}`;
                setResourceScope(target);
                setView("resources");
              }
            }}
          />
        )}

        {/* ── View 2: Resources List/Detail ── */}
        {view === "resources" && (
          <ListView
            title={
              resourceScope === "all"
                ? "resources"
                : resourceScope === "plan"
                ? "plans"
                : resourceScope === "run"
                ? "runs"
                : `${resourceScope} resources`
            }
            items={visibleResources.map((item, index) => {
              const isExec = item.catalogCategory === "execution" || item.kind.startsWith("execution/");
              return {
                id: item.id,
                name: item.name,
                detail: `${item.kind} · ${String(item.attributes.region ?? "local")}`,
                status: item.status,
                hideStatus: isExec,
                marker: markerForIndex(index),
              };
            })}
            selected={selectedResource}
            onSelect={setSelectedResource}
            detail={
              selectedRes ? (
                <ResourceDetail
                  selectedRes={selectedRes}
                  packages={packages}
                />
              ) : (
                <Empty title="Select a resource" text="Inspect attributes, network topology, relationships, and advertised actions." />
              )
            }
          />
        )}

        {/* ── View 3: Packages List/Detail ── */}
        {view === "packages" && (
          <ListView
            title="packages"
            items={packages.map((item) => ({
              id: item.id,
              name: item.name,
              detail: `${item.version} · ${item.actions.length} action${item.actions.length !== 1 ? "s" : ""}`,
              status: item.status === "available" ? "ready" : item.status,
            }))}
            selected={selectedPackage}
            onSelect={setSelectedPackage}
            detail={
              selectedPkg ? (
                <div className="detail-wrapper">
                  <div className="detail-heading">
                    <div className="detail-title-block">
                      <div className="detail-kicker-row">
                        <span className="eyebrow">CAPABILITY PACKAGE</span>
                        <span className="tag tag-info">{selectedPkg.version}</span>
                      </div>
                      <h2>{selectedPkg.name}</h2>
                      {selectedPkg.description && <p className="detail-desc">{selectedPkg.description}</p>}
                      <div className="detail-uri-bar">
                        <code className="detail-uri">{selectedPkg.id}</code>
                        <CopyButton text={selectedPkg.id} label="Copy ID" />
                      </div>
                    </div>
                    <Badge status={selectedPkg.status === "available" ? "ready" : selectedPkg.status} />
                  </div>

                  <div className="detail-section">
                    <div className="panel-title panel-title-plain">
                      <span>Package Actions ({selectedPkg.actions.length})</span>
                    </div>
                    {selectedPkg.actions.length === 0 ? (
                      <p className="muted detail-empty">This package exposes no runtime actions.</p>
                    ) : (
                      selectedPkg.actions.map((action) => (
                        <ActionCard
                          key={action.id}
                          action={action}
                        />
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <Empty title="Select a package" text="Inspect package capabilities, schema definitions, and declared actions." />
              )
            }
          />
        )}

        {/* ── View 4: Activations View ── */}
        {view === "activations" && (
          <section className="content activations-content">
            <div className="activations-header-card">
              <div className="activations-stats">
                <div className="act-stat-box">
                  <span className="act-stat-num">{activations.length}</span>
                  <span className="act-stat-label">Total Projections</span>
                </div>
                <div className="act-stat-box">
                  <span className="act-stat-num text-success">{activations.filter((a) => a.status === "ready").length}</span>
                  <span className="act-stat-label">Ready</span>
                </div>
                <div className="act-stat-box">
                  <span className="act-stat-num text-warning">{activations.filter((a) => a.status === "pending_auth" || a.status === "degraded").length}</span>
                  <span className="act-stat-label">Pending / Degraded</span>
                </div>
                <div className="act-stat-box">
                  <span className="act-stat-num text-danger">{activations.filter((a) => a.status === "stopped" || a.status === "failed").length}</span>
                  <span className="act-stat-label">Stopped</span>
                </div>
              </div>

              <div className="activations-controls">
                <div className="filter-group">
                  <span className="filter-group-label">Filter:</span>
                  <select
                    className="button select-input"
                    value={activationFilter}
                    onChange={(event) => setActivationFilter(event.target.value as typeof activationFilter)}
                  >
                    <option value="all">All states</option>
                    <option value="ready">Ready</option>
                    <option value="pending_auth">Pending auth</option>
                    <option value="stopped">Stopped</option>
                    <option value="starting">Starting</option>
                    <option value="stopping">Stopping</option>
                    <option value="degraded">Degraded</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div className="search-group">
                  <input
                    type="text"
                    placeholder="Search activations…"
                    value={activationSearch}
                    onChange={(e) => setActivationSearch(e.target.value)}
                    className="list-search-input"
                  />
                  {activationSearch && (
                    <button className="search-clear-btn" onClick={() => setActivationSearch("")}>
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="activations-card-list">
              {visibleActivations.length === 0 ? (
                <Empty
                  title="No activations found"
                  text={
                    activationSearch || activationFilter !== "all"
                      ? "Try resetting filters or search criteria."
                      : "No activation projections found."
                  }
                  actionText={activationSearch || activationFilter !== "all" ? "Reset filters" : undefined}
                  onAction={() => {
                    setActivationFilter("all");
                    setActivationSearch("");
                  }}
                />
              ) : (
                visibleActivations.map((item) => {
                  const runsOn = item.relations?.runs_on?.split("/").pop() ?? item.slaveId.split("/").pop();
                  return (
                    <article className="activation-card" key={item.id}>
                      <div className="activation-card-main">
                        <div className="activation-icon-col">
                          <div className="resource-icon activation-icon" aria-hidden="true">
                            <span className="activation-pattern" />
                          </div>
                        </div>

                        <div className="activation-info-col">
                          <div className="act-title-row">
                            <strong>{item.name}</strong>
                            <Badge status={item.status} />
                          </div>

                          <div className="act-details-row">
                            <div className="act-meta-chip">
                              <span className="act-meta-k">Package:</span>
                              <span className="act-meta-v">{packageLabel(item.packageId, packages)}</span>
                            </div>
                            <div className="act-meta-chip">
                              <span className="act-meta-k">Host node:</span>
                              <span className="act-meta-v">{runsOn}</span>
                            </div>
                            <div className="act-meta-chip">
                              <span className="act-meta-k">Auth:</span>
                              <span className={`tag ${item.authentication === "authenticated" ? "tag-success" : item.authentication === "failed" ? "tag-danger" : "tag-neutral"}`}>
                                {item.authentication}
                              </span>
                            </div>
                            {item.lifecycle && (
                              <div className="act-meta-chip">
                                <span className="act-meta-k">Lifecycle:</span>
                                <span className="act-meta-v">{item.lifecycle}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
