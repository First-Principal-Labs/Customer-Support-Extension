import { useState } from 'react';
import type { AIConfig } from '@shared/types.ts';
import { STORAGE_KEYS, DEFAULT_AI_CONFIG, AI_MODELS, CUSTOM_MODEL_SENTINEL } from '@shared/constants.ts';
import { useStorage } from '../hooks/useStorage.ts';
import ApiKeyInput from '../components/ApiKeyInput.tsx';

export default function ApiKeySettings() {
  const [config, setConfig, loading] = useStorage<AIConfig>(
    STORAGE_KEYS.AI_CONFIG,
    DEFAULT_AI_CONFIG
  );
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(
    () => !AI_MODELS[config.provider]?.includes(config.model)
  );

  const handleSave = async () => {
    await setConfig(config);
    setStatus({ type: 'success', message: 'Settings saved!' });
    chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
    setTimeout(() => setStatus(null), 2000);
  };

  const handleTestConnection = async () => {
    if (!config.apiKey) {
      setStatus({ type: 'error', message: 'Please enter an API key first.' });
      return;
    }
    setTesting(true);
    setStatus(null);

    try {
      if (config.provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${config.apiKey}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      setStatus({ type: 'success', message: 'Connection successful!' });
    } catch (err) {
      setStatus({
        type: 'error',
        message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;

  return (
    <div>
      {status && (
        <div className={`status-message ${status.type === 'success' ? 'status-success' : 'status-error'}`}>
          {status.message}
        </div>
      )}

      <div className="form-group">
        <label>AI Provider</label>
        <select
          value={config.provider}
          onChange={(e) => {
            const provider = e.target.value as AIConfig['provider'];
            setIsCustomModel(false);
            setConfig({
              ...config,
              provider,
              model: AI_MODELS[provider][0],
            });
          }}
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </div>

      <div className="form-group">
        <label>Model</label>
        <select
          value={isCustomModel ? CUSTOM_MODEL_SENTINEL : config.model}
          onChange={(e) => {
            if (e.target.value === CUSTOM_MODEL_SENTINEL) {
              setIsCustomModel(true);
              setConfig({ ...config, model: '' });
            } else {
              setIsCustomModel(false);
              setConfig({ ...config, model: e.target.value });
            }
          }}
        >
          {AI_MODELS[config.provider].map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
          <option value={CUSTOM_MODEL_SENTINEL}>Custom...</option>
        </select>
        {isCustomModel && (
          <input
            type="text"
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            placeholder="Enter custom model ID"
            style={{ marginTop: '6px' }}
          />
        )}
      </div>

      <div className="form-group">
        <label>API Key</label>
        <ApiKeyInput
          value={config.apiKey}
          onChange={(apiKey) => setConfig({ ...config, apiKey })}
          placeholder={
            config.provider === 'openai' ? 'sk-...' : 'sk-ant-...'
          }
        />
        <div className="hint">
          Your key is stored locally in your browser only. Never sent to any server except the AI provider.
        </div>
      </div>

      <div className="form-group">
        <label>Temperature <span className="hint">(optional, 0.0-2.0)</span></label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="2"
          value={config.temperature ?? ''}
          onChange={(e) => setConfig({
            ...config,
            temperature: e.target.value === '' ? undefined : parseFloat(e.target.value),
          })}
          placeholder="Provider default"
        />
      </div>

      <div className="form-group">
        <label>Max Tokens <span className="hint">(optional)</span></label>
        <input
          type="number"
          min="1"
          max="128000"
          value={config.maxTokens ?? ''}
          onChange={(e) => setConfig({
            ...config,
            maxTokens: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
          })}
          placeholder="Provider default"
        />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-primary" onClick={handleSave}>
          Save
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleTestConnection}
          disabled={testing || !config.apiKey}
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
      </div>
    </div>
  );
}
