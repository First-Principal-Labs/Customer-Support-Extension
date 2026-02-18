import type { AIConfig, AIRequestMessage, AIStreamChunk } from './types.ts';
import { AI_ENDPOINTS } from './constants.ts';

export interface StreamOptions {
  signal?: AbortSignal;
}

export async function* streamChatCompletion(
  config: AIConfig,
  messages: AIRequestMessage[],
  options?: StreamOptions
): AsyncGenerator<AIStreamChunk> {
  if (!config.apiKey) {
    throw new Error('API key is not configured. Please set it in the extension settings.');
  }

  if (config.provider === 'openai') {
    yield* streamOpenAI(config, messages, options?.signal);
  } else if (config.provider === 'anthropic') {
    yield* streamAnthropic(config, messages, options?.signal);
  } else {
    throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 60000;

function buildSignal(userSignal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (userSignal) {
    return AbortSignal.any([userSignal, timeoutSignal]);
  }
  return timeoutSignal;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  userSignal?: AbortSignal,
  retries = MAX_RETRIES
): Promise<Response> {
  const signal = buildSignal(userSignal);
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, { ...init, signal });

    if (response.ok || response.status < 500) {
      return response;
    }

    // 5xx: retry with exponential backoff
    if (attempt < retries) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt))
      );
    } else {
      return response;
    }
  }
  throw new Error('Retry logic exhausted');
}

async function* streamOpenAI(
  config: AIConfig,
  messages: AIRequestMessage[],
  signal?: AbortSignal
): AsyncGenerator<AIStreamChunk> {
  const response = await fetchWithRetry(
    AI_ENDPOINTS.openai,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        ...(config.temperature !== undefined && { temperature: config.temperature }),
        ...(config.maxTokens !== undefined && { max_tokens: config.maxTokens }),
      }),
    },
    signal
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') {
        yield { content: '', done: true };
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content || '';
        if (content) {
          yield { content, done: false };
        }
      } catch {
        // skip malformed JSON
      }
    }
  }
  yield { content: '', done: true };
}

async function* streamAnthropic(
  config: AIConfig,
  messages: AIRequestMessage[],
  signal?: AbortSignal
): AsyncGenerator<AIStreamChunk> {
  const systemMessage = messages.find(m => m.role === 'system');
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const response = await fetchWithRetry(
    AI_ENDPOINTS.anthropic,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens ?? 4096,
        system: systemMessage?.content || '',
        messages: chatMessages,
        stream: true,
        ...(config.temperature !== undefined && { temperature: config.temperature }),
      }),
    },
    signal
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta') {
          yield { content: parsed.delta?.text || '', done: false };
        } else if (parsed.type === 'message_stop') {
          yield { content: '', done: true };
          return;
        }
      } catch {
        // skip malformed lines
      }
    }
  }
  yield { content: '', done: true };
}

export async function chatCompletion(
  config: AIConfig,
  messages: AIRequestMessage[],
  options?: StreamOptions
): Promise<string> {
  let result = '';
  for await (const chunk of streamChatCompletion(config, messages, options)) {
    result += chunk.content;
  }
  return result;
}
