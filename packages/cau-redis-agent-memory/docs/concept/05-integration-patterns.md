# Memory Integration Patterns

## Three Patterns

The server supports three distinct integration patterns. They are **not mutually exclusive** —
production systems typically combine multiple patterns.

| Pattern         | Control       | Best For                         | Memory Flow                          |
| --------------- | ------------- | -------------------------------- | ------------------------------------ |
| LLM-Driven      | LLM decides   | Conversational agents, chatbots  | LLM ←→ tools ←→ Memory Server       |
| Code-Driven     | App code      | Applications, workflows          | Code ←→ SDK/REST ←→ Memory Server   |
| Background      | Automatic     | Learning systems                 | Conversation → Auto Extract → Memory |

**Recommended starting point**: Code-Driven for predictable behavior, then add Background
extraction for continuous learning, then LLM tools for conversational control.

---

## Pattern 1: LLM-Driven Memory (Tool-Based)

The LLM has access to memory tools and decides when to store/search memories.

### Flow

1. Application provides memory tool schemas to the LLM
2. LLM decides to call a memory tool based on conversation context
3. Application resolves the tool call against the memory server
4. Result is fed back to the LLM

### Available LLM Tools

| Tool                              | Description                                                |
| --------------------------------- | ---------------------------------------------------------- |
| `search_memory`                   | Semantic search across long-term memories                  |
| `get_long_term_memory`            | Retrieve a specific memory by ID                           |
| `eagerly_create_long_term_memory` | Create long-term memories immediately                      |
| `lazily_create_long_term_memory`  | Store in working memory for later background promotion     |
| `edit_long_term_memory`           | Update an existing memory                                  |
| `delete_long_term_memories`       | Remove long-term memories                                  |
| `get_or_create_working_memory`    | Retrieve or create a working memory session                |
| `update_working_memory_data`      | Update session-specific data in working memory             |
| `get_current_datetime`            | Get current UTC datetime for grounding time references     |

### Pros

- Flexible — works with any conversational pattern
- Contextual — LLM understands when memory is relevant
- User control — users can explicitly ask to remember/forget

### Cons

- Latency — additional round trips for tool execution
- Cost — more API calls for tool usage
- Inconsistent — LLM might not always use memory optimally
- Token overhead — tool schemas consume input tokens

---

## Pattern 2: Code-Driven Memory (Programmatic)

Application code explicitly manages memory operations.

### Flow

1. Before LLM call: search long-term memory for relevant context
2. Use `memory_prompt` to hydrate the prompt with context
3. After LLM call: store important information programmatically
4. Store conversation in working memory for background extraction

### Pros

- Predictable — you control exactly when memory operations happen
- Efficient — no token overhead, fewer API calls
- Optimizable — fine-tune storage and retrieval patterns

### Cons

- More coding — need to implement memory logic
- Less natural — memory operations don't happen organically
- Maintenance — need to maintain extraction/retrieval logic

---

## Pattern 3: Background Extraction (Automatic)

Store conversations in working memory; the system auto-extracts memories.

### Flow

1. Store conversation messages via `PUT /v1/working-memory/{session_id}`
2. Server background worker analyzes the conversation using LLM
3. Important information is extracted as structured memories
4. Extracted memories are promoted to long-term storage with deduplication

### What Gets Extracted

- User preferences and facts
- Important personal information
- Events with temporal context
- Project details and recurring topics

### Extraction Strategies

| Strategy      | Best For                                    |
| ------------- | ------------------------------------------- |
| `discrete`    | General chat, factual information (default) |
| `summary`     | Meeting notes, long conversations           |
| `preferences` | User profiles, personalization              |
| `custom`      | Domain-specific (technical, legal, medical) |

### Pros

- Zero overhead — no manual memory management
- Continuous learning — system improves over time
- Deduplication — prevents duplicate memories
- Contextual grounding — resolves pronouns ("he" → "John")

### Cons

- Delayed availability — extraction happens in background
- Potential noise — may capture irrelevant info (mitigate with custom prompts)
- Requires context — works best with rich conversational data

---

## Hybrid Patterns

### Code + Background (Most Common in Production)

1. **Code-driven retrieval**: Use `memory_prompt` to fetch context before LLM call
2. **Background extraction**: Store conversation in working memory for auto-extraction
3. Result: Predictable retrieval + continuous learning

### LLM Tools + Background

1. **LLM tools**: Let the LLM decide when to store/search
2. **Background extraction**: Auto-extract from stored conversations
3. Result: Conversational control + safety net for missed information

---

## Memory Prompt — Context Hydration

The `POST /v1/memory/prompt` endpoint is the key integration point for both Code-Driven
and Hybrid patterns.

### What It Does

1. Retrieves working memory (conversation history + context summary) for the session
2. Searches long-term memory for relevant context matching the query
3. Assembles a ready-to-send prompt with all context included

### Request

```json
{
  "query": "What are the user's preferences?",
  "session": {
    "session_id": "session-123",
    "user_id": "alice",
    "model_name": "gpt-4o"
  },
  "long_term_search": {
    "text": "user preferences",
    "limit": 5,
    "user_id": { "eq": "alice" }
  }
}
```

### Response

```json
{
  "messages": [
    { "role": "system", "content": "...context with memories and conversation history..." },
    { "role": "user", "content": "previous message" },
    { "role": "assistant", "content": "previous response" },
    ...
  ]
}
```

The returned `messages` array is ready to be sent directly to the LLM API.
