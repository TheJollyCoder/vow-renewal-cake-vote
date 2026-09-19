const input = document.getElementById('site-url');
const img = document.getElementById('qr-image');

function cleanPublicUrl(value) {
  try {
    const u = new URL(value);
    u.pathname = '/'; u.search = ''; u.hash = '';
    return u.toString();
  } catch (_) { return window.location.origin + '/'; }
}

function updateQr() {
  const url = cleanPublicUrl(input.value);
  input.value = url;
  // QR image is fetched only while preparing/printing the card; the printed QR then works independently.
  img.onerror = () => { img.onerror = null; img.src = `https://api.qrserver.com/v1/create-qr-code/?size=700x700&margin=8&data=${encodeURIComponent(url)}`; };
  img.src = `https://quickchart.io/qr?size=700&margin=1&text=${encodeURIComponent(url)}`;
}

async function applyTheme() {
  try {
    const r = await fetch('/api/config', {cache:'no-store'});
    if (!r.ok) return;
    const c = await r.json();
    const root = document.documentElement.style;
    for (const [k,v] of Object.entries({bg:c.theme?.background,paper:c.theme?.paper,ink:c.theme?.ink,muted:c.theme?.muted,accent:c.theme?.accent,border:c.theme?.border,leaf:c.theme?.leaf})) if (v) root.setProperty(`--${k}`, v);
  } catch (_) {}
}

document.addEventListener('DOMContentLoaded', async () => {
  await applyTheme();
  input.value = window.location.origin + '/';
  updateQr();
  document.getElementById('update-qr').addEventListener('click', updateQr);
  document.getElementById('print-btn').addEventListener('click', () => window.print());
});
