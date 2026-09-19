const DEFAULT_CONFIG = {
  siteTitle: 'Help Fund Our Honeymoon',
  introText: 'Who would you like to see get cake smashed in their face?',
  rulesText: "At cake cutting, whoever raises the most gets to smash cake in the other person's face. Thank you for helping fund our honeymoon!",
  thankYouText: 'Thank you for celebrating with us!',
  people: {
    joe: { name: 'Joe', venmo:{value:'',link:'',qr:''}, cashapp:{value:'',link:'',qr:''}, zelle:{value:'',link:'',qr:''}, applecash:{value:'',link:'',qr:''} },
    destini: { name: 'Destini', venmo:{value:'',link:'',qr:''}, cashapp:{value:'',link:'',qr:''}, zelle:{value:'',link:'',qr:''}, applecash:{value:'',link:'',qr:''} }
  },
  theme: { background:'#f7f0e6', paper:'#fbf7f0', ink:'#70451f', muted:'#8d7259', accent:'#a8743f', border:'#9a6b3e', leaf:'#817a56' }
};

const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers:{ 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' } });

async function sha256(value) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
}

function cleanString(v, max=10000) { return typeof v === 'string' ? v.slice(0,max) : ''; }
function cleanUrlOrData(v) {
  v = cleanString(v, 4_000_000);
  if (!v) return '';
  if (v.startsWith('data:image/')) return v;
  try { const u = new URL(v); if (['https:','http:','sms:'].includes(u.protocol)) return u.href; } catch (_) {}
  if (/^sms:/i.test(v)) return v;
  return '';
}

function sanitizeConfig(input) {
  const out = structuredClone(DEFAULT_CONFIG);
  if (!input || typeof input !== 'object') return out;
  for (const key of ['siteTitle','introText','rulesText','thankYouText']) out[key] = cleanString(input[key] ?? out[key], key === 'rulesText' ? 2000 : 500);
  for (const person of ['joe','destini']) {
    out.people[person].name = cleanString(input.people?.[person]?.name ?? out.people[person].name, 60);
    for (const provider of ['venmo','cashapp','zelle','applecash']) {
      const p = input.people?.[person]?.[provider] || {};
      out.people[person][provider] = {
        value: cleanString(p.value, 300),
        link: cleanUrlOrData(p.link),
        qr: cleanUrlOrData(p.qr)
      };
    }
  }
  const color = /^#[0-9a-fA-F]{6}$/;
  for (const key of ['background','paper','ink','muted','accent','border','leaf']) {
    const v = input.theme?.[key];
    if (typeof v === 'string' && color.test(v)) out.theme[key] = v;
  }
  return out;
}

async function loadRecord(env) {
  if (!env.WEDDING_CONFIG) return null;
  try { return await env.WEDDING_CONFIG.get('site-config', { type:'json' }); }
  catch (_) { return null; }
}

async function validPassword(record, env, password) {
  if (!password) return false;
  if (record?.adminHash) return (await sha256(password)) === record.adminHash;
  const bootstrap = env.ADMIN_PASSWORD || 'cake2026';
  return password === bootstrap;
}

export async function onRequestGet({ request, env }) {
  const record = await loadRecord(env);
  const config = sanitizeConfig(record?.config || DEFAULT_CONFIG);
  const wantsAdmin = request.headers.has('X-Admin-Password');
  if (wantsAdmin && !(await validPassword(record, env, request.headers.get('X-Admin-Password')))) return json({error:'Wrong admin passcode.'}, 401);
  return json(config);
}

export async function onRequestPost({ request, env }) {
  if (!env.WEDDING_CONFIG) return json({error:'Cloudflare KV binding WEDDING_CONFIG is not configured yet.'}, 503);
  let body;
  try { body = await request.json(); } catch (_) { return json({error:'Invalid request.'},400); }
  const record = await loadRecord(env);
  if (!(await validPassword(record, env, cleanString(body.password, 300)))) return json({error:'Wrong admin passcode.'},401);
  const config = sanitizeConfig(body.config);
  let adminHash = record?.adminHash || await sha256(env.ADMIN_PASSWORD || 'cake2026');
  if (body.newPassword) {
    const next = cleanString(body.newPassword, 300);
    if (next.length < 6) return json({error:'New passcode must be at least 6 characters.'},400);
    adminHash = await sha256(next);
  }
  const recordToSave = { config, adminHash, updatedAt:new Date().toISOString() };
  const serialized = JSON.stringify(recordToSave);
  if (serialized.length > 9_000_000) return json({error:'Settings are too large. Use smaller QR screenshots.'}, 413);
  await env.WEDDING_CONFIG.put('site-config', serialized);
  return json({ok:true, config});
}
