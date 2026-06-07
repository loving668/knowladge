import json
import shutil
import re
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict

from ..database import get_db, KnowledgeBase, WikiPageRow
from .wiki_engine import WikiEngine

KB_ROOT = Path(__file__).parent.parent.parent / "knowledge_bases"


class KBManager:
    """管理多个知识库的注册、创建、删除，以及 WikiEngine 实例池"""

    def __init__(self):
        self._engines: Dict[str, WikiEngine] = {}
        KB_ROOT.mkdir(parents=True, exist_ok=True)

    def _slugify(self, name: str) -> str:
        slug = re.sub(r'[^\w\s-]', '', name.lower())
        slug = re.sub(r'[-\s]+', '-', slug)
        return slug.strip('-')[:40]

    def list_kbs(self) -> List[dict]:
        try:
            db = get_db()
            rows = db.query(KnowledgeBase).order_by(KnowledgeBase.created_at.desc()).all()
            return [
                {
                    "id": r.id,
                    "name": r.name,
                    "created_at": r.created_at.isoformat() if r.created_at else "",
                    "updated_at": r.updated_at.isoformat() if r.updated_at else ""
                }
                for r in rows
            ]
        except Exception:
            return []

    def create_kb(self, name: str) -> dict:
        kb_id = self._slugify(name)
        db = get_db()

        # 生成唯一 ID
        existing = db.query(KnowledgeBase.id).filter(KnowledgeBase.id == kb_id).first()
        if existing:
            counter = 1
            while db.query(KnowledgeBase.id).filter(KnowledgeBase.id == f"{kb_id}-{counter}").first():
                counter += 1
            kb_id = f"{kb_id}-{counter}"

        now = datetime.utcnow()
        row = KnowledgeBase(id=kb_id, name=name, created_at=now, updated_at=now)
        db.add(row)
        db.commit()

        kb_dir = KB_ROOT / kb_id
        kb_dir.mkdir(parents=True, exist_ok=True)
        (kb_dir / "raw_sources").mkdir(exist_ok=True)

        return {
            "id": kb_id,
            "name": name,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

    def delete_kb(self, kb_id: str) -> bool:
        db = get_db()
        row = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
        if not row:
            return False

        # 删除所有 wiki 页面
        db.query(WikiPageRow).filter(WikiPageRow.kb_id == kb_id).delete()
        # 删除图谱边
        from ..database import GraphEdgeRow
        db.query(GraphEdgeRow).filter(GraphEdgeRow.kb_id == kb_id).delete()
        # 删除知识库
        db.delete(row)
        db.commit()

        # 清理磁盘文件
        kb_dir = KB_ROOT / kb_id
        if kb_dir.exists():
            shutil.rmtree(kb_dir)

        self._engines.pop(kb_id, None)
        return True

    def get_engine(self, kb_id: str) -> Optional[WikiEngine]:
        if kb_id in self._engines:
            return self._engines[kb_id]

        # 验证 KB 存在
        try:
            db = get_db()
            exists = db.query(KnowledgeBase.id).filter(KnowledgeBase.id == kb_id).first()
            if not exists:
                return None
        except Exception:
            return None

        kb_dir = KB_ROOT / kb_id
        sources_dir = kb_dir / "raw_sources"
        sources_dir.mkdir(parents=True, exist_ok=True)

        engine = WikiEngine(kb_id, sources_dir)
        self._engines[kb_id] = engine
        return engine

    def ensure_default_kb(self):
        """确保至少存在一个默认知识库，并迁移旧文件数据"""
        db = get_db()
        kbs = db.query(KnowledgeBase).order_by(KnowledgeBase.created_at).all()
        if kbs:
            # 尝试从旧文件目录迁移
            self._migrate_from_files()
            return kbs[0].id

        # 检查旧文件数据
        old_wiki = Path(__file__).parent.parent.parent / "wiki"
        old_registry = KB_ROOT / "_registry.json"

        # 导入旧 _registry.json 中的 KB
        file_kbs = []
        if old_registry.exists():
            try:
                file_kbs = json.loads(old_registry.read_text(encoding="utf-8"))
            except Exception:
                pass

        if file_kbs:
            # 从文件注册表创建 MySQL 记录
            for entry in file_kbs:
                if not db.query(KnowledgeBase.id).filter(KnowledgeBase.id == entry["id"]).first():
                    db.add(KnowledgeBase(
                        id=entry["id"],
                        name=entry["name"],
                        created_at=datetime.fromisoformat(entry.get("created_at", "")),
                        updated_at=datetime.utcnow()
                    ))
            db.commit()
            self._migrate_from_files()
            return file_kbs[0]["id"]

        if old_wiki.exists():
            entry = self.create_kb("默认知识库")
            kb_dir = KB_ROOT / entry["id"]
            target = kb_dir / "wiki"
            shutil.move(str(old_wiki), str(target))
            return entry["id"]

        # 全新环境
        entry = self.create_kb("默认知识库")
        return entry["id"]

    def _migrate_from_files(self):
        """将旧文件系统的 wiki 页面迁移到 MySQL"""
        db = get_db()
        for kb_dir in KB_ROOT.iterdir():
            if not kb_dir.is_dir() or kb_dir.name.startswith("_"):
                continue
            kb_id = kb_dir.name
            wiki_dir = kb_dir / "wiki"
            if not wiki_dir.exists():
                continue

            for cat_dir in wiki_dir.iterdir():
                if not cat_dir.is_dir():
                    continue
                category = cat_dir.name
                for md_file in cat_dir.glob("*.md"):
                    slug = md_file.stem
                    # 检查 MySQL 是否已有
                    existing = db.query(WikiPageRow).filter(
                        WikiPageRow.slug == slug,
                        WikiPageRow.kb_id == kb_id
                    ).first()
                    if existing:
                        continue

                    try:
                        content = md_file.read_text(encoding="utf-8")
                        from ..models.wiki_page import WikiPage
                        page = WikiPage.from_markdown(slug, content)
                        row = WikiPageRow(
                            slug=slug,
                            kb_id=kb_id,
                            title=page.title,
                            category=page.category.value,
                            content=page.content,
                            tags=page.frontmatter.tags,
                            problem=page.frontmatter.problem or "",
                            approach=page.frontmatter.approach or "",
                            source_id=page.frontmatter.source_id,
                            source_url=page.frontmatter.source_url,
                            related_pages=page.frontmatter.related_pages,
                            created_at=page.frontmatter.created_at,
                            updated_at=page.frontmatter.updated_at
                        )
                        db.add(row)
                    except Exception:
                        continue
            db.commit()


kb_manager = KBManager()
