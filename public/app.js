const DEFAULT_CONFIG = {
  siteTitle: 'Help Fund Our Honeymoon',
  introText: 'Who would you like to see get cake smashed in their face?',
  rulesText: "At cake cutting, whoever raises the most gets to smash cake in the other person's face. Thank you for helping fund our honeymoon!",
  thankYouText: 'Thank you for celebrating with us!',
  people: {
    joe: { name: 'Joe', venmo: { value:'', link:'', qr:'' }, cashapp:{ value:'', link:'', qr:'' }, zelle:{ value:'', link:'', qr:'' }, applecash:{ value:'', link:'', qr:'' } },
    destini: { name: 'Destini', venmo: { value:'', link:'', qr:'' }, cashapp:{ value:'', link:'', qr:'' }, zelle:{ value:'', link:'', qr:'' }, applecash:{ value:'', link:'', qr:'' } }
  },
  theme: { background:'#f7f0e6', paper:'#fbf7f0', ink:'#70451f', muted:'#8d7259', accent:'#a8743f', border:'#9a6b3e', leaf:'#817a56' }
};

let config = structuredClone(DEFAULT_CONFIG);
let selectedTarget = null;
let payingPersonKey = null;

const providers = [
  ['venmo','Venmo'],
  ['cashapp','Cash App'],
  ['zelle','Zelle'],
  ['applecash','Apple Cash']
];

function mergeConfig(base, incoming) {
  if (!incoming || typeof incoming !== 'object') return base;
  const out = structuredClone(base);
  for (const key of ['siteTitle','introText','rulesText','thankYouText']) if (typeof incoming[key] === 'string') out[key] = incoming[key];
  if (incoming.theme) Object.assign(out.theme, incoming.theme);
  for (const person of ['joe','destini']) {
    if (!incoming.people?.[person]) continue;
    if (typeof incoming.people[person].name === 'string') out.people[person].name = incoming.people[person].name;
    for (const [provider] of providers) {
      const p = incoming.people[person][provider];
      if (p && typeof p === 'object') Object.assign(out.people[person][provider], p);
    }
  }
  return out;
}

function applyTheme() {
  const t = config.theme;
  const root = document.documentElement.style;
  root.setProperty('--bg', t.background);
  root.setProperty('--paper', t.paper);
  root.setProperty('--ink', t.ink);
  root.setProperty('--muted', t.muted);
  root.setProperty('--accent', t.accent);
  root.setProperty('--border', t.border);
  root.setProperty('--leaf', t.leaf);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.background);
}

async function loadConfig() {
  try {
    const r = await fetch('/api/config', { cache:'no-store' });
    if (r.ok) config = mergeConfig(DEFAULT_CONFIG, await r.json());
  } catch (_) {}
  applyTheme();
  document.title = config.siteTitle;
  document.getElementById('intro-text').textContent = config.introText;
  document.getElementById('rules-text').textContent = config.rulesText;
  const buttons = document.querySelectorAll('.choice-btn');
  buttons[0].textContent = config.people.joe.name;
  buttons[1].textContent = config.people.destini.name;
}

function safeUrl(raw) {
  if (!raw) return '';
  try {
    const u = new URL(raw);
    if (['https:','http:','sms:'].includes(u.protocol)) return u.href;
  } catch (_) {}
  if (/^sms:/i.test(raw)) return raw;
  return '';
}

function chooseTarget(targetKey) {
  selectedTarget = targetKey;
  payingPersonKey = targetKey === 'joe' ? 'destini' : 'joe';
  const target = config.people[targetKey];
  const payer = config.people[payingPersonKey];
  document.getElementById('choose-screen').classList.add('hidden');
  document.getElementById('pay-screen').classList.remove('hidden');
  document.getElementById('selection-title').textContent = `You chose ${target.name}.`;
  document.getElementById('selection-copy').textContent = `To help put cake in ${target.name}'s face, send any amount to ${payer.name} using one of the options below.`;
  renderProviders();
  document.getElementById('payment-panel').classList.add('hidden');
  window.scrollTo({ top:0, behavior:'smooth' });
}

function renderProviders() {
  const grid = document.getElementById('provider-grid');
  grid.replaceChildren();
  providers.forEach(([key,label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'provider-btn';
    btn.textContent = label;
    btn.dataset.provider = key;
    btn.setAttribute('aria-pressed','false');
    btn.addEventListener('click', () => showProvider(key, label));
    grid.append(btn);
  });
}

function showProvider(key, label) {
  document.querySelectorAll('.provider-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.provider === key)));
  const payer = config.people[payingPersonKey];
  const details = payer[key] || {};
  const panel = document.getElementById('payment-panel');
  panel.replaceChildren();
  panel.classList.remove('hidden');

  const h = document.createElement('h3');
  h.textContent = `${payer.name} — ${label}`;
  panel.append(h);

  const lbl = document.createElement('div');
  lbl.className = 'payment-label';
  lbl.textContent = label === 'Zelle' || label === 'Apple Cash' ? 'Send to' : 'Account';
  panel.append(lbl);

  const value = document.createElement('div');
  value.className = 'payment-value';
  value.textContent = details.value || 'Payment information has not been added yet.';
  panel.append(value);

  const actions = document.createElement('div');
  actions.className = 'payment-actions';
  const link = safeUrl(details.link);
  if (link) {
    const a = document.createElement('a');
    a.className = 'primary-btn';
    a.href = link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = label === 'Apple Cash' ? 'Open Messages' : `Open ${label}`;
    actions.append(a);
  }
  if (details.value) {
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'copy-btn';
    copy.textContent = 'Copy';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(details.value); copy.textContent = 'Copied'; setTimeout(()=>copy.textContent='Copy',1400); }
      catch (_) { copy.textContent = 'Press & hold to copy'; }
    });
    actions.append(copy);
  }
  panel.append(actions);

  if (details.qr) {
    const wrap = document.createElement('div');
    wrap.className = 'qr-wrap';
    const note = document.createElement('div');
    note.className = 'small-note';
    note.textContent = `Or use ${label}'s QR code:`;
    const img = document.createElement('img');
    img.src = details.qr;
    img.alt = `${payer.name} ${label} QR code`;
    wrap.append(note, img);
    panel.append(wrap);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  document.querySelectorAll('.choice-btn').forEach(btn => btn.addEventListener('click', () => chooseTarget(btn.dataset.target)));
  document.getElementById('change-choice').addEventListener('click', () => {
    selectedTarget = payingPersonKey = null;
    document.getElementById('pay-screen').classList.add('hidden');
    document.getElementById('choose-screen').classList.remove('hidden');
  });
});
