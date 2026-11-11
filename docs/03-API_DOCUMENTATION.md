# API Documentation & Verification Reference

All `/api/*` endpoints verify the caller's Supabase session cookie via `getAuthenticatedProfile()` (`401 Unauthorized` if unauthenticated). Administrative and operational mutations enforce RBAC (`403 Forbidden` for `viewer` / `auditor` where restricted) and record events in `public.audit_logs`.

## 1. Core Admin & Infrastructure Endpoints

| Method & Endpoint | Role Clearance | Purpose |
| :--- | :--- | :--- |
| `GET /api/health` | Authenticated | Measures live PostgreSQL roundtrip latency (`dbLatencyMs`) and row counts across 10 tables. |
| `GET /api/admin/users` | `super_admin`, `security_admin`, `auditor` | Lists operator profiles and current RBAC roles. |
| `PATCH /api/admin/users` | `super_admin` only | Updates target user's role (`{ userId, role }`). Prevents self-demotion. |
| `GET /api/assets` | Authenticated | Lists registered authorized websites, Android devices, server nodes, and network APs. |
| `POST /api/assets` | Operational roles (`super_admin`, `security_admin`, `module_admin`) | Registers an authorized asset (`name`, `asset_type`, `identifier`, `environment`, `os_or_stack`). |
| `DELETE /api/assets?id=...` | Operational roles | Removes an asset by UUID. |
| `GET /api/audit` | Authenticated | Returns latest 100 immutable records from `public.audit_logs`. |

## 2. Security Module Endpoints

| Method & Endpoint | Module(s) | Request / Behavior |
| :--- | :--- | :--- |
| `GET/POST /api/modules/identity-breach` | 01, 09 | `POST { action: 'record_session' }` logs verified session; `POST { action: 'breach_check', sha1Prefix, sha1Suffix }` queries HIBP k-anonymity range API without plaintext passwords. |
| `GET/POST /api/modules/phishing-scan` | 02 | `POST { url, reportThreat? }` evaluates URL heuristics, live DNS A-records, and `threat_iocs` matches; persists `phishing_scans`. |
| `GET/POST /api/modules/webshield-scan` | 07 | `POST { assetId }` verifies asset is an authorized website, inspects live TLS cert, DNS (`A/MX/TXT`), and 5 HTTP security headers; persists `webshield_scans`. |
| `GET/POST/DELETE /api/modules/vault` | 05 | `POST { title, category, ciphertext, iv, salt }` stores client-encrypted payloads only (`owner_id = auth.uid()`). |
| `GET/POST /api/modules/network` | 04 | `POST { network_name, encryption_type, dns_sec_enabled, vpn_active }` computes real posture score and logs unsafe Wi-Fi alerts. |
| `GET/POST/PATCH /api/modules/backups` | 06, 11 | Creates encrypted backup policies and executes non-destructive integrity/recovery verification drills. |
| `GET/POST /api/modules/forensics` | 08 | Creates forensics cases (`type: 'case'`) and logs evidence artifacts with server-computed SHA-256 digests (`type: 'evidence'`). |
| `GET/POST/DELETE /api/modules/threat-intel` | 10 | Manages Threat Intelligence IOCs (`domain`, `url`, `ip`, `hash`). |
| `GET/POST/PATCH /api/incidents` | 12 | Creates SOC incidents (`POST`) and transitions workflow status `open -> investigating -> contained -> resolved` (`PATCH`). |
