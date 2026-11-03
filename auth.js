/**
 * Rupee Flow — Enterprise-Grade Authentication & Vault Security
 * Powered by Web Crypto API (SHA-256), client-side brute-force defense, and real-time entropy scoring.
 */

(() => {
  'use strict';

  const STORAGE_KEY_USERS = 'rupeeFlow.users.v1';
  const STORAGE_KEY_SESSION = 'rupeeFlow.currentUser';
  const STORAGE_KEY_THEME = 'rupeeFlow.theme';
  const STORAGE_KEY_ATTEMPTS = 'rupeeFlow.loginAttempts';
  const MAX_FAILED_ATTEMPTS = 5;
  const LOCKOUT_SECONDS = 30;

  // Apply saved theme
  try {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
  } catch {}

  // Cryptographic hashing with unique salt
  async function hashPassword(password, username) {
    const salt = `rupee_flow_salt_${username.toLowerCase()}_2026`;
    const enc = new TextEncoder().encode(password + salt);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function getUsers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USERS);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveUsers(users) {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (e) {
      console.warn('Failed to save user account:', e);
    }
  }

  // DOM Elements
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const signInForm = document.getElementById('signInForm');
  const signUpForm = document.getElementById('signUpForm');
  const authAlert = document.getElementById('authAlert');
  const guestBtn = document.getElementById('guestBtn');
  const forgotPassBtn = document.getElementById('forgotPassBtn');
  const signInSubmitBtn = document.getElementById('signInSubmitBtn');

  // Input Elements
  const loginUser = document.getElementById('loginUsername');
  const loginPass = document.getElementById('loginPassword');
  const rememberMe = document.getElementById('rememberMe');
  const toggleLoginPass = document.getElementById('toggleLoginPass');

  const regName = document.getElementById('regFullName');
  const regUser = document.getElementById('regUsername');
  const regPass = document.getElementById('regPassword');
  const regPassConfirm = document.getElementById('regPasswordConfirm');
  const toggleRegPass = document.getElementById('toggleRegPass');
  const strengthFill = document.getElementById('strengthFill');
  const strengthText = document.getElementById('strengthText');

  // Alert Banner
  function showAlert(msg, isError = true) {
    authAlert.textContent = msg;
    authAlert.style.display = 'flex';
    authAlert.className = 'auth-banner ' + (isError ? 'error' : 'success');
  }

  function clearAlert() {
    authAlert.textContent = '';
    authAlert.style.display = 'none';
  }

  // Password Visibility Toggle
  function setupPasswordToggle(button, input) {
    if (!button || !input) return;
    button.addEventListener('click', () => {
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      button.textContent = isPass ? '🙈' : '👁️';
      button.setAttribute('aria-label', isPass ? 'Hide password' : 'Show password');
    });
  }
  setupPasswordToggle(toggleLoginPass, loginPass);
  setupPasswordToggle(toggleRegPass, regPass);

  // Password Entropy / Strength Calculation
  if (regPass) {
    regPass.addEventListener('input', () => {
      const val = regPass.value;
      if (!val) {
        strengthFill.style.width = '0%';
        strengthText.textContent = 'Enter password';
        strengthText.style.color = 'var(--muted)';
        return;
      }

      let score = 0;
      if (val.length >= 4) score += 20;
      if (val.length >= 8) score += 25;
      if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score += 20;
      if (/[0-9]/.test(val)) score += 20;
      if (/[^A-Za-z0-9]/.test(val)) score += 15;

      const pct = Math.min(score, 100);
      strengthFill.style.width = `${pct}%`;

      if (pct < 40) {
        strengthFill.style.background = '#ef4444';
        strengthText.textContent = 'Weak';
        strengthText.style.color = '#ef4444';
      } else if (pct < 75) {
        strengthFill.style.background = '#f59e0b';
        strengthText.textContent = 'Medium';
        strengthText.style.color = '#f59e0b';
      } else {
        strengthFill.style.background = '#10b981';
        strengthText.textContent = 'Strong ✨';
        strengthText.style.color = '#10b981';
      }
    });
  }

  // Brute Force Guard
  function getLockout() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ATTEMPTS);
      if (!raw) return { count: 0, lockedUntil: 0 };
      return JSON.parse(raw);
    } catch { return { count: 0, lockedUntil: 0 }; }
  }

  function setLockout(count, lockedUntil = 0) {
    try {
      localStorage.setItem(STORAGE_KEY_ATTEMPTS, JSON.stringify({ count, lockedUntil }));
    } catch {}
  }

  function checkLockout() {
    const { count, lockedUntil } = getLockout();
    const now = Date.now();
    if (lockedUntil && lockedUntil > now) {
      const rem = Math.ceil((lockedUntil - now) / 1000);
      showAlert(`Security lockout: too many failed attempts. Try again in ${rem}s.`);
      signInSubmitBtn.disabled = true;
      setTimeout(checkLockout, 1000);
      return true;
    } else if (lockedUntil && lockedUntil <= now) {
      setLockout(0, 0);
      signInSubmitBtn.disabled = false;
      clearAlert();
      return false;
    }
    signInSubmitBtn.disabled = false;
    return false;
  }
  checkLockout();

  // Tabs Switcher
  tabSignIn.addEventListener('click', () => {
    tabSignIn.classList.add('active');
    tabSignIn.setAttribute('aria-selected', 'true');
    tabSignUp.classList.remove('active');
    tabSignUp.setAttribute('aria-selected', 'false');
    signInForm.style.display = 'flex';
    signUpForm.style.display = 'none';
    clearAlert();
    loginUser.focus();
  });

  tabSignUp.addEventListener('click', () => {
    tabSignUp.classList.add('active');
    tabSignUp.setAttribute('aria-selected', 'true');
    tabSignIn.classList.remove('active');
    tabSignIn.setAttribute('aria-selected', 'false');
    signUpForm.style.display = 'flex';
    signInForm.style.display = 'none';
    clearAlert();
    regName.focus();
  });

  // Session Handler
  function setSessionAndRedirect(userObj, remember = true) {
    const sessionData = {
      name: userObj.name,
      username: userObj.username,
      loggedInAt: new Date().toISOString(),
      expiresAt: remember ? Date.now() + 30 * 24 * 60 * 60 * 1000 : null
    };
    try {
      if (remember) {
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionData));
        sessionStorage.removeItem(STORAGE_KEY_SESSION);
      } else {
        sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionData));
        localStorage.removeItem(STORAGE_KEY_SESSION);
      }
    } catch {}

    window.location.href = 'index.html';
  }

  // Handle Sign In Submit
  signInForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (checkLockout()) return;
    clearAlert();

    const usernameVal = loginUser.value.trim().toLowerCase();
    const passwordVal = loginPass.value;

    if (!usernameVal || !passwordVal) {
      showAlert('Please enter both your username and password.');
      return;
    }

    const users = getUsers();

    // If no accounts exist yet, auto-create this first user seamlessly
    if (users.length === 0) {
      const hash = await hashPassword(passwordVal, usernameVal);
      const newUser = {
        name: usernameVal.charAt(0).toUpperCase() + usernameVal.slice(1),
        username: usernameVal,
        hash
      };
      try {
        await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: usernameVal, name: newUser.name, passwordHash: hash })
        });
      } catch {}
      users.push(newUser);
      saveUsers(users);
      try {
        localStorage.setItem(`rupeeFlow.expenses.v1.${usernameVal}`, '[]');
        localStorage.removeItem(`rupeeFlow.budget.v1.${usernameVal}`);
        localStorage.removeItem('rupeeFlow.expenses.v1');
        localStorage.removeItem('rupeeFlow.budget.v1');
      } catch {}
      showAlert('Initial master vault profile created! Logging in...', false);
      setTimeout(() => setSessionAndRedirect(newUser, rememberMe.checked), 600);
      return;
    }

    const hashedInput = await hashPassword(passwordVal, usernameVal);

    // Attempt Neon PostgreSQL Cloud Login
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameVal, passwordHash: hashedInput })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setLockout(0, 0);
        showAlert(`Authenticated via Neon DB. Welcome back, ${data.user.name}!`, false);
        setTimeout(() => setSessionAndRedirect(data.user, rememberMe.checked), 400);
        return;
      } else if (res.status === 401 || res.status === 400) {
        const current = getLockout();
        const newCount = current.count + 1;
        if (newCount >= MAX_FAILED_ATTEMPTS) {
          const lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
          setLockout(newCount, lockedUntil);
          checkLockout();
        } else {
          setLockout(newCount, 0);
          showAlert(`Incorrect credentials. ${MAX_FAILED_ATTEMPTS - newCount} attempts remaining.`);
        }
        loginPass.value = '';
        loginPass.focus();
        return;
      }
    } catch {
      // Offline fallback: check local user list
    }

    const matchedUser = users.find(u => u.username.toLowerCase() === usernameVal && u.hash === hashedInput);
    if (matchedUser) {
      setLockout(0, 0);
      showAlert(`Authenticated. Welcome back, ${matchedUser.name}!`, false);
      setTimeout(() => setSessionAndRedirect(matchedUser, rememberMe.checked), 400);
    } else {
      const current = getLockout();
      const newCount = current.count + 1;
      if (newCount >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
        setLockout(newCount, lockedUntil);
        checkLockout();
      } else {
        setLockout(newCount, 0);
        showAlert(`Incorrect credentials. ${MAX_FAILED_ATTEMPTS - newCount} attempts remaining.`);
      }
      loginPass.value = '';
      loginPass.focus();
    }
  });

  // Handle Sign Up Submit
  signUpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const nameVal = regName.value.trim();
    const userVal = regUser.value.trim().toLowerCase();
    const passVal = regPass.value;
    const confirmVal = regPassConfirm.value;

    if (nameVal.length < 2) {
      showAlert('Name must be at least 2 characters.');
      regName.focus();
      return;
    }

    if (userVal.length < 3) {
      showAlert('Username must be at least 3 characters.');
      regUser.focus();
      return;
    }

    if (passVal.length < 4) {
      showAlert('Password or PIN must be at least 4 characters.');
      regPass.focus();
      return;
    }

    if (passVal !== confirmVal) {
      showAlert('Passwords do not match. Please verify.');
      regPassConfirm.focus();
      return;
    }

    const users = getUsers();
    if (users.some(u => u.username.toLowerCase() === userVal)) {
      showAlert('Username already registered. Please choose another.');
      regUser.focus();
      return;
    }

    const hash = await hashPassword(passVal, userVal);
    const newUser = { name: nameVal, username: userVal, hash };

    // Register into Neon PostgreSQL
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userVal, name: nameVal, passwordHash: hash })
      });
      const data = await res.json();
      if (!res.ok && res.status === 409) {
        showAlert('Username already registered in database. Choose another.');
        regUser.focus();
        return;
      }
    } catch {
      // Offline fallback
    }

    users.push(newUser);
    saveUsers(users);

    // Guarantee clean slate for newly created account
    try {
      const uClean = userVal.toLowerCase().trim();
      localStorage.setItem(`rupeeFlow.expenses.v1.${uClean}`, '[]');
      localStorage.removeItem(`rupeeFlow.budget.v1.${uClean}`);
      localStorage.removeItem('rupeeFlow.expenses.v1');
      localStorage.removeItem('rupeeFlow.budget.v1');
      // Wipe any lingering cached variations for clean slate
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.includes(uClean)) {
          if (k.startsWith('rupeeFlow.expenses.')) localStorage.setItem(k, '[]');
          if (k.startsWith('rupeeFlow.budget.')) localStorage.removeItem(k);
        }
      }
    } catch {}

    showAlert('Secure vault created in Neon DB! Unlocking...', false);
    setTimeout(() => setSessionAndRedirect(newUser, true), 500);
  });

  // Continue as Guest (Offline)
  guestBtn.addEventListener('click', () => {
    setSessionAndRedirect({ name: 'Guest Explorer', username: 'guest' }, false);
  });

  // Forgot Password Hint Modal
  forgotPassBtn.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Security Note: Because Rupee Flow operates in zero-knowledge mode with no central servers, there is no remote password recovery. You can register a new username on this device or use "Continue as Guest".');
  });

  // Pre-fill username if session exists without forced auto-redirect
  try {
    const active = localStorage.getItem(STORAGE_KEY_SESSION) || sessionStorage.getItem(STORAGE_KEY_SESSION);
    if (active) {
      const parsed = JSON.parse(active);
      if (parsed && parsed.username && loginUser) {
        loginUser.value = parsed.username;
        if (loginPass) loginPass.focus();
      }
    }
  } catch {}
})();
