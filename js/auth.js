// ════════════════════════════════════════════════════════════════
// auth.js — Login, sesión y panel de usuarios
// ════════════════════════════════════════════════════════════════

const AUTH_KEY = 'gp_auth_v1';

// Ocultar login de inmediato si hay token — evita el flash de 1/4 seg
(function () {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw && JSON.parse(raw)?.token) {
      document.getElementById('loginScreen').style.display = 'none';
    }
  } catch {}
})();

let currentUser = null; // { id, username, role }

// ── Arranque ─────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
  // Enter en los campos de login
  ['loginUser', 'loginPass'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    });
  });

  const saved = getSavedAuth();
  if (!saved) return showLogin();

  // Verificar token con el servidor
  try {
    const res = await apiFetch('GET', '/api/auth/me', null, saved.token);
    if (!res.ok) throw new Error();
    const data = await res.json();
    currentUser = data.user;
    await applySession(saved.token, data.user, data.prefs);
  } catch (e) {
    console.error('Error en arranque de sesión:', e);
    clearAuth();
    showLogin();
  }
});

// ── Login / logout ────────────────────────────────────────────────

async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('loginBtn');

  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Introduce usuario y contraseña'; return; }

  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    const res  = await apiFetch('POST', '/api/auth/login', { username, password });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Error al entrar'; return; }

    saveAuth(data.token, data.user);
    currentUser = data.user;
    applySession(data.token, data.user, data.prefs);
  } catch {
    errEl.textContent = 'No se pudo conectar con el servidor';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

function doLogout() {
  clearAuth();
  _idbDel('gp_cache_v1').catch(() => {});
  document.getElementById('app').style.display          = 'none';
  document.getElementById('uploadScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display  = '';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginError').textContent = '';
}

// ── Sesión ────────────────────────────────────────────────────────

async function applySession(token, user, prefs) {
  // Etiquetar usuario en la barra de carga y en el sidebar
  const lbl = document.getElementById('sessionUserLabel');
  if (lbl) lbl.textContent = `👤 ${user.username}`;

  // Mostrar botón admin en upload screen y nav en sidebar
  const adminBtn = document.getElementById('adminUsersBtn');
  if (adminBtn) adminBtn.style.display = user.role === 'admin' ? '' : 'none';
  const adminNav = document.getElementById('n-usuarios');
  if (adminNav) adminNav.style.display = user.role === 'admin' ? '' : 'none';
  const adminNavHdr = document.getElementById('n-usuarios-hdr');
  if (adminNavHdr) adminNavHdr.style.display = user.role === 'admin' ? '' : 'none';

  // Restaurar config guardada
  if (prefs?.cfg && Object.keys(prefs.cfg).length) {
    CFG = { ...CFG_DEFAULTS, ...prefs.cfg };
  }
  // Sincronizar displays de leyenda con valores cargados
  ['topN','topNHigh'].forEach(k => {
    const el = document.getElementById('disp-' + k);
    if (el) el.textContent = CFG[k] ?? CFG_DEFAULTS[k];
  });
  if (prefs?.store) selectedStore = prefs.store;

  // Ocultar login
  document.getElementById('loginScreen').style.display = 'none';

  // Intentar ir directo al panel si hay caché
  let loaded = false;
  try {
    loaded = await loadFromCache();
  } catch (e) {
    console.error('Error cargando caché:', e);
  }

  if (loaded) {
    showApp();
    const view = prefs?.view;
    if (view && view !== 'mapa') gotoView(view);
  } else {
    // Sin caché → pantalla de carga de Excel
    document.getElementById('uploadScreen').style.display = '';
    // Si tenemos la tienda guardada, pre-seleccionarla
    if (prefs?.store && typeof onStoreSelect === 'function') {
      const sel = document.getElementById('storeSelect');
      if (sel) { sel.value = prefs.store; onStoreSelect(sel); }
    }
  }
}

// Guarda preferencias en el servidor (llamar desde app.js cuando cambien)
async function savePreferences(store, view, cfg) {
  const saved = getSavedAuth();
  if (!saved) return;
  apiFetch('PUT', '/api/preferences', { store, view, cfg }, saved.token).catch(() => {});
}

// ── Persistencia local del token ──────────────────────────────────

function saveAuth(token, user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ token, user }));
}
function getSavedAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}
function getToken() {
  return getSavedAuth()?.token ?? null;
}

// ── Fetch helper ─────────────────────────────────────────────────

function apiFetch(method, path, body, token) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body)  opts.body = JSON.stringify(body);
  return fetch(path, opts);
}

// ── Panel de usuarios ─────────────────────────────────────────────

function openUsersPanel() {
  document.getElementById('usersOverlay').classList.add('open');
  loadUsers();
}
function closeUsersPanel() {
  document.getElementById('usersOverlay').classList.remove('open');
  document.getElementById('usersError').textContent = '';
  document.getElementById('newUsername').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('newRole').value = 'user';
}

async function loadUsers() {
  const list = document.getElementById('usersList');
  list.innerHTML = '<div style="color:var(--mu);font-size:13px">Cargando...</div>';
  try {
    const res   = await apiFetch('GET', '/api/admin/users', null, getToken());
    const users = await res.json();
    renderUsersList(users);
  } catch {
    list.innerHTML = '<div style="color:var(--rd);font-size:13px">Error al cargar usuarios</div>';
  }
}

function renderUsersList(users) {
  const list = document.getElementById('usersList');
  if (!users.length) {
    list.innerHTML = '<div style="color:var(--mu);font-size:13px">No hay usuarios</div>';
    return;
  }
  list.innerHTML = users.map(u => {
    const fecha  = new Date(u.created_at * 1000).toLocaleDateString('es-ES');
    const isMe   = u.id === currentUser?.id;
    const roleLabel = u.role === 'admin' ? 'Admin' : 'Usuario';
    const altRole   = u.role === 'admin' ? 'user'  : 'admin';
    const altRoleLabel = u.role === 'admin' ? '→ Usuario' : '→ Admin';
    return `
      <div class="user-row" id="urow-${u.id}">
        <div class="user-row-name">${escHtml(u.username)}</div>
        <span class="user-role-badge ${u.role}">${roleLabel}</span>
        <div class="user-row-date">Alta ${fecha}</div>
        <div class="user-row-btns">
          <button class="user-btn" onclick="changePassword(${u.id}, '${escHtml(u.username)}')">🔑 Clave</button>
          <button class="user-btn" onclick="changeRole(${u.id}, '${altRole}')" ${isMe ? 'disabled' : ''}>${altRoleLabel}</button>
          <button class="user-btn danger" onclick="deleteUser(${u.id}, '${escHtml(u.username)}')" ${isMe ? 'disabled' : ''}>✕ Eliminar</button>
        </div>
      </div>`;
  }).join('');
}

async function createUser() {
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value;
  const role     = document.getElementById('newRole').value;
  const errEl    = document.getElementById('usersError');
  errEl.textContent = '';

  if (!username || !password) { errEl.textContent = 'Rellena usuario y contraseña'; return; }

  const res  = await apiFetch('POST', '/api/admin/users', { username, password, role }, getToken());
  const data = await res.json();
  if (!res.ok) { errEl.textContent = data.error || 'Error al crear usuario'; return; }

  document.getElementById('newUsername').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('newRole').value = 'user';
  loadUsers();
}

async function deleteUser(id, username) {
  if (!confirm(`¿Eliminar al usuario "${username}"?`)) return;
  const res = await apiFetch('DELETE', `/api/admin/users/${id}`, null, getToken());
  if (res.ok) loadUsers();
}

async function changeRole(id, newRole) {
  const res = await apiFetch('PATCH', `/api/admin/users/${id}/role`, { role: newRole }, getToken());
  if (res.ok) loadUsers();
}

async function changePassword(id, username) {
  const pass = prompt(`Nueva contraseña para "${username}":`);
  if (!pass) return;
  const res = await apiFetch('PATCH', `/api/admin/users/${id}/password`, { password: pass }, getToken());
  if (!res.ok) alert('Error al cambiar contraseña');
  else alert('Contraseña actualizada');
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Login inicial ─────────────────────────────────────────────────

function showLogin() {
  document.getElementById('loginScreen').style.display  = '';
  document.getElementById('uploadScreen').style.display = 'none';
  document.getElementById('app').style.display          = 'none';
}
