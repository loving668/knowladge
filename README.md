# 🧠 LLM Wiki — 知识库问答系统

基于 LLM 的多知识库管理与智能问答平台，支持文档上传自动解析、知识图谱可视化导航、语义检索问答。

## ✨ 核心功能

| 模块 | 说明 |
|------|------|
| 📚 **多知识库管理** | 创建/删除多个知识库，按主题隔离知识 |
| 📄 **文档自动解析** | 上传 PDF/DOCX/TXT/MD，LLM 自动提取问题、方案、摘要、标签 |
| 🌐 **网页内容抓取** | 输入 URL 自动抓取网页内容并提取纯文本入库 |
| 🏷️ **标签化知识组织** | 给文档打标签、分类，支持右键菜单操作 |
| 🕸️ **知识图谱** | 全局关系图谱（Canvas 力导向）+ 聚焦文档图谱，按语义/标签/方法关联 |
| 💬 **智能问答** | RAG 检索 + LLM 生成，精准回答知识库内的问题 |
| 🔍 **全文搜索** | 中文分词搜索，快速定位知识 |

## 🏗️ 技术栈

| 层 | 技术 |
|----|------|
| **前端** | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| **后端** | FastAPI + Uvicorn（Python） |
| **数据库** | MySQL 5.5（SQLAlchemy ORM + PyMySQL） |
| **AI** | DeepSeek Chat API（文档解析 / 图谱生成 / 智能问答） |
| **UI** | Ant Design 5 + Canvas 2D 图谱渲染 |

## 📁 项目结构

```
├── frontend/                 # React 前端
│   └── src/
│       ├── components/       # Sidebar / TopBar / ChatPanel
│       ├── pages/            # Dashboard / DocumentList / DocumentDetail / Graph / IngestPanel
│       ├── services/         # API 请求
│       └── stores/           # Zustand 状态管理
├── backend/                  # FastAPI 后端
│   └── app/
│       ├── api/v1/           # REST API 路由
│       ├── core/             # 核心引擎（Wiki / 搜索 / KB管理 / 图谱）
│       ├── models/           # 数据模型
│       ├── services/         # 业务服务（摄入 / 查询 / 校验）
│       └── database.py       # MySQL 表定义
└── start_all.ps1             # 一键启动脚本
```

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/loving668/knowladge.git
cd knowladge
```

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 填入你的 DeepSeek API Key：

```env
DEEPSEEK_API_KEY=sk-your-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

### 3. 安装依赖

**后端：**

```bash
cd backend
pip install -r requirements.txt
```

**前端：**

```bash
cd frontend
npm install
```

### 4. 启动服务

**后端（端口 8000）：**

```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**前端（端口 3000）：**

```bash
cd frontend
npm run dev
```

访问 http://localhost:3000 即可使用。

> Windows 用户也可直接运行 `start_all.ps1` 一键启动前后端。

## 📡 API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/DELETE | `/api/v1/kb` | 知识库 CRUD |
| GET/PUT/DELETE | `/api/v1/kb/{id}/wiki/pages` | Wiki 页面管理 |
| POST | `/api/v1/kb/{id}/sources/ingest/batch` | 批量上传文件 |
| POST | `/api/v1/kb/{id}/sources/ingest/url` | 抓取网页内容 |
| POST | `/api/v1/kb/{id}/wiki/chat` | 智能问答 |
| GET | `/api/v1/kb/{id}/wiki/graph` | 获取知识图谱数据 |

完整 API 文档：启动后端后访问 http://localhost:8000/docs

## 🔒 安全说明

- `.env` 文件已加入 `.gitignore`，API Key 不会被提交到仓库
- 首次使用请按上方步骤复制 `.env.example` 并填入你的密钥

## 📝 License

MIT
