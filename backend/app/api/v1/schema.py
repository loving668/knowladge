from fastapi import APIRouter
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from pathlib import Path

from ...core.schema_manager import SchemaManager

router = APIRouter(prefix="/schema", tags=["schema"])

WIKI_DIR = Path(__file__).parent.parent.parent.parent / "wiki"

schema_manager = SchemaManager(WIKI_DIR)


class SchemaUpdate(BaseModel):
    content: str


class SystemPromptRequest(BaseModel):
    task_instruction: str = ""


@router.get("/agents", response_class=PlainTextResponse)
def get_agents():
    return schema_manager.get_agents_content()


@router.put("/agents")
def update_agents(data: SchemaUpdate):
    schema_manager.set_agents_content(data.content)
    return {"message": "AGENTS.md updated successfully"}


@router.get("/schema", response_class=PlainTextResponse)
def get_schema():
    return schema_manager.get_schema_content()


@router.put("/schema")
def update_schema(data: SchemaUpdate):
    schema_manager.set_schema_content(data.content)
    return {"message": "SCHEMA.md updated successfully"}


@router.post("/system-prompt")
def build_system_prompt(data: SystemPromptRequest):
    prompt = schema_manager.build_system_prompt(data.task_instruction)
    return {
        "system_prompt": prompt,
        "length": len(prompt)
    }


@router.get("/reset")
def reset_schema():
    schema_manager.initialize_schema()
    return {"message": "Schema reset to defaults"}
