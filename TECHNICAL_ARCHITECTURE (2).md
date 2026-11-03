# Technical Architecture: Rupee Flow

| | |
|---|---|
| Product | Rupee Flow, a personal expense tracker |
| Version | 1.0 |
| Date | 1 November 2026 |
| Style | Client-only static single-page app, no backend, no build step |

## 1. Architecture overview

Rupee Flow runs entirely in the browser. The page is three static files. All state lives in memory while the app is open and is saved to `localStorage` after every change.

```
┌───────────────────────── Browser ─────────────────────────┐
│                                                           │
│  index.html ── structure, forms, landmarks                │
│  style.css  ── design tokens, layout, themes, animation   │
│  script.js  ── state, validation, rendering, storage      │
│                     │                                     │
│                     ▼                                     │
│            localStorage (device only)                     │
│            ├─ rupeeFlow.expenses.v1                       │
│            └─ rupeeFlow.theme                             │
└───────────────────────────────────────────────────────────┘
         No server · No API · No database · No auth
```

## 2. Architectural principles

| Principle | How it shows up |
|-----------|-----------------|
| Single source of truth | The `items` array. The UI is always re-derived from it. |
| Privacy by design | No network requests, analytics or cookies. |
| Zero dependencies | No frameworks, libraries, CDNs or web fonts. |
| Progressive robustness | Every storage call is wrapped in try/catch, and stored data is validated on load. |
| Accessible by default | Labelled fields, 44px targets, visible focus, reduced-motion support. |

## 3. Component breakdown

### 3.1 Presentation layer (HTML and CSS)

| Section | Purpose |
|---------|---------|
| Header | App title and dark mode toggle |
| Hero card | Total spent, expense count, smart insight |
| Add form | Title, amount, category, date, with inline error slots |
| Category summary | Proportional bars per category |
| Filters | Search, category, month, clear button |
| Expense list | Cards with title, category, date, amount, delete |
| Empty state | Explains "no data" versus "no match" |

**Styling approach**
- Colours, surfaces and glow are CSS variables on `:root`.
- Dark theme redefines the same variables, either through `prefers-color-scheme` or `data-theme="dark"` on `<html>`.
- Layout uses CSS Grid and Flexbox. Below 480px the form and filters collapse to one column.
- Safe-area insets keep content clear of phone notches and system bars.

### 3.2 Application layer (script.js)

| Module | Function | Responsibility |
|--------|----------|----------------|
| Storage | `load()`, `save()` | Read, validate and write the expense array |
| Schema check | `isValid(e)` | Drop malformed or tampered records on load |
| Setup | startup block | Fill selects, set today's date, restore theme |
| Validation | submit handler | Normalise input, check rules, show inline errors |
| Query | `filtered()` | Apply category, month and search together, sort newest first |
| Insight | `insight()` | Rule-based text for top category and change vs last month |
| Animation | `countTo()` | Count-up of the total, skipped for reduced motion |
| Renderer | `render()` | Rebuild total, count, insight, summary bars, list and empty state |
| Theme | click handler | Toggle and remember light or dark |

### 3.3 Persistence layer

| Key | Value | Notes |
|-----|-------|-------|
| `rupeeFlow.expenses.v1` | JSON array of expenses | The `v1` suffix allows future migrations |
| `rupeeFlow.theme` | `"light"` or `"dark"` | Absent means follow the system |

## 4. Data model

```json
{
  "id": "lq3x9k2abcde",
  "title": "Lunch at office",
  "amount": 249.5,
  "category": "Food",
  "date": "2026-11-01"
}
```

| Field | Type | Rules |
|-------|------|-------|
| id | string | Time-based base36 plus random suffix, unique per record |
| title | string | 2 to 60 characters, whitespace collapsed |
| amount | number | Above 0, at most 100000000, rounded to 2 decimals |
| category | string | One of: Food, Transport, Shopping, Bills, Health, Entertainment, Other |
| date | string | ISO `YYYY-MM-DD`, not in the future |

**Why ISO date strings.** Month filtering becomes a prefix match (`date.startsWith("2026-11")`) and sorting is a plain string comparison. There are no timezone shifts.

## 5. State and rendering flow

```
User action
   │
   ▼
Event handler ──► Validate ──► Mutate `items` ──► save() ──► render()
                                                               │
        ┌──────────────────────────────────────────────────────┤
        ▼                ▼                 ▼                   ▼
   filtered()      Total + count     Category bars      Expense list
                   (count-up)        (width animates)   (DOM rebuilt)
```

`render()` is idempotent. It always rebuilds the visible sections from `items` and the current filter values. This keeps the code simple at the cost of redrawing the list on each change, which is fine for thousands of rows on modern devices.

## 6. Key technical decisions

| Decision | Choice | Reason | Trade-off |
|----------|--------|--------|-----------|
| Framework | None, vanilla JS | Tiny size, no tooling | Manual DOM updates |
| Storage | localStorage | Simple, synchronous, offline | About 5 MB limit, not encrypted |
| DOM creation | `createElement` and `textContent` | Prevents HTML injection | Slightly more verbose |
| Currency | `Intl.NumberFormat("en-IN", INR)` | Correct lakh/crore grouping | Needs a modern browser |
| Dates | Strings, not `Date` objects, for storage | Timezone-safe | Parse only for display |
| Insight | Local rules, not an AI service | Private, free, instant | Less flexible than a model |
| Animation | CSS plus one `requestAnimationFrame` loop | Smooth, no library | Needs `@property` for the rotating border |
| Deployment | Static files | Host anywhere | No server-side backup |

## 7. Responsive and accessibility design

| Concern | Approach |
|---------|----------|
| Breakpoints | Fluid layout, max width 720px, single column under 480px |
| Touch | Buttons and inputs at least 44px tall |
| Keyboard | All controls are native elements with visible `:focus-visible` outlines |
| Screen readers | Labels on all fields, `aria-label` on icon buttons, `aria-live` on the total |
| Motion | `prefers-reduced-motion` disables all animation, including the count-up |
| Colour | Text and surfaces are chosen from tokens with sufficient contrast in both themes |

## 8. Performance

| Item | Target or approach |
|------|--------------------|
| Payload | About 14 KB total, no external requests |
| First render | Under 1 second on a mid-range phone |
| Rendering | Full list rebuild per change, fine up to several thousand entries |
| Scaling path | For very large lists, add pagination or virtual scrolling |

## 9. Error handling

| Scenario | Behaviour |
|----------|-----------|
| Invalid form input | Inline message under the field, no save |
| Corrupt JSON in storage | Caught and ignored, app starts empty |
| Individual bad record | Filtered out by `isValid` |
| Storage blocked or full | Save fails silently, app keeps working for the session |
| Unsupported `@property` | Border stops rotating but stays visible |

## 10. Testing strategy

| Level | What to check |
|-------|---------------|
| Manual functional | Add, delete, filter by category and month, search, reload persistence |
| Validation | Empty title, 1-character title, zero or negative amount, huge amount, future date |
| Edge cases | Title containing `<script>` or quotes, very long titles, 0 expenses, one category only |
| Cross-browser | Chrome, Edge, Safari, Firefox, including iOS Safari |
| Responsive | 320px, 375px, 768px, desktop widths |
| Accessibility | Keyboard-only run, screen reader pass, reduced-motion setting |
| Automated (future) | Unit tests for `filtered()`, `insight()` and validation once extracted into modules |

## 11. Deployment

| Option | Notes |
|--------|-------|
| GitHub Pages, Netlify, Vercel, Cloudflare Pages | Upload the three files, no configuration needed |
| Local use | Open `index.html` directly in a browser |
| Single-file build | Same app with CSS and JS inlined, handy for sharing, not compatible with a strict CSP |

## 12. Folder structure

```
expense-tracker/
├── index.html
├── style.css
├── script.js
├── PRD.md
├── TECHNICAL_ARCHITECTURE.md
└── PROJECT_DOCS.md
```

## 13. Extension points

| Future feature | Where it plugs in |
|----------------|-------------------|
| Edit expense | Reuse the add form, add an `id`-based update in `items` |
| CSV or JSON export and import | New functions reading and writing `items` |
| Budgets | New storage key plus a progress bar in the hero card |
| Charts | New renderer reading `filtered()` |
| PWA install and offline cache | Add a manifest and a service worker |
| Encrypted backup | Web Crypto API (AES-GCM) around the export |
| Cloud sync | Introduce a backend and an auth layer, replacing `load()` and `save()` |

## 14. Known limitations

- Data is tied to one browser profile on one device.
- Clearing site data deletes all expenses until export and backup exist.
- localStorage is readable by anyone with access to the browser profile.
- Only INR is supported.
