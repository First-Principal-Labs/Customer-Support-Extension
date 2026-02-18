import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Minus,
  X,
  Wand2,
  ClipboardCopy,
  Check,
  AlertCircle,
  RefreshCw,
  Send,
  Square,
  Pencil,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { PageRule, AIConfig, GeneralSettings, AIRequestMessage } from '@shared/types.ts';
import { getAIConfig, getPageRules, getGeneralSettings, getConversationSession, saveConversationSession, clearConversationSession } from '@shared/storage.ts';
import { STORAGE_KEYS } from '@shared/constants.ts';
import { findMatchingRule } from '@shared/url-matcher.ts';
import { streamChatCompletion } from '@shared/ai-client.ts';
import { retrieveRelevantContext, RAG_MEMORY_THRESHOLD } from '@shared/rag.ts';

function autoDetectQueryElement(): HTMLElement | null {
  const selectors = [
    '[data-role="customer-message"]',
    '[data-role="question"]',
    '.ticket-body',
    '.customer-message',
    '.question-body',
    '.issue-description',
    '.comment-body',
    '.message-content',
    '.post-body',
    '.thread-message:first-child',
  ];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el && el.innerText.trim()) return el;
  }
  return null;
}

function autoDetectResponseField(): HTMLElement | null {
  const selectors = [
    'textarea[name*="reply"]',
    'textarea[name*="response"]',
    'textarea[name*="comment"]',
    'textarea[name*="message"]',
    'textarea[name*="answer"]',
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"]',
    'textarea.reply',
    'textarea#reply',
    'textarea',
  ];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

function getElementText(el: HTMLElement): string {
  return el.innerText?.trim() || el.textContent?.trim() || '';
}

function fillResponseField(el: HTMLElement, text: string) {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const nativeSetter =
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set ||
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(el, text);
    } else {
      el.value = text;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (el.isContentEditable) {
    el.innerText = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  el.focus();
}

function findSendButton(): HTMLElement | null {
  // 1. Attribute-based selectors (fast path)
  const attrSelectors = [
    'button[type="submit"]',
    'button[data-action="send"]',
    'button[data-action="reply"]',
    'button[data-action="submit"]',
    'input[type="submit"]',
    'button.send',
    'button.reply',
    'button.submit',
    '[aria-label*="Send" i]',
    '[aria-label*="Reply" i]',
    '[aria-label*="Submit" i]',
  ];
  for (const sel of attrSelectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }

  // 2. Text-content fallback — match button whose visible text includes send/reply keywords
  const sendKeywords = /^(send|send email|send reply|reply|submit)$/i;
  const buttons = document.querySelectorAll<HTMLElement>('button, input[type="button"]');
  for (const btn of buttons) {
    const text = (btn.innerText || btn.textContent || '').trim();
    if (sendKeywords.test(text)) return btn;
  }

  return null;
}

/**
 * Build the system prompt.
 * @param resolvedMemory - Already-retrieved memory context (full or RAG-filtered).
 *                         Pass undefined to skip the knowledge base section.
 */
function buildSystemPrompt(rule: PageRule, resolvedMemory?: string): string {
  let system = rule.prompt || 'You are a professional customer support agent. Draft a helpful, clear response to the customer query below.';
  if (resolvedMemory) {
    const isRagFiltered = rule.memory.length > RAG_MEMORY_THRESHOLD;
    const label = isRagFiltered ? 'Relevant Knowledge Base (retrieved)' : 'Knowledge Base';
    system += `\n\n${label}:\n${resolvedMemory}`;
  }
  system += '\n\nIMPORTANT: Respond with ONLY the reply text. No greetings like "Here is a response". Just the actual response the support agent should send to the customer.';
  return system;
}

export default function AutofillToolbar() {
  const [rule, setRule] = useState<PageRule | null>(null);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [status, setStatus] = useState<'idle' | 'reading' | 'generating' | 'done' | 'error'>('idle');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [queryExpanded, setQueryExpanded] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<AIRequestMessage[]>([]);
  const [refinementInput, setRefinementInput] = useState('');
  const [isRestored, setIsRestored] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Initial load + history restore
  useEffect(() => {
    async function load() {
      const [rules, config, generalSettings] = await Promise.all([
        getPageRules(),
        getAIConfig(),
        getGeneralSettings(),
      ]);
      const currentUrl = window.location.href;
      const matchingRule = findMatchingRule(currentUrl, rules);
      if (!matchingRule) return;

      setRule(matchingRule);
      setAiConfig(config);
      setSettings(generalSettings);

      // Restore previous session for this rule + page
      const session = await getConversationSession(matchingRule.id, window.location.pathname);
      if (session && session.messages.length > 0) {
        const lastAssistant = [...session.messages].reverse().find((m) => m.role === 'assistant');
        if (lastAssistant) {
          // Rebuild full history including a fresh system message
          const resolvedMemory = matchingRule.memory
            ? retrieveRelevantContext(matchingRule.memory, session.query)
            : undefined;
          const systemContent = buildSystemPrompt(matchingRule, resolvedMemory);
          setConversationHistory([
            { role: 'system', content: systemContent },
            ...session.messages,
          ]);
          setPreview(lastAssistant.content);
          setCustomerQuery(session.query);
          setStatus('done');
          setIsRestored(true);
        }
      }
    }
    load();
  }, []);

  // Live settings reload (#18)
  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== 'local') return;

      if (changes[STORAGE_KEYS.AI_CONFIG]?.newValue) {
        setAiConfig(changes[STORAGE_KEYS.AI_CONFIG].newValue as AIConfig);
      }
      if (changes[STORAGE_KEYS.GENERAL_SETTINGS]?.newValue) {
        setSettings(changes[STORAGE_KEYS.GENERAL_SETTINGS].newValue as GeneralSettings);
      }
      if (changes[STORAGE_KEYS.PAGE_RULES]?.newValue) {
        const rules = changes[STORAGE_KEYS.PAGE_RULES].newValue as PageRule[];
        const currentUrl = window.location.href;
        const matchingRule = findMatchingRule(currentUrl, rules);
        setRule(matchingRule);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Drag handlers (#15)
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Only left-click
    if (e.button !== 0) return;
    const panel = (e.target as HTMLElement).closest('.toolbar-panel') as HTMLElement | null;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
    };

    const handleDragMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setDragPos({
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
      });
    };

    const handleDragEnd = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }, []);

  // Apply dark mode class to shadow host (#13 prep)
  useEffect(() => {
    if (!settings) return;
    const host = document.getElementById('ai-support-agent-root');
    if (!host) return;
    host.classList.remove('dark', 'light');
    if (settings.theme === 'dark') {
      host.classList.add('dark');
    } else if (settings.theme === 'light') {
      host.classList.add('light');
    }
  }, [settings?.theme]);

  const readCustomerQuery = useCallback((): string | null => {
    if (!rule) return null;

    let queryEl: HTMLElement | null = null;
    if (rule.querySelector) {
      queryEl = document.querySelector<HTMLElement>(rule.querySelector);
    }
    if (!queryEl && settings?.autoDetectSelectors) {
      queryEl = autoDetectQueryElement();
    }

    if (queryEl) {
      const text = getElementText(queryEl);
      if (text) return text;
    }
    return null;
  }, [rule, settings]);

  const findResponseField = useCallback((): HTMLElement | null => {
    if (!rule) return null;

    let responseEl: HTMLElement | null = null;
    if (rule.responseSelector) {
      responseEl = document.querySelector<HTMLElement>(rule.responseSelector);
    }
    if (!responseEl && settings?.autoDetectSelectors) {
      responseEl = autoDetectResponseField();
    }
    return responseEl;
  }, [rule, settings]);

  const handleGenerate = useCallback(async () => {
    if (!rule || !aiConfig) return;

    setError('');
    setPreview('');
    setStatus('reading');
    setConversationHistory([]);
    setRefinementInput('');
    setQueryExpanded(false);
    setIsRestored(false);

    const query = readCustomerQuery();
    if (!query) {
      setError('Could not find the customer query on this page. Check your Query Selector in the page rule settings.');
      setStatus('error');
      return;
    }
    setCustomerQuery(query);
    setStatus('generating');

    // RAG: retrieve only relevant chunks when memory is large
    const resolvedMemory = rule.memory
      ? retrieveRelevantContext(rule.memory, query)
      : undefined;

    const systemContent = buildSystemPrompt(rule, resolvedMemory);
    const messages: AIRequestMessage[] = [
      { role: 'system', content: systemContent },
      { role: 'user', content: `Customer query:\n${query}` },
    ];

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let content = '';
      for await (const chunk of streamChatCompletion(aiConfig, messages, { signal: controller.signal })) {
        if (chunk.done) break;
        content += chunk.content;
        setPreview(content);
      }
      setPreview(content);
      setStatus('done');
      const updatedHistory = [...messages, { role: 'assistant' as const, content }];
      setConversationHistory(updatedHistory);
      // Persist to storage (saves user+assistant messages only)
      await saveConversationSession(rule.id, window.location.pathname, query, updatedHistory);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus(preview ? 'done' : 'idle');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to generate response');
      setStatus('error');
    } finally {
      abortControllerRef.current = null;
    }
  }, [rule, aiConfig, readCustomerQuery, preview]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const handleRefine = useCallback(async () => {
    if (!refinementInput.trim() || !aiConfig || !rule || conversationHistory.length === 0) return;

    const instruction = refinementInput.trim();
    setRefinementInput('');
    setStatus('generating');
    setError('');

    const messages: AIRequestMessage[] = [
      ...conversationHistory,
      { role: 'user', content: instruction },
    ];

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let content = '';
      for await (const chunk of streamChatCompletion(aiConfig, messages, { signal: controller.signal })) {
        if (chunk.done) break;
        content += chunk.content;
        setPreview(content);
      }
      setPreview(content);
      setStatus('done');
      const updatedHistory = [...messages, { role: 'assistant' as const, content }];
      setConversationHistory(updatedHistory);
      // Persist updated history after each refinement
      await saveConversationSession(rule.id, window.location.pathname, customerQuery, updatedHistory);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus(preview ? 'done' : 'idle');
        return;
      }
      setError(err instanceof Error ? err.message : 'Refinement failed');
      setStatus('error');
    } finally {
      abortControllerRef.current = null;
    }
  }, [refinementInput, conversationHistory, aiConfig, rule, customerQuery, preview]);

  const handleAutofill = useCallback(async () => {
    const responseEl = findResponseField();
    if (!responseEl) {
      setError('Could not find the response field. Check your Response Selector in the page rule settings.');
      return;
    }
    fillResponseField(responseEl, preview);
    if (rule) await clearConversationSession(rule.id, window.location.pathname);
    setStatus('idle');
    setPreview('');
    setIsRestored(false);
  }, [preview, findResponseField, rule]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(preview);
      setCopyFeedback('copied');
    } catch {
      setCopyFeedback('failed');
    }
    setTimeout(() => setCopyFeedback('idle'), 2000);
  }, [preview]);

  const handleSend = useCallback(async () => {
    const responseEl = findResponseField();
    if (!responseEl) {
      setError('Could not find the response field. Check your Response Selector in the page rule settings.');
      return;
    }
    fillResponseField(responseEl, preview);

    const sendBtn = findSendButton();
    if (sendBtn) {
      sendBtn.click();
      if (rule) await clearConversationSession(rule.id, window.location.pathname);
      setStatus('idle');
      setPreview('');
      setIsRestored(false);
    } else {
      setError('Could not find a send/submit button on this page. Use "Fill Response" instead.');
    }
  }, [preview, findResponseField, rule]);

  if (!rule || !aiConfig || !settings || isDismissed) return null;

  const position = settings.toolbarPosition;
  const queryTruncated = customerQuery.length > 120;

  const renderQueryPreview = () => {
    if (!customerQuery) return null;
    return (
      <div className="toolbar-query-preview" onClick={() => queryTruncated && setQueryExpanded(!queryExpanded)}>
        <strong>Query:</strong>{' '}
        {queryExpanded || !queryTruncated
          ? customerQuery
          : customerQuery.substring(0, 120) + '...'}
        {queryTruncated && (
          <button className="toolbar-expand-btn" type="button">
            {queryExpanded ? <><ChevronUp size={12} /> Less</> : <><ChevronDown size={12} /> More</>}
          </button>
        )}
      </div>
    );
  };

  const panelStyle: React.CSSProperties = dragPos
    ? { left: dragPos.x, top: dragPos.y, bottom: 'auto', right: 'auto' }
    : {};

  if (isMinimized) {
    return (
      <button
        className={`toolbar-fab ${dragPos ? '' : position}`}
        style={dragPos ? { position: 'fixed', left: dragPos.x, top: dragPos.y, bottom: 'auto', right: 'auto' } : {}}
        onClick={() => setIsMinimized(false)}
        title="AI Support Agent"
      >
        <MessageSquare size={24} />
      </button>
    );
  }

  return (
    <div
      className={`toolbar-panel ${dragPos ? '' : position}`}
      style={panelStyle}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      <div className="toolbar-header" onMouseDown={handleDragStart}>
        <span className="toolbar-title">{rule.name}</span>
        {/* Model indicator (#17) */}
        <div className="toolbar-model-badge">
          {aiConfig.provider === 'openai' ? 'OpenAI' : 'Anthropic'}: {aiConfig.model}
        </div>
        <div className="toolbar-header-actions">
          <button className="toolbar-icon-btn" onClick={() => setIsMinimized(true)} title="Minimize">
            <Minus size={14} />
          </button>
          <button className="toolbar-icon-btn" onClick={() => setIsDismissed(true)} title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="toolbar-body">
        {status === 'idle' && (
          <div className="toolbar-idle">
            <p>Click below to read the customer query and generate a response.</p>
            <button className="toolbar-btn toolbar-btn-primary" onClick={handleGenerate}>
              <Wand2 size={14} /> Generate Response
            </button>
          </div>
        )}

        {status === 'reading' && (
          <div className="toolbar-status">
            <div className="toolbar-spinner" />
            <span>Reading customer query...</span>
          </div>
        )}

        {status === 'generating' && (
          <div className="toolbar-generating">
            {renderQueryPreview()}
            <div className="toolbar-status">
              <div className="toolbar-spinner" />
              <span>Generating response...</span>
              <button className="toolbar-btn toolbar-btn-danger toolbar-btn-sm" onClick={handleCancel}>
                <Square size={12} /> Cancel
              </button>
            </div>
            {preview && (
              <div className="toolbar-preview">{preview}</div>
            )}
          </div>
        )}

        {status === 'done' && (
          <div className="toolbar-done">
            {isRestored && (
              <div className="toolbar-restored-badge">
                <RefreshCw size={11} /> Restored from previous session
              </div>
            )}
            {renderQueryPreview()}
            <textarea
              className="toolbar-preview-editable"
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              rows={6}
            />
            <div className="toolbar-actions">
              <button className="toolbar-btn toolbar-btn-primary" onClick={handleAutofill} title="Fill response field">
                <Pencil size={14} /> Fill
              </button>
              <button className="toolbar-btn toolbar-btn-success" onClick={handleSend} title="Fill and send">
                <Send size={14} /> Send
              </button>
              <button className="toolbar-btn toolbar-btn-secondary" onClick={handleCopy} title="Copy to clipboard">
                {copyFeedback === 'copied'
                  ? <><Check size={14} /> Copied</>
                  : copyFeedback === 'failed'
                    ? <><AlertCircle size={14} /> Failed</>
                    : <><ClipboardCopy size={14} /> Copy</>}
              </button>
              <button className="toolbar-btn toolbar-btn-secondary" onClick={handleGenerate} title="Regenerate">
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="toolbar-refine">
              <input
                className="toolbar-refine-input"
                type="text"
                value={refinementInput}
                onChange={(e) => setRefinementInput(e.target.value)}
                placeholder="Make it shorter, add greeting..."
                onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
              />
              <button
                className="toolbar-btn toolbar-btn-primary toolbar-btn-sm"
                onClick={handleRefine}
                disabled={!refinementInput.trim()}
                title="Refine response"
              >
                <Wand2 size={12} /> Refine
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="toolbar-error">
            <p>{error}</p>
            <button className="toolbar-btn toolbar-btn-secondary" onClick={() => setStatus('idle')}>
              <RefreshCw size={14} /> Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
