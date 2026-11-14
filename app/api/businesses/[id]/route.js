import { supabaseAdmin } from '@/lib/supabase-admin';
import { currentProfile } from '@/lib/supabase-auth';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function DELETE(_request, { params }) {
  const profile = await currentProfile();
  if (!profile) return json({ error: 'Sign in required.' }, 401);
  const { id } = await params;
  const { data, error } = await supabaseAdmin.from('ledgerly_businesses').update({ archived_at: new Date().toISOString() }).eq('id', id).eq('organization_id', profile.organization_id).is('archived_at', null).select('id').maybeSingle();
  if (error || !data) return json({ error: 'Could not archive business.' }, 404);
  return json({ success: true });
}

export async function PATCH(request, { params }) {
  const profile = await currentProfile();
  if (!profile) return json({ error: 'Sign in required.' }, 401);
  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!body || body.action !== 'restore') return json({ error: 'Unsupported business action.' }, 400);
  const { data, error } = await supabaseAdmin.from('ledgerly_businesses').update({ archived_at: null }).eq('id', id).eq('organization_id', profile.organization_id).not('archived_at', 'is', null).select('id, name, description, created_at, archived_at').maybeSingle();
  if (error) return json({ error: error.code === '23505' ? 'An active business with this name already exists.' : 'Could not restore business.' }, error.code === '23505' ? 409 : 500);
  if (!data) return json({ error: 'Business not found.' }, 404);
  return json({ business: { ...data, createdAt: data.created_at, archivedAt: data.archived_at } });
}
