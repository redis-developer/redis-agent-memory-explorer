const QUERY_EXTRACTION_PROMPT = `Extract the key topics, entities, questions, and themes from these transcript chunks. These phrases will be used as a semantic search query against long-term memory from past sessions -- optimize for retrieval relevance.

Return ONLY a comma-separated list of focused phrases (3-7 phrases). No explanation, no formatting -- just the phrases.

Focus on:
- Domain-specific topics being discussed
- Named entities (people, products, dates, amounts)
- Questions being asked
- References to past events, meetings, or decisions`;

export { QUERY_EXTRACTION_PROMPT };
