(() => {
  'use strict';

  const STORAGE_KEY_EXPENSES = 'rupeeFlow.expenses.v1';
  const STORAGE_KEY_THEME = 'rupeeFlow.theme';
  const STORAGE_KEY_BUDGET = 'rupeeFlow.budget.v1';
  const MAX_AMOUNT = 100000000;

  const CATEGORIES = [
    { name: 'Food', icon: '🍽️' },
    { name: 'Transport', icon: '🚗' },
    { name: 'Shopping', icon: '🛍️' },
    { name: 'Bills', icon: '⚡' },
    { name: 'Health', icon: '💊' },
    { name: 'Entertainment', icon: '🎬' },
    { name: 'Other', icon: '📦' }
  ];

  const CATEGORY_NAMES = new Set(CATEGORIES.map(c => c.name));
  const CATEGORY_ICON_MAP = Object.fromEntries(CATEGORIES.map(c => [c.name, c.icon]));

  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  const formatDateDisplay = (iso) => {
    try {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return iso; }
  };

  const getTodayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getCurrentMonthISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const getPreviousMonthISO = () => {
    const d = new Date();
    let y = d.getFullYear(), m = d.getMonth();
    if (m === 0) { m = 12; y -= 1; }
    return `${y}-${String(m).padStart(2, '0')}`;
  };

  const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  };

  const elements = {
    userName: $('userName'),
    userAvatar: $('userAvatar'),
    logoutBtn: $('logoutBtn'),
    themeToggle: $('themeToggle'),
    dataMenuBtn: $('dataMenuBtn'),
    dataMenu: $('dataMenu'),
    exportCsvBtn: $('exportCsvBtn'),
    exportJsonBtn: $('exportJsonBtn'),
    importBtn: $('importBtn'),
    importFileInput: $('importFileInput'),
    resetAccountBtn: $('resetAccountBtn'),
    deleteAccountBtn: $('deleteAccountBtn'),
    statusToast: $('statusToast'),
    totalSpent: $('totalSpent'),
    expenseCount: $('expenseCount'),
    smartInsight: $('smartInsight'),
    budgetLabel: $('budgetLabel'),
    setBudgetBtn: $('setBudgetBtn'),
    setBudgetText: $('setBudgetText'),
    budgetProgressWrapper: $('budgetProgressWrapper'),
    budgetBarFill: $('budgetBarFill'),
    budgetStatusText: $('budgetStatusText'),
    budgetRemainingText: $('budgetRemainingText'),
    form: $('expenseForm'),
    formHeading: $('formHeading'),
    editingBadge: $('editingBadge'),
    cancelEditBtn: $('cancelEditBtn'),
    submitBtnIcon: $('submitBtnIcon'),
    submitBtnText: $('submitBtnText'),
    titleInput: $('title'),
    amountInput: $('amount'),
    categorySelect: $('category'),
    dateInput: $('date'),
    titleError: $('titleError'),
    amountError: $('amountError'),
    categoryError: $('categoryError'),
    dateError: $('dateError'),
    categorySummary: $('categorySummary'),
    activeFilterBadge: $('activeFilterBadge'),
    searchInput: $('searchInput'),
    filterCategory: $('filterCategory'),
    filterMonth: $('filterMonth'),
    clearFiltersBtn: $('clearFiltersBtn'),
    expenseList: $('expenseList'),
    listVisibleCount: $('listVisibleCount'),
    emptyState: $('emptyState'),
    emptyStateTitle: $('emptyStateTitle'),
    emptyStateText: $('emptyStateText')
  };

  // State
  let items = [];
  let monthlyBudget = 0;
  let editingId = null;
  let currentDisplayedTotal = 0;
  let countAnimationId = null;
  let toastTimer = null;

  const showToast = (msg, duration = 3000) => {
    if (toastTimer) clearTimeout(toastTimer);
    elements.statusToast.textContent = msg;
    elements.statusToast.style.display = 'block';
    toastTimer = setTimeout(() => { elements.statusToast.style.display = 'none'; }, duration);
  };

  const isValidExpense = (e) => Boolean(
    e && typeof e === 'object' &&
    typeof e.id === 'string' && e.id.trim() &&
    typeof e.title === 'string' && e.title.trim().length >= 2 && e.title.length <= 60 &&
    typeof e.amount === 'number' && Number.isFinite(e.amount) && e.amount > 0 && e.amount <= MAX_AMOUNT &&
    typeof e.category === 'string' && CATEGORY_NAMES.has(e.category) &&
    typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
  );

  const getCurrentUser = () => {
    try {
      const raw = localStorage.getItem('rupeeFlow.currentUser') || sessionStorage.getItem('rupeeFlow.currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const getUserStorageKey = (baseKey) => {
    const u = getCurrentUser();
    if (u && u.username) {
      return `${baseKey}.${u.username.toLowerCase().trim()}`;
    }
    return `${baseKey}.guest`;
  };

  const loadExpenses = () => {
    try {
      const key = getUserStorageKey(STORAGE_KEY_EXPENSES);
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isValidExpense) : [];
    } catch { return []; }
  };

  const saveExpenses = () => {
    try {
      const key = getUserStorageKey(STORAGE_KEY_EXPENSES);
      localStorage.setItem(key, JSON.stringify(items));
    } catch (err) { console.warn('RupeeFlow storage save failed:', err); }
  };

  // Neon PostgreSQL Cloud Synchronization
  const syncFromCloud = async () => {
    const u = getCurrentUser();
    if (!u || !u.username || u.username === 'guest') return;

    try {
      const expRes = await fetch(`/api/expenses?username=${encodeURIComponent(u.username)}`);
      if (expRes.ok) {
        const data = await expRes.json();
        if (data.ok && Array.isArray(data.items)) {
          items = data.items;
          saveExpenses();
          render();
        }
      }

      const budgetRes = await fetch(`/api/budget?username=${encodeURIComponent(u.username)}`);
      if (budgetRes.ok) {
        const bData = await budgetRes.json();
        if (bData.ok && typeof bData.budget === 'number') {
          monthlyBudget = bData.budget;
          saveBudget(monthlyBudget);
          renderBudget();
        }
      }

      const badge = document.getElementById('cloudStatus');
      if (badge) {
        const dot = document.createElement('span');
        dot.className = 'cloud-dot';
        const label = document.createElement('span');
        label.textContent = 'Neon DB Connected';
        badge.replaceChildren(dot, label);
        badge.title = 'Neon PostgreSQL Database is actively syncing';
      }
    } catch (err) {
      console.warn('Neon Cloud sync offline or unavailable:', err.message);
      const badge = document.getElementById('cloudStatus');
      if (badge) {
        const dot = document.createElement('span');
        dot.className = 'cloud-dot';
        dot.style.background = '#f59e0b';
        dot.style.boxShadow = 'none';
        const label = document.createElement('span');
        label.textContent = 'Offline Cache';
        badge.replaceChildren(dot, label);
        badge.title = 'Working in local offline cache mode';
      }
    }
  };

  const syncExpenseToCloud = async (expense) => {
    const u = getCurrentUser();
    if (!u || !u.username || u.username === 'guest') return;
    try {
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u.username, expense })
      });
    } catch (e) {
      console.warn('Failed to sync expense to Neon DB:', e);
    }
  };

  const deleteExpenseFromCloud = async (id) => {
    const u = getCurrentUser();
    if (!u || !u.username || u.username === 'guest') return;
    try {
      await fetch('/api/expenses/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u.username, id })
      });
    } catch (e) {
      console.warn('Failed to delete expense from Neon DB:', e);
    }
  };

  const syncBudgetToCloud = async (amount) => {
    const u = getCurrentUser();
    if (!u || !u.username || u.username === 'guest') return;
    try {
      await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u.username, amount })
      });
    } catch (e) {
      console.warn('Failed to sync budget to Neon DB:', e);
    }
  };

  const loadBudget = () => {
    try {
      const key = getUserStorageKey(STORAGE_KEY_BUDGET);
      const raw = localStorage.getItem(key);
      const b = parseFloat(raw);
      return Number.isFinite(b) && b > 0 ? b : 0;
    } catch { return 0; }
  };

  const saveBudget = (amt) => {
    try {
      const key = getUserStorageKey(STORAGE_KEY_BUDGET);
      if (amt > 0) localStorage.setItem(key, amt.toString());
      else localStorage.removeItem(key);
    } catch {}
  };

  const initTheme = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
    } catch {}

    elements.themeToggle?.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const next = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(STORAGE_KEY_THEME, next); } catch {}
    });
  };

  const clearErrors = () => {
    elements.titleError.textContent = '';
    elements.amountError.textContent = '';
    elements.categoryError.textContent = '';
    elements.dateError.textContent = '';
    [elements.titleInput, elements.amountInput, elements.categorySelect, elements.dateInput]
      .forEach(inp => inp.removeAttribute('aria-invalid'));
  };

  const validateForm = () => {
    clearErrors();
    let hasErr = false;

    const title = elements.titleInput.value.replace(/\s+/g, ' ').trim();
    if (title.length < 2) {
      elements.titleError.textContent = 'Enter a title with at least 2 characters.';
      elements.titleInput.setAttribute('aria-invalid', 'true');
      hasErr = true;
    } else if (title.length > 60) {
      elements.titleError.textContent = 'Title must be at most 60 characters.';
      elements.titleInput.setAttribute('aria-invalid', 'true');
      hasErr = true;
    }

    const amt = parseFloat(elements.amountInput.value);
    if (isNaN(amt) || amt <= 0 || amt > MAX_AMOUNT) {
      elements.amountError.textContent = 'Enter an amount above ₹0 and up to ₹10,00,00,000.';
      elements.amountInput.setAttribute('aria-invalid', 'true');
      hasErr = true;
    }

    const cat = elements.categorySelect.value;
    if (!CATEGORY_NAMES.has(cat)) {
      elements.categoryError.textContent = 'Select a valid category.';
      elements.categorySelect.setAttribute('aria-invalid', 'true');
      hasErr = true;
    }

    const dt = elements.dateInput.value;
    const today = getTodayISO();
    if (!dt) {
      elements.dateError.textContent = 'Pick a date.';
      elements.dateInput.setAttribute('aria-invalid', 'true');
      hasErr = true;
    } else if (dt > today) {
      elements.dateError.textContent = 'Date can’t be in the future.';
      elements.dateInput.setAttribute('aria-invalid', 'true');
      hasErr = true;
    }

    if (hasErr) return null;
    return {
      id: editingId || generateId(),
      title,
      amount: Math.round(amt * 100) / 100,
      category: cat,
      date: dt
    };
  };

  // Edit Workflow (v1.1)
  const startEdit = (id) => {
    const item = items.find(it => it.id === id);
    if (!item) return;

    editingId = id;
    elements.titleInput.value = item.title;
    elements.amountInput.value = item.amount;
    elements.categorySelect.value = item.category;
    elements.dateInput.value = item.date;

    elements.formHeading.textContent = 'Edit Expense';
    elements.editingBadge.style.display = 'inline-block';
    elements.submitBtnIcon.textContent = '💾';
    elements.submitBtnText.textContent = 'Update Expense';
    elements.cancelEditBtn.style.display = 'inline-flex';

    clearErrors();
    elements.form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    elements.titleInput.focus();
  };

  const cancelEdit = () => {
    editingId = null;
    elements.formHeading.textContent = 'Add Expense';
    elements.editingBadge.style.display = 'none';
    elements.submitBtnIcon.textContent = '➕';
    elements.submitBtnText.textContent = 'Add Expense';
    elements.cancelEditBtn.style.display = 'none';

    elements.titleInput.value = '';
    elements.amountInput.value = '';
    elements.dateInput.value = getTodayISO();
    clearErrors();
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const expense = validateForm();
    if (!expense) return;

    if (editingId) {
      items = items.map(it => it.id === editingId ? expense : it);
      showToast('Expense updated successfully ✨');
      cancelEdit();
    } else {
      items.unshift(expense);
      elements.titleInput.value = '';
      elements.amountInput.value = '';
      elements.titleInput.focus();
    }

    saveExpenses();
    syncExpenseToCloud(expense);
    render();
  };

  const deleteExpense = (id) => {
    items = items.filter(item => item.id !== id);
    if (editingId === id) cancelEdit();
    saveExpenses();
    deleteExpenseFromCloud(id);
    render();
    showToast('Expense deleted');
  };

  // Budget Workflow (v1.2)
  const promptSetBudget = () => {
    const current = monthlyBudget > 0 ? monthlyBudget.toString() : '';
    const input = window.prompt('Set monthly spending budget in ₹ (enter 0 to remove):', current);
    if (input === null) return;

    const val = parseFloat(input.trim());
    if (isNaN(val) || val < 0 || val > MAX_AMOUNT) {
      alert('Please enter a valid amount between ₹0 and ₹10,00,00,000.');
      return;
    }

    monthlyBudget = Math.round(val * 100) / 100;
    saveBudget(monthlyBudget);
    syncBudgetToCloud(monthlyBudget);
    renderBudget();
    showToast(monthlyBudget > 0 ? `Monthly budget set to ${currencyFormatter.format(monthlyBudget)} 🎯` : 'Budget removed');
  };

  const renderBudget = () => {
    if (monthlyBudget <= 0) {
      elements.setBudgetText.textContent = 'Set Budget';
      elements.budgetProgressWrapper.style.display = 'none';
      return;
    }

    elements.setBudgetText.textContent = `Edit (₹${monthlyBudget})`;
    elements.budgetProgressWrapper.style.display = 'flex';

    const curMonth = getCurrentMonthISO();
    const curMonthItems = items.filter(e => e.date.startsWith(curMonth));
    const spent = curMonthItems.reduce((s, it) => s + it.amount, 0);
    const pct = Math.min(Math.round((spent / monthlyBudget) * 100), 100);

    const bar = elements.budgetBarFill;
    bar.style.width = `${pct}%`;
    bar.className = 'bar-fill ' + (spent > monthlyBudget ? 'budget-over' : spent >= monthlyBudget * 0.8 ? 'budget-warn' : 'budget-safe');

    elements.budgetStatusText.textContent = `${currencyFormatter.format(spent)} of ${currencyFormatter.format(monthlyBudget)} (${Math.round((spent / monthlyBudget) * 100)}%)`;

    const remaining = monthlyBudget - spent;
    if (remaining >= 0) {
      elements.budgetRemainingText.textContent = `${currencyFormatter.format(remaining)} left`;
      elements.budgetRemainingText.style.color = spent >= monthlyBudget * 0.8 ? 'var(--warn)' : 'var(--safe)';
    } else {
      elements.budgetRemainingText.textContent = `Over by ${currencyFormatter.format(Math.abs(remaining))}!`;
      elements.budgetRemainingText.style.color = 'var(--danger)';
    }
  };

  // Data Portability Workflow: CSV / JSON (v1.1)
  const exportCsv = () => {
    if (items.length === 0) { showToast('No expenses to export.'); return; }
    const escapeCsv = (str) => `"${String(str).replace(/"/g, '""')}"`;
    // UTF-8 BOM (\uFEFF) ensures Excel renders characters properly.
    // Format date as ="YYYY-MM-DD" text formula so Excel always displays the date without '########'.
    // Removed technical Transaction ID column for a clean, human-readable report.
    const BOM = '\uFEFF';
    const header = 'Date,Title,Category,Amount\n';
    const rows = items.map(it => [
      `="${it.date}"`,
      escapeCsv(it.title),
      escapeCsv(it.category),
      it.amount
    ].join(',')).join('\n');
    downloadBlob(new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' }), `rupee-flow-${getTodayISO()}.csv`);
    showToast('Exported clean CSV successfully 📄');
    elements.dataMenu.style.display = 'none';
  };

  const exportJson = () => {
    if (items.length === 0) { showToast('No expenses to export.'); return; }
    downloadBlob(new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' }), `rupee-flow-backup-${getTodayISO()}.json`);
    showToast('Exported JSON backup 📦');
    elements.dataMenu.style.display = 'none';
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseCsvLines = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    // Parse header to identify column indices
    const headerCols = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const dateIdx = headerCols.findIndex(c => c.includes('date'));
    const titleIdx = headerCols.findIndex(c => c.includes('title') || c.includes('name') || c.includes('desc'));
    const catIdx = headerCols.findIndex(c => c.includes('cat'));
    const amtIdx = headerCols.findIndex(c => c.includes('amount') || c.includes('rupee') || c.includes('cost') || c.includes('price'));
    const idIdx = headerCols.findIndex(c => c.includes('id'));

    if (dateIdx === -1 || titleIdx === -1 || amtIdx === -1) return [];

    const imported = [];
    for (let i = 1; i < lines.length; i++) {
      // Regex CSV line split handling quotes
      const match = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
      if (!match || match.length < 3) continue;

      const clean = match.map(m => m.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
      const d = (clean[dateIdx] || '').replace(/^[="']+|["']+$/g, '');
      const t = clean[titleIdx] || '';
      const c = catIdx !== -1 && CATEGORY_NAMES.has(clean[catIdx]) ? clean[catIdx] : 'Other';
      const a = parseFloat(clean[amtIdx]);
      const recordId = (idIdx !== -1 && clean[idIdx]) ? clean[idIdx] : generateId();

      const obj = { id: recordId, title: t, amount: a, category: c, date: d };
      if (isValidExpense(obj)) imported.push(obj);
    }
    return imported;
  };

  const handleImportFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        let newItems = [];
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) newItems = parsed.filter(isValidExpense);
        } else {
          newItems = parseCsvLines(content);
        }

        if (newItems.length === 0) {
          alert('No valid expense records could be imported from this file.');
          return;
        }

        const existingIds = new Set(items.map(it => it.id));
        let addedCount = 0;
        for (const item of newItems) {
          if (!existingIds.has(item.id)) {
            items.push(item);
            existingIds.add(item.id);
            addedCount++;
          }
        }

        saveExpenses();
        render();
        showToast(`Imported ${addedCount} expenses successfully! 📥`);
      } catch (err) {
        alert('Failed to parse file: ' + err.message);
      } finally {
        elements.importFileInput.value = '';
        elements.dataMenu.style.display = 'none';
      }
    };
    reader.readAsText(file);
  };

  // Queries & Rendering
  const getFilteredItems = () => {
    const q = (elements.searchInput.value || '').trim().toLowerCase();
    const cat = elements.filterCategory.value;
    const mo = elements.filterMonth.value;

    return items
      .filter(it => (!cat || it.category === cat) && (!mo || it.date.startsWith(mo)) && (!q || it.title.toLowerCase().includes(q)))
      .sort((a, b) => b.date !== a.date ? b.date.localeCompare(a.date) : b.id.localeCompare(a.id));
  };

  const animateTotal = (target) => {
    if (countAnimationId) { cancelAnimationFrame(countAnimationId); countAnimationId = null; }
    if (prefersReducedMotion() || Math.abs(target - currentDisplayedTotal) < 0.01) {
      currentDisplayedTotal = target;
      elements.totalSpent.textContent = currencyFormatter.format(target);
      return;
    }

    const start = currentDisplayedTotal, diff = target - start, duration = 500, startTime = performance.now();
    const step = (t) => {
      const p = Math.min((t - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      elements.totalSpent.textContent = currencyFormatter.format(start + diff * ease);
      if (p < 1) countAnimationId = requestAnimationFrame(step);
      else {
        currentDisplayedTotal = target;
        elements.totalSpent.textContent = currencyFormatter.format(target);
        countAnimationId = null;
      }
    };
    countAnimationId = requestAnimationFrame(step);
  };

  const calculateInsight = () => {
    if (items.length === 0) return 'Add your first expense above to see spending insights.';
    const curMonth = getCurrentMonthISO();
    const curItems = items.filter(e => e.date.startsWith(curMonth));
    if (curItems.length === 0) return 'Nothing logged for this month yet.';

    const totalCur = curItems.reduce((s, e) => s + e.amount, 0);
    const catTotals = {};
    for (const e of curItems) catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;

    let topCat = '', topAmt = 0;
    for (const [c, a] of Object.entries(catTotals)) {
      if (a > topAmt) { topAmt = a; topCat = c; }
    }

    const share = totalCur > 0 ? Math.round((topAmt / totalCur) * 100) : 0;
    const prevMonth = getPreviousMonthISO();
    const prevItems = items.filter(e => e.date.startsWith(prevMonth));

    if (prevItems.length > 0) {
      const totalPrev = prevItems.reduce((s, e) => s + e.amount, 0);
      if (totalPrev > 0) {
        const diff = Math.round(((totalCur - totalPrev) / totalPrev) * 100);
        if (diff > 0) return `${topCat} takes ${share}% of this month’s spend. Total spending is ${diff}% higher than last month.`;
        if (diff < 0) return `${topCat} takes ${share}% of this month’s spend. Total spending is ${Math.abs(diff)}% lower than last month.`;
        return `${topCat} takes ${share}% of this month’s spend. Total spending is the same as last month.`;
      }
    }
    return `${topCat} is your highest spending category this month, taking ${share}% of ${currencyFormatter.format(totalCur)}.`;
  };

  const renderCategorySummary = (list, total) => {
    const c = elements.categorySummary;
    c.textContent = '';
    if (list.length === 0 || total <= 0) {
      c.appendChild(el('p', 'empty-hint', 'No expenses match the current view to summarize.'));
      return;
    }

    const totals = {};
    for (const it of list) totals[it.category] = (totals[it.category] || 0) + it.amount;
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

    for (const [cat, amt] of sorted) {
      const pct = Math.round((amt / total) * 100);
      const row = el('div', 'category-bar-row');
      const header = el('div', 'category-bar-header');
      header.appendChild(el('span', 'category-bar-name', `${CATEGORY_ICON_MAP[cat] || '📦'} ${cat}`));

      const vals = el('div', 'category-bar-values');
      vals.appendChild(el('span', 'category-bar-amount', currencyFormatter.format(amt)));
      vals.appendChild(el('span', 'category-bar-percent', `${pct}%`));
      header.appendChild(vals);

      const track = el('div', 'bar-track');
      const fill = el('div', `bar-fill cat-${cat}`);
      fill.style.width = '0%';
      track.appendChild(fill);

      row.appendChild(header);
      row.appendChild(track);
      c.appendChild(row);

      requestAnimationFrame(() => { fill.style.width = `${pct}%`; });
    }
  };

  const renderExpenseList = (list) => {
    const ul = elements.expenseList;
    ul.textContent = '';

    for (const it of list) {
      const li = el('li', 'expense-item');
      li.dataset.id = it.id;

      const main = el('div', 'expense-item-main');
      main.appendChild(el('div', 'category-avatar', CATEGORY_ICON_MAP[it.category] || '📦'));

      const details = el('div', 'expense-details');
      details.appendChild(el('span', 'expense-title', it.title));

      const meta = el('div', 'expense-meta');
      meta.appendChild(el('span', 'expense-category-tag', it.category));
      meta.appendChild(el('span', 'meta-dot', '•'));
      meta.appendChild(el('span', 'expense-date', formatDateDisplay(it.date)));
      details.appendChild(meta);
      main.appendChild(details);

      const side = el('div', 'expense-item-side');
      side.appendChild(el('span', 'expense-amount', currencyFormatter.format(it.amount)));

      // Edit Button (v1.1)
      const editBtn = el('button', 'btn-action-icon btn-edit', '✏️');
      editBtn.type = 'button';
      editBtn.setAttribute('aria-label', `Edit ${it.title}`);
      editBtn.title = 'Edit expense';
      editBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        startEdit(it.id);
      });

      // Delete Button
      const delBtn = el('button', 'btn-action-icon btn-delete', '🗑️');
      delBtn.type = 'button';
      delBtn.setAttribute('aria-label', `Delete ${it.title}`);
      delBtn.title = 'Delete expense';
      delBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        deleteExpense(it.id);
      });

      side.appendChild(editBtn);
      side.appendChild(delBtn);
      li.appendChild(main);
      li.appendChild(side);
      ul.appendChild(li);
    }
  };

  const render = () => {
    const list = getFilteredItems();
    const total = list.reduce((s, it) => s + it.amount, 0);

    animateTotal(total);

    const count = list.length;
    elements.expenseCount.textContent = count === 1 ? '1 expense' : `${count} expenses`;
    elements.listVisibleCount.textContent = `${count} visible`;

    const isFiltered = Boolean((elements.searchInput.value || '').trim() || elements.filterCategory.value || elements.filterMonth.value);
    elements.activeFilterBadge.style.display = isFiltered ? 'inline-block' : 'none';

    elements.smartInsight.textContent = calculateInsight();
    renderCategorySummary(list, total);
    renderBudget();

    if (items.length === 0) {
      elements.expenseList.style.display = 'none';
      elements.emptyState.style.display = 'flex';
      elements.emptyStateTitle.textContent = 'No expenses yet';
      elements.emptyStateText.textContent = 'Add your first expense above to start tracking your flow.';
    } else if (list.length === 0) {
      elements.expenseList.style.display = 'none';
      elements.emptyState.style.display = 'flex';
      elements.emptyStateTitle.textContent = 'No matching expenses';
      elements.emptyStateText.textContent = 'No expenses match these filters. Try clearing them.';
    } else {
      elements.emptyState.style.display = 'none';
      elements.expenseList.style.display = 'flex';
      renderExpenseList(list);
    }
  };

  const init = () => {
    elements.dateInput.value = getTodayISO();
    elements.dateInput.max = getTodayISO();

    items = loadExpenses();
    monthlyBudget = loadBudget();
    initTheme();

    // Auto-clean any residual legacy mock data from the browser
    try {
      localStorage.removeItem('rupeeFlow.expenses.v1');
      localStorage.removeItem('rupeeFlow.budget.v1');
      const u = getCurrentUser();
      if (u) {
        if (items.some(it => Number(it.amount) === 1000) && (monthlyBudget === 30000 || monthlyBudget === 0)) {
          items = [];
          monthlyBudget = 0;
          saveExpenses();
          saveBudget(0);
        }
      }
    } catch {}

    // Trigger cloud synchronization with Neon PostgreSQL
    syncFromCloud();

    // User profile & lock session
    try {
      const raw = localStorage.getItem('rupeeFlow.currentUser') || sessionStorage.getItem('rupeeFlow.currentUser');
      if (raw) {
        const u = JSON.parse(raw);
        if (u && u.name && elements.userName) elements.userName.textContent = u.name;
      }
    } catch {}

    elements.logoutBtn?.addEventListener('click', () => {
      try {
        localStorage.removeItem('rupeeFlow.currentUser');
        sessionStorage.removeItem('rupeeFlow.currentUser');
      } catch {}
      window.location.href = 'login.html';
    });

    elements.form.addEventListener('submit', handleFormSubmit);
    elements.cancelEditBtn.addEventListener('click', cancelEdit);

    elements.searchInput.addEventListener('input', render);
    elements.filterCategory.addEventListener('change', render);
    elements.filterMonth.addEventListener('change', render);

    elements.clearFiltersBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      elements.filterCategory.value = '';
      elements.filterMonth.value = '';
      render();
    });

    elements.setBudgetBtn.addEventListener('click', promptSetBudget);

    // Data Menu & Portability
    elements.dataMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = elements.dataMenu.style.display === 'flex';
      elements.dataMenu.style.display = open ? 'none' : 'flex';
    });

    document.addEventListener('click', () => {
      if (elements.dataMenu) elements.dataMenu.style.display = 'none';
    });

    elements.exportCsvBtn.addEventListener('click', exportCsv);
    elements.exportJsonBtn.addEventListener('click', exportJson);
    elements.importBtn.addEventListener('click', () => elements.importFileInput.click());
    elements.importFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleImportFile(e.target.files[0]);
    });

    elements.resetAccountBtn?.addEventListener('click', async () => {
      const u = getCurrentUser();
      const accountName = u?.name || 'this account';
      if (!confirm(`Are you sure you want to clear all expenses and reset the budget for ${accountName}? This sets total spending back to ₹0.00.`)) return;
      if (u && u.username && u.username !== 'guest') {
        try {
          await fetch('/api/account/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u.username })
          });
        } catch {}
      }
      items = [];
      monthlyBudget = 0;
      saveExpenses();
      saveBudget(0);
      if (u && u.username) {
        const uKey = u.username.toLowerCase().trim();
        localStorage.removeItem(`rupeeFlow.expenses.v1.${uKey}`);
        localStorage.removeItem(`rupeeFlow.budget.v1.${uKey}`);
      }
      localStorage.removeItem('rupeeFlow.expenses.v1');
      localStorage.removeItem('rupeeFlow.budget.v1');
      render();
      showToast('Account reset: 0 expenses and ₹0.00 spending.');
      if (elements.dataMenu) elements.dataMenu.style.display = 'none';
    });

    elements.deleteAccountBtn?.addEventListener('click', async () => {
      const u = getCurrentUser();
      const accountName = u?.name || u?.username || 'this account';
      if (!confirm(`PERMANENT DELETION: Are you sure you want to delete "${accountName}" from Neon DB and remove all records?`)) return;
      if (u && u.username && u.username !== 'guest') {
        try {
          await fetch('/api/account/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u.username })
          });
        } catch {}
      }
      try {
        if (u && u.username) {
          const uKey = u.username.toLowerCase().trim();
          localStorage.removeItem(`rupeeFlow.expenses.v1.${uKey}`);
          localStorage.removeItem(`rupeeFlow.budget.v1.${uKey}`);
          const rawUsers = localStorage.getItem('rupeeFlow.users');
          if (rawUsers) {
            const parsed = JSON.parse(rawUsers);
            if (Array.isArray(parsed)) {
              localStorage.setItem('rupeeFlow.users', JSON.stringify(parsed.filter(x => x.username.toLowerCase().trim() !== uKey)));
            }
          }
        }
        localStorage.removeItem('rupeeFlow.currentUser');
        sessionStorage.removeItem('rupeeFlow.currentUser');
        localStorage.removeItem('rupeeFlow.expenses.v1');
        localStorage.removeItem('rupeeFlow.budget.v1');
      } catch {}
      alert(`Account "${accountName}" has been deleted.`);
      window.location.href = 'login.html';
    });

    elements.titleInput.addEventListener('input', () => {
      if (elements.titleError.textContent) elements.titleError.textContent = '';
      elements.titleInput.removeAttribute('aria-invalid');
    });

    elements.amountInput.addEventListener('input', () => {
      if (elements.amountError.textContent) elements.amountError.textContent = '';
      elements.amountInput.removeAttribute('aria-invalid');
    });

    elements.dateInput.addEventListener('change', () => {
      if (elements.dateError.textContent) elements.dateError.textContent = '';
      elements.dateInput.removeAttribute('aria-invalid');
    });

    render();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
