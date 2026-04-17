// ============================================================
//  ALOQAPRO — SUPABASE.JS
// ============================================================

// !!! O'ZINGIZNING SUPABASE MA'LUMOTLARINGIZNI QO'YING
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Supabase client
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// global qilish
window.sb = sb;

// ============================================================
//  HELPERLAR
// ============================================================

// Tashkent time
function tzNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(now);

  const get = type => parts.find(p => p.type === type)?.value || '00';

  return new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
  );
}

function todayISO() {
  const d = tzNow();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtHM(date) {
  if (!date) return '-';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

window.tzNow = tzNow;
window.todayISO = todayISO;
window.fmtHM = fmtHM;

// ============================================================
//  AUTH HELPERS
// ============================================================

async function getSessionSafe() {
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) {
      console.warn('getSession error:', error.message);
      return null;
    }
    return data?.session || null;
  } catch (e) {
    console.warn('getSessionSafe exception:', e.message);
    return null;
  }
}

async function getUserSafe() {
  try {
    const { data, error } = await sb.auth.getUser();
    if (error) {
      console.warn('getUser error:', error.message);
      return null;
    }
    return data?.user || null;
  } catch (e) {
    console.warn('getUserSafe exception:', e.message);
    return null;
  }
}

async function signOutSafe() {
  try {
    const { error } = await sb.auth.signOut();
    if (error) console.warn('signOut error:', error.message);
  } catch (e) {
    console.warn('signOutSafe exception:', e.message);
  }
}

window.getSessionSafe = getSessionSafe;
window.getUserSafe = getUserSafe;
window.signOutSafe = signOutSafe;

// ============================================================
//  SIMPLE DB HELPERS
// ============================================================

async function dbSelect(table, queryBuilder) {
  try {
    let q = sb.from(table).select('*');
    if (typeof queryBuilder === 'function') q = queryBuilder(q);

    const { data, error } = await q;
    if (error) {
      console.warn(`${table} select error:`, error.message);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (e) {
    console.warn(`${table} select exception:`, e.message);
    return { data: null, error: e };
  }
}

async function dbInsert(table, payload) {
  try {
    const { data, error } = await sb.from(table).insert(payload).select();
    if (error) {
      console.warn(`${table} insert error:`, error.message);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (e) {
    console.warn(`${table} insert exception:`, e.message);
    return { data: null, error: e };
  }
}

async function dbUpdate(table, payload, filters = {}) {
  try {
    let q = sb.from(table).update(payload);

    Object.entries(filters).forEach(([k, v]) => {
      q = q.eq(k, v);
    });

    const { data, error } = await q.select();
    if (error) {
      console.warn(`${table} update error:`, error.message);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (e) {
    console.warn(`${table} update exception:`, e.message);
    return { data: null, error: e };
  }
}

async function dbUpsert(table, payload, onConflict = null) {
  try {
    let q = sb.from(table).upsert(payload);
    if (onConflict) q = sb.from(table).upsert(payload, { onConflict });

    const { data, error } = await q.select();
    if (error) {
      console.warn(`${table} upsert error:`, error.message);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (e) {
    console.warn(`${table} upsert exception:`, e.message);
    return { data: null, error: e };
  }
}

window.dbSelect = dbSelect;
window.dbInsert = dbInsert;
window.dbUpdate = dbUpdate;
window.dbUpsert = dbUpsert;

// ============================================================
//  ATTENDANCE HELPERS
// ============================================================

async function upsertAttendance(payload) {
  try {
    const { employee_id, work_date } = payload;

    const { data: existing, error: selErr } = await sb
      .from('attendance')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('work_date', work_date)
      .maybeSingle();

    if (selErr) {
      console.warn('attendance select error:', selErr.message);
      return { ok: false, error: selErr };
    }

    if (existing?.id) {
      const { error } = await sb
        .from('attendance')
        .update(payload)
        .eq('id', existing.id);

      if (error) {
        console.warn('attendance update error:', error.message);
        return { ok: false, error };
      }

      return { ok: true, mode: 'update' };
    } else {
      const { error } = await sb
        .from('attendance')
        .insert(payload);

      if (error) {
        console.warn('attendance insert error:', error.message);
        return { ok: false, error };
      }

      return { ok: true, mode: 'insert' };
    }
  } catch (e) {
    console.warn('upsertAttendance exception:', e.message);
    return { ok: false, error: e };
  }
}

async function insertAttendanceEvent(payload) {
  try {
    const { error } = await sb.from('attendance_events').insert(payload);
    if (error) {
      console.warn('attendance_events insert error:', error.message);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (e) {
    console.warn('insertAttendanceEvent exception:', e.message);
    return { ok: false, error: e };
  }
}

window.upsertAttendance = upsertAttendance;
window.insertAttendanceEvent = insertAttendanceEvent;

// ============================================================
//  CONNECTION TEST
// ============================================================

async function testSupabaseConnection() {
  try {
    const { data, error } = await sb.from('settings').select('key').limit(1);
    if (error) {
      console.warn('Supabase connection test failed:', error.message);
      return false;
    }
    console.log('Supabase connected:', data);
    return true;
  } catch (e) {
    console.warn('Supabase test exception:', e.message);
    return false;
  }
}

window.testSupabaseConnection = testSupabaseConnection;

console.log('✅ supabase.js yuklandi');
