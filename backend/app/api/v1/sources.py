from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from html.parser import HTMLParser
import re

from ...core.kb_manager import kb_manager
from ...services.ingest_service import IngestService

router = APIRouter(tags=["sources"])


class _HTMLStripper(HTMLParser):
    """Extract readable text from HTML, stripping all tags"""
    def __init__(self):
        super().__init__()
        self.text: List[str] = []
        self.skip_tags = {"script", "style", "noscript", "iframe", "svg", "head"}
        self.current_tag: Optional[str] = None

    def handle_starttag(self, tag: str, attrs):
        self.current_tag = tag.lower()

    def handle_endtag(self, tag: str):
        if self.current_tag == tag.lower():
            self.current_tag = None

    def handle_data(self, data: str):
        if self.current_tag and self.current_tag in self.skip_tags:
            return
        stripped = data.strip()
        if stripped:
            self.text.append(stripped)


def _extract_text_from_html(html: str) -> str:
    """Convert HTML to plain text, preserving basic structure"""
    stripper = _HTMLStripper()
    try:
        stripper.feed(html)
    except Exception:
        pass
    text = "\n".join(stripper.text)
    # Collapse excessive whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


class IngestRequest(BaseModel):
    title: str
    content: str
    source_type: str = "text"
    source_url: Optional[str] = None


class SourceInfo(BaseModel):
    id: str
    title: str
    source_type: str
    url: Optional[str]
    file_path: Optional[str]


def _get_engine(kb_id: str):
    engine = kb_manager.get_engine(kb_id)
    if not engine:
        raise HTTPException(404, f"知识库不存在: {kb_id}")
    return engine


@router.post("/kb/{kb_id}/sources/ingest")
def ingest_source(kb_id: str, data: IngestRequest):
    engine = _get_engine(kb_id)
    ingest_service = IngestService(engine)
    result = ingest_service.ingest_source(
        title=data.title,
        content=data.content,
        source_type=data.source_type,
        source_url=data.source_url
    )

    return {
        "status": "success",
        "source_id": result["source_id"],
        "summary_page": result["summary_page"]
    }


@router.post("/kb/{kb_id}/sources/ingest/batch")
async def ingest_files_batch(
    kb_id: str,
    files: List[UploadFile] = File(...)
):
    """批量上传文件，每个文件自动 LLM 解析"""
    engine = _get_engine(kb_id)
    ingest_service = IngestService(engine)

    results = []
    for file in files:
        content = await file.read()
        try:
            text_content = content.decode("utf-8")
        except UnicodeDecodeError:
            text_content = content.decode("utf-8", errors="ignore")

        source_title = file.filename or "Untitled"

        result = ingest_service.ingest_source(
            title=source_title,
            content=text_content,
            source_type="file",
            source_url=None
        )

        source_id = result["source_id"]
        source_file = engine.sources_dir / f"{source_id}_{file.filename}"
        source_file.write_bytes(content)

        results.append({
            "filename": file.filename,
            "source_id": source_id,
            "summary_page": result.get("summary_page", ""),
            "problem": result.get("problem", ""),
            "approach": result.get("approach", "")
        })

    return {
        "status": "success",
        "total": len(results),
        "results": results
    }


@router.post("/kb/{kb_id}/sources/ingest/file")
async def ingest_file(
    kb_id: str,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None)
):
    engine = _get_engine(kb_id)
    ingest_service = IngestService(engine)
    content = await file.read()

    try:
        text_content = content.decode("utf-8")
    except UnicodeDecodeError:
        text_content = content.decode("utf-8", errors="ignore")

    source_title = title or file.filename or "Untitled"

    result = ingest_service.ingest_source(
        title=source_title,
        content=text_content,
        source_type="file",
        source_url=None
    )

    source_id = result["source_id"]
    source_file = engine.sources_dir / f"{source_id}_{file.filename}"
    source_file.write_bytes(content)

    return {
        "status": "success",
        "filename": file.filename,
        "source_id": source_id,
        "summary_page": result["summary_page"]
    }


@router.post("/kb/{kb_id}/sources/ingest/url")
def ingest_url(kb_id: str, data: dict):
    engine = _get_engine(kb_id)
    ingest_service = IngestService(engine)
    import requests

    url = data.get("url")
    title = data.get("title")

    if not url:
        raise HTTPException(400, "URL is required")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }

    try:
        response = requests.get(url, headers=headers, timeout=30, allow_redirects=True)
        response.raise_for_status()
        response.encoding = response.apparent_encoding
        content = response.text
        if not content or len(content.strip()) < 100:
            raise HTTPException(400, f"抓取到的内容过短（{len(content)} 字符），可能页面为空或被拦截")
    except requests.exceptions.Timeout:
        raise HTTPException(400, f"请求超时: {url}")
    except requests.exceptions.ConnectionError:
        raise HTTPException(400, f"无法连接到目标网站: {url}")
    except requests.exceptions.HTTPError as e:
        raise HTTPException(400, f"目标网站返回错误 (HTTP {e.response.status_code}): {url}")
    except Exception as e:
        raise HTTPException(400, f"抓取失败: {str(e)}")

    source_title = title or url.split("/")[-1] or "Web Page"

    # Extract plain text from HTML for better LLM processing
    text_content = _extract_text_from_html(content)
    if len(text_content) < 50:
        text_content = content  # fallback to raw if HTML extraction produced too little

    result = ingest_service.ingest_source(
        title=source_title,
        content=text_content,
        source_type="web",
        source_url=url
    )

    return {
        "status": "success",
        "url": url,
        "source_id": result["source_id"],
        "summary_page": result["summary_page"]
    }


@router.get("/kb/{kb_id}/sources/list")
def list_sources(kb_id: str):
    engine = _get_engine(kb_id)
    sources: List[SourceInfo] = []

    for file_path in engine.sources_dir.glob("*"):
        if file_path.is_file() and not file_path.name.startswith("."):
            sources.append(SourceInfo(
                id=file_path.stem,
                title=file_path.name,
                source_type="file",
                url=None,
                file_path=str(file_path)
            ))

    return {
        "total": len(sources),
        "sources": [s.model_dump() for s in sources]
    }


@router.get("/kb/{kb_id}/sources/{source_id}")
def get_source(kb_id: str, source_id: str):
    engine = _get_engine(kb_id)
    for file_path in engine.sources_dir.glob(f"{source_id}*"):
        if file_path.is_file():
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            return {
                "id": source_id,
                "filename": file_path.name,
                "content": content[:10000],
                "full_length": len(content)
            }

    raise HTTPException(404, f"Source not found: {source_id}")


@router.delete("/kb/{kb_id}/sources/{source_id}")
def delete_source(kb_id: str, source_id: str):
    engine = _get_engine(kb_id)
    deleted = False
    for file_path in engine.sources_dir.glob(f"{source_id}*"):
        if file_path.is_file():
            file_path.unlink()
            deleted = True

    if not deleted:
        raise HTTPException(404, f"Source not found: {source_id}")

    return {"message": f"Source {source_id} deleted"}
