# Personal Computing Space Console

独立的 Personal Computing Space 前端控制台。资源列表从独立的 Resource Catalog 服务读取；能力包详情和活跃资源的 GRIP 描述从 Observer 读取。保留本地 `FixtureAdapter` 用于离线开发。

## 开发

```bash
npm install
npm run dev
```

验证：

```bash
npm test -- --run
npm run build
```

## 架构

- `src/domain/`：前端稳定领域模型和 JSON Schema 类型
- `src/data/fixtures/`：异构资源、能力包、未知自定义 action 和生命周期状态
- `src/data/adapters/fixture-adapter.ts`：本地数据与模拟执行
- `src/data/adapters/observer-adapter.ts`：Resource Catalog 与 Observer 的前端数据边界
- `src/app/App.tsx`：控制台导航、概览、资源、能力包、激活和 Runs 视图

能力包 action 是开放数组。通用 Action Card 读取 action 的 interaction、权限、副作用和 JSON Schema；未知能力包自动回退到相同界面。`byte-stream` 在当前版本可见但提示需要专用流式界面。

## Observer 模式

复制 `.env.example` 为 `.env.local`，填入 Observer 公共地址和运行时 token。启动后打开页面即可读取真实资源，不需要浏览器控制台操作：

```bash
VITE_DATA_MODE=observer
VITE_OBSERVER_URL=https://observer.example
VITE_OBSERVER_TOKEN=（本机配置，不要提交）
VITE_WORKSPACE_ID=workspace-default
VITE_GRIP_AUTHORITY=loom.local
```

开发服务器将 `/api` 和 `/.well-known` 代理到 Observer，将 `/catalog` 代理到独立目录服务。目录服务地址由服务端的 `CATALOG_URL` 指定，默认为 `http://127.0.0.1:18081`；目录令牌从 `CATALOG_TOKEN_FILE` 读取，默认为 `/opt/loom-production/catalog/secrets/catalog-api-token`。目录令牌只用于代理请求，不进入浏览器构建产物。前端请求仍需现有 Observer 令牌。Observer 模式请求失败时不会自动显示 fixture 数据。

## 工作区部署

工作区 VM 的开发代理使用 `VITE_OBSERVER_URL` 指向 Observer，并通过 Vite 同源代理读取目录服务。启动：

```bash
npm ci
npm run build
npm run dev -- --host 0.0.0.0
```

生产环境应将 token 通过运行时私有配置注入，不要提交 `.env.local`。
