import math
import re
from typing import List, Dict, Set
from ..models.wiki_page import WikiPage, SearchResult, PageCategory


class BM25SearchEngine:
    def __init__(
        self,
        k1: float = 1.5,
        b: float = 0.75,
        title_boost: float = 3.0
    ):
        self.k1 = k1
        self.b = b
        self.title_boost = title_boost
        self.pages: Dict[str, WikiPage] = {}
        self._avg_doc_len: float = 0.0
        self._doc_freqs: Dict[str, int] = {}
        self._inverse_doc_freqs: Dict[str, float] = {}

    def index_pages(self, pages: List[WikiPage]) -> None:
        self.pages = {p.slug: p for p in pages}
        if not pages:
            return

        total_len = sum(len(self._tokenize(p.content)) for p in pages)
        self._avg_doc_len = total_len / len(pages)

        all_tokens: Set[str] = set()
        for page in pages:
            tokens = set(self._tokenize(page.content))
            tokens.update(self._tokenize(page.title))
            all_tokens.update(tokens)

        self._doc_freqs = {}
        for token in all_tokens:
            df = 0
            for page in pages:
                page_tokens = self._tokenize(page.content + " " + page.title)
                if token in page_tokens:
                    df += 1
            self._doc_freqs[token] = df

        n_docs = len(pages)
        self._inverse_doc_freqs = {}
        for token, df in self._doc_freqs.items():
            idf = math.log((n_docs - df + 0.5) / (df + 0.5) + 1.0)
            self._inverse_doc_freqs[token] = idf

    def _tokenize(self, text: str) -> List[str]:
        text = text.lower()
        # 英文单词 + 中文字符逐个拆分
        tokens = []
        for ch in text:
            if 'a' <= ch <= 'z' or '0' <= ch <= '9':
                tokens.append(ch)
            elif '\u4e00' <= ch <= '\u9fff':
                tokens.append(ch)
        # 合并连续的英文/数字字符为单词
        merged = []
        i = 0
        while i < len(tokens):
            t = tokens[i]
            if 'a' <= t <= 'z' or '0' <= t <= '9':
                word = []
                while i < len(tokens) and ('a' <= tokens[i] <= 'z' or '0' <= tokens[i] <= '9'):
                    word.append(tokens[i])
                    i += 1
                merged.append(''.join(word))
            else:
                merged.append(t)
                i += 1
        return merged

    def _compute_bm25_score(
        self,
        query_tokens: List[str],
        doc_tokens: List[str],
        title_tokens: List[str]
    ) -> float:
        if not doc_tokens:
            return 0.0

        doc_len = len(doc_tokens)
        score = 0.0

        for token in query_tokens:
            if token not in self._inverse_doc_freqs:
                continue

            idf = self._inverse_doc_freqs[token]
            tf = doc_tokens.count(token)

            numerator = tf * (self.k1 + 1)
            denominator = tf + self.k1 * (1 - self.b + self.b * (doc_len / self._avg_doc_len))
            tf_norm = numerator / denominator if denominator > 0 else 0

            score += idf * tf_norm

            if token in title_tokens:
                score += idf * self.title_boost

        return score

    def search(
        self,
        query: str,
        category: PageCategory = None,
        top_k: int = 20
    ) -> List[SearchResult]:
        if not self.pages:
            return []

        query_tokens = self._tokenize(query)
        if not query_tokens:
            return []

        results: List[SearchResult] = []

        for slug, page in self.pages.items():
            if category and page.category != category:
                continue

            doc_tokens = self._tokenize(page.content)
            title_tokens = self._tokenize(page.title)

            score = self._compute_bm25_score(query_tokens, doc_tokens, title_tokens)

            if score > 0:
                highlights = self._extract_highlights(query_tokens, page.content)
                results.append(SearchResult(
                    page=page,
                    score=score,
                    highlights=highlights
                ))

        results.sort(key=lambda x: x.score, reverse=True)
        return results[:top_k]

    def _extract_highlights(
        self,
        query_tokens: List[str],
        content: str,
        context_chars: int = 50
    ) -> List[str]:
        highlights: List[str] = []
        content_lower = content.lower()

        for token in query_tokens[:3]:
            pos = content_lower.find(token)
            if pos >= 0:
                start = max(0, pos - context_chars)
                end = min(len(content), pos + len(token) + context_chars)
                highlight = content[start:end]
                if highlight not in highlights:
                    highlights.append(highlight)
                if len(highlights) >= 3:
                    break

        return highlights

    def get_page(self, slug: str) -> WikiPage:
        return self.pages.get(slug)

    def get_pages_by_category(self, category: PageCategory) -> List[WikiPage]:
        return [p for p in self.pages.values() if p.category == category]
