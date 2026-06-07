import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_database
from .core.kb_manager import kb_manager

settings = get_settings()
logger = logging.getLogger(__name__)


def _build_mysql_url() -> str:
    return (
        f"mysql+pymysql://{settings.MYSQL_USER}:{settings.MYSQL_PASSWORD}"
        f"@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}/{settings.MYSQL_DATABASE}"
        "?charset=utf8"
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 初始化 MySQL 数据库
    mysql_url = _build_mysql_url()
    try:
        init_database(mysql_url)
        logger.info(f"MySQL 数据库连接成功: {settings.MYSQL_HOST}:{settings.MYSQL_PORT}/{settings.MYSQL_DATABASE}")
    except Exception as e:
        logger.error(f"MySQL 初始化失败: {e}")
        raise

    # 迁移旧数据 + 确保默认知识库存在
    default_kb_id = kb_manager.ensure_default_kb()

    logger.info(f"LLM Wiki 多知识库系统启动")
    logger.info(f"默认知识库: {default_kb_id}")
    logger.info(f"知识库总数: {len(kb_manager.list_kbs())}")

    yield

    logger.info("应用关闭...")


def create_app() -> FastAPI:
    app = FastAPI(
        title="LLM Wiki 多知识库系统",
        version="3.0.0",
        description="多知识库管理 + LLM 语义图谱",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from .api.v1 import wiki, sources, schema, kb

    app.include_router(kb.router, prefix=settings.API_PREFIX)
    app.include_router(wiki.router, prefix=settings.API_PREFIX)
    app.include_router(sources.router, prefix=settings.API_PREFIX)
    app.include_router(schema.router, prefix=settings.API_PREFIX)

    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "version": "3.0.0", "system": "LLM Wiki Multi-KB"}

    @app.get("/")
    async def root():
        return {
            "name": "LLM Wiki 多知识库系统",
            "version": "3.0.0",
            "features": [
                "多知识库创建/删除",
                "知识库内文档 CRUD",
                "LLM 语义图谱",
                "智能问答",
                "标签化知识组织"
            ],
            "docs": "/docs",
        }

    return app


app = create_app()
