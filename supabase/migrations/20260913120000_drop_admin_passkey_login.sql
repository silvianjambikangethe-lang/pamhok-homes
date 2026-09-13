-- Passkey login is replaced by Google OAuth sign-in (auto-linked to the
-- existing admin_users row via Supabase Auth's automatic identity
-- linking). No app code references these tables anymore.
drop table if exists passkey_challenges;
drop table if exists passkey_credentials;
