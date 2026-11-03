# Technology Stack: Rupee Flow

| | |
|---|---|
| Product | Rupee Flow, a personal expense tracker |
| Version | 1.0 |
| Date | 1 November 2026 |
| Approach | Plain HTML, CSS and JavaScript. No framework, no build step, no backend. |

## 1. Stack at a glance

| Layer | Technology | Role |
|-------|-----------|------|
| Markup | HTML5 | Page structure, form, semantic landmarks |
| Styling | CSS3 | Layout, themes, animation, responsive design |
| Logic | Vanilla JavaScript (ES2020) | State, validation, rendering, storage |
| Storage | Web Storage API (`localStorage`) | Saves expenses and theme on the device |
| Currency formatting | `Intl.NumberFormat` (`en-IN`, INR) | ₹ display with lakh/crore grouping |
| Typography | System font stack | Fast, no downloads |
| Hosting | Any static host | Serves three files |
| Tooling | Text editor and browser DevTools | Nothing to install |

## 2. Frontend technologies

### 2.1 HTML5
| Feature used | Why |
|--------------|-----|
| Semantic elements (`main`, `header`, `section`, `form`, `ul`) | Accessibility and clear structure |
| Native form controls (`input type="number"`, `date`, `month`, `search`, `select`) | Built-in mobile keyboards and pickers |
| `inputmode="decimal"`, `maxlength`, `min`, `step` | Better mobile entry and light constraints |
| `aria-label`, `aria-live` | Screen reader support for icon buttons and the live total |
| Viewport meta with `viewport-fit=cover` | Correct scaling and notch support on phones |

### 2.2 CSS3
| Feature | Used for |
|---------|----------|
| CSS custom properties (variables) | Light and dark design tokens |
| `prefers-color-scheme` and `data-theme` | System-aware dark mode with manual override |
| Grid and Flexbox | Page layout, form, filters, list rows |
| `color-mix()` and `backdrop-filter` | Frosted, translucent cards |
| `@keyframes` | Aurora drift, title shimmer, pop-in, rotating border |
| `@property` (typed custom property) | Smooth rotation of the gradient border |
| `clamp()` | Fluid type size for the total |
| Media queries | Single-column layout under 480px, reduced-motion support |
| `env(safe-area-inset-*)` | Keeps content clear of notches and system bars |

### 2.3 JavaScript (ES2020, no libraries)
| Feature | Used for |
|---------|----------|
| `const`, `let`, arrow functions, template literals | Clean modern syntax |
| `Array` methods (`filter`, `sort`, `reduce`, `map`) | Filtering, sorting, totals, grouping |
| `Object.entries` | Category summary |
| `JSON.parse` and `JSON.stringify` | Persistence |
| `createElement`, `textContent`, `replaceChildren` | Safe DOM rendering |
| `requestAnimationFrame` | Count-up total and bar animation |
| `matchMedia` | Detect dark mode and reduced motion |
| `Intl.NumberFormat`, `toLocaleDateString` | Currency and date display |
| IIFE wrapper | Keeps variables out of the global scope |

## 3. Data and storage

| Item | Choice |
|------|--------|
| Store | `localStorage` |
| Keys | `rupeeFlow.expenses.v1`, `rupeeFlow.theme` |
| Format | JSON array of expense objects |
| Capacity | Around 5 MB per origin, enough for tens of thousands of expenses |
| Sync | None, single device only |

## 4. Why these choices

| Decision | Reason |
|----------|--------|
| Vanilla JS over React or Vue | The app is small; a framework would add size and tooling with no real benefit |
| No CSS framework | Custom tokens give a distinctive look and a tiny payload |
| localStorage over IndexedDB | Simple and synchronous; data volume is small |
| No backend | Privacy, zero cost, works offline |
| System fonts | No external requests, instant text rendering |
| `Intl` for ₹ | Correct Indian number grouping without a library |
| Emoji icons | No icon library or image files |

## 5. Alternatives considered

| Option | Why not (for v1) | When to reconsider |
|--------|------------------|--------------------|
| React, Vue or Svelte | Overkill for one screen | Many screens, complex state |
| Tailwind CSS | Needs a build step or a CDN | Larger design system |
| IndexedDB or Dexie | More code for little gain | Large datasets, attachments |
| Chart.js or D3 | Extra weight; bars are done in CSS | Trend and pie charts |
| Firebase or Supabase | Adds accounts and privacy concerns | Cloud sync and multi-device |
| TypeScript | Needs a compile step | Team growth, larger codebase |

## 6. Browser support

| Browser | Minimum version (approx.) | Notes |
|---------|---------------------------|-------|
| Chrome and Edge | 105+ | Full support, including `color-mix` and `@property` |
| Safari (macOS and iOS) | 16.4+ | Full support |
| Firefox | 113+ | `@property` may be missing in older builds, so the border still shows but may not rotate |

## 7. Performance profile

| Metric | Value |
|--------|-------|
| Total size | About 14 KB for all code |
| HTTP requests | 3 (HTML, CSS, JS) or 1 for the single-file build |
| Third-party requests | 0 |
| Runtime dependencies | 0 |
| Build time | None |

## 8. Development and tooling

| Need | Tool |
|------|------|
| Editing | VS Code or any text editor |
| Running locally | Open `index.html`, or use a simple server such as VS Code Live Server |
| Debugging | Browser DevTools: Elements, Console, Application (localStorage) |
| Testing | Manual checklist now; Playwright or Vitest later |
| Quality checks | Lighthouse for performance, accessibility and best practices |
| Version control | Git and GitHub |
| Formatting (optional) | Prettier |
| Linting (optional) | ESLint |

## 9. Deployment

| Option | Cost | Notes |
|--------|------|-------|
| GitHub Pages | Free | Push the three files, enable Pages |
| Netlify | Free tier | Drag and drop the folder; supports a `_headers` file |
| Vercel | Free tier | Import the repository, no build command |
| Cloudflare Pages | Free tier | Fast global CDN |
| Local file | Free | Open `index.html` directly |

Every option needs only static file hosting over HTTPS.

## 10. File structure

```
expense-tracker/
├── index.html                 page structure
├── style.css                  design tokens, layout, themes, animation
├── script.js                  state, validation, rendering, storage
├── PRD.md                     product requirements
├── TECHNICAL_ARCHITECTURE.md  components and data model
├── SYSTEM_WORKFLOW.md         flows and sequences
├── SECURITY_ARCHITECTURE.md   threats and controls
├── TECHNOLOGY_STACK.md        this document
└── PROJECT_DOCS.md            combined summary
```

## 11. Upgrade path

| Stage | Stack additions |
|-------|-----------------|
| v1.1 | File API and Blob for CSV and JSON export and import |
| v1.2 | Web Crypto API for optional encrypted backup |
| v1.3 | A small chart library or inline SVG for trends |
| v2.0 | Web App Manifest and Service Worker for an installable offline PWA |
| v3.0 (optional) | Backend such as Node.js with PostgreSQL or Supabase, authentication, REST or GraphQL API, and a TypeScript migration |
