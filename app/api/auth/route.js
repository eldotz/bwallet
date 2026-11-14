import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { clearSupabaseSession, currentProfile, setSupabaseSession } from '@/lib/supabase-auth';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function createProfile(user, name, organizationId, role = 'partner') {
  const { error } = await supabaseAdmin.from('ledgerly_profiles').insert({ id: user.id, organization_id: organizationId, name: name.trim(), role });
  if (error) throw error;
}

export async function GET() {
  const profile = await currentProfile();
  if (!profile) return json({ user: null });
  return json({ user: { id: profile.id, name: profile.name, email: profile.email, role: profile.role, organizationId: profile.organization_id, organization: profile.organization.name, inviteCode: profile.organization.invite_code } });
}

export async function POST(request) {
  const body = await request.json();
  const action = body.action || 'login';
  const email = body.email?.trim().toLowerCase();
  if (!email || !body.password || body.password.length < 8) return json({ error: 'Use valid email and password of at least 8 characters.' }, 400);

  try {
    let authResult;
    let profileName = body.name?.trim();
    let organizationId;
    let role = 'partner';

    if (action === 'signup') {
      if (!profileName || !body.organization?.trim()) return json({ error: 'Name and workspace are required.' }, 400);
      const inviteCode = `NS-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const { data: organization, error: organizationError } = await supabaseAdmin.from('ledgerly_organizations').insert({ name: body.organization.trim(), invite_code: inviteCode }).select('id').single();
      if (organizationError) throw organizationError;
      organizationId = organization.id;
      role = 'owner';
      authResult = await supabase.auth.signUp({ email, password: body.password });
    } else if (action === 'join') {
      if (!profileName || !body.inviteCode?.trim()) return json({ error: 'Name and invite code are required.' }, 400);
      const { data: organization } = await supabaseAdmin.from('ledgerly_organizations').select('id').eq('invite_code', body.inviteCode.trim().toUpperCase()).single();
      if (!organization) return json({ error: 'Invite code not found.' }, 404);
      organizationId = organization.id;
      authResult = await supabase.auth.signUp({ email, password: body.password });
    } else {
      authResult = await supabase.auth.signInWithPassword({ email, password: body.password });
      profileName = null;
    }

    if (authResult.error) return json({ error: authResult.error.message }, 401);
    if (!authResult.data.user || !authResult.data.session) return json({ error: 'Email confirmation is required before signing in.' }, 401);
    if (organizationId) await createProfile(authResult.data.user, profileName, organizationId, role);
    await setSupabaseSession(authResult.data.session);
    const profile = await currentProfile();
    return json({ user: profile ? { id: profile.id, name: profile.name, email: profile.email, organizationId: profile.organization_id } : null });
  } catch (error) {
    if (String(error.message).includes('duplicate') || String(error.message).includes('already registered')) return json({ error: 'That email or workspace is already in use.' }, 409);
    return json({ error: 'Could not complete sign-in.' }, 500);
  }
}

export async function DELETE() {
  const profile = await currentProfile();
  if (profile?.authUser) await supabaseAdmin.auth.admin.signOut(profile.authUser.id).catch(() => {});
  await clearSupabaseSession();
  return json({ ok: true });
}
