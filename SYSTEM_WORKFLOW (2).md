# System Workflow: Rupee Flow

| | |
|---|---|
| Product | Rupee Flow, a personal expense tracker |
| Version | 1.0 |
| Date | 1 November 2026 |
| Scope | How data and control move through the app, from page load to every user action |

## 1. High-level workflow

```
Page load ─► Load & validate data ─► Apply theme ─► First render
                                                        │
                                                        ▼
                                            Wait for user action
                      ┌───────────┬───────────┬───────────┬────────────┐
                      ▼           ▼           ▼           ▼            ▼
                 Add expense   Delete     Filter/Search   Clear     Toggle theme
                      │           │           │           │            │
                      └─► Update state ─► Save ─► Render ◄┘            └─► Save theme
```

Every action that changes data follows the same loop: **validate, update state, save, render**.

## 2. Actors and components

| Actor or component | Role |
|--------------------|------|
| User | Enters expenses, filters, searches, deletes, switches theme |
| UI (HTML and CSS) | Collects input and displays results |
| script.js | Validates, holds state in `items`, renders |
| localStorage | Stores expenses and theme on the device |

## 3. Workflow: app load

| Step | What happens |
|------|--------------|
| 1 | Browser loads `index.html`, then `style.css` and `script.js` |
| 2 | Category dropdowns are filled from the fixed category list |
| 3 | Date field defaults to today |
| 4 | Saved theme is read; if none, the system preference is used |
| 5 | Expenses are read from localStorage and parsed |
| 6 | Each record is schema-checked; invalid ones are dropped |
| 7 | `render()` draws total, insight, category bars and list |

```
Read storage ─► Parse OK? ──no──► Start with empty list
                   │ yes
                   ▼
             Keep only valid records ─► render()
```

## 4. Workflow: add expense

| Step | What happens |
|------|--------------|
| 1 | User fills title, amount, category and date, then presses **Add expense** |
| 2 | Default browser submit is cancelled |
| 3 | Title is trimmed and extra spaces collapsed; amount is rounded to 2 decimals |
| 4 | Fields are validated one by one |
| 5a | If any field fails, its inline message appears and nothing is saved |
| 5b | If all pass, previous errors are cleared |
| 6 | A record with a new unique id is pushed to `items` |
| 7 | `save()` writes the array to localStorage |
| 8 | Title and amount inputs are cleared and focus returns to Title |
| 9 | `render()` updates the total (count-up), bars, insight and list |

```
Submit ─► Normalise ─► Validate ──fail──► Show inline errors (stop)
                           │ pass
                           ▼
                    Create record ─► Save ─► Reset inputs ─► Render
```

### Validation decision table
| Field | Condition | Result |
|-------|-----------|--------|
| Title | Fewer than 2 characters | "Enter a title with at least 2 characters." |
| Amount | Missing, 0, negative or above ₹10,00,00,000 | "Enter an amount above ₹0 and up to ₹10,00,00,000." |
| Date | Empty | "Pick a date." |
| Date | After today | "Date can’t be in the future." |

## 5. Workflow: delete expense

| Step | What happens |
|------|--------------|
| 1 | User taps the bin icon on an item |
| 2 | The record with that id is removed from `items` |
| 3 | `save()` writes the updated array |
| 4 | `render()` refreshes everything, so total and category bars shrink accordingly |

## 6. Workflow: filter and search

| Step | What happens |
|------|--------------|
| 1 | User types in search, changes category or picks a month |
| 2 | `render()` runs on each change |
| 3 | `filtered()` keeps records matching **all** active conditions |
| 4 | Result is sorted newest first, with id as tie-breaker |
| 5 | Total, count, category bars and list use only the filtered result |
| 6 | The insight line still uses all expenses, so it does not change with filters |

```
All expenses ─► Category match? ─► Month match? ─► Title contains search? ─► Sort ─► Display
```

**Clear filters:** search, category and month are reset, then `render()` runs.

## 7. Workflow: render cycle

| Step | Output |
|------|--------|
| 1 | Compute `list = filtered()` |
| 2 | Sum amounts, then animate the displayed total toward the new value (about 0.6 s) |
| 3 | Update the count text ("1 expense" or "N expenses") |
| 4 | Build the insight sentence from all expenses |
| 5 | Group the filtered list by category, sort by amount, draw bars (width animates from 0) |
| 6 | Rebuild the list items and attach delete handlers |
| 7 | Show the right empty-state message, or hide it |

### Empty-state logic
| Situation | Message |
|-----------|---------|
| No expenses at all | "No expenses yet. Add your first one above." |
| Expenses exist, filters match none | "No expenses match these filters. Try clearing them." |

## 8. Workflow: smart insight

```
No expenses ─────────────► "Add your first expense…"
Nothing this month ──────► "Nothing logged for this month yet."
Otherwise ───────────────► Top category share this month
                           + change vs last month (if last month has data)
```

The insight is built locally by fixed rules. No data is sent anywhere.

## 9. Workflow: theme switching

| Step | What happens |
|------|--------------|
| 1 | Without a saved choice, the app follows the system light or dark setting |
| 2 | On toggle, the current theme is detected and flipped |
| 3 | `data-theme` is set on `<html>`, so the CSS variables change at once |
| 4 | The choice is saved in localStorage and reused on the next visit |

## 10. Data flow summary

```
          ┌────────────┐   input    ┌──────────────┐
          │    User    │ ─────────► │  Event       │
          └────────────┘            │  handlers    │
                ▲                   └──────┬───────┘
                │ display                  │ validated data
          ┌─────┴──────┐            ┌──────▼───────┐
          │  render()  │ ◄───────── │ items (state)│
          └────────────┘            └──────┬───────┘
                                           │ save / load
                                    ┌──────▼───────┐
                                    │ localStorage │
                                    └──────────────┘
```

## 11. Error and edge-case handling

| Situation | Behaviour |
|-----------|-----------|
| Stored JSON is corrupt | Caught; app starts with an empty list |
| One stored record is malformed | That record is skipped, the others load |
| localStorage is blocked or full | Save is skipped silently; the session still works but data is not kept |
| Title contains HTML such as `<b>` | Shown as plain text, never executed |
| Many expenses at once | Whole list is redrawn each time, fine for thousands of rows |
| User prefers reduced motion | Count-up and all animations are skipped |
| Same date and many entries | Tie broken by id so order stays stable |

## 12. Sequence diagram: add expense

```
User        Form/UI         script.js           localStorage
 │  fill form    │               │                    │
 │──────────────►│               │                    │
 │  submit       │               │                    │
 │──────────────►│  validate     │                    │
 │               │──────────────►│                    │
 │               │   errors?     │                    │
 │◄──────────────│◄──────────────│  (stop if yes)     │
 │               │               │  push to items     │
 │               │               │  save()            │
 │               │               │───────────────────►│
 │               │               │  render()          │
 │◄──────────────│◄──────────────│                    │
 │ updated total, bars, list     │                    │
```

## 13. Future workflow additions

| Feature | Workflow change |
|---------|-----------------|
| Edit expense | Tap item, form fills with its data, submit replaces the record by id |
| Export and import | Export serialises `items` to a file; import validates every record before merging |
| Budgets | After each render, compare the month's total with the budget and update a progress bar |
| Sync | Replace the save step with an authenticated API call plus conflict handling |
