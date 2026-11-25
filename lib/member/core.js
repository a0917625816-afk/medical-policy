// 會員系統（Cloudflare Pages Functions + D1）
// 目前「不上鎖」：網站照常開放，這裡只負責帳號、裝置、付款紀錄、推廣分潤與站長後台。
// 綠界串接前，付款由站長在後台手動登記。

const SETUP_HASH = '17ed6ed25d4c8e66d5b0d997e8c30d5b5abd45b16af33f378dd0270396ce7ac0'; // 站長開通碼（只在還沒有站長時有效）
const SESSION_DAYS = 90;
const MAX_DEVICES = 3;
const PBKDF2_ITER = 100000;
const DEFAULTS = { brand: '燈塔 Pharos', price_month: '399', price_year: '3990', price_team: '3591', lock: '0' };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, login TEXT UNIQUE NOT NULL, name TEXT NOT NULL DEFAULT '', pw TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', status TEXT NOT NULL DEFAULT 'active', plan TEXT, paid_until TEXT, invite_code TEXT, note TEXT NOT NULL DEFAULT '', must_change INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_login TEXT)`,
  `CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, device TEXT NOT NULL DEFAULT '', ip TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, last_seen TEXT NOT NULL, expires_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS invites(code TEXT PRIMARY KEY, kind TEXT NOT NULL, owner TEXT NOT NULL DEFAULT '', share_pct REAL NOT NULL DEFAULT 0, max_uses INTEGER, uses INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, plan TEXT NOT NULL, months INTEGER NOT NULL, period_from TEXT NOT NULL, period_to TEXT NOT NULL, method TEXT NOT NULL DEFAULT 'manual', invite_code TEXT, share_pct REAL NOT NULL DEFAULT 0, share_amount INTEGER NOT NULL DEFAULT 0, refunded INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS payments_user ON payments(user_id)`,
  `CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS attempts(k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, actor INTEGER, action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '', at TEXT NOT NULL)`,
];

// ---------- 小工具 ----------
const enc = new TextEncoder();
const nowIso = () => new Date().toISOString();
const addDaysIso = (d) => new Date(Date.now() + d * 864e5).toISOString();
// 台北日期 YYYY-MM-DD
const twDate = (t = Date.now()) => new Date(t + 8 * 36e5).toISOString().slice(0, 10);
const twMonth = (t = Date.now()) => twDate(t).slice(0, 7);
function addMonths(dateStr, m) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1 + m, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const randToken = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));
function tempPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint8Array(10));
  return [...r].map((x) => abc[x % abc.length]).join('');
}
function newCode(prefix) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(6));
  return prefix + '-' + [...r].map((x) => abc[x % abc.length]).join('');
}
async function hashPw(pw, saltB64) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, key, 256);
  return `pbkdf2$${PBKDF2_ITER}$${b64u(salt)}$${b64u(bits)}`;
}
async function checkPw(pw, stored) {
  const [, , salt, want] = String(stored).split('$');
  if (!salt || !want) return false;
  const got = (await hashPw(pw, salt)).split('$')[3];
  if (got.length !== want.length) return false;
  let x = 0; for (let i = 0; i < got.length; i++) x |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return x === 0;
}
const normLogin = (s) => String(s || '').trim().toLowerCase().replace(/[\s-]/g, '');
const validLogin = (s) => /^09\d{8}$/.test(s) || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
function deviceName(ua = '') {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : '其他裝置';
  const br = /Line\//.test(ua) ? 'LINE' : /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '';
  return br ? `${os}・${br}` : os;
}

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const fail = (status, msg) => { throw new HttpError(status, msg); };

// ---------- 資料庫 ----------
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  schemaReady = true;
}
async function settings(db) {
  const { results } = await db.prepare('SELECT k,v FROM settings').all();
  const s = { ...DEFAULTS };
  for (const r of results) s[r.k] = r.v;
  return s;
}
const audit = (db, actor, action, target = '', detail = '') =>
  db.prepare('INSERT INTO audit(actor,action,target,detail,at) VALUES(?,?,?,?,?)').bind(actor, action, String(target), String(detail).slice(0, 500), nowIso()).run();

// 嘗試次數限制（登入、註冊、開通）
async function throttle(db, key, limit, minutes) {
  const row = await db.prepare('SELECT n,reset_at FROM attempts WHERE k=?').bind(key).first();
  const now = nowIso();
  if (row && row.reset_at > now && row.n >= limit) fail(429, '嘗試太多次，請過 15 分鐘再試');
  if (!row || row.reset_at <= now) await db.prepare('INSERT OR REPLACE INTO attempts(k,n,reset_at) VALUES(?,1,?)').bind(key, addDaysIso(minutes / 1440)).run();
  else await db.prepare('UPDATE attempts SET n=n+1 WHERE k=?').bind(key).run();
}
const clearThrottle = (db, key) => db.prepare('DELETE FROM attempts WHERE k=?').bind(key).run();

// ---------- 登入狀態 ----------
function cookieHeader(token, req) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return token
    ? `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`
    : `sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
const readCookie = (req) => (req.headers.get('cookie') || '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === 'sid')?.[1] || '';

async function currentUser(db, req) {
  const token = readCookie(req);
  if (!token) return null;
  const sid = await sha256(token);
  const row = await db.prepare('SELECT s.id sid, s.last_seen, s.expires_at, u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=?').bind(sid).first();
  if (!row || row.expires_at < nowIso()) return null;
  if (row.status !== 'active') return null;
  // 每天最多更新一次「最後使用」，並把 90 天往後延
  if (Date.parse(row.last_seen) < Date.now() - 864e5)
    await db.prepare('UPDATE sessions SET last_seen=?, expires_at=? WHERE id=?').bind(nowIso(), addDaysIso(SESSION_DAYS), sid).run();
  return row;
}

async function createSession(db, user, req) {
  const now = nowIso();
  await db.prepare('DELETE FROM sessions WHERE user_id=? AND expires_at<?').bind(user.id, now).run();
  const { results } = await db.prepare('SELECT id FROM sessions WHERE user_id=? ORDER BY last_seen ASC, created_at ASC, rowid ASC').bind(user.id).all();
  let kicked = 0;
  // 超過裝置上限：登出最久沒用的那台（站長不限）
  if (user.role !== 'admin') {
    for (let i = 0; i <= results.length - MAX_DEVICES; i++) {
      await db.prepare('DELETE FROM sessions WHERE id=?').bind(results[i].id).run();
      kicked++;
    }
  }
  const token = randToken();
  await db.prepare('INSERT INTO sessions(id,user_id,device,ip,created_at,last_seen,expires_at) VALUES(?,?,?,?,?,?,?)')
    .bind(await sha256(token), user.id, deviceName(req.headers.get('user-agent') || ''), req.headers.get('cf-connecting-ip') || '', now, now, addDaysIso(SESSION_DAYS)).run();
  await db.prepare('UPDATE users SET last_login=? WHERE id=?').bind(now, user.id).run();
  return { token, kicked };
}

// 會員狀態（給前端顯示）
function memberState(u, today = twDate()) {
  if (u.status !== 'active') return 'disabled';
  if (u.role === 'admin') return 'admin';
  if (u.role === 'partner') return 'partner';
  if (u.paid_until && u.paid_until >= today) return 'paid';
  if (u.paid_until) return 'expired';
  return 'unpaid';
}
const publicUser = (u) => ({
  id: u.id, login: u.login, name: u.name, role: u.role, status: u.status, plan: u.plan,
  paid_until: u.paid_until, invite_code: u.invite_code, note: u.note, created_at: u.created_at,
  last_login: u.last_login, must_change: !!u.must_change, state: memberState(u),
});

// ---------- 路由 ----------
async function body(req) {
  try { return await req.json(); } catch { return {}; }
}

export async function handle(req, env) {
  const db = env.DB;
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  if (!db) return json({ error: '會員資料庫尚未設定' }, 503);
  try {
    // 只接受本站送出的修改請求
    if (req.method !== 'GET') {
      const origin = req.headers.get('origin');
      if (origin && new URL(origin).host !== url.host) fail(403, '來源不符');
    }
    await ensureSchema(db);
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    const s = await settings(db);

    // ----- 公開 -----
    if (path === '/api/config' && req.method === 'GET') {
      const admin = await db.prepare("SELECT 1 FROM users WHERE role='admin' LIMIT 1").first();
      return json({ brand: s.brand, prices: { month: +s.price_month, year: +s.price_year, team: +s.price_team }, lock: s.lock === '1', needs_setup: !admin, max_devices: MAX_DEVICES, session_days: SESSION_DAYS });
    }

    if (path === '/api/setup' && req.method === 'POST') {
      await throttle(db, 'setup:' + ip, 5, 15);
      const b = await body(req);
      const admin = await db.prepare("SELECT 1 FROM users WHERE role='admin' LIMIT 1").first();
      if (admin) fail(400, '站長帳號已經建立過了');
      if ((await sha256(String(b.code || '').trim().toUpperCase())) !== SETUP_HASH) fail(403, '開通碼不正確');
      const login = normLogin(b.login);
      if (!validLogin(login)) fail(400, '帳號請用手機號碼（09 開頭 10 碼）或 Email');
      if (String(b.password || '').length < 8) fail(400, '密碼至少 8 個字');
      await db.prepare('INSERT INTO users(login,name,pw,role,created_at) VALUES(?,?,?,?,?)').bind(login, String(b.name || '站長').slice(0, 30), await hashPw(b.password), 'admin', nowIso()).run();
      const u = await db.prepare('SELECT * FROM users WHERE login=?').bind(login).first();
      await audit(db, u.id, 'setup', u.id);
      const { token } = await createSession(db, u, req);
      return json({ ok: true, user: publicUser(u) }, 200, { 'set-cookie': cookieHeader(token, req) });
    }

    if (path === '/api/signup' && req.method === 'POST') {
      await throttle(db, 'signup:' + ip, 10, 60);
      const b = await body(req);
      const login = normLogin(b.login);
      if (!validLogin(login)) fail(400, '帳號請用手機號碼（09 開頭 10 碼）或 Email');
      if (String(b.password || '').length < 8) fail(400, '密碼至少 8 個字');
      const name = String(b.name || '').trim().slice(0, 30);
      if (!name) fail(400, '請填姓名');
      let role = 'member', code = null;
      if (b.code) {
        code = String(b.code).trim().toUpperCase();
        const inv = await db.prepare('SELECT * FROM invites WHERE code=?').bind(code).first();
        if (!inv || !inv.active || (inv.max_uses && inv.uses >= inv.max_uses)) fail(400, '邀請碼無效或已用完');
        if (inv.kind === 'partner') role = 'partner';
      }
      if (await db.prepare('SELECT 1 FROM users WHERE login=?').bind(login).first()) fail(400, '這個帳號已經註冊過了，請直接登入');
      await db.prepare('INSERT INTO users(login,name,pw,role,invite_code,created_at) VALUES(?,?,?,?,?,?)').bind(login, name, await hashPw(b.password), role, code, nowIso()).run();
      if (code) await db.prepare('UPDATE invites SET uses=uses+1 WHERE code=?').bind(code).run();
      const u = await db.prepare('SELECT * FROM users WHERE login=?').bind(login).first();
      await audit(db, u.id, 'signup', u.id, code || '');
      const { token } = await createSession(db, u, req);
      return json({ ok: true, user: publicUser(u) }, 200, { 'set-cookie': cookieHeader(token, req) });
    }

    if (path === '/api/login' && req.method === 'POST') {
      const b = await body(req);
      const login = normLogin(b.login);
      await throttle(db, 'login:' + ip, 20, 15);
      await throttle(db, 'acct:' + login, 8, 15);
      const u = await db.prepare('SELECT * FROM users WHERE login=?').bind(login).first();
      if (!u || !(await checkPw(String(b.password || ''), u.pw))) fail(401, '帳號或密碼不正確');
      if (u.status !== 'active') fail(403, '這個帳號已停用，請聯絡站長');
      await clearThrottle(db, 'acct:' + login);
      const { token, kicked } = await createSession(db, u, req);
      return json({ ok: true, kicked, user: publicUser(u) }, 200, { 'set-cookie': cookieHeader(token, req) });
    }

    if (path === '/api/logout' && req.method === 'POST') {
      const token = readCookie(req);
      if (token) await db.prepare('DELETE FROM sessions WHERE id=?').bind(await sha256(token)).run();
      return json({ ok: true }, 200, { 'set-cookie': cookieHeader('', req) });
    }

    // ----- 需要登入 -----
    const me = await currentUser(db, req);
    if (!me) fail(401, '請先登入');

    if (path === '/api/me' && req.method === 'GET') {
      const { results } = await db.prepare('SELECT id,device,created_at,last_seen FROM sessions WHERE user_id=? AND expires_at>? ORDER BY last_seen DESC').bind(me.id, nowIso()).all();
      const devices = results.map((d) => ({ id: d.id.slice(0, 12), device: d.device, created_at: d.created_at, last_seen: d.last_seen, current: d.id === me.sid }));
      const { results: pays } = await db.prepare('SELECT amount,plan,months,period_from,period_to,refunded,created_at FROM payments WHERE user_id=? ORDER BY id DESC LIMIT 24').bind(me.id).all();
      return json({ user: publicUser(me), devices, payments: pays, brand: s.brand, prices: { month: +s.price_month, year: +s.price_year, team: +s.price_team }, max_devices: MAX_DEVICES });
    }
    if (path === '/api/me/password' && req.method === 'POST') {
      const b = await body(req);
      if (!(await checkPw(String(b.old || ''), me.pw))) fail(400, '舊密碼不正確');
      if (String(b.password || '').length < 8) fail(400, '新密碼至少 8 個字');
      await db.prepare('UPDATE users SET pw=?, must_change=0 WHERE id=?').bind(await hashPw(b.password), me.id).run();
      await db.prepare('DELETE FROM sessions WHERE user_id=? AND id<>?').bind(me.id, me.sid).run();
      return json({ ok: true });
    }
    if (path === '/api/me/devices/revoke' && req.method === 'POST') {
      const b = await body(req);
      const prefix = String(b.id || '');
      if (prefix.length !== 12) fail(400, '裝置不存在');
      await db.prepare('DELETE FROM sessions WHERE user_id=? AND substr(id,1,12)=? AND id<>?').bind(me.id, prefix, me.sid).run();
      return json({ ok: true });
    }

    // ----- 站長 -----
    if (path.startsWith('/api/admin/')) {
      if (me.role !== 'admin') fail(403, '只有站長可以使用');
      return await adminRoute(db, req, path, me, s);
    }
    fail(404, '找不到');
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: '系統忙碌，請稍後再試' }, 500);
  }
}

async function adminRoute(db, req, path, me, s) {
  const url = new URL(req.url);
  const today = twDate();
  const month = twMonth();
  const G = req.method === 'GET', P = req.method === 'POST';

  if (path === '/api/admin/overview' && G) {
    const one = (sql, ...a) => db.prepare(sql).bind(...a).first();
    const paid = await one("SELECT COUNT(*) n FROM users WHERE role='member' AND status='active' AND paid_until>=?", today);
    const partners = await one("SELECT COUNT(*) n FROM users WHERE role='partner' AND status='active'");
    const unpaid = await one("SELECT COUNT(*) n FROM users WHERE role='member' AND status='active' AND (paid_until IS NULL OR paid_until<?)", today);
    const disabled = await one("SELECT COUNT(*) n FROM users WHERE status<>'active'");
    const newThis = await one('SELECT COUNT(*) n FROM users WHERE substr(created_at,1,7)=?', month);
    const rev = await one('SELECT COALESCE(SUM(amount),0) a, COALESCE(SUM(share_amount),0) sh FROM payments WHERE refunded=0 AND substr(created_at,1,7)=?', month);
    const d30 = twDate(Date.now() - 30 * 864e5);
    const churn = await one("SELECT COUNT(*) n FROM users WHERE role='member' AND paid_until<? AND paid_until>=?", today, d30);
    const d7 = twDate(Date.now() + 7 * 864e5);
    const { results: expiring } = await db.prepare("SELECT id,name,login,paid_until FROM users WHERE role='member' AND status='active' AND paid_until>=? AND paid_until<=? ORDER BY paid_until").bind(today, d7).all();
    const { results: trend } = await db.prepare('SELECT substr(created_at,1,7) m, SUM(CASE WHEN refunded=0 THEN amount ELSE 0 END) a, COUNT(*) n FROM payments GROUP BY m ORDER BY m DESC LIMIT 12').all();
    const { results: recent } = await db.prepare('SELECT u.id,u.name,u.login,u.role,u.created_at,u.invite_code FROM users u ORDER BY u.id DESC LIMIT 8').all();
    return json({ today, month, paid: paid.n, partners: partners.n, unpaid: unpaid.n, disabled: disabled.n, new_this_month: newThis.n, revenue: rev.a, share_owed: rev.sh, churn_30d: churn.n, expiring, trend: trend.reverse(), recent, brand: s.brand });
  }

  if (path === '/api/admin/users' && G) {
    const q = `%${(url.searchParams.get('q') || '').trim()}%`;
    const role = url.searchParams.get('role') || '';
    const { results } = await db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM sessions s WHERE s.user_id=u.id AND s.expires_at>?) devices FROM users u WHERE (u.login LIKE ? OR u.name LIKE ? OR IFNULL(u.invite_code,'') LIKE ?) ${role ? 'AND u.role=?' : ''} ORDER BY u.id DESC LIMIT 500`)
      .bind(...[nowIso(), q, q, q, ...(role ? [role] : [])]).all();
    return json({ users: results.map((u) => ({ ...publicUser(u), devices: u.devices })) });
  }

  if (path === '/api/admin/users' && P) {
    const b = await body(req);
    const login = normLogin(b.login);
    if (!validLogin(login)) fail(400, '帳號請用手機號碼（09 開頭 10 碼）或 Email');
    if (await db.prepare('SELECT 1 FROM users WHERE login=?').bind(login).first()) fail(400, '這個帳號已存在');
    const role = ['member', 'partner'].includes(b.role) ? b.role : 'partner';
    const pw = tempPassword();
    await db.prepare('INSERT INTO users(login,name,pw,role,note,must_change,created_at) VALUES(?,?,?,?,?,1,?)').bind(login, String(b.name || '').slice(0, 30), await hashPw(pw), role, String(b.note || '').slice(0, 200), nowIso()).run();
    const u = await db.prepare('SELECT * FROM users WHERE login=?').bind(login).first();
    await audit(db, me.id, 'create_user', u.id, role);
    return json({ ok: true, user: publicUser(u), temp_password: pw });
  }

  let m = path.match(/^\/api\/admin\/users\/(\d+)$/);
  if (m && P) {
    const id = +m[1];
    const u = await db.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
    if (!u) fail(404, '找不到這位會員');
    const b = await body(req);
    if (u.role === 'admin' && b.action !== 'note') fail(400, '站長帳號不能在這裡修改');
    let extra = {};
    switch (b.action) {
      case 'disable':
        await db.prepare("UPDATE users SET status='disabled' WHERE id=?").bind(id).run();
        await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();
        break;
      case 'enable': await db.prepare("UPDATE users SET status='active' WHERE id=?").bind(id).run(); break;
      case 'role':
        if (!['member', 'partner'].includes(b.role)) fail(400, '身分不正確');
        await db.prepare('UPDATE users SET role=? WHERE id=?').bind(b.role, id).run(); break;
      case 'note': await db.prepare('UPDATE users SET note=? WHERE id=?').bind(String(b.note || '').slice(0, 200), id).run(); break;
      case 'logout_all': await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run(); break;
      case 'reset_password': {
        const pw = tempPassword();
        await db.prepare('UPDATE users SET pw=?, must_change=1 WHERE id=?').bind(await hashPw(pw), id).run();
        await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();
        extra = { temp_password: pw };
        break;
      }
      case 'paid_until':
        if (b.paid_until && !/^\d{4}-\d{2}-\d{2}$/.test(b.paid_until)) fail(400, '日期格式不正確');
        await db.prepare('UPDATE users SET paid_until=? WHERE id=?').bind(b.paid_until || null, id).run(); break;
      default: fail(400, '不明的操作');
    }
    await audit(db, me.id, 'user_' + b.action, id, b.role || b.paid_until || '');
    const nu = await db.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
    return json({ ok: true, user: publicUser(nu), ...extra });
  }

  m = path.match(/^\/api\/admin\/users\/(\d+)\/detail$/);
  if (m && G) {
    const id = +m[1];
    const u = await db.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
    if (!u) fail(404, '找不到這位會員');
    const { results: devices } = await db.prepare('SELECT device,created_at,last_seen FROM sessions WHERE user_id=? AND expires_at>? ORDER BY last_seen DESC').bind(id, nowIso()).all();
    const { results: payments } = await db.prepare('SELECT * FROM payments WHERE user_id=? ORDER BY id DESC').bind(id).all();
    return json({ user: publicUser(u), devices, payments });
  }

  // 手動登記付款（綠界串接後改由系統自動登記）
  if (path === '/api/admin/payments' && P) {
    const b = await body(req);
    const u = await db.prepare('SELECT * FROM users WHERE id=?').bind(+b.user_id).first();
    if (!u || u.role === 'admin') fail(404, '找不到這位會員');
    const plan = ['month', 'year', 'team'].includes(b.plan) ? b.plan : 'month';
    const months = Math.max(1, Math.min(36, parseInt(b.months, 10) || (plan === 'year' ? 12 : 1)));
    const amount = Math.max(0, parseInt(b.amount, 10) || 0);
    const from = u.paid_until && u.paid_until >= today ? addMonths(u.paid_until, 0) : today;
    const to = addMonths(from, months);
    let pct = 0;
    if (u.invite_code) {
      const inv = await db.prepare("SELECT * FROM invites WHERE code=? AND kind='promo'").bind(u.invite_code).first();
      if (inv) pct = inv.share_pct;
    }
    const share = Math.round((amount * pct) / 100);
    await db.prepare('INSERT INTO payments(user_id,amount,plan,months,period_from,period_to,method,invite_code,share_pct,share_amount,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(u.id, amount, plan, months, from, to, 'manual', pct ? u.invite_code : null, pct, share, String(b.note || '').slice(0, 200), nowIso()).run();
    await db.prepare("UPDATE users SET paid_until=?, plan=?, status='active' WHERE id=?").bind(to, plan, u.id).run();
    await audit(db, me.id, 'payment', u.id, `${amount}/${months}m`);
    return json({ ok: true, paid_until: to, share_amount: share });
  }

  m = path.match(/^\/api\/admin\/payments\/(\d+)\/refund$/);
  if (m && P) {
    const p = await db.prepare('SELECT * FROM payments WHERE id=?').bind(+m[1]).first();
    if (!p || p.refunded) fail(400, '這筆付款不存在或已退款');
    await db.prepare('UPDATE payments SET refunded=1 WHERE id=?').bind(p.id).run();
    // 退款後：會員到期日退回這筆付款之前
    const last = await db.prepare('SELECT MAX(period_to) t FROM payments WHERE user_id=? AND refunded=0').bind(p.user_id).first();
    await db.prepare('UPDATE users SET paid_until=? WHERE id=?').bind(last.t || null, p.user_id).run();
    await audit(db, me.id, 'refund', p.user_id, p.id);
    return json({ ok: true, paid_until: last.t || null });
  }

  if (path === '/api/admin/invites' && G) {
    const { results } = await db.prepare(`SELECT i.*,
      (SELECT COUNT(*) FROM users u WHERE u.invite_code=i.code) members,
      (SELECT COUNT(*) FROM users u WHERE u.invite_code=i.code AND u.role='member' AND u.paid_until>=?) paying,
      (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.invite_code=i.code AND p.refunded=0 AND substr(p.created_at,1,7)=?) month_rev,
      (SELECT COALESCE(SUM(share_amount),0) FROM payments p WHERE p.invite_code=i.code AND p.refunded=0 AND substr(p.created_at,1,7)=?) month_share,
      (SELECT COALESCE(SUM(share_amount),0) FROM payments p WHERE p.invite_code=i.code AND p.refunded=0) total_share
      FROM invites i ORDER BY i.created_at DESC`).bind(today, month, month).all();
    return json({ invites: results, month });
  }
  if (path === '/api/admin/invites' && P) {
    const b = await body(req);
    const kind = b.kind === 'promo' ? 'promo' : 'partner';
    const pct = kind === 'promo' ? Math.max(0, Math.min(90, Number(b.share_pct) || 0)) : 0;
    let code = String(b.code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!code) code = newCode(kind === 'promo' ? 'PR' : 'PT');
    if (code.length < 4) fail(400, '邀請碼至少 4 個字');
    if (await db.prepare('SELECT 1 FROM invites WHERE code=?').bind(code).first()) fail(400, '這個邀請碼已經有了');
    const max = b.max_uses ? Math.max(1, parseInt(b.max_uses, 10)) : null;
    await db.prepare('INSERT INTO invites(code,kind,owner,share_pct,max_uses,note,created_at) VALUES(?,?,?,?,?,?,?)').bind(code, kind, String(b.owner || '').slice(0, 40), pct, max, String(b.note || '').slice(0, 200), nowIso()).run();
    await audit(db, me.id, 'invite_create', code, `${kind}/${pct}`);
    return json({ ok: true, code });
  }
  m = path.match(/^\/api\/admin\/invites\/([A-Z0-9-]+)$/);
  if (m && P) {
    const b = await body(req);
    const inv = await db.prepare('SELECT * FROM invites WHERE code=?').bind(m[1]).first();
    if (!inv) fail(404, '找不到邀請碼');
    if (b.action === 'toggle') await db.prepare('UPDATE invites SET active=1-active WHERE code=?').bind(inv.code).run();
    else if (b.action === 'share' && inv.kind === 'promo') await db.prepare('UPDATE invites SET share_pct=? WHERE code=?').bind(Math.max(0, Math.min(90, Number(b.share_pct) || 0)), inv.code).run();
    else fail(400, '不明的操作');
    await audit(db, me.id, 'invite_' + b.action, inv.code, b.share_pct ?? '');
    return json({ ok: true });
  }

  if (path === '/api/admin/report' && G) {
    const mon = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '') ? url.searchParams.get('month') : month;
    const { results: pays } = await db.prepare('SELECT p.*, u.name, u.login FROM payments p JOIN users u ON u.id=p.user_id WHERE substr(p.created_at,1,7)=? ORDER BY p.id').bind(mon).all();
    const { results: promo } = await db.prepare("SELECT p.invite_code code, i.owner, SUM(p.amount) revenue, SUM(p.share_amount) share, COUNT(*) n FROM payments p LEFT JOIN invites i ON i.code=p.invite_code WHERE p.refunded=0 AND p.invite_code IS NOT NULL AND substr(p.created_at,1,7)=? GROUP BY p.invite_code").bind(mon).all();
    const live = pays.filter((p) => !p.refunded);
    const total = live.reduce((a, p) => a + p.amount, 0);
    const shares = live.reduce((a, p) => a + p.share_amount, 0);
    const refunds = pays.filter((p) => p.refunded).reduce((a, p) => a + p.amount, 0);
    if (url.searchParams.get('format') === 'csv') {
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = [['日期', '姓名', '帳號', '方案', '月數', '金額', '期間起', '期間迄', '邀請碼', '分潤%', '分潤金額', '已退款', '備註']]
        .concat(pays.map((p) => [p.created_at.slice(0, 10), p.name, p.login, p.plan, p.months, p.amount, p.period_from, p.period_to, p.invite_code || '', p.share_pct, p.share_amount, p.refunded ? '是' : '', p.note]));
      return new Response('﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="report-${mon}.csv"`, 'cache-control': 'no-store' } });
    }
    return json({ month: mon, total, shares, net: total - shares, refunds, count: live.length, payments: pays, promo });
  }

  if (path === '/api/admin/settings' && G) return json({ settings: s });
  if (path === '/api/admin/settings' && P) {
    const b = await body(req);
    const allowed = { brand: (v) => String(v).trim().slice(0, 30), price_month: (v) => String(Math.max(0, parseInt(v, 10) || 0)), price_year: (v) => String(Math.max(0, parseInt(v, 10) || 0)), price_team: (v) => String(Math.max(0, parseInt(v, 10) || 0)) };
    for (const [k, f] of Object.entries(allowed)) {
      if (b[k] !== undefined && b[k] !== '') await db.prepare('INSERT OR REPLACE INTO settings(k,v) VALUES(?,?)').bind(k, f(b[k])).run();
    }
    await audit(db, me.id, 'settings', '', JSON.stringify(b).slice(0, 300));
    return json({ ok: true, settings: await settings(db) });
  }

  if (path === '/api/admin/audit' && G) {
    const { results } = await db.prepare('SELECT a.*, u.name actor_name FROM audit a LEFT JOIN users u ON u.id=a.actor ORDER BY a.id DESC LIMIT 200').all();
    return json({ audit: results });
  }

  fail(404, '找不到');
}
