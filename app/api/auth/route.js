import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { clearSupabaseSession, currentProfile, setSupabaseSession } from '@/lib/supabase-auth';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function createProfile(user, name, organizationId, role = 'partner') {
  const { error } = await supabaseAdmin.from('ledgerly_profiles').insert({ id: user.id, organization_id: organizationId, name, role });
  if (error) throw error;
}

async function removeOrganization(id) {
  if (id) await supabaseAdmin.from('ledgerly_organizations').delete().eq('id', id);
}

async function removeAuthUser(id) {
  if (id) await supabaseAdmin.auth.admin.deleteUser(id).catch(() => {});
}

export async function GET() {
  const profile = await currentProfile();
  if (!profile) return json({ user: null });
  return json({ user: { id: profile.id, name: profile.name, email: profile.email, role: profile.role, organizationId: profile.organization_id, organization: profile.organization.name, inviteCode: profile.organization.invite_code } });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request body.' }, 400);

  const action = body.action || 'login';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!['login', 'signup', 'join'].includes(action) || !emailPattern.test(email) || password.length < 8 || password.length > 128) {
    return json({ error: 'Use a valid email and password of 8 to 128 characters.' }, 400);
  }

  const profileName = typeof body.name === 'string' ? body.name.trim() : '';
  const organizationName = typeof body.organization === 'string' ? body.organization.trim() : '';
  const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim().toUpperCase() : '';
  if (profileName.length > 100 || organizationName.length > 120 || inviteCode.length > 40) return json({ error: 'One or more fields are too long.' }, 400);

  let createdOrganizationId = null;
  let createdAuthUserId = null;
  try {
    let authResult;
    let organizationId;
    let role = 'partner';

    if (action === 'signup') {
      if (!profileName || !organizationName) return json({ error: 'Name and workspace are required.' }, 400);
      const generatedInviteCode = `NS-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const { data: organization, error: organizationError } = await supabaseAdmin.from('ledgerly_organizations').insert({ name: organizationName, invite_code: generatedInviteCode }).select('id').single();
      if (organizationError) throw organizationError;
      createdOrganizationId = organization.id;
      organizationId = organization.id;
      role = 'owner';
      authResult = await supabase.auth.signUp({ email, password });
    } else if (action === 'join') {
      if (!profileName || !inviteCode) return json({ error: 'Name and invite code are required.' }, 400);
      const { data: organization } = await supabaseAdmin.from('ledgerly_organizations').select('id').eq('invite_code', inviteCode).single();
      if (!organization) return json({ error: 'Invite code not found.' }, 404);
      organizationId = organization.id;
      authResult = await supabase.auth.signUp({ email, password });
    } else {
      authResult = await supabase.auth.signInWithPassword({ email, password });
    }

    if (authResult.error) {
      await removeOrganization(createdOrganizationId);
      const message = String(authResult.error.message).toLowerCase();
      if (message.includes('already registered') || message.includes('duplicate')) return json({ error: 'That email is already registered.' }, 409);
      return json({ error: action === 'login' ? 'Invalid email or password.' : 'Could not create account.' }, 401);
    }

    const user = authResult.data.user;
    if (!user || !authResult.data.session) {
      await removeOrganization(createdOrganizationId);
      return json({ error: 'Email confirmation is required before signing in.' }, 401);
    }

    if (organizationId) {
      createdAuthUserId = user.id;
      await createProfile(user, profileName, organizationId, role);
    }
    await setSupabaseSession(authResult.data.session);
    const profile = await currentProfile();
    if (!profile) throw new Error('Profile setup failed.');
    return json({ user: { id: profile.id, name: profile.name, email: profile.email, organizationId: profile.organization_id } });
  } catch (error) {
    await removeAuthUser(createdAuthUserId);
    await removeOrganization(createdOrganizationId);
    const message = String(error.message || '').toLowerCase();
    if (message.includes('duplicate') || message.includes('already registered')) return json({ error: 'That email or workspace is already in use.' }, 409);
    return json({ error: 'Could not complete sign-in.' }, 500);
  }
}

export async function DELETE() {
  const profile = await currentProfile();
  if (profile?.authUser) await supabaseAdmin.auth.admin.signOut(profile.authUser.id).catch(() => {});
  await clearSupabaseSession();
  return json({ ok: true });
}
