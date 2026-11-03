const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PORT = 3001;
const NEON_DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_6Sx7ZFUOGmTk@ep-damp-glitter-az6hfwsc-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

// Initialize PostgreSQL Pool
const pool = new Pool({
  connectionString: NEON_DB_URL,
  ssl: { rejectUnauthorized: false }
});

// Auto-initialize DB Tables
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        title VARCHAR(200) NOT NULL,
        amount NUMERIC(15, 2) NOT NULL,
        category VARCHAR(50) NOT NULL,
        date VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS budgets (
        username VARCHAR(100) PRIMARY KEY,
        amount NUMERIC(15, 2) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(username);
    `);
    console.log('✔ Neon PostgreSQL tables ready (users, expenses, budgets).');
  } catch (err) {
    console.error('⚠ Neon PostgreSQL init warning:', err.message);
  }
}
initDb();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Helper to parse JSON body (compatible with standalone Node and Vercel serverless)
function parseJsonBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return Promise.resolve(JSON.parse(req.body));
      } catch {
        return Promise.resolve({});
      }
    }
    return Promise.resolve(req.body);
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

async function handleRequest(req, res) {
  const urlParts = req.url.split('?');
  const pathname = decodeURIComponent(urlParts[0]);
  const query = new URLSearchParams(urlParts[1] || '');

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // --- API ROUTES (Neon PostgreSQL) ---

  // Health check
  if (pathname === '/api/health') {
    try {
      const dbRes = await pool.query('SELECT NOW() as now, current_database() as db');
      sendJson(res, 200, { ok: true, status: 'connected', db: dbRes.rows[0].db, time: dbRes.rows[0].now });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // Register
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const { username, name, passwordHash } = await parseJsonBody(req);
      if (!username || !name || !passwordHash) {
        sendJson(res, 400, { ok: false, error: 'Missing required registration fields' });
        return;
      }
      const existing = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
      if (existing.rows.length > 0) {
        sendJson(res, 409, { ok: false, error: 'Username already registered in database' });
        return;
      }
      await pool.query(
        'INSERT INTO users (username, name, password_hash) VALUES ($1, $2, $3)',
        [username.trim().toLowerCase(), name.trim(), passwordHash]
      );
      sendJson(res, 201, { ok: true, user: { username: username.trim().toLowerCase(), name: name.trim() } });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // Login
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const { username, passwordHash } = await parseJsonBody(req);
      if (!username || !passwordHash) {
        sendJson(res, 400, { ok: false, error: 'Missing username or password' });
        return;
      }
      const result = await pool.query(
        'SELECT username, name, password_hash FROM users WHERE LOWER(username) = LOWER($1)',
        [username.trim()]
      );
      if (result.rows.length === 0 || result.rows[0].password_hash !== passwordHash) {
        sendJson(res, 401, { ok: false, error: 'Invalid username or password' });
        return;
      }
      sendJson(res, 200, { ok: true, user: { username: result.rows[0].username, name: result.rows[0].name } });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // Get Expenses for User
  if (pathname === '/api/expenses' && req.method === 'GET') {
    try {
      const user = (query.get('username') || '').toLowerCase().trim();
      if (!user) {
        sendJson(res, 400, { ok: false, error: 'Username parameter required' });
        return;
      }
      const result = await pool.query(
        'SELECT id, title, amount::float as amount, category, date FROM expenses WHERE LOWER(username) = LOWER($1) ORDER BY date DESC, created_at DESC',
        [user]
      );
      sendJson(res, 200, { ok: true, items: result.rows });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // Save / Update Expense
  if (pathname === '/api/expenses' && req.method === 'POST') {
    try {
      const { username, expense } = await parseJsonBody(req);
      if (!username || !expense || !expense.id || !expense.title) {
        sendJson(res, 400, { ok: false, error: 'Invalid expense payload' });
        return;
      }
      const user = username.toLowerCase().trim();
      await pool.query(
        `INSERT INTO expenses (id, username, title, amount, category, date)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           amount = EXCLUDED.amount,
           category = EXCLUDED.category,
           date = EXCLUDED.date`,
        [expense.id, user, expense.title, expense.amount, expense.category, expense.date]
      );
      sendJson(res, 200, { ok: true, item: expense });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // Delete Expense
  if (pathname === '/api/expenses/delete' && req.method === 'POST') {
    try {
      const { username, id } = await parseJsonBody(req);
      if (!username || !id) {
        sendJson(res, 400, { ok: false, error: 'Missing username or id' });
        return;
      }
      await pool.query('DELETE FROM expenses WHERE id = $1 AND LOWER(username) = LOWER($2)', [id, username.trim()]);
      sendJson(res, 200, { ok: true, deletedId: id });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // Get Monthly Budget
  if (pathname === '/api/budget' && req.method === 'GET') {
    try {
      const user = (query.get('username') || '').toLowerCase().trim();
      if (!user) {
        sendJson(res, 400, { ok: false, error: 'Username parameter required' });
        return;
      }
      const result = await pool.query('SELECT amount::float as amount FROM budgets WHERE LOWER(username) = LOWER($1)', [user]);
      const budget = result.rows.length > 0 ? result.rows[0].amount : 0;
      sendJson(res, 200, { ok: true, budget });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // Save Monthly Budget
  if (pathname === '/api/budget' && req.method === 'POST') {
    try {
      const { username, amount } = await parseJsonBody(req);
      if (!username) {
        sendJson(res, 400, { ok: false, error: 'Missing username' });
        return;
      }
      const user = username.toLowerCase().trim();
      const val = parseFloat(amount);
      if (val > 0) {
        await pool.query(
          `INSERT INTO budgets (username, amount) VALUES ($1, $2)
           ON CONFLICT (username) DO UPDATE SET amount = EXCLUDED.amount, updated_at = CURRENT_TIMESTAMP`,
          [user, val]
        );
      } else {
        await pool.query('DELETE FROM budgets WHERE LOWER(username) = LOWER($1)', [user]);
      }
      sendJson(res, 200, { ok: true, budget: val > 0 ? val : 0 });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // Reset Account Data (Fresh start)
  if (pathname === '/api/account/reset' && req.method === 'POST') {
    try {
      const { username } = await parseJsonBody(req);
      if (!username) {
        sendJson(res, 400, { ok: false, error: 'Missing username' });
        return;
      }
      const user = username.toLowerCase().trim();
      await pool.query('DELETE FROM expenses WHERE LOWER(username) = LOWER($1)', [user]);
      await pool.query('DELETE FROM budgets WHERE LOWER(username) = LOWER($1)', [user]);
      sendJson(res, 200, { ok: true, resetUser: user });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // Delete Entire Account
  if (pathname === '/api/account/delete' && req.method === 'POST') {
    try {
      const { username } = await parseJsonBody(req);
      if (!username) {
        sendJson(res, 400, { ok: false, error: 'Missing username' });
        return;
      }
      const user = username.toLowerCase().trim();
      await pool.query('DELETE FROM expenses WHERE LOWER(username) = LOWER($1)', [user]);
      await pool.query('DELETE FROM budgets WHERE LOWER(username) = LOWER($1)', [user]);
      await pool.query('DELETE FROM users WHERE LOWER(username) = LOWER($1)', [user]);
      sendJson(res, 200, { ok: true, deletedUser: user });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // --- STATIC FILE SERVING ---
  let servePath = pathname;
  if (!servePath || servePath === '/') {
    servePath = 'login.html';
  }

  const cleanRelative = servePath.replace(/^[\/\\]+/, '');
  let filePath = path.resolve(__dirname, cleanRelative);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'login.html');
    }
  } catch {}

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(content);
    }
  });
}

const server = http.createServer(handleRequest);

function startServer(port) {
  server.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(` Rupee Flow + Neon PostgreSQL is live at: http://localhost:${port}`);
    console.log(`======================================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

if (require.main === module) {
  startServer(PORT);
}

module.exports = handleRequest;
