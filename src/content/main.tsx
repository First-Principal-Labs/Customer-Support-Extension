import { createRoot } from 'react-dom/client';
import AutofillToolbar from './AutofillToolbar.tsx';
import widgetStyles from './styles/widget.css?inline';

const CONTAINER_ID = 'ai-support-agent-root';

function injectGoogleFont() {
  if (document.getElementById('ai-support-agent-font')) return;
  const preconnect1 = document.createElement('link');
  preconnect1.rel = 'preconnect';
  preconnect1.href = 'https://fonts.googleapis.com';
  const preconnect2 = document.createElement('link');
  preconnect2.rel = 'preconnect';
  preconnect2.href = 'https://fonts.gstatic.com';
  preconnect2.crossOrigin = '';
  const link = document.createElement('link');
  link.id = 'ai-support-agent-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&display=swap';
  document.head.append(preconnect1, preconnect2, link);
}

function init() {
  if (document.getElementById(CONTAINER_ID)) return;

  injectGoogleFont();

  const host = document.createElement('div');
  host.id = CONTAINER_ID;
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;  font-family: "Figtree", sans-serif;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = widgetStyles;
  shadow.appendChild(style);

  const mountPoint = document.createElement('div');
  mountPoint.id = 'autofill-toolbar-root';
  shadow.appendChild(mountPoint);

  const root = createRoot(mountPoint);
  root.render(<AutofillToolbar />);

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'REMOVE_CONTENT_SCRIPT') {
      root.unmount();
      host.remove();
    }
  });
}

init();
