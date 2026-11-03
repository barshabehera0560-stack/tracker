# Product Requirements Document: Rupee Flow

| | |
|---|---|
| Product | Rupee Flow, a personal expense tracker |
| Version | 1.0 |
| Date | 1 November 2026 |
| Platform | Web (HTML, CSS, JavaScript), mobile and desktop browsers |
| Status | Built |

## 1. Overview

Rupee Flow is a fast, private expense tracker that runs entirely in the browser. There is no sign-up, no server and no install. All data stays on the user's device.

## 2. Problem statement

People in India who want to track daily spending often find apps too heavy: they ask for accounts, bank access or subscriptions. Spreadsheets are flexible but slow to use on a phone. Users need a quick way to log what they spend and see where the money goes.

## 3. Goals and non-goals

**Goals**
- Log an expense in under 10 seconds.
- Show total spending, category breakdown and month-wise views at a glance.
- Work offline on any modern phone or desktop browser.
- Keep user data private by design.

**Non-goals for v1**
- User accounts or cloud sync
- Bank or UPI import
- Multi-currency support
- Budgets and alerts
- Editing an existing expense (planned for v1.1)

## 4. Target users

| Persona | Need |
|---------|------|
| Student | Track a small monthly allowance without complexity |
| Salaried professional | See which categories drain the month's salary |
| Household manager | Record shared daily spending quickly on a phone |

## 5. User stories

1. As a user, I want to add an expense with title, amount, category and date so I have a record of it.
2. As a user, I want to see all my expenses, newest first, and delete a wrong entry.
3. As a user, I want to see my total spent so I know where I stand.
4. As a user, I want a category summary so I can see what takes the biggest share.
5. As a user, I want to filter by category and month so I can review a specific period.
6. As a user, I want to search by title so I can find a past expense quickly.
7. As a user, I want my data saved automatically so it is there when I return.
8. As a user, I want clear error messages when I enter something invalid.
9. As a user, I want dark mode so the app is comfortable at night.
10. As a user, I want the app to work well on my phone.

## 6. Functional requirements

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| F1 | Add expense | Must | Title, amount, category and date are saved and appear in the list immediately |
| F2 | Expense list with delete | Must | List is sorted newest first; the bin icon removes the item and updates all totals |
| F3 | Total spent | Must | Shows the sum of the currently visible expenses with a count |
| F4 | Category summary | Must | Each category shows its amount and a bar proportional to its share |
| F5 | Filter by category and month | Must | Filters combine with each other and with search; "Clear filters" resets all |
| F6 | Search | Must | Case-insensitive match on title, updates as the user types |
| F7 | Local persistence | Must | Data survives page reload and browser restart |
| F8 | Form validation | Must | Invalid fields show an inline message and nothing is saved |
| F9 | Rupee currency | Must | Amounts display as ₹ with Indian digit grouping, for example ₹1,23,456.00 |
| F10 | Dark mode | Must | Follows system setting by default; manual toggle is remembered |
| F11 | Responsive design | Must | Usable from 320px wide up; touch targets at least 44px |
| F12 | Smart insight | Should | Shows the top category this month and the change compared with last month |

### Categories
Food, Transport, Shopping, Bills, Health, Entertainment, Other.

### Validation rules
| Field | Rule |
|-------|------|
| Title | 2 to 60 characters after trimming |
| Amount | Greater than 0, at most ₹10,00,00,000, rounded to 2 decimals |
| Date | Required and not in the future |
| Category | Must be one of the fixed categories |

## 7. Non-functional requirements

| Area | Requirement |
|------|-------------|
| Performance | First render under 1 second; no network requests |
| Privacy | No data leaves the device; no analytics or cookies |
| Accessibility | Labelled fields, visible keyboard focus, sufficient contrast, reduced-motion support |
| Compatibility | Current Chrome, Edge, Safari and Firefox |
| Reliability | Corrupt stored data is ignored safely instead of crashing the app |
| Size | Under 20 KB in total |

## 8. UX and design principles

- One screen, top to bottom: total, add form, category summary, expense list.
- Clean, modern look with an aurora-glow, AI-inspired visual style.
- Motion is used to confirm changes (count-up total, growing bars, new items appearing) and is switched off for users who prefer reduced motion.
- Plain-language labels and error messages that say how to fix the problem.

## 9. Success metrics

| Metric | Target |
|--------|--------|
| Time to add an expense | Under 10 seconds |
| Sessions with at least one expense added | Above 60% |
| Data-loss bugs | Zero |
| Mobile usability issues reported | Zero blocking issues |

## 10. Assumptions and constraints

- Users accept that data is tied to one browser on one device.
- Clearing browser data deletes the expenses.
- Only INR is supported.

## 11. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Data lost when browser storage is cleared | Add JSON/CSV export and import in a later version |
| Others can read data on a shared device | Document the limitation; consider optional passphrase encryption |
| Input errors such as typos in amounts | Strict validation and easy deletion |

## 12. Roadmap

| Version | Scope |
|---------|-------|
| 1.0 | Current scope (F1 to F12) |
| 1.1 | Edit expense, CSV export and import |
| 1.2 | Monthly budgets with progress bar |
| 1.3 | Charts, recurring expenses |
| 2.0 | Installable PWA, optional encrypted backup |

## 13. Out of scope for now

Cloud accounts, bank sync, receipts scanning, multi-user sharing.
