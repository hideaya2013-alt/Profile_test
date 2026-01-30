```mermaid
flowchart LR

subgraph FE[Frontend]
  UIPlus[Plus panel: select sections]
  ChatInput[User input]
  CPS[contextPackService: build payload text]
  FinalText[FinalText = payload + user message]
  ChatScreen[triCoachChat: send button]
  DevPanel[dev preview]
end

subgraph DB[IndexedDB SoT]
  DBProfile[(Profile)]
  DBDoctrine[(Doctrine)]
  DBHistory[(History/Activities)]
  DBPlan[(Plan)]
  DBProgress[(PlanProgress)]
  CacheChat[(Cache only: last turns)]
end

subgraph BE[FastAPI Backend]
  Health[GET /health]
  Echo[POST /v1/echo]
  Chat[POST /v1/chat]
end

subgraph OAI[OpenAI future]
  OAIChat[OpenAI API]
end

subgraph MENU[Menu]
  Apply[Apply by user]
  MenuUI[Menu screen]
end

DBProfile --> CPS
DBDoctrine --> CPS
DBHistory --> CPS
DBProgress --> CPS

UIPlus --> CPS
CPS --> FinalText
ChatInput --> FinalText
FinalText --> ChatScreen

ChatScreen --> Health
ChatScreen --> Echo
ChatScreen --> Chat

Chat --> OAIChat
OAIChat --> Chat

ChatScreen --> CacheChat
CacheChat --> CPS

ChatScreen --> Apply
Apply --> MenuUI
MenuUI --> DBPlan
MenuUI --> DBProgress

%% ---- styles (safe) ----
classDef fe fill:#0b2545,stroke:#3b82f6,color:#e5e7eb;
classDef db fill:#0f172a,stroke:#22c55e,color:#e5e7eb;
classDef be fill:#111827,stroke:#f59e0b,color:#e5e7eb;
classDef oai fill:#1f2937,stroke:#a855f7,color:#e5e7eb;
classDef menu fill:#0b1220,stroke:#06b6d4,color:#e5e7eb;

class UIPlus,ChatInput,CPS,FinalText,ChatScreen,DevPanel fe;
class DBProfile,DBDoctrine,DBHistory,DBPlan,DBProgress,CacheChat db;
class Health,Echo,Chat be;
class OAIChat oai;
class Apply,MenuUI menu;
