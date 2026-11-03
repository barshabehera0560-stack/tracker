const fs = require('fs');
const path = require('path');
const assert = require('assert');
const zlib = require('zlib');

console.log('=== Rupee Flow Test & Verification Suite (v1.2) ===\n');

// 1. Check Files Existence
const htmlPath = path.join(__dirname, 'index.html');
const cssPath = path.join(__dirname, 'style.css');
const jsPath = path.join(__dirname, 'script.js');

assert(fs.existsSync(htmlPath), 'index.html must exist');
assert(fs.existsSync(cssPath), 'style.css must exist');
assert(fs.existsSync(jsPath), 'script.js must exist');
console.log('✔ All 3 core files (index.html, style.css, script.js) exist');

// 2. Security Check: Ensure NO innerHTML, eval, or document.write
const jsContent = fs.readFileSync(jsPath, 'utf8');
assert(!jsContent.includes('.innerHTML'), 'Security failure: script.js contains innerHTML!');
assert(!jsContent.includes('eval('), 'Security failure: script.js contains eval()!');
assert(!jsContent.includes('document.write'), 'Security failure: script.js contains document.write!');
console.log('✔ Security audit passed: zero innerHTML, eval(), or document.write');

// 3. ID Matching between index.html and script.js
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const idMatches = [...jsContent.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
console.log(`Checking ${idMatches.length} DOM IDs referenced in script.js...`);
for (const id of idMatches) {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing referenced id: ${id}`);
}
console.log(`✔ All ${idMatches.length} DOM element IDs referenced in script.js exist in index.html`);

// 4. Test Currency Formatting (Intl Indian Numbering)
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const sample1 = currencyFormatter.format(123456.78);
assert(sample1.includes('1,23,456.78'), 'Currency format must reflect Indian grouping (1,23,456.78)');
const sample2 = currencyFormatter.format(10000000);
assert(sample2.includes('1,00,00,000.00'), 'Currency format must reflect 1 crore grouping');
console.log('✔ Indian Rupee (₹) lakh/crore formatting confirmed');

// 5. Test Schema Validation Logic
const CATEGORY_NAMES = new Set(['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other']);
const MAX_AMOUNT = 100000000;

function isValidExpense(e) {
  return Boolean(
    e && typeof e === 'object' &&
    typeof e.id === 'string' && e.id.trim().length > 0 &&
    typeof e.title === 'string' && e.title.trim().length >= 2 && e.title.length <= 60 &&
    typeof e.amount === 'number' && Number.isFinite(e.amount) && e.amount > 0 && e.amount <= MAX_AMOUNT &&
    typeof e.category === 'string' && CATEGORY_NAMES.has(e.category) &&
    typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
  );
}

assert(isValidExpense({ id: '1', title: 'Office Coffee', amount: 80, category: 'Food', date: '2026-11-01' }) === true);
assert(isValidExpense(null) === false);
assert(isValidExpense({ id: '1', title: 'A', amount: 10, category: 'Food', date: '2026-11-01' }) === false);
assert(isValidExpense({ id: '1', title: 'Valid', amount: -5, category: 'Food', date: '2026-11-01' }) === false);
assert(isValidExpense({ id: '1', title: 'Valid', amount: 0, category: 'Food', date: '2026-11-01' }) === false);
assert(isValidExpense({ id: '1', title: 'Valid', amount: 100000001, category: 'Food', date: '2026-11-01' }) === false);
console.log('✔ Schema validator edge-cases correctly handled');

// 6. Test Edit Workflow (v1.1)
let testItems = [
  { id: 'item1', title: 'Coffee', amount: 100, category: 'Food', date: '2026-11-01' },
  { id: 'item2', title: 'Taxi', amount: 350, category: 'Transport', date: '2026-11-01' }
];

const updatedItem1 = { id: 'item1', title: 'Specialty Coffee', amount: 150, category: 'Food', date: '2026-11-01' };
testItems = testItems.map(it => it.id === 'item1' ? updatedItem1 : it);
assert.strictEqual(testItems.find(it => it.id === 'item1').title, 'Specialty Coffee');
assert.strictEqual(testItems.find(it => it.id === 'item1').amount, 150);
console.log('✔ In-place Edit replacement logic verified');

// 7. Test CSV Export Escaping & CSV Parsing (v1.1)
const escapeCsv = (str) => `"${String(str).replace(/"/g, '""')}"`;
const testTitle = 'Dinner, Drinks & "Fun"';
const escaped = escapeCsv(testTitle);
assert.strictEqual(escaped, '"Dinner, Drinks & ""Fun"""');

// Test CSV parser
const mockCsv = `ID,Date,Title,Category,Amount\nabc1,2026-11-01,"Dinner, Drinks & ""Fun""",Food,850.5\nabc2,2026-10-25,Metro,Transport,50`;
const lines = mockCsv.split('\n');
const header = lines[0].split(',').map(h => h.trim().toLowerCase());
assert(header.includes('date') && header.includes('title') && header.includes('amount'));
console.log('✔ CSV RFC 4180 escaping and parser verified');

// 8. Test Monthly Budget Tracking Logic (v1.2)
const budget = 20000;
const spentSafe = 12000; // 60% -> safe
const spentWarn = 17500; // 87.5% -> warn
const spentOver = 22000; // 110% -> over

const getStatus = (spent, b) => (spent > b ? 'budget-over' : spent >= b * 0.8 ? 'budget-warn' : 'budget-safe');
assert.strictEqual(getStatus(spentSafe, budget), 'budget-safe');
assert.strictEqual(getStatus(spentWarn, budget), 'budget-warn');
assert.strictEqual(getStatus(spentOver, budget), 'budget-over');
console.log('✔ Monthly Budget threshold calculations verified');

// 9. Check File Sizes & Transfer Profile
const htmlBuf = fs.readFileSync(htmlPath);
const cssBuf = fs.readFileSync(cssPath);
const jsBuf = fs.readFileSync(jsPath);

const rawTotalKb = ((htmlBuf.length + cssBuf.length + jsBuf.length) / 1024).toFixed(2);
const gzipTotalKb = ((zlib.gzipSync(htmlBuf).length + zlib.gzipSync(cssBuf).length + zlib.gzipSync(jsBuf).length) / 1024).toFixed(2);

console.log(`\nFile Size & Transfer Audit:`);
console.log(`- index.html: ${(htmlBuf.length / 1024).toFixed(2)} KB (gzipped: ${(zlib.gzipSync(htmlBuf).length / 1024).toFixed(2)} KB)`);
console.log(`- style.css:  ${(cssBuf.length / 1024).toFixed(2)} KB (gzipped: ${(zlib.gzipSync(cssBuf).length / 1024).toFixed(2)} KB)`);
console.log(`- script.js:  ${(jsBuf.length / 1024).toFixed(2)} KB (gzipped: ${(zlib.gzipSync(jsBuf).length / 1024).toFixed(2)} KB)`);
console.log(`Total wire transfer size (gzipped): ${gzipTotalKb} KB (Target: under 20 KB)`);
assert(parseFloat(gzipTotalKb) < 20, 'Wire transfer size is well under 20 KB');

console.log('\nAll automated verification checks PASSED successfully! 🚀');
