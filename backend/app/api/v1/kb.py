from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from ...core.kb_manager import kb_manager

router = APIRouter(prefix="/kb", tags=["knowledge-bases"])


class KBCreateRequest(BaseModel):
    name: str


@router.get("")
def list_kbs():
    """列出所有知识库"""
    kbs = kb_manager.list_kbs()
    return {"knowledge_bases": kbs}


@router.post("")
def create_kb(data: KBCreateRequest):
    """创建新知识库"""
    if not data.name.strip():
        raise HTTPException(400, "知识库名称不能为空")
    entry = kb_manager.create_kb(data.name.strip())
    return {"status": "created", "knowledge_base": entry}


@router.delete("/{kb_id}")
def delete_kb(kb_id: str):
    """删除知识库及其所有数据"""
    success = kb_manager.delete_kb(kb_id)
    if not success:
        raise HTTPException(404, f"知识库不存在: {kb_id}")
    return {"status": "deleted", "kb_id": kb_id}


@router.get("/stats")
def get_kb_stats():
    """获取所有知识库的统计信息"""
    kbs = kb_manager.list_kbs()
    stats = []
    total_docs = 0
    for kb in kbs:
        engine = kb_manager.get_engine(kb["id"])
        page_count = len(engine.get_all_pages()) if engine else 0
        total_docs += page_count
        stats.append({
            "id": kb["id"],
            "name": kb["name"],
            "doc_count": page_count,
            "created_at": kb["created_at"]
        })
    return {
        "total_kbs": len(kbs),
        "total_docs": total_docs,
        "knowledge_bases": stats
    }
