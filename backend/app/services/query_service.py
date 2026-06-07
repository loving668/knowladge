from typing import List, Dict, Any, Optional

from ..core.wiki_engine import WikiEngine
from ..core.schema_manager import SchemaManager
from ..models.wiki_page import WikiPage, PageCategory


class QueryService:
    def __init__(self, wiki_engine: WikiEngine):
        self.wiki = wiki_engine
        self.schema = wiki_engine.schema_manager

    def query(
        self,
        question: str,
        top_k: int = 5,
        context_slug: Optional[str] = None
    ) -> Dict[str, Any]:
        # 搜索整个知识库
        search_results = self.wiki.search(question, top_k=top_k)

        # 如果提供了 context_slug，将该页面作为补充上下文
        context_page_from_slug = None
        if context_slug:
            context_page_from_slug = self.wiki.get_page(context_slug)

        if not search_results and not context_page_from_slug:
            return {
                "answer": "知识库中暂时没有找到相关信息，请先导入一些文档。",
                "sources": []
            }

        # 收集最佳上下文
        context_pages = []
        page_scores = {}
        for r in search_results[:top_k]:
            if r.page.slug not in page_scores:
                context_pages.append(r.page)
                page_scores[r.page.slug] = r.score

        # 如果指定了文档，插入到首位
        if context_page_from_slug and context_page_from_slug.slug not in page_scores:
            context_pages.insert(0, context_page_from_slug)

        context = self._build_context(context_pages)

        answer = self._generate_answer(question, context, context_pages)

        self.wiki.append_log(
            "query",
            f"Question: {question[:100]}...\nAnswer length: {len(answer)} chars"
        )

        return {
            "answer": answer,
            "sources": [
                {"slug": p.slug, "title": p.title}
                for p in context_pages[:5]
            ]
        }

    def _build_context(self, pages: List[WikiPage]) -> str:
        context_parts = []
        for page in pages:
            # 包含文档的问题/方案信息作为上下文
            block = f"### [{page.title}]\n\n"
            if page.frontmatter.problem:
                block += f"**解决的问题**: {page.frontmatter.problem}\n\n"
            if page.frontmatter.approach:
                block += f"**解决方法**: {page.frontmatter.approach}\n\n"
            # 截取内容避免过长
            content = page.content[:1500] + ("..." if len(page.content) > 1500 else "")
            block += content
            context_parts.append(block)
        return "\n---\n".join(context_parts)

    def _generate_answer(
        self,
        question: str,
        context: str,
        source_pages: List[WikiPage]
    ) -> str:
        system_prompt = (
            "You are a knowledgeable AI assistant embedded in a knowledge base system. "
            "Answer the user's question based on the provided knowledge base context. "
            "Key rules:\n"
            "- Answer in Chinese\n"
            "- Be comprehensive but concise\n"
            "- If the knowledge base contains relevant information, explain it clearly\n"
            "- If not enough information, honestly say so and suggest what to add\n"
            "- At the end, list the reference documents you used"
        )

        source_list = "\n".join(f"- [{p.title}]" for p in source_pages)

        prompt = f"""以下是从知识库中检索到的最相关内容：

{context}

---
用户问题：{question}

请根据上述知识库内容，给出全面的回答。

可参考的文档：
{source_list}"""

        response = self.wiki.llm_client.chat(prompt, system=system_prompt)
        return response

    def search_pages(
        self,
        query: str,
        category: Optional[PageCategory] = None,
        top_k: int = 20
    ) -> List[Dict[str, Any]]:
        results = self.wiki.search(query, category=category, top_k=top_k)
        return [
            {
                "slug": r.page.slug,
                "title": r.page.title,
                "category": r.page.category.value,
                "score": r.score,
                "highlights": r.highlights[:2],
                "snippet": r.page.content[:200] + "..."
            }
            for r in results
        ]
