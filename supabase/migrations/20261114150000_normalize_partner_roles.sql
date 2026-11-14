-- BWallet currently treats every member as a partner in the UI.
-- Keep role column for future role-specific permissions.
update public.ledgerly_profiles
set role = 'partner'
where role = 'owner';
