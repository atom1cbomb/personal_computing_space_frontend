# Personal Computing Space Console

独立的 Loom 资源目录只读控制台。Catalog 提供分类列表和关系索引；选中资源后通过 Observer 的只读 `DESCRIBE` 补充详情。前端不执行 Action，也不管理能力包实例。

## 数据流

```text
浏览器 → 同源 /catalog 代理 → Resource Catalog HTTP API
       → 同源 /observer/describe → 服务端限定的 Observer DESCRIBE
```

`CatalogAdapter` 按 capability、compute、execution 分类读取资源，并查询 supporting Action 以展示能力包声明的 Action 名称。Package、Activation、Driver、Slave、VM、Plan、Run 的列表由 Catalog 投影生成。选中 Package 时读取 Action 描述、Schema、权限和副作用；选中 Plan 或 Run 时读取状态、关联资源、执行标识和版本等详情。Observer 读取失败时仍显示 Catalog 摘要。所有 Action 信息只用于展示。

## 本地运行

复制 `.env.example` 为 `.env.local`，设置：

- `VITE_CATALOG_PROXY_TOKEN`：浏览器访问本地代理的令牌；只授予目录读取能力。
- `CATALOG_URL`：Catalog 服务地址，默认 `http://127.0.0.1:18081`。
- `CATALOG_TOKEN_FILE`：Catalog API 令牌文件路径，默认 `/opt/loom-production/catalog/secrets/catalog-api-token`。
- `OBSERVER_URL`：Observer 地址，默认 `http://127.0.0.1:8080`。
- `OBSERVER_TOKEN_FILE`：Observer GRIP 令牌文件路径，默认 `/opt/loom-production/observer/secrets/grip_token`。

```bash
npm ci
npm run dev
```

Vite 代理 `/catalog`，并提供只接受 `GET` 的 `/observer/describe`。后者由服务端固定构造 GRIP `DESCRIBE` 请求并清理敏感字段，不接受浏览器提供的 GRIP method。Catalog 和 Observer 令牌都不进入浏览器构建产物。生产环境应由网关实现相同的只读路由和字段过滤。

## 验证

```bash
npm test -- --run
npm run build
```

Resource Catalog 不可用时，页面显示连接错误，不回退到本地模拟数据。
