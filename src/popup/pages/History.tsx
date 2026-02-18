import { useState, useEffect, useCallback } from 'react';
import type { ConversationSession, AIRequestMessage } from '@shared/types.ts';
import { STORAGE_KEYS } from '@shared/constants.ts';
import { getPageRules } from '@shared/storage.ts';

interface SessionEntry {
  key: string;        // "ruleId::pathname"
  ruleId: string;
  pathname: string;
  ruleName: string;
  session: ConversationSession;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function MessageBubble({ msg }: { msg: AIRequestMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`history-bubble history-bubble--${isUser ? 'user' : 'assistant'}`}>
      <span className="history-bubble-role">{isUser ? 'You' : 'AI'}</span>
      <p className="history-bubble-text">{msg.content}</p>
    </div>
  );
}

function HistoryCard({
  entry,
  isExpanded,
  onToggle,
  onClear,
}: {
  entry: SessionEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onClear: () => void;
}) {
  const { session, ruleName, pathname } = entry;
  const exchangeCount = Math.floor(session.messages.length / 2);
  const queryPreview = session.query.length > 80
    ? session.query.slice(0, 80) + '…'
    : session.query;

  return (
    <div className={`history-card ${isExpanded ? 'history-card--open' : ''}`}>
      <div className="history-card-header" onClick={onToggle}>
        <div className="history-card-meta">
          <span className="history-rule-badge">{ruleName}</span>
          <span className="history-time">{timeAgo(session.savedAt)}</span>
        </div>
        <p className="history-query-preview">{queryPreview}</p>
        <div className="history-card-footer">
          <span className="history-exchange-count">
            {exchangeCount} exchange{exchangeCount !== 1 ? 's' : ''}
            {' · '}
            <span className="history-pathname" title={pathname}>{pathname}</span>
          </span>
          <div className="history-card-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="btn btn-danger btn-sm"
              onClick={onClear}
              title="Delete this session"
            >
              Delete
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onToggle}>
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="history-thread">
          <div className="history-query-full">
            <span className="history-bubble-role">Customer Query</span>
            <p className="history-bubble-text">{session.query}</p>
          </div>
          {session.messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function History() {
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const loadHistory = useCallback(async () => {
    const [raw, rules] = await Promise.all([
      chrome.storage.local.get(STORAGE_KEYS.CONVERSATION_HISTORY),
      getPageRules(),
    ]);
    const historyMap = (raw[STORAGE_KEYS.CONVERSATION_HISTORY] ?? {}) as Record<string, ConversationSession>;
    const ruleMap = new Map(rules.map((r) => [r.id, r.name]));

    const parsed: SessionEntry[] = Object.entries(historyMap).map(([key, session]) => {
      const sep = key.indexOf('::');
      const ruleId = sep === -1 ? key : key.slice(0, sep);
      const pathname = sep === -1 ? '' : key.slice(sep + 2);
      return { key, ruleId, pathname, ruleName: ruleMap.get(ruleId) ?? 'Unknown Rule', session };
    });

    parsed.sort((a, b) => b.session.savedAt - a.session.savedAt);
    setEntries(parsed);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadHistory();
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === 'local' && changes[STORAGE_KEYS.CONVERSATION_HISTORY]) loadHistory();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [loadHistory]);

  const clearSession = async (key: string) => {
    const raw = await chrome.storage.local.get(STORAGE_KEYS.CONVERSATION_HISTORY);
    const map = (raw[STORAGE_KEYS.CONVERSATION_HISTORY] ?? {}) as Record<string, ConversationSession>;
    delete map[key];
    await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATION_HISTORY]: map });
    if (expanded === key) setExpanded(null);
  };

  const clearAll = async () => {
    await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATION_HISTORY]: {} });
    setExpanded(null);
    setShowClearConfirm(false);
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading…</div>;

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p>No conversation history yet.</p>
        <p style={{ fontSize: '12px' }}>
          Generate and refine responses on supported pages to see sessions here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="history-toolbar">
        <span className="history-count">
          {entries.length} session{entries.length !== 1 ? 's' : ''}
        </span>
        {!showClearConfirm ? (
          <button className="btn btn-danger btn-sm" onClick={() => setShowClearConfirm(true)}>
            Clear All
          </button>
        ) : (
          <div className="history-confirm-inline">
            <span>Sure?</span>
            <button className="btn btn-danger btn-sm" onClick={clearAll}>Yes, clear</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowClearConfirm(false)}>No</button>
          </div>
        )}
      </div>

      {entries.map((entry) => (
        <HistoryCard
          key={entry.key}
          entry={entry}
          isExpanded={expanded === entry.key}
          onToggle={() => setExpanded(expanded === entry.key ? null : entry.key)}
          onClear={() => clearSession(entry.key)}
        />
      ))}
    </div>
  );
}
