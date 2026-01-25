from datetime import datetime, timezone
import logging
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .schemas import ChatRequest, ChatResponse, EchoRequest, EchoResponse, HasSections, HealthResponse


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tri-menu-api")

app = FastAPI(title="TriCoach Menu API", version=settings.api_version)

app.add_middleware(
  CORSMiddleware,
  allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
  allow_credentials=False,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
  now = datetime.now(timezone.utc).isoformat()
  logger.info("GET /health")
  return HealthResponse(ok=True, service="tri-menu-api", version=settings.api_version, time=now)


@app.post("/v1/echo", response_model=EchoResponse)
def echo(payload: EchoRequest) -> EchoResponse:
  logger.info("POST /v1/echo chars=%s", len(payload.text))
  try:
    text = payload.text or ""
    head = text[:300]
    sections = detect_sections(text)
    return EchoResponse(chars=len(text), head=head, hasSections=sections)
  except Exception as error:
    logger.exception("echo failed: %s", error)
    raise HTTPException(status_code=500, detail="internal error") from error


@app.post("/v1/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
  logger.info("POST /v1/chat chars=%s", len(payload.text))
  try:
    reply_text = await build_chat_reply(payload.text, payload.max_output_chars)
    return ChatResponse(replyText=reply_text, requestId=str(uuid.uuid4()))
  except Exception as error:
    logger.exception("chat failed: %s", error)
    raise HTTPException(status_code=500, detail="internal error") from error


def detect_sections(text: str) -> HasSections:
  normalized = text or ""
  return HasSections(
    always="[ALWAYS]" in normalized,
    history="[HISTORY" in normalized,
    restmenu="[RESTMENU]" in normalized,
    chat=("[RECENT CHAT]" in normalized) or ("[CHAT" in normalized),
  )


async def build_chat_reply(text: str, max_output_chars: int | None) -> str:
  if settings.openai_api_key:
    return await call_openai_placeholder(text, max_output_chars)
  return build_stub_reply(text, max_output_chars)


def build_stub_reply(text: str, max_output_chars: int | None) -> str:
  reply = f"(stub) received chars={len(text)}"
  if max_output_chars:
    return reply[:max_output_chars]
  return reply


async def call_openai_placeholder(text: str, max_output_chars: int | None) -> str:
  # TODO: replace with OpenAI API call in next iteration.
  reply = f"(stub-openai) received chars={len(text)}"
  if max_output_chars:
    return reply[:max_output_chars]
  return reply
