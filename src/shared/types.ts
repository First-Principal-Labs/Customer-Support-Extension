export interface PageRule {
  id: string;
  name: string;
  urlPattern: string;
  querySelector: string;
  responseSelector: string;
  prompt: string;
  memory: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export type AIProvider = 'openai' | 'anthropic';

export interface AIConfig {
  apiKey: string;
  provider: AIProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface GeneralSettings {
  theme: ThemeMode;
  toolbarPosition: 'bottom-right' | 'bottom-left';
  autoDetectSelectors: boolean;
  /** How many previous user+assistant messages to include when refining. Range: 2–25. */
  contextMessages: number;
}

export type MessageType =
  | 'GET_ACTIVE_RULE'
  | 'ACTIVE_RULE_RESPONSE'
  | 'SETTINGS_UPDATED'
  | 'INJECT_CONTENT_SCRIPT'
  | 'REMOVE_CONTENT_SCRIPT'
  | 'TEST_SELECTOR';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface AIRequestMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIStreamChunk {
  content: string;
  done: boolean;
}

/** Persisted per (ruleId + pathname). Only user/assistant messages are stored. */
export interface ConversationSession {
  /** The customer query text, used to display on restore. */
  query: string;
  /** user + assistant messages only, max 25. */
  messages: AIRequestMessage[];
  savedAt: number;
}
