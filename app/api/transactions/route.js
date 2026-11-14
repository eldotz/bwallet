import { supabaseAdmin } from '@/lib/supabase-admin';
import { currentProfile } from '@/lib/supabase-auth';

const validEntryTypes = ['investment', 'spend', 'loan', 'withdrawal', 'loan_withdrawal', 'advance_spend', 'partner_repayment', 'repayment', 'return'];
const validSources = ['wallet', 'loan', 'profit', 'partner', 'partner_advance'];
const validAllocationTypes = ['common', 'individual'];
const MAX_AMOUNT = 1_000_000_000_000;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const toType = (entryType) => entryType === 'loan' ? 'loan' : entryType === 'investment' || entryType === 'return' || entryType === 'partner_repayment' ? 'income' : entryType === 'withdrawal' || entryType === 'loan_withdrawal' ? 'draw' : 'expense';
const toSignedAmount = (entryType, amount) => ['investment', 'spend', 'withdrawal', 'loan_withdrawal', 'advance_spend', 'repayment'].includes(entryType) ? -amount : amount;

async function enrichTransactions(rows) {
  const businessIds = [...new Set(rows.map((row) => row.business_id).filter(Boolean))];
  const profileIds = [...new Set(rows.flatMap((row) => [row.taken_by_user_id, row.allocation_user_id]).filter(Boolean))];
  const [{ data: businesses }, { data: profiles }] = await Promise.all([
    businessIds.length ? supabaseAdmin.from('ledgerly_businesses').select('id, name').in('id', businessIds) : Promise.resolve({ data: [] }),
    profileIds.length ? supabaseAdmin.from('ledgerly_profiles').select('id, name').in('id', profileIds) : Promise.resolve({ data: [] })
  ]);
  const businessMap = new Map((businesses || []).map((item) => [item.id, item.name]));
  const profileMap = new Map((profiles || []).map((item) => [item.id, item.name]));
  return rows.map((row) => ({ id: row.id, userId: row.user_id, description: row.description, category: row.category, type: row.type, entryType: row.entry_type, source: row.source, allocationType: row.allocation_type || 'common', allocationUserId: row.allocation_user_id, allocationUserName: profileMap.get(row.allocation_user_id) || null, amount: row.amount, businessId: row.business_id, businessName: businessMap.get(row.business_id) || null, takenById: row.taken_by_user_id, takenByName: profileMap.get(row.taken_by_user_id) || null, occurredOn: row.occurred_on, createdAt: row.created_at }));
}

async function validateMovement(profile, body) {
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

export async function GET() {
  const profile = await currentProfile();
  if (!profile) return json({ error: 'Sign in required.' }, 401);
  const { data, error } = await supabaseAdmin.from('ledgerly_transactions').select('*').eq('organization_id', profile.organization_id).order('occurred_on', { ascending: false }).order('created_at', { ascending: false });
  if (error) return json({ error: 'Could not load transactions.' }, 500);
  return json({ transactions: await enrichTransactions(data || []) });
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
  const movement = await validateMovement(profile, body);
  if (movement.error) return json({ error: movement.error }, 400);

  const row = { organization_id: profile.organization_id, user_id: profile.id, taken_by_user_id: movement.takenByUserId, business_id: movement.businessId, description: movement.description, category: movement.category, type: toType(movement.entryType), entry_type: movement.entryType, source: movement.source, allocation_type: movement.allocationType, allocation_user_id: movement.allocationUserId, amount: toSignedAmount(movement.entryType, movement.amount) };
  const { data, error } = await supabaseAdmin.from('ledgerly_transactions').insert(row).select('id').single();
  if (error) return json({ error: 'Could not save transaction.' }, 500);
  const { error: auditError } = await supabaseAdmin.from('ledgerly_audit_logs').insert({ organization_id: profile.organization_id, user_id: profile.id, transaction_id: data.id, action: 'created', after_json: { ...row, id: data.id } });
  if (auditError) {
    await supabaseAdmin.from('ledgerly_transactions').delete().eq('id', data.id).eq('organization_id', profile.organization_id);
    return json({ error: 'Could not record transaction history.' }, 500);
  }
  return json({ id: data.id }, 201);
}
