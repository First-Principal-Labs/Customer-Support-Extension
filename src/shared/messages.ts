import type { ExtensionMessage, MessageType } from './types.ts';

export function sendMessageToBackground(
  type: MessageType,
  payload?: unknown
): Promise<unknown> {
  return chrome.runtime.sendMessage({ type, payload } satisfies ExtensionMessage);
}

export function sendMessageToTab(
  tabId: number,
  type: MessageType,
  payload?: unknown
): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, { type, payload } satisfies ExtensionMessage);
}

export function onMessage(
  handler: (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | void
): void {
  chrome.runtime.onMessage.addListener(handler);
}
