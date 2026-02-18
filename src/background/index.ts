import { getPageRules } from '@shared/storage.ts';
import { findMatchingRule } from '@shared/url-matcher.ts';
import type { ExtensionMessage } from '@shared/types.ts';

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return;
  }

  const rules = await getPageRules();
  const match = findMatchingRule(tab.url, rules);

  if (match) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
    } catch (error) {
      console.error('Failed to inject content script:', error);
    }
  }
});

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    if (message.type === 'GET_ACTIVE_RULE') {
      const tabUrl = sender.tab?.url;
      if (tabUrl) {
        getPageRules().then((rules) => {
          const match = findMatchingRule(tabUrl, rules);
          sendResponse({ rule: match ? rules.find((r) => r.id === match.id) : null });
        });
        return true;
      }
    }

    if (message.type === 'TEST_SELECTOR') {
      const { selector } = message as ExtensionMessage & { selector: string };
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (!tabId) {
          sendResponse({ found: false, error: 'No active tab' });
          return;
        }
        chrome.scripting
          .executeScript({
            target: { tabId },
            func: (sel: string) => {
              try {
                const el = document.querySelector(sel);
                if (!el) return { found: false };
                return {
                  found: true,
                  tag: el.tagName.toLowerCase(),
                  text: (el.textContent || '').trim().substring(0, 100),
                };
              } catch (e) {
                return { found: false, error: (e as Error).message };
              }
            },
            args: [selector],
          })
          .then((results) => {
            sendResponse(results[0]?.result || { found: false, error: 'Script failed' });
          })
          .catch((err) => {
            sendResponse({ found: false, error: err.message });
          });
      });
      return true;
    }

    if (message.type === 'SETTINGS_UPDATED') {
      reevaluateAllTabs();
    }
  }
);

async function reevaluateAllTabs() {
  const tabs = await chrome.tabs.query({});
  const rules = await getPageRules();

  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) continue;

    const match = findMatchingRule(tab.url, rules);

    if (match) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
      } catch {
        // ignore injection failures
      }
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  reevaluateAllTabs();
});
