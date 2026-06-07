import os
from pathlib import Path
from typing import Optional, Dict, Any

from dotenv import load_dotenv

# 自动加载 backend/.env
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)


class Settings:
    APP_NAME: str = "AI Agent Platform"
    APP_VERSION: str = "1.0.0"
    DESCRIPTION: str = "The intelligent AI Agent platform, integrating knowledge management and skill orchestration, enables users to build efficient and smart workspaces."
    API_PREFIX: str = "/api/v1"
    CORS_ORIGINS: list = ["*"]
    
    # Vector storage
    VECTOR_STORE_TYPE: str = "local"
    VECTOR_STORE_PATH: str = "data/vectors"
    
    # Database
    DATABASE_URL: str = "sqlite:///data/agent_platform.db"
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = "1234"
    MYSQL_DATABASE: str = "llm_wiki"
    
    # LLM Configuration (DeepSeek)
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_BASE_URL: Optional[str] = None
    DEEPSEEK_MODEL: str = "deepseek-chat"
    
    LLM_API_KEY: Optional[str] = None
    LLM_BASE_URL: Optional[str] = None


_settings: Optional[Settings] = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
        
        # Load from environment variables
        for key, value in os.environ.items():
            if hasattr(_settings, key):
                setattr(_settings, key, value)
                
    return _settings
