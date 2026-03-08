# Redis Agent Memory -- Examples

Runnable examples demonstrating `cau-redis-agent-memory` with LangChain/LangGraph JS.

## Prerequisites

1. **Redis Agent Memory Server** running at `http://localhost:8000`
2. **OPENAI_API_KEY** set in `.env` (copy `.env.example` to `.env`)
3. **Node.js** >= 18

## Setup

```bash
# From this directory
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

npm install
```

The package must be built first:

```bash
cd ../../packages/cau-redis-agent-memory
npm run build
```

## Examples

| # | Script | Focus | Needs OpenAI? |
|---|--------|-------|---------------|
| 1 | `01-chatbot-working-memory.ts` | Chatbot loop: memoryPrompt -> LLM -> fetch-append-put | Yes |
| 2 | `02-long-term-memory-crud.ts` | Create, search, get, edit, delete long-term memories | No |
| 3 | `03-langgraph-memory-agent.ts` | LangGraph StateGraph agent with memory as bound tools | Yes |
| 4 | `04-summary-views-flow.ts` | Create views, run partitions, poll tasks | No |
| 5 | `05-background-extraction-and-forget.ts` | Auto-extraction from conversations + forget policies | Yes |

## Run

```bash
npx tsx 01-chatbot-working-memory.ts
npx tsx 02-long-term-memory-crud.ts
npx tsx 03-langgraph-memory-agent.ts
npx tsx 04-summary-views-flow.ts
npx tsx 05-background-extraction-and-forget.ts
```

Or use the npm scripts:

```bash
npm run ex:01
npm run ex:02
npm run ex:03
npm run ex:04
npm run ex:05
```
