# YouTube Shorts Blocker (Chrome Extension)

A Manifest V3 Chrome extension that removes YouTube Shorts entry points while preserving regular long-form YouTube videos.

## What it blocks

- Direct `/shorts/<id>` page visits (redirected to `/watch?v=<id>`).
- Shorts shelf/modules on Home, Watch, Search, and some Channel layouts.
- Shorts item in YouTube left navigation.
- Shorts tab links on channel pages.
- Newly injected Shorts content in SPA navigation (using `MutationObserver`).

## Why this architecture

- **Manifest V3 + static `content_scripts`**: reliable for always-on filtering on YouTube pages.
- **`run_at: document_start`**: hides Shorts UI as early as possible.
- **CSS + JS hybrid**:
  - CSS handles fast hiding of known UI components.
  - JS handles dynamic SPA updates and redirect logic.

## Install locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `extensions/youtube-shorts-blocker`.
5. Open YouTube and refresh existing tabs.

## Notes

- YouTube frequently changes DOM structure/classes, so selectors may need periodic updates.
- This extension focuses on YouTube web (`youtube.com` and `m.youtube.com`).
