import { supabaseAdmin } from '@/lib/supabase-admin';
import { currentProfile } from '@/lib/supabase-auth';

const validEntryTypes = ['investment', 'spend', 'loan', 'withdrawal', 'loan_withdrawal', 'advance_spend', 'partner_repayment', 'repayment', 'return'];
const validSources = ['wallet', 'loan', 'profit', 'partner', 'partner_advance'];
const validAllocationTypes = ['common', 'individual'];
const MAX_AMOUNT = 1_000_000_000_000;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const toType = (entryType) => entryType === 'loan' ? 'loan' : entryType === 'investment' || entryType === 'return' || entryType === 'partner_repayment' ? 'income' : entryType === 'withdrawal' || entryType === 'loan_withdrawal' ? 'draw' : 'expense';
const toSignedAmount = (entryType, amount) => ['investment', 'spend', 'withdrawal', 'loan_withdrawal', 'advance_spend', 'repayment'].includes(entryType) ? -amount : amount;

async function validMovement(profile, body) {
  const amount = Number(body.amount);
  const amountMinor = Math.round(amount * 100);
  const entryType = body.entryType || body.type;
  const source = body.source || (entryType === 'loan' || entryType === 'loan_withdrawal' ? 'loan' : entryType === 'advance_spend' ? 'partner_advance' : entryType === 'partner_repayment' ? 'partner' : 'wallet');
  const allocationEnabled = ['investment', 'spend', 'loan', 'loan_withdrawal'].includes(entryType);
  const allocationType = allocationEnabled ? body.allocationType || 'common' : 'common';
  const allocationUserId = allocationType === 'individual' ? body.allocationUserId : null;
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';

  if (!description || description.length > 240 || !category || category.length > 80 || !validEntryTypes.includes(entryType) || !validSources.includes(source) || !validAllocationTypes.includes(allocationType) || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    return { error: 'Enter valid movement details and an amount up to ₹1,000,000,000,000.' };
  }

  const businessId = body.businessId || null;
  if (businessId) {
    const { data: business, error } = await supabaseAdmin.from('ledgerly_businesses').select('id').eq('id', businessId).eq('organization_id', profile.organization_id).is('archived_at', null).maybeSingle();
    if (error || !business) return { error: 'Business does not belong to this workspace or is archived.' };
  }

  const takenByUserId = ['withdrawal', 'loan_withdrawal', 'advance_spend', 'partner_repayment'].includes(entryType) ? body.takenById || profile.id : null;
  if (takenByUserId) {
    const { data: partner, error } = await supabaseAdmin.from('ledgerly_profiles').select('id').eq('id', takenByUserId).eq('organization_id', profile.organization_id).maybeSingle();
    if (error || !partner) return { error: 'Selected partner does not belong to this workspace.' };
  }

  if (allocationType === 'individual') {
    if (!allocationUserId) return { error: 'Choose the partner wallet for individual money.' };
    const { data: owner, error } = await supabaseAdmin.from('ledgerly_profiles').select('id').eq('id', allocationUserId).eq('organization_id', profile.organization_id).maybeSingle();
    if (error || !owner) return { error: 'Selected wallet owner does not belong to this workspace.' };
  }

  return { amount: amountMinor, entryType, source, allocationType, allocationUserId, businessId, takenByUserId, description, category };
}

export async function GET(_request, { params }) {
  const profile = await currentProfile();
  if (!profile) return json({ error: 'Sign in required.' }, 401);
  const { id } = await params;
  const { data: transaction, error } = await supabaseAdmin.from('ledgerly_transactions').select('*').eq('id', id).eq('organization_id', profile.organization_id).maybeSingle();
  if (error || !transaction) return json({ error: 'Transaction not found.' }, 404);

  const [{ data: history }, { data: business }, { data: taker }] = await Promise.all([
    supabaseAdmin.from('ledgerly_audit_logs').select('id, action, before_json, after_json, created_at, user_id').eq('transaction_id', id).eq('organization_id', profile.organization_id).order('created_at', { ascending: false }),
    transaction.business_id ? supabaseAdmin.from('ledgerly_businesses').select('name').eq('id', transaction.business_id).eq('organization_id', profile.organization_id).single() : Promise.resolve({ data: null }),
    transaction.taken_by_user_id ? supabaseAdmin.from('ledgerly_profiles').select('name').eq('id', transaction.taken_by_user_id).eq('organization_id', profile.organization_id).single() : Promise.resolve({ data: null })
  ]);
  const actorIds = [...new Set((history || []).map((item) => item.user_id))];
  const { data: actors } = actorIds.length ? await supabaseAdmin.from('ledgerly_profiles').select('id, name').in('id', actorIds).eq('organization_id', profile.organization_id) : { data: [] };
  const actorMap = new Map((actors || []).map((actor) => [actor.id, actor.name]));
  return json({ transaction: { id: transaction.id, description: transaction.description, category: transaction.category, entryType: transaction.entry_type, source: transaction.source, allocationType: transaction.allocation_type || 'common', allocationUserId: transaction.allocation_user_id, amount: transaction.amount, businessId: transaction.business_id, businessName: business?.name || null, takenById: transaction.taken_by_user_id, takenByName: taker?.name || null, occurredOn: transaction.occurred_on }, history: (history || []).map((item) => ({ id: item.id, action: item.action, beforeJson: item.before_json, afterJson: item.after_json, createdAt: item.created_at, userName: actorMap.get(item.user_id) || 'Partner' })) });
}

export async function PATCH(request, { params }) {
  const profile = await currentProfile();
  if (!profile) return json({ error: 'Sign in required.' }, 401);
  const { id } = await params;
  const { data: before, error: readError } = await supabaseAdmin.from('ledgerly_transactions').select('*').eq('id', id).eq('organization_id', profile.organization_id).maybeSingle();
  if (readError || !before) return json({ error: 'Transaction not found.' }, 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request body.' }, 400);
  const movement = await validMovement(profile, body);
  if (movement.error) return json({ error: movement.error }, 400);

  const next = { taken_by_user_id: movement.takenByUserId, allocation_user_id: movement.allocationUserId, business_id: movement.businessId, description: movement.description, category: movement.category, type: toType(movement.entryType), entry_type: movement.entryType, source: movement.source, allocation_type: movement.allocationType, amount: toSignedAmount(movement.entryType, movement.amount) };
  const { error } = await supabaseAdmin.from('ledgerly_transactions').update(next).eq('id', id).eq('organization_id', profile.organization_id);
  if (error) return json({ error: 'Could not update transaction.' }, 500);

  const { error: auditError } = await supabaseAdmin.from('ledgerly_audit_logs').insert({ organization_id: profile.organization_id, user_id: profile.id, transaction_id: id, action: 'updated', before_json: before, after_json: { ...before, ...next } });
  if (auditError) {
    const previous = { taken_by_user_id: before.taken_by_user_id, allocation_user_id: before.allocation_user_id, business_id: before.business_id, description: before.description, category: before.category, type: before.type, entry_type: before.entry_type, source: before.source, allocation_type: before.allocation_type, amount: before.amount };
    await supabaseAdmin.from('ledgerly_transactions').update(previous).eq('id', id).eq('organization_id', profile.organization_id);
    return json({ error: 'Could not record transaction history.' }, 500);
  }
  return json({ ok: true });
}
