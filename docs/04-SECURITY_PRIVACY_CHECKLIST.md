# Security, Privacy & Ethical Compliance Checklist

Aligned with Section 8 of the **SIS Cyber Fortress** project specification:

- [x] **Authorized Scope Enforcement:** `POST /api/modules/webshield-scan` strictly checks `public.authorized_assets` (`asset_type = 'website'` AND `is_authorized = true`) and returns `403 Forbidden` for any unregistered domain.
- [x] **No Unauthorized Access / Data Exfiltration:** All routes require authenticated Supabase sessions (`supabase.auth.getUser()`) and enforce RBAC + PostgreSQL Row Level Security (RLS).
- [x] **No Fake Statistics or Fake Scan Results:** Every metric card, module count, scan score, and report is queried from PostgreSQL or computed dynamically from real TLS/DNS/HTTP/heuristic checks.
- [x] **Zero Plaintext Password Storage:** Authentication uses Google OAuth; Module 01 breach checking hashes candidate secrets in-browser (`SHA-1`) and sends only the 5-character k-Anonymity prefix.
- [x] **Vault Plaintext Hidden from Super Admin:** Module 05 (`vault_items`) encrypts client-side via `PBKDF2 + AES-256-GCM` (Web Crypto API). PostgreSQL stores `ciphertext`, `iv`, and `salt` only, and RLS restricts access strictly to `owner_id = (SELECT auth.uid())`.
- [x] **No Destructive Malware / Ransomware Execution:** Module 06 (`Ransomware Guardian`) performs safe backup integrity and recovery-readiness verification only.
- [x] **No Self-Escalation / Role Bypass:** `profiles` RLS blocks users from updating their own `role` column; only `super_admin` can assign roles via `/api/admin/users`, and `SECURITY DEFINER` helpers revoke `anon` RPC execution.
- [x] **Open Redirect Prevention:** `/auth/callback` validates `next` to allow relative paths only (rejects `//` and external origins).
- [x] **Immutable Audit Trail:** Role updates, asset registration, scans, vault writes, forensics evidence, backup drills, and incident transitions log actor, role, timestamp, and action to `public.audit_logs`.
