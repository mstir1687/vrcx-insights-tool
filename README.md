# VRCX Insights Tool

独立本地 Electron 工具，读取 `VRCX.sqlite3` 做关系分析。

## 启动

```bash
cd vrcx-insights-tool
npm install
VRCX_DB_PATH=../VRCX.sqlite3 npm start
```

说明：

- 项目使用内建 `node:sqlite` 只读打开 `VRCX.sqlite3`
- 工具不会修改 VRCX 数据库

## 架构

- Electron `main` 进程持有 `InsightsService` 和内存索引
- Electron `preload` 暴露 `window.vrcxInsights` 给 renderer
- 静态 Vue renderer 仅负责界面渲染和交互
