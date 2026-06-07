from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Optional, List

from ...core.kb_manager import kb_manager
from ...services.query_service import QueryService
from ...services.lint_service import LintService
from ...models.wiki_page import PageCategory

router = APIRouter(tags=["wiki"])


class PageCreate(BaseModel):
    title: str
    category: str
    content: str
    tags: List[str] = []
    source_id: Optional[str] = None
    source_url: Optional[str] = None


class PageUpdate(BaseModel):
    content: Optional[str] = None
    tags: Optional[List[str]] = None


class QueryRequest(BaseModel):
    question: str
    top_k: int = 5
    context_slug: Optional[str] = None


def _get_engine(kb_id: str):
    engine = kb_manager.get_engine(kb_id)
    if not engine:
        raise HTTPException(404, f"知识库不存在: {kb_id}")
    return engine


# ======= Pages CRUD =======

@router.get("/kb/{kb_id}/wiki/pages")
def list_pages(kb_id: str, category: Optional[str] = None):
    engine = _get_engine(kb_id)
    if category:
        try:
            cat = PageCategory(category)
            pages = engine.get_pages_by_category(cat)
        except ValueError:
            raise HTTPException(400, f"Invalid category: {category}")
    else:
        pages = engine.get_all_pages()

    return {
        "total": len(pages),
        "pages": [
            {
                "slug": p.slug,
                "title": p.title,
                "category": p.category.value,
                "tags": p.frontmatter.tags,
                "updated_at": p.frontmatter.updated_at.isoformat(),
                "problem": p.frontmatter.problem or "",
                "approach": p.frontmatter.approach or ""
            }
            for p in pages
        ]
    }


@router.get("/kb/{kb_id}/wiki/pages/{slug}")
def get_page(kb_id: str, slug: str):
    engine = _get_engine(kb_id)
    page = engine.get_page(slug)
    if not page:
        raise HTTPException(404, f"Page not found: {slug}")

    backlinks = engine.get_backlinks(slug)

    return {
        "slug": page.slug,
        "title": page.title,
        "category": page.category.value,
        "content": page.content,
        "frontmatter": {
            "tags": page.frontmatter.tags,
            "source_id": page.frontmatter.source_id,
            "source_url": page.frontmatter.source_url,
            "problem": page.frontmatter.problem or "",
            "approach": page.frontmatter.approach or "",
            "created_at": page.frontmatter.created_at.isoformat(),
            "updated_at": page.frontmatter.updated_at.isoformat()
        },
        "backlinks": [
            {"slug": b.slug, "title": b.title}
            for b in backlinks
        ],
        "markdown": page.to_markdown()
    }


@router.post("/kb/{kb_id}/wiki/pages")
def create_page(kb_id: str, data: PageCreate):
    engine = _get_engine(kb_id)
    try:
        category = PageCategory(data.category)
    except ValueError:
        raise HTTPException(400, f"Invalid category: {data.category}")

    page = engine.create_page(
        title=data.title,
        category=category,
        content=data.content,
        source_id=data.source_id,
        source_url=data.source_url,
        tags=data.tags
    )

    return {
        "slug": page.slug,
        "title": page.title,
        "category": page.category.value,
        "message": "Page created successfully"
    }


@router.put("/kb/{kb_id}/wiki/pages/{slug}")
def update_page(kb_id: str, slug: str, data: PageUpdate):
    engine = _get_engine(kb_id)
    page = engine.update_page(slug, content=data.content, tags=data.tags)
    if not page:
        raise HTTPException(404, f"Page not found: {slug}")

    return {
        "slug": page.slug,
        "message": "Page updated successfully"
    }


@router.delete("/kb/{kb_id}/wiki/pages/{slug}")
def delete_page(kb_id: str, slug: str):
    engine = _get_engine(kb_id)
    success = engine.delete_page(slug)
    if not success:
        raise HTTPException(404, f"Page not found: {slug}")

    return {"message": f"Page {slug} deleted"}


@router.get("/kb/{kb_id}/wiki/pages/{slug}/raw", response_class=PlainTextResponse)
def get_page_raw(kb_id: str, slug: str):
    engine = _get_engine(kb_id)
    page = engine.get_page(slug)
    if not page:
        raise HTTPException(404, f"Page not found: {slug}")

    return page.to_markdown()


# ======= Search & Query =======

@router.get("/kb/{kb_id}/wiki/search")
def search_pages(
    kb_id: str,
    q: str = Query(..., description="Search query"),
    category: Optional[str] = None,
    top_k: int = 20
):
    engine = _get_engine(kb_id)
    query_service = QueryService(engine)
    cat = None
    if category:
        try:
            cat = PageCategory(category)
        except ValueError:
            raise HTTPException(400, f"Invalid category: {category}")

    results = query_service.search_pages(q, category=cat, top_k=top_k)

    return {
        "query": q,
        "total": len(results),
        "results": results
    }


@router.post("/kb/{kb_id}/wiki/query")
def query_wiki(kb_id: str, data: QueryRequest):
    engine = _get_engine(kb_id)
    query_service = QueryService(engine)
    result = query_service.query(data.question, top_k=data.top_k, context_slug=data.context_slug)
    return result


# ======= Lint & Stats =======

@router.get("/kb/{kb_id}/wiki/lint")
def lint_wiki(kb_id: str):
    engine = _get_engine(kb_id)
    lint_service = LintService(engine)
    report = lint_service.lint()
    return {
        "health_score": report.health_score,
        "total_pages": report.total_pages,
        "issues": [
            {
                "type": i.issue_type,
                "page": i.page_slug,
                "description": i.description,
                "severity": i.severity
            }
            for i in report.issues
        ],
        "checked_at": report.checked_at.isoformat()
    }


@router.get("/kb/{kb_id}/wiki/statistics")
def get_statistics(kb_id: str):
    engine = _get_engine(kb_id)
    lint_service = LintService(engine)
    return lint_service.get_statistics()


@router.get("/kb/{kb_id}/wiki/suggestions")
def get_suggestions(kb_id: str):
    engine = _get_engine(kb_id)
    lint_service = LintService(engine)
    return {"suggestions": lint_service.suggest_improvements()}


@router.get("/kb/{kb_id}/wiki/index", response_class=PlainTextResponse)
def get_index(kb_id: str):
    engine = _get_engine(kb_id)
    engine.write_index_file()
    index_path = engine._wiki_dir / "index.md"
    if index_path.exists():
        return index_path.read_text(encoding="utf-8")
    return "# Wiki Index\n\nNo pages yet."


@router.get("/kb/{kb_id}/wiki/log", response_class=PlainTextResponse)
def get_log(kb_id: str):
    engine = _get_engine(kb_id)
    log_path = engine._wiki_dir / "log.md"
    if log_path.exists():
        return log_path.read_text(encoding="utf-8")
    return "# Wiki Log\n\nNo entries yet."


@router.get("/kb/{kb_id}/wiki/categories")
def list_categories(kb_id: str):
    return {
        "categories": [
            {"value": "summaries", "label": "文档"},
            {"value": "synthesis", "label": "综合"},
            {"value": "queries", "label": "问答"}
        ]
    }


# ======= Knowledge Graph =======

@router.get("/kb/{kb_id}/wiki/graph")
def get_knowledge_graph(kb_id: str):
    """获取知识图谱 — 文档节点 + 问题/方案语义关联 + 同标签"""
    engine = _get_engine(kb_id)
    pages = engine.get_all_pages()

    tag_colors = [
        "#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
        "#EC4899", "#6366F1", "#14B8A6", "#F97316", "#84CC16"
    ]

    all_tags = []
    for p in pages:
        for t in p.frontmatter.tags:
            if t and t not in all_tags and not t.startswith("未解析"):
                all_tags.append(t)
    tag_color_map = {}
    for i, t in enumerate(all_tags):
        tag_color_map[t] = tag_colors[i % len(tag_colors)]

    nodes = []
    added_slugs = set()
    for page in pages:
        node_id = page.slug
        if node_id not in added_slugs:
            main_tag = page.frontmatter.tags[0] if page.frontmatter.tags else ""
            nodes.append({
                "id": node_id,
                "label": page.title,
                "tags": [t for t in page.frontmatter.tags if t and not t.startswith("未解析")],
                "color": tag_color_map.get(main_tag, "#64748B"),
                "problem": page.frontmatter.problem or "",
                "approach": page.frontmatter.approach or ""
            })
            added_slugs.add(node_id)

    seen_links = set()
    links = []

    def add_link(source, target, link_type, reason=""):
        key = tuple(sorted([source, target]))
        if key not in seen_links and source != target:
            seen_links.add(key)
            links.append({
                "source": source,
                "target": target,
                "type": link_type,
                "reason": reason
            })

    # 同标签关联
    tag_docs: dict = {}
    for page in pages:
        for tag in page.frontmatter.tags:
            if tag and not tag.startswith("未解析"):
                tag_docs.setdefault(tag, []).append(page.slug)
    for tag, slugs in tag_docs.items():
        for i in range(len(slugs)):
            for j in range(i + 1, min(i + 4, len(slugs))):
                add_link(slugs[i], slugs[j], "same_tag", f"共享标签: {tag}")

    # LLM 语义关联（基于问题/方案)）
    try:
        semantic_links = engine.analyze_relationships(pages)
        for r in semantic_links:
            add_link(r["source"], r["target"], r.get("type", "semantic"), r.get("reason", ""))
    except Exception as e:
        print(f"Semantic analysis skipped: {e}")

    return {
        "nodes": nodes,
        "links": links,
        "tag_groups": {t: tag_color_map.get(t, "#64748B") for t in all_tags}
    }


@router.get("/kb/{kb_id}/wiki/graph/focus/{slug}")
def get_focus_graph(kb_id: str, slug: str):
    """获取以指定文档为中心的聚焦图谱"""
    engine = _get_engine(kb_id)
    center_page = engine.get_page(slug)
    if not center_page:
        raise HTTPException(404, f"Page not found: {slug}")

    tag_colors = [
        "#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
        "#EC4899", "#6366F1", "#14B8A6", "#F97316", "#84CC16"
    ]

    all_pages = engine.get_all_pages()
    all_tags = []
    for p in all_pages:
        for t in p.frontmatter.tags:
            if t and t not in all_tags and not t.startswith("未解析"):
                all_tags.append(t)
    tag_color_map = {}
    for i, t in enumerate(all_tags):
        tag_color_map[t] = tag_colors[i % len(tag_colors)]

    def page_color(page):
        for t in page.frontmatter.tags:
            if t and not t.startswith("未解析"):
                return tag_color_map.get(t, "#64748B")
        return "#64748B"

    nodes = []
    links = []
    added_slugs = set()

    def add_node(page):
        if page.slug not in added_slugs:
            added_slugs.add(page.slug)
            nodes.append({
                "id": page.slug,
                "label": page.title,
                "tags": [t for t in page.frontmatter.tags if t and not t.startswith("未解析")],
                "color": page_color(page),
                "problem": page.frontmatter.problem or "",
                "approach": page.frontmatter.approach or ""
            })

    def add_link(source, target, link_type, reason=""):
        links.append({
            "source": source,
            "target": target,
            "type": link_type,
            "reason": reason
        })

    add_node(center_page)

    # 同标签关联
    center_tags = [t for t in center_page.frontmatter.tags if t and not t.startswith("未解析")]
    for p in all_pages:
        if p.slug == slug:
            continue
        for t in p.frontmatter.tags:
            if t in center_tags:
                add_node(p)
                add_link(p.slug, slug, "same_tag", f"共享标签: {t}")
                break

    # LLM 语义关联（基于问题/方案）
    try:
        candidates = [center_page]
        for p in all_pages:
            if p.slug != slug and any(t in center_tags for t in p.frontmatter.tags):
                candidates.append(p)
        if len(candidates) >= 2:
            semantic_links = engine.analyze_relationships(candidates)
            for r in semantic_links:
                src_page = engine.get_page(r["source"])
                tgt_page = engine.get_page(r["target"])
                if src_page:
                    add_node(src_page)
                if tgt_page:
                    add_node(tgt_page)
                add_link(r["source"], r["target"], r.get("type", "semantic"), r.get("reason", ""))
    except Exception as e:
        print(f"Focus semantic analysis skipped: {e}")

    return {
        "center": center_page.slug,
        "nodes": nodes,
        "links": links
    }
