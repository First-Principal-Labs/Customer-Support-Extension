import type { GeneralSettings, AIConfig } from './types.ts';

export const STORAGE_KEYS = {
  AI_CONFIG: 'aiConfig',
  PAGE_RULES: 'pageRules',
  GENERAL_SETTINGS: 'generalSettings',
  CONVERSATION_HISTORY: 'conversationHistory',
} as const;

export const DEFAULT_AI_CONFIG: AIConfig = {
  apiKey: '',
  provider: 'openai',
  model: 'gpt-4o-mini',
};

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  theme: 'system',
  toolbarPosition: 'bottom-right',
  autoDetectSelectors: true,
  contextMessages: 10,
};

export const AI_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-20250514'],
};

export const CUSTOM_MODEL_SENTINEL = '__custom__';

export const AI_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
} as const;
