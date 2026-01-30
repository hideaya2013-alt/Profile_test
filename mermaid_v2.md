```mermaid
flowchart LR

subgraph FE[Frontend Screens]
  ChatUI[triCoachChat.ts]
  PlusUI[panel select sections]
  Input[User input]
  DevPanel[dev pack preview]
  MenuUI[triCoachMenu.ts]
end

subgraph SV[Services]
  CPS[contextPackService.buildContextPack]
  CFT[contextPackService.composeFinalText  Step1]
  Cache[chatCacheService localStorage 5 turns ]
  ProposalS[proposalService step2]
end

subgraph DB[IndexedDB SoT]
  Profile[(Profile)]
  Doctrine[(Doctrine)]
  Activities[(History/Activities)]
  Plan[(Plan)]
  Progress[(PlanProgress)]
end

subgraph BE[FastAPI]
  Health[GET /health]
  Chat[POST /v1/chat]
end

%% ---- context pack ----
PlusUI --> CPS
Profile --> CPS
Doctrine --> CPS
Activities --> CPS
Cache --> CPS
CPS --> DevPanel
CPS --> CFT
Input --> CFT
CFT --> ChatUI

%% ---- backend ----
ChatUI --> Health
ChatUI --> Chat

%% ---- cache (UI表示用：finalText禁止) ----
ChatUI --> Cache

%% ---- proposal path (Step2で有効化) ----
Chat --> ProposalS
ProposalS --> MenuUI
MenuUI --> Plan
MenuUI --> Progress
