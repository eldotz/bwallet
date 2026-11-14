import { cookies } from 'next/headers';
import { supabase } from './supabase';
import { supabaseAdmin } from './supabase-admin';

export async function setSupabaseSession(session) {
  const cookieStore = await cookies();
  cookieStore.set('ledgerly_access_token', session.access_token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 30, path: '/' });
  cookieStore.set('ledgerly_refresh_token', session.refresh_token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 30, path: '/' });
}

export async function clearSupabaseSession() {
  const cookieStore = await cookies();
  cookieStore.delete('ledgerly_access_token');
  cookieStore.delete('ledgerly_refresh_token');
}

export async function currentProfile() {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get('ledgerly_access_token')?.value;
  const refreshToken = cookieStore.get('ledgerly_refresh_token')?.value;
  if (!accessToken) return null;
  let { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error && refreshToken) {
    const refreshed = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (refreshed.data.session) {
      await setSupabaseSession(refreshed.data.session);
      accessToken = refreshed.data.session.access_token;
      ({ data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken));
    }
  }
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin.from('ledgerly_profiles').select('id, name, role, organization_id').eq('id', user.id).single();
  if (!profile) return null;
  const { data: organization } = await supabaseAdmin.from('ledgerly_organizations').select('id, name, invite_code').eq('id', profile.organization_id).single();
  return { ...profile, email: user.email, organization, authUser: user };
}
