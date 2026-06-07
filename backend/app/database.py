"""MySQL 数据库连接与表模型"""

import json
from sqlalchemy import (
    create_engine, Column, String, Integer, DateTime, Text, ForeignKey, Index
)
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from datetime import datetime

# MySQL 连接将在 startup 时初始化，此处为占位
_engine = None
SessionLocal = None


def init_database(database_url: str):
    """初始化 MySQL 连接和表"""
    global _engine, SessionLocal
    _engine = create_engine(
        database_url,
        pool_size=10,
        max_overflow=20,
        pool_recycle=3600,
        echo=False,
    )
    SessionLocal = sessionmaker(bind=_engine)
    # 创建所有表
    Base.metadata.create_all(bind=_engine)
    return _engine


def get_db() -> Session:
    """获取数据库会话"""
    if SessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    return SessionLocal()


class Base(DeclarativeBase):
    pass


def _json_dumps(value) -> str:
    """JSON 序列化为字符串（MySQL 5.5 无 JSON 类型）"""
    return json.dumps(value, ensure_ascii=False) if value is not None else "[]"


def _json_loads(value) -> list:
    """JSON 反序列化"""
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return json.loads(value)
        except Exception:
            return []
    return []


# ======= 知识库元数据表 =======
class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id = Column(String(80), primary_key=True)
    name = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ======= Wiki 页面表 =======
class WikiPageRow(Base):
    __tablename__ = "wiki_pages"

    slug = Column(String(191), primary_key=True)
    kb_id = Column(String(80), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    category = Column(String(50), nullable=False, default="summaries")
    content = Column(Text, nullable=False)
    _tags = Column("tags", Text, nullable=False, default="[]")
    problem = Column(Text, nullable=False, default="")
    approach = Column(Text, nullable=False, default="")
    source_id = Column(String(100), default=None)
    source_url = Column(String(500), default=None)
    _related_pages = Column("related_pages", Text, nullable=False, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_kb_category", "kb_id", "category"),
    )

    @property
    def tags(self) -> list:
        return _json_loads(self._tags)

    @tags.setter
    def tags(self, value: list):
        self._tags = _json_dumps(value)

    @property
    def related_pages(self) -> list:
        return _json_loads(self._related_pages)

    @related_pages.setter
    def related_pages(self, value: list):
        self._related_pages = _json_dumps(value)


# ======= 图谱边表 =======
class GraphEdgeRow(Base):
    __tablename__ = "graph_edges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    kb_id = Column(String(80), nullable=False, index=True)
    source_slug = Column(String(191), nullable=False)
    target_slug = Column(String(191), nullable=False)
    edge_type = Column(String(50), nullable=False, default="related")
    reason = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_kb_edge", "kb_id", "source_slug", "target_slug"),
    )
