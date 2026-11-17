# Personal Computing Space Console

独立的 Loom 资源目录只读控制台。页面只查询 Resource Catalog；不调用 Observer、执行 Action 或管理能力包实例。

## 数据流

```text
浏览器 → 同源 /catalog 代理 → Resource Catalog HTTP API
```

`CatalogAdapter` 按 capability、compute、execution 分类读取资源，并查询 supporting Action 以展示能力包声明的 Action 名称。Package、Activation、Driver、Slave、VM、Plan、Run 均由 Catalog 投影生成页面模型。支持分页、生命周期筛选和关系展示。Action 的 URI、权限和 Catalog 提供的 Schema 仅用于展示；Catalog 未提供的交互类型、副作用和认证状态显示为未知，不从 URI 推断。

## 本地运行

复制 `.env.example` 为 `.env.local`，设置：

- `VITE_CATALOG_PROXY_TOKEN`：浏览器访问本地代理的令牌；只授予目录读取能力。
- `CATALOG_URL`：Catalog 服务地址，默认 `http://127.0.0.1:18081`。
- `CATALOG_TOKEN_FILE`：Catalog API 令牌文件路径，默认 `/opt/loom-production/catalog/secrets/catalog-api-token`。

```bash
npm ci
npm run dev
```

Vite 只代理 `/catalog`，并在服务端注入 Catalog API 令牌。Catalog API 令牌不进入浏览器构建产物。生产环境应由网关实现同样的认证和代理路由。

## 验证

```bash
npm test -- --run
npm run build
```

Resource Catalog 不可用时，页面显示连接错误，不回退到本地模拟数据。
