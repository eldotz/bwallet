import { supabaseAdmin } from '@/lib/supabase-admin';
import { currentProfile } from '@/lib/supabase-auth';

export async function DELETE(_request, { params }) {
  const profile = await currentProfile();
  if (!profile) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('ledgerly_businesses').update({ archived_at: new Date().toISOString() }).eq('id', params.id).eq('organization_id', profile.organization_id).is('archived_at', null).select('id').single();
  if (error || !data) return Response.json({ error: 'Could not archive business.' }, { status: 404 });
  return Response.json({ success: true });
}

export async function PATCH(request, { params }) {
  const profile = await currentProfile();
  if (!profile) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body.action !== 'restore') return Response.json({ error: 'Unsupported business action.' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('ledgerly_businesses').update({ archived_at: null }).eq('id', params.id).eq('organization_id', profile.organization_id).not('archived_at', 'is', null).select('id, name, description, created_at, archived_at').single();
  if (error) return Response.json({ error: error.code === '23505' ? 'An active business with this name already exists.' : 'Could not restore business.' }, { status: error.code === '23505' ? 409 : 500 });
  if (!data) return Response.json({ error: 'Business not found.' }, { status: 404 });
  return Response.json({ business: { ...data, createdAt: data.created_at, archivedAt: data.archived_at } });
}
