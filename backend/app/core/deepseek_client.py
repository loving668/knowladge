import os
from pathlib import Path
from dotenv import load_dotenv

# 确保 .env 在模块初始化前加载
_env_path = Path(__file__).parent.parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

from openai import OpenAI
from typing import Optional, List, Dict
import re

from ..config import get_settings

settings = get_settings()


class DeepSeekClient:
    def __init__(
        self,
        api_key: str = None,
        base_url: str = None,
        model: str = None
    ):
        self.api_key = api_key or settings.DEEPSEEK_API_KEY or os.environ.get("DEEPSEEK_API_KEY", "")
        self.base_url = base_url or settings.DEEPSEEK_BASE_URL or "https://api.deepseek.com"
        self.model = model or settings.DEEPSEEK_MODEL or "deepseek-chat"
        
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )

    def chat(
        self,
        prompt: str,
        system: Optional[str] = None,
        reasoning_effort: str = "high",
        stream: bool = False
    ) -> str:
        messages: List[Dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=stream
        )
        return response.choices[0].message.content

    def extract_json(
        self,
        prompt: str,
        system: Optional[str] = None
    ) -> str:
        """
        要求LLM返回纯JSON，并尝试提取JSON部分
        """
        response = self.chat(prompt, system)
        # 尝试提取 ```json 包裹的部分
        json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", response)
        if json_match:
            return json_match.group(1)
        # 如果没有，尝试找到第一个 { 和最后一个 }
        first_brace = response.find("{")
        last_brace = response.rfind("}")
        if first_brace != -1 and last_brace != -1:
            return response[first_brace : last_brace + 1]
        return response


deepseek_client = DeepSeekClient()
