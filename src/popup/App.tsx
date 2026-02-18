import { useState, useEffect } from 'react';
import Header from './components/Header.tsx';
import TabNav from './components/TabNav.tsx';
import ApiKeySettings from './pages/ApiKeySettings.tsx';
import PageRules from './pages/PageRules.tsx';
import GeneralSettings from './pages/GeneralSettings.tsx';
import { useStorage } from './hooks/useStorage.ts';
import { STORAGE_KEYS, DEFAULT_GENERAL_SETTINGS, DEFAULT_AI_CONFIG } from '@shared/constants.ts';
import type { GeneralSettings as GeneralSettingsType, AIConfig } from '@shared/types.ts';

type TabId = 'apiKey' | 'pageRules' | 'settings';

const TABS: { id: TabId; label: string }[] = [
  { id: 'apiKey', label: 'API Key' },
  { id: 'pageRules', label: 'Page Rules' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('pageRules');
  const [settings] = useStorage<GeneralSettingsType>(
    STORAGE_KEYS.GENERAL_SETTINGS,
    DEFAULT_GENERAL_SETTINGS
  );
  const [aiConfig, , aiConfigLoading] = useStorage<AIConfig>(
    STORAGE_KEYS.AI_CONFIG,
    DEFAULT_AI_CONFIG
  );
  const needsOnboarding = !aiConfigLoading && !aiConfig.apiKey;

  useEffect(() => {
    const theme = settings.theme;
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [settings.theme]);

  return (
    <div className="popup-container">
      <Header />
      {needsOnboarding && activeTab !== 'apiKey' && (
        <div className="onboarding-banner">
          <p>Welcome! Set your API key to get started.</p>
          <button onClick={() => setActiveTab('apiKey')}>Set API Key</button>
        </div>
      )}
      <TabNav
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
      />
      <main className="popup-content">
        {activeTab === 'apiKey' && <ApiKeySettings />}
        {activeTab === 'pageRules' && <PageRules />}
        {activeTab === 'settings' && <GeneralSettings />}
      </main>
    </div>
  );
}
