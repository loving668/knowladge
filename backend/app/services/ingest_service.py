import uuid
from typing import List, Dict, Any
from datetime import datetime

from ..core.wiki_engine import WikiEngine
from ..core.schema_manager import SchemaManager
from ..models.wiki_page import WikiPage, SourceDocument, PageCategory


class IngestService:
    def __init__(self, wiki_engine: WikiEngine):
        self.wiki = wiki_engine
        self.schema = wiki_engine.schema_manager

    def ingest_source(
        self,
        title: str,
        content: str,
        source_type: str = "text",
        source_url: str = None
    ) -> Dict[str, Any]:
        source_id = str(uuid.uuid4())[:8]

        source_doc = SourceDocument(
            id=source_id,
            title=title,
            content=content,
            source_type=source_type,
            url=source_url
        )

        try:
            # LLM 解析：提取问题+方案+摘要+标签
            result = self._analyze_document(source_doc)
            summary_page = result["page"]
            problem = result["problem"]
            approach = result["approach"]
        except Exception as e:
            print(f"LLM processing failed: {e}")
            summary_page = self._create_fallback_summary(source_doc)
            problem = ""
            approach = ""

        # 把 problem/approach 更新到页面
        if problem or approach:
            self.wiki.update_page(summary_page.slug, 
                content=summary_page.content,
                problem=problem,
                approach=approach)

        self.wiki.write_index_file()
        self.wiki.append_log(
            "ingest",
            f"Processed: {title}\n- Problem: {problem[:100] if problem else 'N/A'}\n- Approach: {approach[:100] if approach else 'N/A'}",
            source=source_id
        )

        return {
            "source_id": source_id,
            "summary_page": summary_page.slug,
            "problem": problem,
            "approach": approach
        }

    def _create_fallback_summary(self, source: SourceDocument) -> WikiPage:
        """Fallback when LLM is unavailable - just save the raw content"""
        return self.wiki.create_page(
            title=source.title,
            category=PageCategory.SUMMARY,
            content=f"## Content\n\n{source.content[:2000]}\n\n---\n*Raw content saved without LLM processing*",
            source_id=source.id,
            source_url=source.url,
            tags=["未解析", source.source_type]
        )

    def _analyze_document(self, source: SourceDocument) -> Dict[str, Any]:
        """使用 LLM 解析文档：提取核心问题、解决方案、摘要、标签"""
        try:
            system_prompt = (
                "You are a knowledge engineer. Analyze the document and extract its core knowledge. "
                "Respond in Chinese."
            )

            prompt = f"""请分析以下文档，提取核心知识。

文档标题：{source.title}

文档内容：
{source.content[:8000]}

请按以下格式回答：

问题：
[用1-3句话描述这个文档要解决的核心问题是什么]

方案：
[用2-5句话描述这个文档是如何解决该问题的，使用了什么方法、技术或思路]

摘要：
[100-200字的内容摘要]

要点：
- 关键点1
- 关键点2
- 关键点3
- ...

标签：
标签1, 标签2, 标签3
"""

            response = self.wiki.llm_client.chat(prompt, system=system_prompt)

            problem = self._extract_section(response, "问题")
            approach = self._extract_section(response, "方案")
            summary = self._extract_section(response, "摘要")
            takeaways = self._extract_section(response, "要点")
            tags = self._extract_tags(response)

            # 构建页面内容
            content = ""
            if summary:
                content += f"## 摘要\n\n{summary}\n\n"
            if problem:
                content += f"## 核心问题\n\n{problem}\n\n"
            if approach:
                content += f"## 解决方案\n\n{approach}\n\n"
            if takeaways:
                content += f"## 要点\n\n{takeaways}\n\n"
            content += f"---\n*原文长度: {len(source.content)} 字符*"

            page = self.wiki.create_page(
                title=source.title,
                category=PageCategory.SUMMARY,
                content=content,
                source_id=source.id,
                source_url=source.url,
                tags=tags
            )

            return {
                "page": page,
                "problem": problem,
                "approach": approach
            }
        except Exception as e:
            print(f"Document analysis failed: {e}")
            raise

    def _extract_section(self, text: str, section_name: str) -> str:
        """从 LLM 响应中提取指定段落"""
        lines = text.split("\n")
        capturing = False
        result = []
        for line in lines:
            stripped = line.strip()
            if not stripped:
                if capturing:
                    continue
                else:
                    continue
            lower = stripped.lower()
            if section_name in lower and (stripped.endswith(":") or stripped.endswith("：")):
                capturing = True
                continue
            # Stop at next section header
            if capturing:
                is_header = False
                for kw in ["问题", "方案", "摘要", "要点", "标签", "problem", "approach", "summary", "tags"]:
                    if lower.startswith(kw) and (stripped.endswith(":") or stripped.endswith("：")):
                        is_header = True
                        break
                if is_header:
                    break
                result.append(stripped)
        return "\n".join(result).strip()

    def _extract_tags(self, response: str) -> List[str]:
        for line in response.split("\n"):
            if "标签" in line.lower() and ":" in line:
                tags_str = line.split(":", 1)[-1].strip()
                if not tags_str:
                    # Might be Chinese colon
                    tags_str = line.split("：", 1)[-1].strip()
                return [t.strip() for t in tags_str.split(",") if t.strip()]
        return []


