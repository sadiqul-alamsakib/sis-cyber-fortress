# SIS Cyber Fortress — 12-in-1 Enterprise Cybersecurity Ecosystem

Enterprise-grade cybersecurity web platform and Central Super Admin Dashboard built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS v4**, and **Supabase (PostgreSQL + Auth + RLS + Realtime)**.

## Integrated 12 Security Modules
1. **01. SIS Identity Guardian** — Google OAuth, TOTP MFA enrollment, login activity log & privacy-preserving k-Anonymity SHA-1 breach check (`/api/modules/identity-breach`).
2. **02. SIS Phishing Shield** — Live URL heuristics, IDN/punycode checks, DNS A-record resolution & Threat IOC correlation (`/api/modules/phishing-scan`).
3. **03. SIS Endpoint Guardian** — Authorized Android device & server node registry and compliance tracking (`/api/assets`).
4. **04. SIS Network Sentinel** — Wi-Fi/network encryption risk scoring, DNSSEC & VPN checklist evaluation (`/api/modules/network`).
5. **05. SIS Vault Guardian** — Zero-knowledge client-side `PBKDF2 + AES-256-GCM` encryption via Web Crypto API; PostgreSQL stores ciphertext, IV, and salt only (`/api/modules/vault`).
6. **06. SIS Ransomware Guardian** — Safe recovery readiness & non-destructive snapshot verification drills (`/api/modules/backups`).
7. **07. SIS WebShield** — Authorized-domain-only TLS certificate, DNS (`A`/`MX`/`TXT`), and HTTP security header (`HSTS`, `CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) scanner (`/api/modules/webshield-scan`).
8. **08. SIS Digital Forensics** — Case creation, server-computed SHA-256 evidence digests, chain-of-custody log & JSON report export (`/api/modules/forensics`).
9. **09. SIS Access Guardian** — 4-tier Enterprise RBAC (`super_admin`, `security_admin`, `module_admin`, `auditor`, plus `viewer`) & MFA factor governance (`/api/admin/users`).
10. **10. SIS Threat Intelligence** — IOC repository (`domain`, `url`, `ip`, `hash`) with severity & feed attribution (`/api/modules/threat-intel`).
11. **11. SIS Cloud Backup Guardian** — Encrypted backup policy scheduling, retention & integrity verification (`/api/modules/backups`).
12. **12. SIS Cyber SOC** — Real-time `security_logs` streaming, SOC incident triage workflow & audit correlation (`/api/incidents`).

## Assignment Documentation & Deliverables
- [Project Requirements & Planning](docs/01-REQUIREMENTS_AND_PLANNING.md)
- [System Architecture & Security Flows](docs/02-ARCHITECTURE_AND_FLOWS.md)
- [API Documentation](docs/03-API_DOCUMENTATION.md)
- [Security, Privacy & Ethical Compliance Checklist](docs/04-SECURITY_PRIVACY_CHECKLIST.md)
- [Known Limitations & Future Improvements](docs/05-KNOWN_LIMITATIONS.md)
- [Test & Verification Report](docs/06-TEST_REPORT.md)
- [Complete PostgreSQL Schema](supabase/schema.sql)

## Environment Setup (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-or-anon-key
```

## Installation, Testing & Running
```bash
npm install
npm test        # Runs unit & cryptography test suite (11 tests)
npm run lint    # ESLint verification
npm run build   # Production Next.js build
npm run dev     # Starts development server at http://localhost:3000
```
