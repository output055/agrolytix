// =============================================================================
// Agrolytix · agx-chat Edge Function (Supabase / Deno)
// -----------------------------------------------------------------------------
// Routes (POST):
//   /agx-chat/token         → validate Laravel token, mint short-lived Supabase JWT
//   /agx-chat/sign-upload   → Cloudinary signed-upload parameters
//   /agx-chat/declare-cash  → automatic daily cash reconciliation
//
// The Laravel (Sanctum) token is sent in the `x-agx-token` header.
// Deploy with JWT verification DISABLED (this function does its own auth):
//   supabase functions deploy agx-chat --no-verify-jwt
//
// Required secrets (Dashboard → Edge Functions → Secrets):
//   AGX_JWT_SECRET          Supabase "Legacy JWT secret" (Settings → JWT Keys)
//   CLOUDINARY_CLOUD_NAME   Cloudinary dashboard
//   CLOUDINARY_API_KEY      Cloudinary → Settings → API Keys
//   CLOUDINARY_API_SECRET   Cloudinary → Settings → API Keys
// Optional:
//   AGX_API_URL       default https://agrolytixapi.asatek.online/api
//   RECON_TOLERANCE   default 1   (GH₵)
//   BUSINESS_TZ       default Africa/Accra
//   ALLOWED_ORIGINS   default *   (comma separated, e.g. https://agrolytix.asatek.online,http://localhost:4200)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// =============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { SignJWT } from 'npm:jose@5';

const AGX_API_URL     = (Deno.env.get('AGX_API_URL') ?? 'https://agrolytixapi.asatek.online/api').replace(/\/+$/, '');
const AGX_JWT_SECRET  = Deno.env.get('AGX_JWT_SECRET') ?? 'v7Pa7a+dwhayMXLuE3Ym5QX1COR0sG9Fncv67xoFduFoqepBIYP86wzsrAeYqJ6943jVoxP2kLAV1MJ0zis1yA==';
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL') ?? 'https://xfapeknaqakooacakjqy.supabase.co';
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmYXBla25hcWFrb29hY2FranF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjczODQ1NywiZXhwIjoyMTA4MzE0NDU3fQ.LVsCYolHCH-qGSQrrX_IB1odVO1AYKlRihZ0651ElW8';
const CLD_NAME        = Deno.env.get('CLOUDINARY_CLOUD_NAME') ?? 'dp1bt3b0p';
const CLD_KEY         = Deno.env.get('CLOUDINARY_API_KEY') ?? '526674843521758';
const CLD_SECRET      = Deno.env.get('CLOUDINARY_API_SECRET') ?? '8gR1USPplTNSIZvoryjy8t4xPGE';
const TOLERANCE       = Number(Deno.env.get('RECON_TOLERANCE') ?? '1');
const BUSINESS_TZ     = Deno.env.get('BUSINESS_TZ') ?? 'Africa/Accra';
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map(s => s.trim()).filter(Boolean);
const TOKEN_TTL_SEC   = 60 * 60;
const AUDITOR_NAME    = 'Agrolytix Auditor';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Utilities ───────────────────────────────────────────────────────────────
class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

interface Identity {
  userId: number;
  name: string;
  role: string;
  businessId: number;
  businessName: string;
  orgId: number;
  isHq: boolean;
  isHqAdmin: boolean;
}

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allow = ALLOWED_ORIGINS.includes('*')
    ? '*'
    : ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? '');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agx-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
}

const num    = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const round2 = (v: number): number => Math.round(v * 100) / 100;
const ghs    = (v: number): string => 'GH₵' + v.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function businessDate(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

async function sha(algo: 'SHA-1' | 'SHA-256', input: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest(algo, new TextEncoder().encode(input)));
}
const toHex = (b: Uint8Array) => [...b].map(x => x.toString(16).padStart(2, '0')).join('');

/** Deterministic RFC-4122-shaped UUID from a string (Supabase expects `sub` to be a uuid). */
async function uuidFrom(input: string): Promise<string> {
  const h = (await sha('SHA-256', input)).slice(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = toHex(h);
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

// ─── Agrolytix (Laravel) API — read-only ─────────────────────────────────────
async function agx<T = any>(path: string, token: string): Promise<T> {
  const res = await fetch(`${AGX_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    let msg = `Agrolytix API ${path} responded ${res.status}`;
    try { const b = await res.json(); if (b?.message) msg = b.message; } catch { /* ignore */ }
    throw new HttpError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

async function identify(token: string, hint?: any): Promise<Identity> {
  const raw = await agx<any>('/user', token);
  const user = raw?.user ?? raw?.data ?? raw;
  if (!user?.id) throw new HttpError(401, 'Invalid session');
  if (user.role === 'SuperAdmin') throw new HttpError(403, 'Branch chat is only available inside a business account');

  const biz = user.business ?? {};
  let businessId = num(biz.id ?? user.business_id);
  let businessName = String(biz.name ?? `Business #${businessId}`);
  let parentId = biz.parent_id ? num(biz.parent_id) : 0;

  // Adopt active branch hint from frontend if supplied (e.g. user assigned to a child branch)
  if (hint?.active_business_id && hint?.active_business_name) {
    const hintBizId = num(hint.active_business_id);
    if (hintBizId) {
      businessId = hintBizId;
      businessName = String(hint.active_business_name);
      if (hint.active_business_parent_id !== undefined && hint.active_business_parent_id !== null) {
        parentId = num(hint.active_business_parent_id);
      }
    }
  }

  const isHq = !parentId;
  const role = String(user.role ?? 'Worker');

  return {
    userId: num(user.id),
    name: String(user.name ?? 'User'),
    role,
    businessId,
    businessName,
    orgId: parentId || businessId,
    isHq,
    isHqAdmin: isHq && role === 'Admin',
  };
}

/** Keep the org directory fresh so everyone can see all branches for DMs / status board. */
async function syncDirectory(id: Identity, token: string): Promise<void> {
  const rows: { business_id: number; org_id: number; name: string; is_hq: boolean; updated_at: string }[] = [
    { business_id: id.businessId, org_id: id.orgId, name: id.businessName, is_hq: id.isHq, updated_at: new Date().toISOString() },
  ];

  if (id.isHqAdmin) {
    try {
      const raw = await agx<any>('/branches', token);
      const list: any[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
      for (const b of list) {
        if (!b?.id) continue;
        rows.push({ business_id: num(b.id), org_id: id.orgId, name: String(b.name ?? `Branch #${b.id}`), is_hq: false, updated_at: new Date().toISOString() });
      }
    } catch (e) {
      console.warn('Branch directory sync failed:', (e as Error).message);
    }
  }

  const { error } = await admin.from('chat_businesses').upsert(rows, { onConflict: 'business_id' });
  if (error) console.warn('chat_businesses upsert failed:', error.message);
}

// ─── Actions ─────────────────────────────────────────────────────────────────
async function actionToken(token: string, body?: any) {
  if (!AGX_JWT_SECRET) throw new HttpError(500, 'AGX_JWT_SECRET is not configured');
  const id = await identify(token, body);
  await syncDirectory(id, token);

  const now = Math.floor(Date.now() / 1000);
  const exp = now + TOKEN_TTL_SEC;

  const jwt = await new SignJWT({
    role: 'authenticated',
    aud: 'authenticated',
    agx_uid: id.userId,
    org_id: id.orgId,
    business_id: id.businessId,
    business_name: id.businessName,
    name: id.name,
    app_role: id.role,
    is_hq: id.isHq,
    is_hq_admin: id.isHqAdmin,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(await uuidFrom(`agrolytix-user-${id.userId}`))
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(AGX_JWT_SECRET));

  return { token: jwt, expires_at: exp, profile: id, cloudinary_cloud: CLD_NAME };
}

async function actionSignUpload(token: string) {
  if (!CLD_NAME || !CLD_KEY || !CLD_SECRET) throw new HttpError(500, 'Cloudinary is not configured');
  const id = await identify(token);
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `agrolytix/${id.orgId}/${id.businessId}`;
  // Cloudinary signature: alphabetically sorted params joined with &, then + api_secret, SHA-1
  const signature = toHex(await sha('SHA-1', `folder=${folder}&timestamp=${timestamp}${CLD_SECRET}`));
  return { cloud_name: CLD_NAME, api_key: CLD_KEY, timestamp, folder, signature };
}

interface Figures {
  retailRevenue: number;
  wholesaleCollected: number;
  expenses: number;
  expected: number;
  source: 'sales' | 'today_stats';
}

async function sumTodayExpenses(token: string, date: string): Promise<number> {
  let total = 0;
  for (let page = 1; page <= 30; page++) {
    const res = await agx<any>(`/expenses?date_from=${date}&date_to=${date}&page=${page}`, token);
    const rows: any[] = res?.data ?? [];
    for (const r of rows) total += num(r.amount);
    if (!res?.last_page || page >= num(res.last_page)) break;
  }
  return round2(total);
}

async function computeExpected(token: string, date: string): Promise<Figures> {
  const isToday = date === businessDate();
  const retailUrl = isToday ? '/sales/retail?preset=today&page=1' : `/sales/retail?date_from=${date}&date_to=${date}&page=1`;
  const wholesaleUrl = isToday ? '/sales/wholesale?preset=today&page=1' : `/sales/wholesale?date_from=${date}&date_to=${date}&page=1`;

  try {
    const [retail, wholesale, expenses] = await Promise.all([
      agx<any>(retailUrl, token),
      agx<any>(wholesaleUrl, token),
      sumTodayExpenses(token, date),
    ]);
    const retailRevenue      = round2(num(retail?.summary?.total_revenue));
    const wholesaleCollected = round2(num(wholesale?.summary?.total_collected));
    return {
      retailRevenue, wholesaleCollected, expenses,
      expected: round2(retailRevenue + wholesaleCollected - expenses),
      source: 'sales',
    };
  } catch (e) {
    // Workers without sales-report permission get 403 → fall back to the
    // expenses "today-stats" net revenue (available to every role).
    if (!(e instanceof HttpError) || e.status !== 403) throw e;
    const s = await agx<any>(isToday ? '/expenses/today-stats' : `/expenses/today-stats?date=${date}`, token);
    const net = round2(num(s?.net_revenue));
    const exp = round2(num(s?.total_expenses ?? s?.expenses_total ?? s?.expenses ?? 0));
    return {
      retailRevenue: round2(num(s?.retail_revenue)),
      wholesaleCollected: round2(num(s?.wholesale_collected ?? s?.wholesale_revenue)),
      expenses: exp,
      expected: net,
      source: 'today_stats',
    };
  }
}

async function actionDeclareCash(token: string, req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = await identify(token, body);

  const amount = round2(Number(body?.amount));
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
    throw new HttpError(422, 'Enter a valid cash amount');
  }
  const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  const imageUrl = typeof body?.image_url === 'string' && CLD_NAME && body.image_url.startsWith(`https://res.cloudinary.com/${CLD_NAME}/`)
    ? body.image_url
    : null;

  // Validate or default business_date (auto-defaults to today)
  const today = businessDate();
  const rawDate = typeof body?.business_date === 'string' ? body.business_date.trim() : today;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;

  if (date > today) {
    throw new HttpError(422, 'Cannot declare cash for a future date');
  }

  // Prevent declaring cash for a date more than once per branch
  const { count } = await admin
    .from('cash_declarations')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', id.businessId)
    .eq('business_date', date);

  if ((count ?? 0) > 0) {
    throw new HttpError(409, `Cash has already been declared for ${id.businessName} on ${date}. Only one declaration per date is allowed.`);
  }

  const attempt = 1;
  const f = await computeExpected(token, date);

  const difference = round2(amount - f.expected);
  const status: 'balanced' | 'short' | 'over' =
    Math.abs(difference) <= TOLERANCE ? 'balanced' : difference < 0 ? 'short' : 'over';

  const { data: decl, error: declErr } = await admin
    .from('cash_declarations')
    .insert({
      org_id: id.orgId,
      business_id: id.businessId,
      business_name: id.businessName,
      user_id: id.userId,
      user_name: id.name,
      business_date: date,
      declared: amount,
      expected: f.expected,
      retail_revenue: f.retailRevenue,
      wholesale_collected: f.wholesaleCollected,
      expenses: f.expenses,
      difference,
      tolerance: TOLERANCE,
      status,
      attempt,
      source: f.source,
      note,
      image_url: imageUrl,
    })
    .select('id')
    .single();
  if (declErr) throw new HttpError(500, `Could not save declaration: ${declErr.message}`);

  const room = `recon:${id.businessId}`;
  const t0 = Date.now();
  const at = (ms: number) => new Date(t0 + ms).toISOString();

  const headline =
    status === 'balanced' ? `✅ Cash balanced for ${date}. ${id.businessName}'s declared cash matches the system.`
    : status === 'short'  ? `🔴 Cash shortage of ${ghs(Math.abs(difference))} for ${date} at ${id.businessName}. Admin has been alerted.`
    :                       `🟠 Cash surplus of ${ghs(Math.abs(difference))} for ${date} at ${id.businessName}. Admin has been alerted.`;

  const publicLine =
    status === 'balanced'
      ? `✅ ${id.businessName} submitted cash for ${date}. Balanced.`
      : `⚠️ ${id.businessName}'s cash declaration for ${date} was flagged. Admin notified.`;

  // Note: the detailed `expected` breakdown is intentionally NOT copied into
  // message meta (readable by all branch users). Admins read it from
  // cash_declarations, which is RLS-restricted to admins.
  const messages = [
    {
      org_id: id.orgId, room, kind: 'cash_declaration',
      sender_user_id: id.userId, sender_name: id.name,
      sender_business_id: id.businessId, sender_business_name: id.businessName, sender_role: id.role,
      body: note, image_url: imageUrl,
      meta: { declaration_id: decl.id, declared: amount, attempt, business_date: date },
      created_at: at(0),
    },
    {
      org_id: id.orgId, room, kind: 'recon_result',
      sender_user_id: null, sender_name: AUDITOR_NAME,
      sender_business_id: null, sender_business_name: null, sender_role: 'system',
      body: headline, image_url: null,
      meta: {
        declaration_id: decl.id, status, declared: amount, difference, tolerance: TOLERANCE, attempt,
        business_id: id.businessId, business_name: id.businessName, business_date: date,
        submitted_by: id.name, submitted_by_id: id.userId, source: f.source,
      },
      created_at: at(5),
    },
    {
      org_id: id.orgId, room: 'general', kind: 'recon_status',
      sender_user_id: null, sender_name: AUDITOR_NAME,
      sender_business_id: null, sender_business_name: null, sender_role: 'system',
      body: publicLine, image_url: null,
      meta: { status: status === 'balanced' ? 'balanced' : 'flagged', business_id: id.businessId, business_name: id.businessName, attempt },
      created_at: at(10),
    },
  ];

  const { error: msgErr } = await admin.from('chat_messages').insert(messages);
  if (msgErr) throw new HttpError(500, `Declaration saved but chat post failed: ${msgErr.message}`);

  return {
    declaration_id: decl.id,
    status, declared: amount, difference, attempt, tolerance: TOLERANCE,
    business_date: date, room, source: f.source,
  };
}

// ─── Router ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST')    return json(req, 405, { message: 'Method not allowed' });

  const action = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  const token = req.headers.get('x-agx-token') ?? '';

  try {
    if (!token) throw new HttpError(401, 'Missing Agrolytix session token');
    switch (action) {
      case 'token': {
        const body = await req.json().catch(() => ({}));
        return json(req, 200, await actionToken(token, body));
      }
      case 'sign-upload':  return json(req, 200, await actionSignUpload(token));
      case 'declare-cash': return json(req, 200, await actionDeclareCash(token, req));
      default:             return json(req, 404, { message: `Unknown action "${action}"` });
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error(`[agx-chat/${action}]`, (e as Error).message);
    return json(req, status, { message: (e as Error).message ?? 'Unexpected error' });
  }
});
