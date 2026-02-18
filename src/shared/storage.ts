import type { AIConfig, PageRule, GeneralSettings, ConversationSession, AIRequestMessage } from './types.ts';
import { STORAGE_KEYS, DEFAULT_AI_CONFIG, DEFAULT_GENERAL_SETTINGS } from './constants.ts';

const MAX_HISTORY_MESSAGES = 25;

async function getFromStorage<T>(key: string, defaultValue: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T) ?? defaultValue;
}

async function setInStorage<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

// --- AI Config ---
export async function getAIConfig(): Promise<AIConfig> {
  return getFromStorage(STORAGE_KEYS.AI_CONFIG, DEFAULT_AI_CONFIG);
}

export async function setAIConfig(config: AIConfig): Promise<void> {
  return setInStorage(STORAGE_KEYS.AI_CONFIG, config);
}

// --- Page Rules ---
export async function getPageRules(): Promise<PageRule[]> {
  return getFromStorage(STORAGE_KEYS.PAGE_RULES, []);
}

export async function setPageRules(rules: PageRule[]): Promise<void> {
  return setInStorage(STORAGE_KEYS.PAGE_RULES, rules);
}

// --- General Settings ---
export async function getGeneralSettings(): Promise<GeneralSettings> {
  return getFromStorage(STORAGE_KEYS.GENERAL_SETTINGS, DEFAULT_GENERAL_SETTINGS);
}

export async function setGeneralSettings(settings: GeneralSettings): Promise<void> {
  return setInStorage(STORAGE_KEYS.GENERAL_SETTINGS, settings);
}

// --- Export / Import ---
export async function exportAllSettings(): Promise<string> {
  const aiConfig = await getAIConfig();
  const pageRules = await getPageRules();
  const generalSettings = await getGeneralSettings();
  const exportData = {
    aiConfig: { ...aiConfig, apiKey: '' },
    pageRules,
    generalSettings,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(exportData, null, 2);
}

export async function importSettings(json: string): Promise<void> {
  const data = JSON.parse(json);
  if (data.pageRules) await setPageRules(data.pageRules);
  if (data.generalSettings) await setGeneralSettings(data.generalSettings);
}

// --- Conversation History ---

/** Storage key scoped to a specific rule + page path to avoid cross-ticket bleed. */
export function conversationStorageKey(ruleId: string, pathname: string): string {
  return `${ruleId}::${pathname}`;
}

export async function getConversationSession(
  ruleId: string,
  pathname: string
): Promise<ConversationSession | null> {
  const all = await getFromStorage<Record<string, ConversationSession>>(
    STORAGE_KEYS.CONVERSATION_HISTORY,
    {}
  );
  return all[conversationStorageKey(ruleId, pathname)] ?? null;
}

export async function saveConversationSession(
  ruleId: string,
  pathname: string,
  query: string,
  messages: AIRequestMessage[]
): Promise<void> {
  const all = await getFromStorage<Record<string, ConversationSession>>(
    STORAGE_KEYS.CONVERSATION_HISTORY,
    {}
  );
  // Only persist user/assistant messages, capped at MAX_HISTORY_MESSAGES
  const filtered = messages
    .filter((m) => m.role !== 'system')
    .slice(-MAX_HISTORY_MESSAGES);

  all[conversationStorageKey(ruleId, pathname)] = {
    query,
    messages: filtered,
    savedAt: Date.now(),
  };
  await setInStorage(STORAGE_KEYS.CONVERSATION_HISTORY, all);
}

export async function clearConversationSession(
  ruleId: string,
  pathname: string
): Promise<void> {
  const all = await getFromStorage<Record<string, ConversationSession>>(
    STORAGE_KEYS.CONVERSATION_HISTORY,
    {}
  );
  delete all[conversationStorageKey(ruleId, pathname)];
  await setInStorage(STORAGE_KEYS.CONVERSATION_HISTORY, all);
}

export function onStorageChange(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void
): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      callback(changes);
    }
  });
}
