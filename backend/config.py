import os


class Settings:
  def __init__(self) -> None:
    self.api_version = os.getenv("TRI_MENU_API_VERSION", "0.1.0")
    self.openai_api_key = os.getenv("OPENAI_API_KEY")


settings = Settings()
