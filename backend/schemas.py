from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
  ok: bool = True
  service: str = "tri-menu-api"
  version: str
  time: str


class EchoRequest(BaseModel):
  text: str
  options: dict | None = None
  meta: dict | None = None


class HasSections(BaseModel):
  always: bool
  history: bool
  restmenu: bool
  chat: bool


class EchoResponse(BaseModel):
  chars: int
  head: str
  hasSections: HasSections


class ChatRequest(BaseModel):
  text: str
  max_output_chars: int | None = Field(default=None, ge=1)


class ChatResponse(BaseModel):
  replyText: str
  requestId: str
