import { supabaseAdmin } from '@/lib/supabase-admin';
import { currentProfile } from '@/lib/supabase-auth';

const validEntryTypes = ['investment', 'spend', 'loan', 'withdrawal', 'loan_withdrawal', 'advance_spend', 'partner_repayment', 'repayment', 'return'];
const validSources = ['wallet', 'loan', 'profit', 'partner', 'partner_advance'];
const validAllocationTypes = ['common', 'individual'];
const toType = (entryType) => entryType === 'loan' ? 'loan' : entryType === 'investment' || entryType === 'return' || entryType === 'partner_repayment' ? 'income' : entryType === 'withdrawal' || entryType === 'loan_withdrawal' ? 'draw' : 'expense';
const toSignedAmount = (entryType, amount) => ['investment', 'spend', 'withdrawal', 'loan_withdrawal', 'advance_spend', 'repayment'].includes(entryType) ? -Math.round(amount * 100) : Math.round(amount * 100);

async function validMovement(profile, body) {
  const amount = Number(body.amount);
  const entryType = body.entryType;
  const allocationEnabled = ['investment', 'spend', 'loan', 'loan_withdrawal'].includes(entryType);
  const allocationType = allocationEnabled ? body.allocationType || 'common' : 'common';
  const allocationUserId = allocationType === 'individual' ? body.allocationUserId : null;
  if (!body.description?.trim() || !body.category?.trim() || !validEntryTypes.includes(entryType) || !validSources.includes(body.source) || !validAllocationTypes.includes(allocationType) || !Number.isFinite(amount) || amount <= 0) return { error: 'Valid entry type, source and amount are required.' };
  const businessId = body.businessId || null;
  if (businessId) {
    const { data: business } = await supabaseAdmin.from('ledgerly_businesses').select('id').eq('id', businessId).eq('organization_id', profile.organization_id).maybeSingle();
    if (!business) return { error: 'Business does not belong to this workspace.' };
  }
  const takenByUserId = ['withdrawal', 'loan_withdrawal', 'advance_spend', 'partner_repayment'].includes(entryType) ? body.takenById || profile.id : null;
  if (takenByUserId) {
    const { data: partner } = await supabaseAdmin.from('ledgerly_profiles').select('id').eq('id', takenByUserId).eq('organization_id', profile.organization_id).maybeSingle();
    if (!partner) return { error: 'Selected partner does not belong to this workspace.' };
  }
  if (allocationType === 'individual') {
    if (!allocationUserId) return { error: 'Choose the partner wallet for individual money.' };
    const { data: owner } = await supabaseAdmin.from('ledgerly_profiles').select('id').eq('id', allocationUserId).eq('organization_id', profile.organization_id).maybeSingle();
    if (!owner) return { error: 'Selected wallet owner does not belong to this workspace.' };
  }
  return { amount, entryType, source: body.source, allocationType, allocationUserId, businessId, takenByUserId };
}

export async function GET(_request, { params }) {
  const profile = await currentProfile();
  if (!profile) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  const { id } = await params;
  const { data: transaction } = await supabaseAdmin.from('ledgerly_transactions').select('*').eq('id', id).eq('organization_id', profile.organization_id).maybeSingle();
  if (!transaction) return Response.json({ error: 'Transaction not found.' }, { status: 404 });
  const [{ data: history }, { data: business }, { data: taker }] = await Promise.all([
    supabaseAdmin.from('ledgerly_audit_logs').select('id, action, before_json, after_json, created_at, user_id').eq('transaction_id', id).eq('organization_id', profile.organization_id).order('created_at', { ascending: false }),
    transaction.business_id ? supabaseAdmin.from('ledgerly_businesses').select('name').eq('id', transaction.business_id).single() : Promise.resolve({ data: null }),
    transaction.taken_by_user_id ? supabaseAdmin.from('ledgerly_profiles').select('name').eq('id', transaction.taken_by_user_id).single() : Promise.resolve({ data: null })
  ]);
  const actorIds = [...new Set((history || []).map((item) => item.user_id))];
  const { data: actors } = actorIds.length ? await supabaseAdmin.from('ledgerly_profiles').select('id, name').in('id', actorIds) : { data: [] };
  const actorMap = new Map((actors || []).map((actor) => [actor.id, actor.name]));
  return Response.json({ transaction: { id: transaction.id, description: transaction.description, category: transaction.category, entryType: transaction.entry_type, source: transaction.source, allocationType: transaction.allocation_type || 'common', allocationUserId: transaction.allocation_user_id, amount: transaction.amount, businessId: transaction.business_id, businessName: business?.name || null, takenById: transaction.taken_by_user_id, takenByName: taker?.name || null, occurredOn: transaction.occurred_on }, history: (history || []).map((item) => ({ id: item.id, action: item.action, beforeJson: item.before_json, afterJson: item.after_json, createdAt: item.created_at, userName: actorMap.get(item.user_id) || 'Partner' })) });
}

export async function PATCH(request, { params }) {
  const profile = await currentProfile();
  if (!profile) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  const { id } = await params;
  const { data: before } = await supabaseAdmin.from('ledgerly_transactions').select('*').eq('id', id).eq('organization_id', profile.organization_id).maybeSingle();
  if (!before) return Response.json({ error: 'Transaction not found.' }, { status: 404 });
  const body = await request.json();
  const movement = await validMovement(profile, body);
  if (movement.error) return Response.json({ error: movement.error }, { status: 400 });
  const next = { taken_by_user_id: movement.takenByUserId, allocation_user_id: movement.allocationUserId, business_id: movement.businessId, description: body.description.trim(), category: body.category.trim(), type: toType(movement.entryType), entry_type: movement.entryType, source: movement.source, allocation_type: movement.allocationType, amount: toSignedAmount(movement.entryType, movement.amount) };
  const { error } = await supabaseAdmin.from('ledgerly_transactions').update(next).eq('id', id).eq('organization_id', profile.organization_id);
  if (error) return Response.json({ error: 'Could not update transaction.' }, { status: 500 });
  await supabaseAdmin.from('ledgerly_audit_logs').insert({ organization_id: profile.organization_id, user_id: profile.id, transaction_id: id, action: 'updated', before_json: before, after_json: next });
  return Response.json({ ok: true });
}
