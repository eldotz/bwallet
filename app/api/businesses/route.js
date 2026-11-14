import { supabaseAdmin } from '@/lib/supabase-admin';
import { currentProfile } from '@/lib/supabase-auth';

export async function GET() {
  const profile = await currentProfile();
  if (!profile) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('ledgerly_businesses').select('id, name, description, created_at, archived_at').eq('organization_id', profile.organization_id).order('created_at');
  if (error) return Response.json({ error: 'Could not load businesses.' }, { status: 500 });
  return Response.json({ businesses: data.map((business) => ({ ...business, createdAt: business.created_at, archivedAt: business.archived_at })) });
}

export async function POST(request) {
  const profile = await currentProfile();
  if (!profile) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  const body = await request.json();
  const name = body.name?.trim();
  if (!name) return Response.json({ error: 'Business name is required.' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('ledgerly_businesses').insert({ organization_id: profile.organization_id, name, description: body.description?.trim() || null }).select('id, name, description, created_at, archived_at').single();
  if (error) return Response.json({ error: error.code === '23505' ? 'That business already exists.' : 'Could not create business.' }, { status: error.code === '23505' ? 409 : 500 });
  return Response.json({ business: { ...data, createdAt: data.created_at, archivedAt: data.archived_at } }, { status: 201 });
}
