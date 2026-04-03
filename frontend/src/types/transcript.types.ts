type TranscriptChunk = {
  timestamp: string;
  speaker: string;
  role: string;
  text: string;
};

type TranscriptMeeting = {
  id: string;
  date: string;
  type: string;
  durationMinutes: number;
  participants: Record<string, string>;
  summary: {
    topics: string[];
    sentiment: string;
    keyDecisions: string[];
    followUps: string[];
  };
};

type TranscriptData = {
  meeting: TranscriptMeeting;
  chunks: TranscriptChunk[];
};

type TranscriptSummary = {
  id: string;
  date: string;
  type: string;
  durationMinutes: number;
  chunkCount: number;
  participants: Record<string, string>;
};

export type {
  TranscriptChunk,
  TranscriptMeeting,
  TranscriptData,
  TranscriptSummary,
};
