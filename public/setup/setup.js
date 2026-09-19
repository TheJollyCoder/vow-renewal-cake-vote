const providerDefs = [
  ['venmo','Venmo','@username','Payment/profile link (optional)'],
  ['cashapp','Cash App','$Cashtag','Cash App payment link (optional)'],
  ['zelle','Zelle','Phone number or email','Link usually left blank'],
  ['applecash','Apple Cash','Phone number or email','Optional sms: link']
];
let currentPassword = '';
let config = null;

function status(message, type='info') {
  document.getElementById('status').innerHTML = `<div class="notice ${type}">${message}</div>`;
}

function fieldId(person, provider, part) { return `${person}-${provider}-${part}`; }

function buildPersonFields(person) {
  const wrap = document.getElementById(`${person}-fields`);
  wrap.replaceChildren();
  const nameField = document.createElement('div');
  nameField.className = 'field full';
  nameField.innerHTML = `<label>Display name</label><input id="${person}-name" autocomplete="off" />`;
  wrap.append(nameField);

  for (const [provider,label,placeholder,linkPlaceholder] of providerDefs) {
    const value = document.createElement('div');
    value.className = 'field';
    value.innerHTML = `<label>${label}</label><input id="${fieldId(person,provider,'value')}" placeholder="${placeholder}" autocomplete="off" />`;
    wrap.append(value);

    const link = document.createElement('div');
    link.className = 'field';
    link.innerHTML = `<label>${label} link</label><input id="${fieldId(person,provider,'link')}" placeholder="${linkPlaceholder}" inputmode="url" autocomplete="off" />`;
    wrap.append(link);

    const qr = document.createElement('div');
    qr.className = 'field full';
    qr.innerHTML = `<label>${label} QR image (optional)</label><input id="${fieldId(person,provider,'file')}" type="file" accept="image/*" /><input id="${fieldId(person,provider,'qr')}" type="hidden" /><div id="${fieldId(person,provider,'preview')}"></div><p class="form-help">Upload the QR image from ${label}. Stored with the site settings.</p>`;
    wrap.append(qr);
    qr.querySelector('input[type=file]').addEventListener('change', e => imageToDataUrl(e.target.files?.[0], person, provider));
  }
}

function imageToDataUrl(file, person, provider) {
  if (!file) return;
  if (file.size > 750_000) { status('That QR image is too large. Use a screenshot/crop under 750 KB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById(fieldId(person,provider,'qr')).value = reader.result;
    showQrPreview(person, provider, reader.result);
  };
  reader.readAsDataURL(file);
}

function showQrPreview(person, provider, src) {
  const box = document.getElementById(fieldId(person,provider,'preview'));
  box.replaceChildren();
  if (!src) return;
  const img = document.createElement('img');
  img.className = 'file-preview';
  img.src = src;
  img.alt = 'QR preview';
  box.append(img);
}

async function fetchConfig(password='') {
  const r = await fetch('/api/config', { cache:'no-store', headers: password ? { 'X-Admin-Password': password } : {} });
  if (!r.ok) throw new Error((await r.json().catch(()=>({}))).error || `HTTP ${r.status}`);
  return r.json();
}

function populate(c) {
  config = c;
  for (const person of ['joe','destini']) {
    document.getElementById(`${person}-name`).value = c.people[person].name || '';
    for (const [provider] of providerDefs) {
      const p = c.people[person][provider] || {};
      document.getElementById(fieldId(person,provider,'value')).value = p.value || '';
      document.getElementById(fieldId(person,provider,'link')).value = p.link || '';
      document.getElementById(fieldId(person,provider,'qr')).value = p.qr || '';
      showQrPreview(person, provider, p.qr || '');
    }
  }
  for (const k of ['siteTitle','introText','rulesText','thankYouText']) document.getElementById(k).value = c[k] || '';
  for (const k of ['background','ink','accent','border']) document.getElementById(`theme-${k}`).value = c.theme[k];
}

function collect() {
  const out = structuredClone(config);
  for (const person of ['joe','destini']) {
    out.people[person].name = document.getElementById(`${person}-name`).value.trim();
    for (const [provider] of providerDefs) {
      out.people[person][provider] = {
        value: document.getElementById(fieldId(person,provider,'value')).value.trim(),
        link: document.getElementById(fieldId(person,provider,'link')).value.trim(),
        qr: document.getElementById(fieldId(person,provider,'qr')).value
      };
    }
  }
  for (const k of ['siteTitle','introText','rulesText','thankYouText']) out[k] = document.getElementById(k).value.trim();
  for (const k of ['background','ink','accent','border']) out.theme[k] = document.getElementById(`theme-${k}`).value;
  return out;
}

async function unlock() {
  const pass = document.getElementById('admin-password').value;
  if (!pass) return status('Enter the admin passcode.', 'error');
  try {
    const c = await fetchConfig(pass);
    currentPassword = pass;
    populate(c);
    document.getElementById('login-card').classList.add('hidden');
    document.getElementById('settings-form').classList.remove('hidden');
    status('Settings unlocked.', 'success');
  } catch (e) { status(`Could not unlock settings: ${e.message}`, 'error'); }
}

document.addEventListener('DOMContentLoaded', () => {
  buildPersonFields('joe');
  buildPersonFields('destini');
  document.getElementById('unlock-btn').addEventListener('click', unlock);
  document.getElementById('admin-password').addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });

  document.getElementById('settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    if (newPassword && newPassword.length < 6) return status('New passcode must be at least 6 characters.', 'error');
    try {
      const r = await fetch('/api/config', {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({ password:currentPassword, newPassword, config:collect() })
      });
      const body = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
      config = body.config;
      if (newPassword) { currentPassword = newPassword; document.getElementById('new-password').value=''; }
      status('Saved. The public page is updated.', 'success');
    } catch (err) { status(`Save failed: ${err.message}`, 'error'); }
  });
});
