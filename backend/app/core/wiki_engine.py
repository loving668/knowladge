import re
import json
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Callable, Dict

from ..database import get_db, WikiPageRow, GraphEdgeRow
from ..models.wiki_page import (
    WikiPage, WikiPageFrontmatter, PageCategory,
    SourceDocument, SearchResult, LintIssue, LintReport
)
from .search_engine import BM25SearchEngine
from .schema_manager import SchemaManager
from .deepseek_client import deepseek_client


class WikiEngine:
    def __init__(
        self,
        kb_id: str,
        sources_dir: Path,
        llm_client=None
    ):
        self.kb_id = kb_id
        self.sources_dir = Path(sources_dir)
        self.llm_client = llm_client or deepseek_client

        # Schema 仍用文件系统（配置文件），但 wiki 页面存 MySQL
        self._wiki_dir = Path(sources_dir).parent  # KB 根目录
        self.schema_manager = SchemaManager(self._wiki_dir)
        self.search_engine = BM25SearchEngine()

        self._ensure_directories()
        self.schema_manager.initialize_schema()
        self._load_pages()

    def _ensure_directories(self) -> None:
        self.sources_dir.mkdir(parents=True, exist_ok=True)

    def _load_pages(self) -> None:
        """从 MySQL 加载页面并重建搜索索引"""
        pages: List[WikiPage] = []
        try:
            db = get_db()
            rows = db.query(WikiPageRow).filter(WikiPageRow.kb_id == self.kb_id).all()
            for row in rows:
                try:
                    page = self._row_to_page(row)
                    pages.append(page)
                except Exception:
                    continue
        except Exception:
            pass
        self.search_engine.index_pages(pages)

    def _row_to_page(self, row: WikiPageRow) -> WikiPage:
        """将 SQLAlchemy 行对象转换为 WikiPage"""
        frontmatter = WikiPageFrontmatter(
            title=row.title,
            category=PageCategory(row.category) if row.category else PageCategory.SUMMARY,
            created_at=row.created_at or datetime.utcnow(),
            updated_at=row.updated_at or datetime.utcnow(),
            tags=row.tags or [],
            source_id=row.source_id,
            source_url=row.source_url,
            related_pages=row.related_pages or [],
            problem=row.problem or "",
            approach=row.approach or ""
        )
        return WikiPage(slug=row.slug, frontmatter=frontmatter, content=row.content or "")

    def _slugify(self, title: str) -> str:
        slug = re.sub(r'[^\w\s-]', '', title.lower())
        slug = re.sub(r'[-\s]+', '-', slug)
        return slug.strip('-')[:50]

    def create_page(
        self,
        title: str,
        category: PageCategory,
        content: str,
        source_id: str = None,
        source_url: str = None,
        tags: List[str] = None,
        problem: str = "",
        approach: str = ""
    ) -> WikiPage:
        slug = self._slugify(title)

        db = get_db()
        # 确保 slug 唯一
        counter = 1
        original_slug = slug
        while db.query(WikiPageRow).filter(
            WikiPageRow.slug == slug, WikiPageRow.kb_id == self.kb_id
        ).first():
            slug = f"{original_slug}-{counter}"
            counter += 1

        now = datetime.utcnow()
        row = WikiPageRow(
            slug=slug,
            kb_id=self.kb_id,
            title=title,
            category=category.value,
            content=content,
            tags=tags or [],
            problem=problem or "",
            approach=approach or "",
            source_id=source_id,
            source_url=source_url,
            created_at=now,
            updated_at=now
        )
        db.add(row)
        db.commit()

        page = self._row_to_page(row)
        self._load_pages()
        return page

    def get_page(self, slug: str) -> Optional[WikiPage]:
        return self.search_engine.get_page(slug)

    def update_page(self, slug: str, content: str = None, tags: List[str] = None, problem: str = None, approach: str = None) -> Optional[WikiPage]:
        db = get_db()
        row = db.query(WikiPageRow).filter(
            WikiPageRow.slug == slug, WikiPageRow.kb_id == self.kb_id
        ).first()
        if not row:
            return None

        if content is not None:
            row.content = content
        if tags is not None:
            row.tags = tags
        if problem is not None:
            row.problem = problem
        if approach is not None:
            row.approach = approach
        row.updated_at = datetime.utcnow()
        db.commit()

        self._load_pages()
        return self._row_to_page(row)

    def delete_page(self, slug: str) -> bool:
        db = get_db()
        row = db.query(WikiPageRow).filter(
            WikiPageRow.slug == slug, WikiPageRow.kb_id == self.kb_id
        ).first()
        if not row:
            return False

        db.delete(row)
        db.commit()
        self._load_pages()
        return True

    def search(
        self,
        query: str,
        category: PageCategory = None,
        top_k: int = 20
    ) -> List[SearchResult]:
        return self.search_engine.search(query, category, top_k)

    def get_all_pages(self) -> List[WikiPage]:
        return list(self.search_engine.pages.values())

    def get_pages_by_category(self, category: PageCategory) -> List[WikiPage]:
        return self.search_engine.get_pages_by_category(category)

    def write_index_file(self) -> None:
        lines = ["# Wiki Index\n"]
        lines.append(f"Generated: {datetime.utcnow().isoformat()}\n")
        lines.append(f"Total pages: {len(self.search_engine.pages)}\n")

        for category in PageCategory:
            pages = self.get_pages_by_category(category)
            if pages:
                lines.append(f"\n## {category.value.title()}\n")
                for page in pages:
                    lines.append(f"- [[{page.slug}]] - {page.title}\n")

        index_path = self._wiki_dir / "index.md"
        index_path.parent.mkdir(parents=True, exist_ok=True)
        index_path.write_text("".join(lines), encoding="utf-8")

    def append_log(self, action: str, details: str, source: str = None) -> None:
        log_path = self._wiki_dir / "log.md"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        entry = f"\n## [{timestamp}] {action}"
        if source:
            entry += f" | {source}"
        entry += f"\n{details}\n"

        with open(log_path, "a", encoding="utf-8") as f:
            f.write(entry)

    def find_links(self, content: str) -> List[str]:
        return re.findall(r'\[\[([^\]]+)\]\]', content)

    def get_backlinks(self, slug: str) -> List[WikiPage]:
        backlinks: List[WikiPage] = []
        for page in self.search_engine.pages.values():
            if f"[[{slug}]]" in page.content:
                backlinks.append(page)
        return backlinks

    def analyze_relationships(
        self,
        pages: List[WikiPage] = None
    ) -> List[Dict[str, str]]:
        """使用 LLM 基于问题/方案分析文档之间的语义关系"""
        if pages is None:
            pages = self.get_all_pages()

        if len(pages) < 2:
            return []

        # 构建文档问题/方案列表供 LLM 分析
        doc_list = []
        for p in pages:
            problem = (p.frontmatter.problem or "")[:300]
            approach = (p.frontmatter.approach or "")[:300]
            tags_str = ", ".join(p.frontmatter.tags) if p.frontmatter.tags else "无"
            doc_list.append(
                f"- slug: {p.slug}\n"
                f"  标题: {p.title}\n"
                f"  标签: {tags_str}\n"
                f"  解决的问题: {problem or '未知'}\n"
                f"  解决的方法: {approach or '未知'}"
            )

        prompt = f"""分析以下文档要解决的问题和解决方法的关联。找出有实质内容关联的文档对。

文档列表：
{chr(10).join(doc_list)}

请找出文档之间的关联，返回 JSON 数组。每条关联包含：
- source: 源文档 slug
- target: 目标文档 slug
- type: 关联类型（same_problem=解决同类问题, related_method=方法相关, complementary=互补, similar=相似）
- reason: 一句话说明关联（中文）

只返回有实质关联的文档对（最多 20 对），避免牵强附会。
返回格式：
```json
[
  {{"source": "doc-a", "target": "doc-b", "type": "same_problem", "reason": "两者都解决..."}}
]
```"""

        try:
            response = self.llm_client.extract_json(prompt)
            relations = json.loads(response)
            if isinstance(relations, list):
                # 过滤有效关系
                valid = []
                all_slugs = {p.slug for p in pages}
                for r in relations:
                    if isinstance(r, dict) and r.get("source") in all_slugs and r.get("target") in all_slugs:
                        if r["source"] != r["target"]:
                            valid.append({
                                "source": r["source"],
                                "target": r["target"],
                                "type": r.get("type", "related"),
                                "reason": r.get("reason", "")
                            })
                return valid
        except Exception as e:
            print(f"LLM relationship analysis failed: {e}")

        return []
