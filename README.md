# AI Support Agent - Chrome Extension

A Chrome Extension for customer support agents. It reads the customer's query on your support page, generates an AI-drafted response, and autofills it into the reply field. You just review and submit.

## How It Works

1. **You open a support ticket page** (Zendesk, Freshdesk, Intercom, custom dashboard, etc.)
2. **Click "Generate Response"** on the floating toolbar
3. **AI reads the customer query** from the page and drafts a professional response
4. **Click "Fill Response"** to autofill it into the reply textarea
5. **Review, edit if needed, and submit**

## Features

- **Page-Specific Rules** - Define URL patterns to activate on specific support pages (e.g., `*.zendesk.com/agent/*`)
- **CSS Selectors** - Tell the extension where the customer query lives and where to fill the response (or let it auto-detect)
- **Per-Page Prompt & Memory** - Each page rule gets its own system prompt and knowledge base (pricing, policies, FAQs)
- **API Key in Browser Only** - Your key stays in `chrome.storage.local`. No backend server. Data only goes to the AI provider
- **Streaming Responses** - Watch the response generate in real-time
- **Auto-detect Fields** - Can automatically find the query and reply fields on common support platforms
- **Export/Import Settings** - Backup and share your configuration

## Supported AI Providers

| Provider | Models |
|----------|--------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo |
| Anthropic | claude-sonnet-4, claude-haiku-4.5, claude-opus-4 |

## Getting Started

### Install & Build

```bash
npm install
npm run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder from this project

### Development

```bash
npm run dev
```

Vite rebuilds automatically on file changes. After changes, refresh the extension in `chrome://extensions` and reload target pages.

## Setup Guide

### 1. Set Your API Key

Extension icon -> **API Key** tab -> Select provider, model, enter key -> **Test Connection**

### 2. Create a Page Rule

Extension icon -> **Page Rules** tab -> **Add Rule**:

| Field | Description | Example |
|-------|-------------|---------|
| **Name** | Label for this rule | "Zendesk Tickets" |
| **URL Pattern** | Glob pattern for matching pages | `*.zendesk.com/agent/tickets/*` |
| **Query Selector** | CSS selector for customer's message | `.ticket-body` |
| **Response Selector** | CSS selector for reply textarea | `textarea.reply` |
| **System Prompt** | AI behavior instructions | "You are a support agent for Acme Corp..." |
| **Memory** | Knowledge base | Pricing, policies, FAQs |

Leave selectors empty to use auto-detection.

### 3. Use It

Navigate to your support page. The toolbar appears. Click **Generate Response** -> review -> **Fill Response** -> submit.

## Project Structure

```
src/
├── shared/              # Shared utilities
│   ├── types.ts         # TypeScript interfaces
│   ├── constants.ts     # Defaults, model lists, endpoints
│   ├── storage.ts       # chrome.storage.local wrapper
│   ├── url-matcher.ts   # Glob -> regex URL matching
│   ├── ai-client.ts     # Streaming AI API client
│   └── messages.ts      # Extension message passing
├── popup/               # Extension popup (settings UI)
│   ├── App.tsx          # Tab navigation (API Key, Page Rules, Settings)
│   ├── pages/           # ApiKeySettings, PageRules, PageRuleEditor, GeneralSettings
│   ├── components/      # Header, TabNav, PatternInput, RuleCard, etc.
│   └── hooks/           # useStorage, usePageRules
├── content/             # Content script (injected into support pages)
│   ├── main.tsx         # Shadow DOM bootstrap
│   ├── AutofillToolbar.tsx  # Read query -> generate -> autofill flow
│   └── styles/widget.css
└── background/          # Service worker
    └── index.ts         # Tab monitoring, script injection
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | TypeScript check + Vite build -> `dist/` |
| `npm run dev` | Vite watch mode (auto-rebuild) |
| `npm run lint` | Run ESLint |
| `npm run clean` | Remove `dist/` |

## Tech Stack

- React 19 + TypeScript 5.9 + Vite 7
- Chrome Extension Manifest V3
- Shadow DOM for CSS isolation
- Direct REST API calls (no SDK)
- SSE streaming for real-time response generation
