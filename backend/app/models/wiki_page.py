from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum


class PageCategory(str, Enum):
    SUMMARY = "summaries"
    SYNTHESIS = "synthesis"
    QUERY = "queries"


class WikiPageFrontmatter(BaseModel):
    title: str
    category: PageCategory
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    tags: List[str] = []
    source_id: Optional[str] = None
    source_url: Optional[str] = None
    related_pages: List[str] = []
    problem: str = ""
    approach: str = ""


class WikiPage(BaseModel):
    slug: str
    frontmatter: WikiPageFrontmatter
    content: str

    @property
    def title(self) -> str:
        return self.frontmatter.title

    @property
    def category(self) -> PageCategory:
        return self.frontmatter.category

    def to_markdown(self) -> str:
        fm_lines = ["---"]
        fm_lines.append(f"title: {self.frontmatter.title}")
        fm_lines.append(f"category: {self.frontmatter.category.value}")
        fm_lines.append(f"created_at: {self.frontmatter.created_at.isoformat()}")
        fm_lines.append(f"updated_at: {self.frontmatter.updated_at.isoformat()}")
        if self.frontmatter.tags:
            fm_lines.append(f"tags: {self.frontmatter.tags}")
        if self.frontmatter.source_id:
            fm_lines.append(f"source_id: {self.frontmatter.source_id}")
        if self.frontmatter.source_url:
            fm_lines.append(f"source_url: {self.frontmatter.source_url}")
        if self.frontmatter.related_pages:
            fm_lines.append(f"related_pages: {self.frontmatter.related_pages}")
        if self.frontmatter.problem:
            fm_lines.append(f"problem: |")
            for line in self.frontmatter.problem.split("\n"):
                fm_lines.append(f"  {line}")
        if self.frontmatter.approach:
            fm_lines.append(f"approach: |")
            for line in self.frontmatter.approach.split("\n"):
                fm_lines.append(f"  {line}")
        fm_lines.append("---")
        return "\n".join(fm_lines) + "\n\n" + self.content

    @classmethod
    def from_markdown(cls, slug: str, markdown: str) -> "WikiPage":
        lines = markdown.split("\n")
        if not lines[0].strip() == "---":
            raise ValueError("Invalid wiki page format: missing frontmatter")

        fm_end = None
        for i, line in enumerate(lines[1:], 1):
            if line.strip() == "---":
                fm_end = i
                break

        if fm_end is None:
            raise ValueError("Invalid wiki page format: unclosed frontmatter")

        fm_text = "\n".join(lines[1:fm_end])
        content = "\n".join(lines[fm_end + 1:]).strip()

        def parse_fm(text: str) -> dict:
            """Parse frontmatter with multi-line support for problem/approach"""
            result: Dict[str, str] = {}
            current_key = None
            current_value = []
            for line in text.split("\n"):
                if not line:
                    if current_key and current_value:
                        result[current_key] = "\n".join(current_value)
                    current_key = None
                    current_value = []
                    continue
                if ":" in line and not line.startswith(" "):
                    if current_key and current_value:
                        result[current_key] = "\n".join(current_value)
                    key, _, value = line.partition(":")
                    key = key.strip()
                    value = value.strip()
                    if value == "|":
                        current_key = key
                        current_value = []
                    else:
                        result[key] = value
                        current_key = None
                        current_value = []
                elif current_key and line.startswith("  "):
                    current_value.append(line.strip())
                elif current_key:
                    current_value.append(line.strip())
            if current_key and current_value:
                result[current_key] = "\n".join(current_value)
            return result

        fm_dict = parse_fm(fm_text)

        # Parse tags
        tags_raw = fm_dict.get("tags", "[]")
        if isinstance(tags_raw, str):
            try:
                import ast
                tags = ast.literal_eval(tags_raw)
                if not isinstance(tags, list):
                    tags = [tags_raw]
            except Exception:
                tags = [t.strip() for t in tags_raw.strip("[]").split(",") if t.strip()]
        else:
            tags = tags_raw if isinstance(tags_raw, list) else []

        # Parse related_pages
        related_raw = fm_dict.get("related_pages", "[]")
        if isinstance(related_raw, str):
            try:
                import ast
                related_pages = ast.literal_eval(related_raw)
                if not isinstance(related_pages, list):
                    related_pages = []
            except Exception:
                related_pages = []
        else:
            related_pages = related_raw if isinstance(related_raw, list) else []

        frontmatter = WikiPageFrontmatter(
            title=fm_dict.get("title", slug),
            category=PageCategory(fm_dict.get("category", "summaries")),
            created_at=datetime.fromisoformat(fm_dict["created_at"]) if "created_at" in fm_dict else datetime.now(),
            updated_at=datetime.fromisoformat(fm_dict["updated_at"]) if "updated_at" in fm_dict else datetime.now(),
            tags=tags,
            source_id=fm_dict.get("source_id"),
            source_url=fm_dict.get("source_url"),
            related_pages=related_pages,
            problem=fm_dict.get("problem", ""),
            approach=fm_dict.get("approach", ""),
        )

        return cls(slug=slug, frontmatter=frontmatter, content=content)


class SourceDocument(BaseModel):
    id: str
    title: str
    content: str
    source_type: str = "text"
    url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    metadata: Dict[str, str] = {}


class SearchResult(BaseModel):
    page: WikiPage
    score: float
    highlights: List[str] = []


class LintIssue(BaseModel):
    issue_type: str
    page_slug: str
    description: str
    severity: str = "warning"


class LintReport(BaseModel):
    health_score: float
    issues: List[LintIssue]
    total_pages: int
    checked_at: datetime = Field(default_factory=datetime.now)
