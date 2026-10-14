'use strict';

function getSupabaseConfig(env = process.env) {
  const projectUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY
    || env.SUPABASE_ANON_KEY
    || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || '';
  if (!projectUrl || !publishableKey || projectUrl.includes('your-project-ref') || publishableKey.includes('your-key')) {
    return { configured: false };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(projectUrl);
  } catch {
    return { configured: false };
  }
  const isLocal = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
  if ((parsedUrl.protocol !== 'https:' && !(isLocal && parsedUrl.protocol === 'http:')) || !parsedUrl.host) {
    return { configured: false };
  }
  return { configured: true, url: parsedUrl.origin, publishableKey };
}

module.exports = { getSupabaseConfig };
