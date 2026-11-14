import { supabaseAdmin } from '@/lib/supabase-admin';
import { currentProfile } from '@/lib/supabase-auth';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  const profile = await currentProfile();
  if (!profile) return json({ error: 'Sign in required.' }, 401);
  const { data, error } = await supabaseAdmin.from('ledgerly_businesses').select('id, name, description, created_at, archived_at').eq('organization_id', profile.organization_id).order('created_at');
  if (error) return json({ error: 'Could not load businesses.' }, 500);
  return json({ businesses: data.map((business) => ({ ...business, createdAt: business.created_at, archivedAt: business.archived_at })) });
}

export async function POST(request) {
  const profile = await currentProfile();
  if (!profile) return json({ error: 'Sign in required.' }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request body.' }, 400);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!name) return json({ error: 'Business name is required.' }, 400);
  if (name.length > 120 || description.length > 500) return json({ error: 'Business name or description is too long.' }, 400);
  const { data, error } = await supabaseAdmin.from('ledgerly_businesses').insert({ organization_id: profile.organization_id, name, description: description || null }).select('id, name, description, created_at, archived_at').single();
  if (error) return json({ error: error.code === '23505' ? 'That business already exists.' : 'Could not create business.' }, error.code === '23505' ? 409 : 500);
  return json({ business: { ...data, createdAt: data.created_at, archivedAt: data.archived_at } }, 201);
}
