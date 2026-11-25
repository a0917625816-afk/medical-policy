// 會員中心與站長後台共用小工具
window.M = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  async function api(path, data) {
    const r = await fetch(path, data === undefined ? { credentials: 'same-origin' } : { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) { const e = new Error(j.error || '發生錯誤，請再試一次'); e.status = r.status; throw e; }
    return j;
  }
  let tt;
  function toast(msg) {
    const t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => (t.hidden = true), 3200);
  }
  const alert = (e) => toast(e.message || String(e));
  function form(sel, fn) {
    const f = document.querySelector(sel); if (!f) return;
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = f.querySelector('[data-err]'); if (err) err.textContent = '';
      const btn = f.querySelector('button'); if (btn) btn.disabled = true;
      try { await fn(Object.fromEntries(new FormData(f)), f); }
      catch (x) { if (err) err.textContent = x.message; else alert(x); }
      finally { if (btn) btn.disabled = false; }
    });
  }
  function when(iso) {
    if (!iso) return '—';
    const d = (Date.now() - Date.parse(iso)) / 1000;
    if (d < 120) return '剛剛';
    if (d < 3600) return Math.round(d / 60) + ' 分鐘前';
    if (d < 86400) return Math.round(d / 3600) + ' 小時前';
    if (d < 86400 * 30) return Math.round(d / 86400) + ' 天前';
    return new Date(iso).toLocaleDateString('zh-TW');
  }
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString('zh-TW') : '—');
  const planName = (p) => ({ month: '月繳', year: '年繳', team: '處經理團購' }[p] || '—');
  const money = (n) => 'NT$' + Number(n || 0).toLocaleString();
  function brand(name) {
    document.querySelectorAll('#brand').forEach((b) => (b.textContent = name));
    document.title = document.title.split('｜')[0] + '｜' + name;
  }
  return { esc, api, toast, alert, form, when, day, planName, money, brand };
})();
