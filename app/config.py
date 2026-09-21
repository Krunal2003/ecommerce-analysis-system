from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    groq_api_key: str = "your_key_here"
    database_url: str = "sqlite:///data.db"
    port: int = 8000
    debug: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
