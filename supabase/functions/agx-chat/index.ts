// =============================================================================
// Agrolytix · agx-chat Edge Function (Supabase / Deno)
// -----------------------------------------------------------------------------
// Routes (POST):
//   /agx-chat/token               → validate Laravel token, mint short-lived Supabase JWT
//   /agx-chat/sign-upload         → Cloudinary signed-upload parameters
//   /agx-chat/declare-cash        → automatic daily cash reconciliation + SMS alert
//   /agx-chat/send-sms            → programmatic SMS dispatcher via Arkesel
//   /agx-chat/arkesel-balance     → check live Arkesel SMS credit balance
//   /agx-chat/check-missing-cash  → cron/manual check for branches that haven't declared cash
//   /agx-chat/daily-summary       → cron/manual nightly reconciliation summary SMS
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
// Optional secrets:
//   ARKESEL_API_KEY         Fallback Arkesel API key (or set dynamically in chat_sms_settings table)
//   ARKESEL_SENDER_ID       Default 'Agrolytix'
//   AGX_API_URL             default https://agrolytixapi.asatek.online/api
//   RECON_TOLERANCE         default 1   (GH₵)
//   BUSINESS_TZ             default Africa/Accra
//   ALLOWED_ORIGINS         default *
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
  contact?: string | null;
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
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

/** Deterministic RFC-4122-shaped UUID from a string */
async function uuidFrom(input: string): Promise<string> {
  const h = (await sha('SHA-256', input)).slice(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = toHex(h);
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

// ─── Agrolytix (Laravel) API ────────────────────────────────────────────────
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

  // Adopt active branch hint from frontend if supplied
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
  const contact = user.contact || user.phone || null;

  return {
    userId: num(user.id),
    name: String(user.name ?? 'User'),
    role,
    contact,
    businessId,
    businessName,
    orgId: parentId || businessId,
    isHq,
    isHqAdmin: isHq && role === 'Admin',
  };
}

/** Keep the org directory & contact cache fresh */
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

  // Sync current user contact
  if (id.contact) {
    await admin.from('chat_contacts').upsert({
      user_id: id.userId,
      org_id: id.orgId,
      business_id: id.businessId,
      name: id.name,
      role: id.role,
      phone: id.contact,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,org_id' });
  }

  // If HQ admin, also sync workers from /workers if accessible
  if (id.isHqAdmin) {
    try {
      const workersRaw = await agx<any>('/workers', token);
      const workersList: any[] = Array.isArray(workersRaw) ? workersRaw : (workersRaw?.data ?? []);
      const contactRows = workersList
        .filter(w => w?.id && w?.contact)
        .map(w => ({
          user_id: num(w.id),
          org_id: id.orgId,
          business_id: num(w.business_id ?? id.businessId),
          name: String(w.name ?? 'User'),
          role: String(w.role ?? 'Worker'),
          phone: String(w.contact),
          updated_at: new Date().toISOString(),
        }));
      if (contactRows.length > 0) {
        await admin.from('chat_contacts').upsert(contactRows, { onConflict: 'user_id,org_id' });
      }
    } catch (e) {
      console.warn('Worker contact sync failed (non-critical):', (e as Error).message);
    }
  }
}

// ─── Arkesel SMS Dispatcher & Engine ─────────────────────────────────────────

function sanitizePhone(phone: string): string | null {
  if (!phone) return null;
  let p = phone.trim().replace(/[\s\-\(\)]/g, '');
  if (!p) return null;
  // If starts with 0 (e.g. 0244123456 in Ghana) → 233244123456
  if (/^0\d{9}$/.test(p)) {
    p = '233' + p.slice(1);
  } else if (/^\+\d+$/.test(p)) {
    p = p.slice(1);
  }
  return /^\d{10,15}$/.test(p) ? p : null;
}

interface SmsSettingsRow {
  org_id: number;
  arkesel_api_key?: string | null;
  sender_id?: string | null;
  enabled: boolean;
  alert_stock_intake: boolean;
  alert_cash_declaration: boolean;
  alert_cash_balanced: boolean;
  alert_cash_imbalance: boolean;
  alert_price_change: boolean;
  alert_missing_cash: boolean;
  alert_daily_summary: boolean;
  alert_low_balance: boolean;
  low_balance_threshold: number;
  last_low_balance_alert_at?: string | null;
}

async function getOrgSmsSettings(orgId: number): Promise<SmsSettingsRow> {
  const { data } = await admin
    .from('chat_sms_settings')
    .select('*')
    .eq('org_id', orgId)
    .single();

  const envKey = Deno.env.get('ARKESEL_API_KEY') || null;
  const envSender = Deno.env.get('ARKESEL_SENDER_ID') || 'Agrolytix';

  if (!data) {
    return {
      org_id: orgId,
      arkesel_api_key: envKey,
      sender_id: envSender,
      enabled: !!envKey,
      alert_stock_intake: true,
      alert_cash_declaration: true,
      alert_cash_balanced: true,
      alert_cash_imbalance: true,
      alert_price_change: true,
      alert_missing_cash: true,
      alert_daily_summary: true,
      alert_low_balance: true,
      low_balance_threshold: 10,
    };
  }

  return {
    ...data,
    arkesel_api_key: data.arkesel_api_key || envKey,
    sender_id: data.sender_id || envSender,
  };
}

async function checkArkeselBalance(apiKey: string): Promise<any> {
  if (!apiKey) return null;
  try {
    const res = await fetch('https://sms.arkesel.com/api/v2/clients/balance-details', {
      headers: { 'api-key': apiKey, 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function dispatchArkeselSms(
  orgId: number,
  eventType: string,
  rawRecipients: (string | null | undefined)[],
  message: string
): Promise<{ success: boolean; count: number; error?: string }> {
  const settings = await getOrgSmsSettings(orgId);
  if (!settings.enabled || !settings.arkesel_api_key) {
    return { success: false, count: 0, error: 'SMS service disabled or API key not configured' };
  }

  // Filter & sanitize valid recipients
  const cleanRecipients = Array.from(new Set(
    rawRecipients.map(r => r ? sanitizePhone(r) : null).filter((p): p is string => !!p)
  ));

  if (cleanRecipients.length === 0) {
    return { success: false, count: 0, error: 'No recipients with valid phone numbers found' };
  }

  const sender = (settings.sender_id || 'Agrolytix').slice(0, 11);
  const payload = {
    sender,
    message,
    recipients: cleanRecipients,
  };

  try {
    const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'api-key': settings.arkesel_api_key,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));

    // Log to chat_sms_logs
    await admin.from('chat_sms_logs').insert({
      org_id: orgId,
      event_type: eventType,
      recipients: cleanRecipients,
      message,
      status: res.ok ? 'success' : 'failed',
      response: body,
      error_message: res.ok ? null : (body?.message || `HTTP ${res.status}`),
    });

    // Check low balance alert if enabled
    if (res.ok && settings.alert_low_balance) {
      setTimeout(async () => {
        try {
          const bal = await checkArkeselBalance(settings.arkesel_api_key!);
          const smsBalance = num(bal?.data?.sms_balance ?? bal?.data?.main_balance);
          if (smsBalance > 0 && smsBalance <= (settings.low_balance_threshold || 10)) {
            // Post notification in general room or alert admin
            const lastAlert = settings.last_low_balance_alert_at ? new Date(settings.last_low_balance_alert_at).getTime() : 0;
            // Alert once per 24 hours
            if (Date.now() - lastAlert > 24 * 3600 * 1000) {
              await admin.from('chat_messages').insert({
                org_id: orgId,
                room: 'general',
                kind: 'system',
                sender_name: 'Agrolytix Alert',
                body: `⚠️ Low SMS Credit Alert: Your Arkesel balance is ${smsBalance} units. Please top up your account to maintain automated SMS notifications.`,
              });
              await admin.from('chat_sms_settings').update({
                last_low_balance_alert_at: new Date().toISOString(),
              }).eq('org_id', orgId);
            }
          }
        } catch { /* silent */ }
      }, 500);
    }

    return { success: res.ok, count: cleanRecipients.length };
  } catch (err: any) {
    await admin.from('chat_sms_logs').insert({
      org_id: orgId,
      event_type: eventType,
      recipients: cleanRecipients,
      message,
      status: 'failed',
      error_message: err.message,
    });
    return { success: false, count: 0, error: err.message };
  }
}

/** Get all HQ Admin phone numbers in the org */
async function getHqAdminPhones(orgId: number): Promise<string[]> {
  const { data } = await admin
    .from('chat_contacts')
    .select('phone')
    .eq('org_id', orgId)
    .eq('role', 'Admin');

  return (data || []).map(r => r.phone).filter(Boolean);
}

/** Get worker phones for a specific branch */
async function getBranchWorkerPhones(orgId: number, businessId: number): Promise<string[]> {
  const { data } = await admin
    .from('chat_contacts')
    .select('phone')
    .eq('org_id', orgId)
    .eq('business_id', businessId);

  return (data || []).map(r => r.phone).filter(Boolean);
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

  const today = businessDate();
  const rawDate = typeof body?.business_date === 'string' ? body.business_date.trim() : today;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;

  if (date > today) {
    throw new HttpError(422, 'Cannot declare cash for a future date');
  }

  // Prevent duplicate declarations for the same date per branch
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

  // ─── Automated SMS Dispatch for Cash Declaration ───────────────────────────
  try {
    const settings = await getOrgSmsSettings(id.orgId);
    if (settings.enabled) {
      const shouldSend =
        (status === 'balanced' && settings.alert_cash_balanced) ||
        (status !== 'balanced' && settings.alert_cash_imbalance);

      if (shouldSend) {
        // Recipients: HQ Admins + Declaring Worker's contact
        const hqPhones = await getHqAdminPhones(id.orgId);
        const recipients = [...hqPhones];
        if (id.contact) recipients.push(id.contact);

        const statusLabel = status === 'balanced' ? 'BALANCED' : status === 'short' ? `SHORTAGE (${ghs(Math.abs(difference))})` : `SURPLUS (${ghs(Math.abs(difference))})`;
        const smsText = `Agrolytix Cash Declared: ${id.businessName} (${date})\nAmount: ${ghs(amount)}\nStatus: ${statusLabel}\nBy: ${id.name}`;

        await dispatchArkeselSms(id.orgId, `cash_declaration_${status}`, recipients, smsText);
      }
    }
  } catch (smsErr) {
    console.error('Failed to trigger cash declaration SMS:', smsErr);
  }

  return {
    declaration_id: decl.id,
    status, declared: amount, difference, attempt, tolerance: TOLERANCE,
    business_date: date, room, source: f.source,
  };
}

// ─── Programmatic SMS Action (Called from Frontend for Stockings / Price changes) ──
async function actionSendSms(token: string, req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = await identify(token, body);
  const event = String(body?.event || 'custom_alert');
  const details = body?.details || {};

  const settings = await getOrgSmsSettings(id.orgId);
  if (!settings.enabled) {
    return { success: false, message: 'SMS is disabled for this organization' };
  }

  let smsMessage = '';
  const recipients: string[] = [];

  if (event === 'stock_intake') {
    if (!settings.alert_stock_intake) return { success: false, message: 'Stock intake SMS alerts are disabled' };
    
    // Check if price change alert applies
    const hasPriceChange = !!details.has_price_changes;
    if (hasPriceChange && !settings.alert_price_change) {
      // Still send stock alert if stock alert is on
    }

    const itemCount = details.items_count || 1;
    const supplier = details.supplier ? ` from ${details.supplier}` : '';
    const priceNote = hasPriceChange ? ' [PRICE MODIFIED - Action Needed]' : '';
    smsMessage = `Agrolytix Stock Arrival: ${id.businessName} received ${itemCount} item(s)${supplier} reported by ${id.name}.${priceNote} Waiting for Admin approval.`;

    const hqPhones = await getHqAdminPhones(id.orgId);
    recipients.push(...hqPhones);
  } else if (event === 'stock_approved' || event === 'stock_rejected') {
    const isApprove = event === 'stock_approved';
    smsMessage = `Agrolytix Stock ${isApprove ? 'APPROVED' : 'REJECTED'}: Delivery for ${details.business_name || id.businessName} has been ${isApprove ? 'approved and inventory restocked' : 'rejected'}${details.reason ? ': ' + details.reason : ''}.`;
    
    // Notify branch workers + worker who submitted
    const branchPhones = await getBranchWorkerPhones(id.orgId, details.business_id || id.businessId);
    recipients.push(...branchPhones);
    if (details.submitted_by_phone) recipients.push(details.submitted_by_phone);
  } else if (body?.message) {
    smsMessage = String(body.message);
    if (Array.isArray(body.recipients)) recipients.push(...body.recipients);
    else {
      const hqPhones = await getHqAdminPhones(id.orgId);
      recipients.push(...hqPhones);
    }
  }

  if (!smsMessage || recipients.length === 0) {
    return { success: false, message: 'No valid message or recipients' };
  }

  return await dispatchArkeselSms(id.orgId, event, recipients, smsMessage);
}

// ─── Missing Cash Check Action (at ~8:00 PM / Cron / Manual Trigger) ─────────
async function actionCheckMissingCash(token: string, req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = await identify(token, body);
  const today = businessDate();
  const settings = await getOrgSmsSettings(id.orgId);

  if (!settings.enabled || !settings.alert_missing_cash) {
    return { success: false, message: 'Missing cash alert disabled' };
  }

  // Find all branches in org
  const { data: businesses } = await admin
    .from('chat_businesses')
    .select('business_id, name, is_hq')
    .eq('org_id', id.orgId);

  const branches = (businesses || []).filter(b => !b.is_hq);

  // Find who has declared today
  const { data: declarations } = await admin
    .from('cash_declarations')
    .select('business_id')
    .eq('org_id', id.orgId)
    .eq('business_date', today);

  const declaredIds = new Set((declarations || []).map(d => d.business_id));
  const missingBranches = branches.filter(b => !declaredIds.has(b.business_id));

  if (missingBranches.length === 0) {
    return { success: true, missing_count: 0, message: 'All branches have submitted today\'s cash declaration.' };
  }

  const hqPhones = await getHqAdminPhones(id.orgId);
  const branchNames = missingBranches.map(b => b.name).join(', ');
  const adminMsg = `⚠️ Agrolytix Alert: ${missingBranches.length} branch(es) have NOT declared cash for ${today}: ${branchNames}.`;

  // Send alert to HQ admins
  await dispatchArkeselSms(id.orgId, 'missing_cash_admin', hqPhones, adminMsg);

  // Also send reminder SMS directly to workers of each missing branch!
  for (const mb of missingBranches) {
    const workerPhones = await getBranchWorkerPhones(id.orgId, mb.business_id);
    if (workerPhones.length > 0) {
      const workerMsg = `⚠️ Agrolytix Reminder: ${mb.name} has not submitted today's cash declaration (${today}). Please count your cash and declare it now.`;
      await dispatchArkeselSms(id.orgId, 'missing_cash_worker', workerPhones, workerMsg);
    }
  }

  return { success: true, missing_count: missingBranches.length, missing_branches: missingBranches.map(b => b.name) };
}

// ─── Nightly Summary Action (at ~9:30 PM / Cron / Manual Trigger) ────────────
async function actionDailySummary(token: string, req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = await identify(token, body);
  const today = businessDate();
  const settings = await getOrgSmsSettings(id.orgId);

  if (!settings.enabled || !settings.alert_daily_summary) {
    return { success: false, message: 'Daily summary alert disabled' };
  }

  const { data: declarations } = await admin
    .from('cash_declarations')
    .select('business_name, declared, expected, difference, status')
    .eq('org_id', id.orgId)
    .eq('business_date', today);

  const list = declarations || [];
  let totalDeclared = 0;
  let totalExpected = 0;
  let balancedCount = 0;
  let issueCount = 0;

  for (const d of list) {
    totalDeclared += num(d.declared);
    totalExpected += num(d.expected);
    if (d.status === 'balanced') balancedCount++;
    else issueCount++;
  }

  const netDiff = round2(totalDeclared - totalExpected);
  const summaryMsg = `📊 Agrolytix Daily Summary (${today})\nBranches Declared: ${list.length}\nBalanced: ${balancedCount} | Flagged: ${issueCount}\nTotal Cash: ${ghs(totalDeclared)}\nVariance: ${netDiff >= 0 ? '+' : ''}${ghs(netDiff)}`;

  const hqPhones = await getHqAdminPhones(id.orgId);
  return await dispatchArkeselSms(id.orgId, 'daily_summary', hqPhones, summaryMsg);
}

// ─── Arkesel Balance Check Action ───────────────────────────────────────────
async function actionArkeselBalance(token: string, req: Request) {
  const id = await identify(token);
  const settings = await getOrgSmsSettings(id.orgId);
  if (!settings.arkesel_api_key) {
    return { configured: false, message: 'Arkesel API key not set' };
  }
  const bal = await checkArkeselBalance(settings.arkesel_api_key);
  return { configured: true, data: bal?.data || bal };
}

// ─── Router ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });

  const action = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  const token = req.headers.get('x-agx-token') ?? '';

  try {
    if (!token) throw new HttpError(401, 'Missing Agrolytix session token');
    switch (action) {
      case 'token': {
        const body = await req.json().catch(() => ({}));
        return json(req, 200, await actionToken(token, body));
      }
      case 'sign-upload':         return json(req, 200, await actionSignUpload(token));
      case 'declare-cash':        return json(req, 200, await actionDeclareCash(token, req));
      case 'send-sms':            return json(req, 200, await actionSendSms(token, req));
      case 'check-missing-cash':  return json(req, 200, await actionCheckMissingCash(token, req));
      case 'daily-summary':       return json(req, 200, await actionDailySummary(token, req));
      case 'arkesel-balance':     return json(req, 200, await actionArkeselBalance(token, req));
      default:                    return json(req, 404, { message: `Unknown action "${action}"` });
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error(`[agx-chat/${action}]`, (e as Error).message);
    return json(req, status, { message: (e as Error).message ?? 'Unexpected error' });
  }
});
