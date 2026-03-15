from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str = ""
    GEMINI_API_KEY: Optional[str] = None
    LOG_LEVEL: str = "INFO"
    # Comma-separated CORS origins
    CORS_ORIGINS: str = "http://localhost:3000"

    # Gmail SMTP credentials for the email/sendEmail node.
    # Use a Google App Password (not your main account password).
    # Generate at: https://myaccount.google.com/apppasswords
    GMAIL_USER: Optional[str] = None
    GMAIL_APP_PASSWORD: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
