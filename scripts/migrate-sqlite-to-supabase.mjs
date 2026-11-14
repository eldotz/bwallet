import Database from 'better-sqlite3';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { supabaseAdmin } from '../lib/supabase-admin.js';

const dbPath = path.join(process.cwd(), 'data', 'ledgerly.sqlite');
if (!existsSync(dbPath)) throw new Error(`SQLite file not found: ${dbPath}`);
const db = new Database(dbPath, { readonly: true });
const rows = (table) => db.prepare(`SELECT * FROM ${table}`).all();
const cols = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
const has = (table, column) => cols(table).includes(column);
const fail = (label, error) => { if (error) throw new Error(`${label}: ${error.message}`); };

const { data: usersPage, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
fail('Could not list Supabase Auth users', usersError);
const authByEmail = new Map((usersPage.users || []).map((user) => [user.email?.toLowerCase(), user]));
const organizationMap = new Map();
const profileMap = new Map();
const businessMap = new Map();
const transactionMap = new Map();

for (const organization of rows('organizations')) {
  const { data, error } = await supabaseAdmin.from('ledgerly_organizations').insert({ name: organization.name, invite_code: organization.invite_code }).select('id').single();
  fail(`Organization ${organization.name}`, error);
  organizationMap.set(organization.id, data.id);
}

for (const user of rows('users')) {
  const authUser = authByEmail.get(user.email.toLowerCase());
  if (!authUser) throw new Error(`No Supabase Auth user for ${user.email}. Create/sign in that account first, then rerun migration.`);
  const { data, error } = await supabaseAdmin.from('ledgerly_profiles').insert({ id: authUser.id, organization_id: organizationMap.get(user.organization_id), name: user.name, role: user.role, created_at: user.created_at }).select('id').single();
  fail(`Profile ${user.email}`, error);
  profileMap.set(user.id, data.id);
}

if (has('businesses')) {
  for (const business of rows('businesses')) {
    const { data, error } = await supabaseAdmin.from('ledgerly_businesses').insert({ organization_id: organizationMap.get(business.organization_id), name: business.name, description: business.description, created_at: business.created_at }).select('id').single();
    fail(`Business ${business.name}`, error);
    businessMap.set(business.id, data.id);
  }
}

for (const transaction of rows('transactions')) {
  const entryType = has('transactions', 'entry_type') ? transaction.entry_type : ({ income: 'return', expense: 'spend', loan: 'loan', draw: 'withdrawal' }[transaction.type] || 'spend');
  const payload = {
    organization_id: organizationMap.get(transaction.organization_id),
    user_id: profileMap.get(transaction.user_id),
    taken_by_user_id: has('transactions', 'taken_by_user_id') ? profileMap.get(transaction.taken_by_user_id) || null : null,
    business_id: has('transactions', 'business_id') ? businessMap.get(transaction.business_id) || null : null,
    description: transaction.description,
    category: transaction.category,
    type: transaction.type,
    entry_type: entryType,
    source: has('transactions', 'source') ? transaction.source : 'wallet',
    amount: transaction.amount,
    occurred_on: transaction.occurred_on,
    created_at: transaction.created_at
  };
  const { data, error } = await supabaseAdmin.from('ledgerly_transactions').insert(payload).select('id').single();
  fail(`Transaction ${transaction.id}`, error);
  transactionMap.set(transaction.id, data.id);
}

if (has('audit_logs')) {
  for (const audit of rows('audit_logs')) {
    const { error } = await supabaseAdmin.from('ledgerly_audit_logs').insert({ organization_id: organizationMap.get(audit.organization_id), user_id: profileMap.get(audit.user_id), transaction_id: transactionMap.get(audit.transaction_id), action: audit.action, before_json: audit.before_json ? JSON.parse(audit.before_json) : null, after_json: audit.after_json ? JSON.parse(audit.after_json) : null, created_at: audit.created_at });
    fail(`Audit log ${audit.id}`, error);
  }
}

console.log(`Migrated ${organizationMap.size} organizations, ${profileMap.size} profiles, ${businessMap.size} businesses, and ${transactionMap.size} transactions to Supabase.`);
db.close();
