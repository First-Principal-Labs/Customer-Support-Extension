import { useState, useRef } from 'react';
import type { GeneralSettings as GeneralSettingsType, ThemeMode } from '@shared/types.ts';
import { STORAGE_KEYS, DEFAULT_GENERAL_SETTINGS } from '@shared/constants.ts';
import { useStorage } from '../hooks/useStorage.ts';
import { exportAllSettings, importSettings } from '@shared/storage.ts';
import ConfirmDialog from '../components/ConfirmDialog.tsx';

export default function GeneralSettings() {
  const [settings, setSettings, loading] = useStorage<GeneralSettingsType>(
    STORAGE_KEYS.GENERAL_SETTINGS,
    DEFAULT_GENERAL_SETTINGS
  );
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (updates: Partial<GeneralSettingsType>) => {
    setSettings({ ...settings, ...updates });
  };

  const handleExport = async () => {
    try {
      const json = await exportAllSettings();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-support-agent-settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: 'Settings exported!' });
    } catch {
      setStatus({ type: 'error', message: 'Export failed.' });
    }
    setTimeout(() => setStatus(null), 2000);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importSettings(text);
      setStatus({ type: 'success', message: 'Settings imported! Reload to apply.' });
    } catch {
      setStatus({ type: 'error', message: 'Invalid settings file.' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTimeout(() => setStatus(null), 3000);
  };

  const handleClearAll = async () => {
    await chrome.storage.local.clear();
    setShowClearConfirm(false);
    setStatus({ type: 'success', message: 'All data cleared.' });
    setTimeout(() => setStatus(null), 2000);
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;

  return (
    <div>
      {status && (
        <div className={`status-message ${status.type === 'success' ? 'status-success' : 'status-error'}`}>
          {status.message}
        </div>
      )}

      <div className="setting-row">
        <div>
          <div className="setting-label">Theme</div>
          <div className="setting-desc">Appearance of the extension popup</div>
        </div>
        <select
          value={settings.theme}
          onChange={(e) => {
            const theme = e.target.value as ThemeMode;
            update({ theme });
            document.documentElement.setAttribute(
              'data-theme',
              theme === 'system' ? '' : theme
            );
          }}
          style={{ width: '110px' }}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div className="setting-row">
        <div>
          <div className="setting-label">Toolbar Position</div>
          <div className="setting-desc">Where the generate button appears</div>
        </div>
        <select
          value={settings.toolbarPosition}
          onChange={(e) =>
            update({ toolbarPosition: e.target.value as GeneralSettingsType['toolbarPosition'] })
          }
          style={{ width: '130px' }}
        >
          <option value="bottom-right">Bottom Right</option>
          <option value="bottom-left">Bottom Left</option>
        </select>
      </div>

      <div className="setting-row">
        <div>
          <div className="setting-label">Auto-detect Selectors</div>
          <div className="setting-desc">Find query/response fields automatically</div>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.autoDetectSelectors}
            onChange={(e) => update({ autoDetectSelectors: e.target.checked })}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>
            Export Settings
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
            Import Settings
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => setShowClearConfirm(true)}
          style={{ alignSelf: 'flex-start' }}
        >
          Clear All Data
        </button>
      </div>

      {showClearConfirm && (
        <ConfirmDialog
          title="Clear All Data"
          message="This will delete all settings, page rules, and conversation history. This cannot be undone."
          confirmLabel="Clear Everything"
          danger
          onConfirm={handleClearAll}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}
