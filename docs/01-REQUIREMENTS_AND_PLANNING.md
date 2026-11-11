# Project Requirements & Planning Document
**Project:** SIS Cyber Fortress — 12-in-1 Enterprise Cybersecurity Ecosystem  
**Platform Implemented:** Next.js 16 Web Application + Central Super Admin Dashboard + PostgreSQL/Supabase Backend API  

## 1. Objectives
1. Build a production-ready, unified cybersecurity operations platform following SDLC best practices.
2. Enforce Google OAuth authentication, cookie-backed SSR session validation (`proxy.ts`), and 4-tier Enterprise RBAC (`super_admin`, `security_admin`, `module_admin`, `auditor`, plus `viewer`).
3. Integrate all **12 Security Modules** into a centralized Super Admin Control Center backed exclusively by live PostgreSQL queries and real server-side/client-side security checks (zero hardcoded fake statistics).
4. Uphold strict privacy and ethical testing boundaries: zero plaintext password or vault secret exposure, authorized-domain-only scanning, and immutable audit logging.

## 2. 12-Module Integration Matrix
| Code | Module | Primary Table(s) | Backend API Route |
| :--- | :--- | :--- | :--- |
| 01 | SIS Identity Guardian | `login_activities`, `profiles` | `/api/modules/identity-breach` |
| 02 | SIS Phishing Shield | `phishing_scans`, `threat_iocs` | `/api/modules/phishing-scan` |
| 03 | SIS Endpoint Guardian | `authorized_assets` | `/api/assets` |
| 04 | SIS Network Sentinel | `network_assessments` | `/api/modules/network` |
| 05 | SIS Vault Guardian | `vault_items` | `/api/modules/vault` |
| 06 | SIS Ransomware Guardian | `backup_policies` | `/api/modules/backups` |
| 07 | SIS WebShield | `webshield_scans`, `authorized_assets` | `/api/modules/webshield-scan` |
| 08 | SIS Digital Forensics | `forensics_cases`, `forensics_evidence` | `/api/modules/forensics` |
| 09 | SIS Access Guardian | `profiles`, `audit_logs` | `/api/admin/users` |
| 10 | SIS Threat Intelligence | `threat_iocs` | `/api/modules/threat-intel` |
| 11 | SIS Cloud Backup Guardian | `backup_policies` | `/api/modules/backups` |
| 12 | SIS Cyber SOC | `soc_incidents`, `security_logs` | `/api/incidents` |

## 3. Milestone Alignment
- **Milestone 1–2 (Planning & Foundation):** Next.js 16 App Router, TypeScript, Tailwind CSS v4 (Obsidian Carbon + Tactical Gold theme), Supabase SSR & `proxy.ts`.
- **Milestone 3–4 (Core Functionality & API/DB Integration):** All 13 REST API routes, 14 PostgreSQL tables with RLS, and real TLS/DNS/HTTP/WebCrypto logic.
- **Milestone 5–7 (Dashboard Integration, QA & Verification):** Central Super Admin Dashboard, 12-module workspaces, automated unit tests (`npm test`), TypeScript/ESLint/Production Build checks, and full documentation.
