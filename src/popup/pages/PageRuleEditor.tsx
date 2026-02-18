import { useState } from 'react';
import type { PageRule } from '@shared/types.ts';
import PatternInput from '../components/PatternInput.tsx';
import SelectorTester from '../components/SelectorTester.tsx';
import '../styles/fullscreen-editor.css';

interface PageRuleEditorProps {
  rule?: PageRule;
  onSave: (data: Omit<PageRule, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export default function PageRuleEditor({ rule, onSave, onCancel }: PageRuleEditorProps) {
  const [name, setName] = useState(rule?.name || '');
  const [urlPattern, setUrlPattern] = useState(rule?.urlPattern || '');
  const [querySelector, setQuerySelector] = useState(rule?.querySelector || '');
  const [responseSelector, setResponseSelector] = useState(rule?.responseSelector || '');
  const [prompt, setPrompt] = useState(rule?.prompt || '');
  const [memory, setMemory] = useState(rule?.memory || '');
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [fullscreenField, setFullscreenField] = useState<'prompt' | 'memory' | null>(null);
  const [fullscreenValue, setFullscreenValue] = useState('');

  const canSave = name.trim() && urlPattern.trim();

  const openFullscreenEditor = (field: 'prompt' | 'memory') => {
    setFullscreenField(field);
    setFullscreenValue(field === 'prompt' ? prompt : memory);
    // Request fullscreen on the next render
    setTimeout(() => {
      const editor = document.querySelector('.fullscreen-editor-overlay') as HTMLElement;
      if (editor && editor.requestFullscreen) {
        editor.requestFullscreen().catch(err => {
          alert('Failed to enter fullscreen mode. Please allow fullscreen for this extension in your browser settings.');
          console.log('Fullscreen request failed:', err);
        });
      }
    }, 10);
  };

  const closeFullscreenEditor = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setFullscreenField(null);
  };

  const saveFullscreenContent = () => {
    if (fullscreenField === 'prompt') {
      setPrompt(fullscreenValue);
    } else if (fullscreenField === 'memory') {
      setMemory(fullscreenValue);
    }
    closeFullscreenEditor();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      name: name.trim(),
      urlPattern: urlPattern.trim(),
      querySelector: querySelector.trim(),
      responseSelector: responseSelector.trim(),
      prompt: prompt.trim(),
      memory: memory.trim(),
      isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600 }}>
          {rule ? 'Edit Rule' : 'New Rule'}
        </h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className="form-group">
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Zendesk Support"
        />
      </div>

      <div className="form-group">
        <label>URL Pattern</label>
        <PatternInput value={urlPattern} onChange={setUrlPattern} />
      </div>

      <div className="form-group">
        <label>Customer Query Selector</label>
        <input
          type="text"
          value={querySelector}
          onChange={(e) => setQuerySelector(e.target.value)}
          placeholder="e.g., .ticket-body, #customer-message"
        />
        <div className="hint">
          CSS selector for the element containing the customer's question/ticket. Leave empty to auto-detect.
        </div>
        {querySelector.trim() && <SelectorTester selector={querySelector} />}
      </div>

      <div className="form-group">
        <label>Response Field Selector</label>
        <input
          type="text"
          value={responseSelector}
          onChange={(e) => setResponseSelector(e.target.value)}
          placeholder="e.g., textarea.reply, #response-box, [contenteditable]"
        />
        <div className="hint">
          CSS selector for the textarea/input where the AI response will be filled. Leave empty to auto-detect.
        </div>
        {responseSelector.trim() && <SelectorTester selector={responseSelector} />}
      </div>

      <div className="form-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <label style={{ margin: 0 }}>System Prompt</label>
          <button
            type="button"
            className="btn-icon"
            onClick={() => openFullscreenEditor('prompt')}
            title="Open in full-screen editor"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="You are a customer support agent for [Company]. Draft professional, helpful responses to customer queries..."
          rows={4}
        />
        <div className="hint">
          Instructions for tone, style, and behavior when generating responses.
        </div>
      </div>

      <div className="form-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <label style={{ margin: 0 }}>Memory / Knowledge Base</label>
          <button
            type="button"
            className="btn-icon"
            onClick={() => openFullscreenEditor('memory')}
            title="Open in full-screen editor"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        </div>
        <textarea
          value={memory}
          onChange={(e) => setMemory(e.target.value)}
          placeholder="Company policies, pricing, FAQs, product details, common resolutions..."
          rows={4}
        />
        <div className="hint">
          Persistent knowledge the AI uses to draft accurate responses.
        </div>
      </div>

      <div className="setting-row" style={{ borderBottom: 'none', padding: '0 0 16px 0' }}>
        <div>
          <div className="setting-label">Active</div>
          <div className="setting-desc">Enable autofill assistant on matching pages</div>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={!canSave}>
        {rule ? 'Update Rule' : 'Create Rule'}
      </button>

      {fullscreenField && (
        <div className="fullscreen-editor-overlay">
          <div className="fullscreen-editor">
            <div className="fullscreen-editor-header">
              <h3>{fullscreenField === 'prompt' ? 'System Prompt' : 'Memory / Knowledge Base'}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={saveFullscreenContent}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={closeFullscreenEditor}
                >
                  Cancel
                </button>
              </div>
            </div>
            <textarea
              className="fullscreen-textarea"
              value={fullscreenValue}
              onChange={(e) => setFullscreenValue(e.target.value)}
              placeholder={
                fullscreenField === 'prompt'
                  ? 'You are a customer support agent for [Company]. Draft professional, helpful responses to customer queries...'
                  : 'Company policies, pricing, FAQs, product details, common resolutions...'
              }
              autoFocus
            />
          </div>
        </div>
      )}
    </form>
  );
}
