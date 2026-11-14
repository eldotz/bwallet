import { supabaseAdmin } from '@/lib/supabase-admin';
import { currentProfile } from '@/lib/supabase-auth';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  const profile = await currentProfile();
  if (!profile) return json({ error: 'Sign in required.' }, 401);
  const orgId = profile.organization_id;
  const [{ data: organization, error: organizationError }, { data: members, error: membersError }, { data: businesses, error: businessesError }] = await Promise.all([
    supabaseAdmin.from('ledgerly_organizations').select('id, name, invite_code').eq('id', orgId).single(),
    supabaseAdmin.from('ledgerly_profiles').select('id, name, role, created_at').eq('organization_id', orgId).order('created_at'),
    supabaseAdmin.from('ledgerly_businesses').select('id, name, description, created_at, archived_at').eq('organization_id', orgId).order('created_at')
  ]);
  if (organizationError || membersError || businessesError || !organization) return json({ error: 'Could not load workspace.' }, 500);

  const { data: movements, error: movementsError } = await supabaseAdmin.from('ledgerly_transactions').select('user_id, allocation_user_id, taken_by_user_id, entry_type, amount').eq('organization_id', orgId);
  if (movementsError) return json({ error: 'Could not load workspace balances.' }, 500);

  const memberBalances = (members || []).map((member) => {
    const balance = (movements || []).reduce((sum, movement) => {
      const walletOwnerId = movement.allocation_user_id || movement.user_id;
      if (movement.entry_type === 'investment' && walletOwnerId === member.id) return sum - movement.amount;
      if (['withdrawal', 'loan_withdrawal', 'partner_repayment'].includes(movement.entry_type) && movement.taken_by_user_id === member.id) return sum + movement.amount;
      return sum;
    }, 0);
    return { id: member.id, name: member.name, role: member.role, createdAt: member.created_at, balance };
  });
  return json({ organization: { ...organization, inviteCode: organization.invite_code }, members: memberBalances, businesses: (businesses || []).map((business) => ({ ...business, createdAt: business.created_at, archivedAt: business.archived_at })) });
}
