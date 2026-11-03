# Security Architecture: Rupee Flow

| | |
|---|---|
| Product | Rupee Flow, a personal expense tracker |
| Version | 1.0 |
| Date | 1 November 2026 |
| Scope | Client-only web app: HTML, CSS, JavaScript, localStorage. No backend, accounts or network calls. |

## 1. Security overview

Rupee Flow is designed so that most common web risks never arise. There is no server to breach, no login to steal, and no data in transit. The remaining risks are in the browser: script injection through user text, tampered local data, third-party code, and access to the device itself.

**Security posture:** privacy by design, minimal attack surface, defence in depth on the client.

## 2. Assets

| Asset | Sensitivity | Location |
|-------|-------------|----------|
| Expense records (titles, amounts, dates, categories) | Medium: reveals spending habits | localStorage |
| Theme preference | Low | localStorage |
| Application code | Low: public | Static hosting |

## 3. Trust boundaries

```
┌───────────────── User's device ─────────────────┐
│  Browser profile (trusted by the user)          │
│   ├─ App code (static, same origin)             │
│   └─ localStorage (same-origin only)            │
└──────────────────────┬──────────────────────────┘
                       │ only the initial file download
                ┌──────▼───────┐
                │ Static host  │  (serves HTML, CSS, JS only)
                └──────────────┘
```

- Nothing is sent from the browser back to the host.
- Other websites cannot read this origin's localStorage (same-origin policy).
- Anyone with access to the browser profile can read it.

## 4. Threat model

| # | Threat | Likelihood | Impact | Control |
|---|--------|-----------|--------|---------|
| T1 | Cross-site scripting (XSS) through expense titles | Medium | High | Render with `textContent`; never use `innerHTML` for user data |
| T2 | Tampered or corrupt localStorage data | Low | Medium | `JSON.parse` in try/catch; per-record schema check on load |
| T3 | Malicious third-party script or font | Low | High | No external scripts, fonts, images or CDNs |
| T4 | Invalid or abusive input (huge numbers, long text) | Medium | Low | Length and range limits, fixed category list, date check |
| T5 | Data exposure on a shared or stolen device | Medium | Medium | Documented limitation; optional encryption on roadmap |
| T6 | Data loss from clearing browser data | Medium | Medium | Documented; export and backup on roadmap |
| T7 | Tampering with the hosted files | Low | High | HTTPS, trusted host, optional Subresource Integrity and CSP |
| T8 | Clickjacking (app embedded in a hostile frame) | Low | Low | `frame-ancestors 'none'` or `X-Frame-Options: DENY` when self-hosting |
| T9 | Privacy leak through analytics or referrers | Low | Medium | No analytics; `Referrer-Policy: no-referrer` recommended |
| T10 | Browser storage blocked or full | Medium | Low | Storage calls wrapped in try/catch; app still works for the session |

## 5. Implemented controls

### 5.1 Output encoding (T1)
| Practice | Detail |
|----------|--------|
| Safe DOM building | Elements are created with `createElement`; text is set through `textContent` |
| No HTML injection | A title like `<img src=x onerror=alert(1)>` is displayed as literal text |
| Accessible labels | Delete buttons use `setAttribute("aria-label", ...)`, which is also non-executable |
| No dynamic code | No `eval`, `new Function`, `document.write` or inline event attributes |

### 5.2 Input validation (T4)
| Field | Rule |
|-------|------|
| Title | Trimmed, whitespace collapsed, 2 to 60 characters (also `maxlength="60"` on the input) |
| Amount | Finite number, above 0, at most 100000000, rounded to 2 decimals |
| Date | Required, ISO format, not in the future |
| Category | Must be one of the fixed list; stored values are re-checked on load |

Validation runs on submit in JavaScript. The HTML attributes are only a convenience, not the security control.

### 5.3 Storage integrity (T2, T10)
| Practice | Detail |
|----------|--------|
| Safe parsing | `JSON.parse` inside try/catch, returns an empty list on failure |
| Schema filter | Each record must have a string id and title, finite amount, known category and `YYYY-MM-DD` date |
| Versioned key | `rupeeFlow.expenses.v1` allows safe migration later |
| Fail-soft writes | A blocked or full storage does not crash the app |

### 5.4 Supply chain (T3)
- Zero runtime dependencies.
- System font stack, no web fonts.
- No images or icons loaded from other origins; the icons are emoji characters.
- No package manager, so no `node_modules` risk.

### 5.5 Privacy (T9)
- No network requests after load.
- No cookies, analytics, tracking or third-party calls.
- The smart insight is computed on the device by fixed rules. No AI service receives any data.

## 6. Recommended hardening for hosting

### 6.1 Security headers
| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | `default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` | Blocks injected or foreign scripts and framing |
| X-Content-Type-Options | `nosniff` | Stops MIME sniffing |
| Referrer-Policy | `no-referrer` | Avoids leaking the page URL |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` | Disables unused browser features |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` | Forces HTTPS |
| Cross-Origin-Opener-Policy | `same-origin` | Isolates the window context |

> The CSP above works with the **three-file build** (`index.html`, `style.css`, `script.js`). The single-file build uses inline CSS and JS and would need `'unsafe-inline'` or hashes, which weakens the policy. Prefer the three-file build for self-hosting.

### 6.2 Hosting checklist
- [ ] Serve only over HTTPS.
- [ ] Use a trusted static host with two-factor authentication on the account.
- [ ] Enable branch protection if the code is in a Git repository.
- [ ] Apply the headers above (Netlify `_headers`, Vercel `vercel.json`, or server config).
- [ ] Do not add third-party scripts without a review and Subresource Integrity.

### 6.3 Example `_headers` file (Netlify)
```
/*
  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## 7. User-side security guidance

| Situation | Advice |
|-----------|--------|
| Shared computer | Use a personal browser profile, or clear site data after use |
| Lost or stolen phone | Keep the device locked; browser data is only as safe as the device |
| Private or incognito window | Data disappears when the window closes |
| Before clearing browser data | Back up first once export is available |
| Browser extensions | Extensions can read page content; install only trusted ones |

## 8. Compliance and data protection

| Topic | Position |
|-------|----------|
| Personal data collected by the developer | None. Nothing is transmitted. |
| Cookies and consent banners | Not needed, no cookies are set |
| Data residency | Data stays on the user's device |
| Right to delete | User can delete any record, or clear site data |
| India DPDP Act | Because the app does not collect or process data on any server, obligations are minimal. If a backend or analytics is added, a review is required. |

## 9. Security testing plan

| Test | Method | Expected result |
|------|--------|-----------------|
| XSS payload in title | Enter `<script>alert(1)</script>` and `"><img src=x onerror=alert(1)>` | Shown as plain text, no alert |
| Corrupt storage | In DevTools set the key to `{bad json` and reload | App loads with an empty list |
| Tampered record | Set a record with `amount: "abc"` or unknown category | Record is ignored |
| Boundary values | Amount 0, -5, 1e12, NaN, empty | Rejected with an inline message |
| Future date | Pick tomorrow | Rejected |
| Network check | Open DevTools Network tab during use | No requests after initial load |
| CSP check | Deploy with headers, run Lighthouse or securityheaders.com | No violations, strong grade |
| Storage blocked | Disable site storage in the browser | App still works for the session |

## 10. Known limitations and risk acceptance

| Limitation | Risk level | Plan |
|------------|-----------|------|
| localStorage is not encrypted | Medium on shared devices | Optional passphrase encryption using Web Crypto (AES-GCM, PBKDF2) |
| No backup, data lost if site data is cleared | Medium | JSON/CSV export and import |
| No authentication | Accepted | The app is single-user and local by design |
| Single-file build cannot use a strict CSP | Low | Use the three-file build for production hosting |
| Same-origin scripts (for example from XSS on another page of the same host) could read the data | Low | Host the app on its own origin or subdomain |

## 11. Future security roadmap

| Version | Enhancement |
|---------|-------------|
| 1.1 | Export and import with strict record validation |
| 1.2 | Optional app lock and passphrase-based encryption of stored data |
| 2.0 | If cloud sync is added: authentication, TLS everywhere, server-side validation, rate limiting, audit logging, and a full threat-model update |

## 12. Security checklist before release

- [ ] No use of `innerHTML`, `eval` or inline handlers with user data
- [ ] All inputs validated in JavaScript
- [ ] Storage reads schema-checked, storage writes guarded
- [ ] No external requests in the Network tab
- [ ] HTTPS and security headers configured
- [ ] CSP tested with the three-file build
- [ ] XSS and corrupt-storage tests passed
- [ ] Privacy statement kept accurate ("data stays on your device")
