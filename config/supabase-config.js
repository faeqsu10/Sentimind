// ---------------------------------------------------------------------------
// Supabase Configuration
// ---------------------------------------------------------------------------
// Supabase 클라이언트 초기화 및 설정을 관리합니다.
// 모든 값은 .env 파일의 환경변수로 오버라이드 가능합니다.
//
// 사용법:
//   const { supabase, supabaseAdmin, USE_SUPABASE } = require('./config/supabase-config');
// ---------------------------------------------------------------------------

const { createClient } = require('@supabase/supabase-js');

// ---------------------------------------------------------------------------
// Environment Variables
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase is active only when both URL and anon key are provided
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------------
// Client Instances
// ---------------------------------------------------------------------------

// Public client (respects RLS, used for authenticated user requests)
const supabase = USE_SUPABASE
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Admin client (bypasses RLS, used for server-side operations like migration)
// Only created when service role key is available
const supabaseAdmin =
  USE_SUPABASE && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

// ---------------------------------------------------------------------------
// User-scoped Client Factory
// ---------------------------------------------------------------------------
// Creates a Supabase client scoped to a specific user's JWT.
// All queries through this client are filtered by RLS (auth.uid() = user.id).

function createUserClient(accessToken) {
  if (!USE_SUPABASE) return null;

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  USE_SUPABASE,
  supabase,
  supabaseAdmin,
  createUserClient,
};
