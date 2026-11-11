# System Architecture, User Flows & Security Design

## 1. High-Level Architecture
```mermaid
flowchart TD
    User["Operator / Admin Browser"] -->|"HTTPS / Cookie Session"| Proxy["Next.js 16 proxy.ts (Auth Gate)"]
    Proxy -->|"Unauthenticated /dashboard/*"| Login["/login (Google OAuth)"]
    Proxy -->|"Authenticated"| Dashboard["Central Super Admin Dashboard (/dashboard/*)"]
    Dashboard -->|"Client Web Crypto (AES-256-GCM)"| VaultAPI["/api/modules/vault (Ciphertext Only)"]
    Dashboard -->|"REST API Calls"| APIs["Next.js Route Handlers (/api/*)"]
    APIs -->|"RBAC Check + Audit Log"| Supabase["Supabase PostgreSQL + RLS + Realtime"]
    APIs -->|"node:tls / node:dns / fetch"| Target["Authorized Assets Only (WebShield / Phishing)"]
```

## 2. Authentication & RBAC Flow
```mermaid
sequenceDiagram
    participant U as User Browser
    participant L as /login
    participant G as Google OAuth
    participant C as /auth/callback
    participant P as proxy.ts
    participant DB as Supabase (profiles + RLS)

    U->>L: Click "Continue with Google"
    L->>G: signInWithOAuth(redirectTo=/auth/callback)
    G-->>C: Return authorization code
    C->>DB: exchangeCodeForSession(code) -> trigger handle_new_user()
    C-->>U: Set HTTP cookies & redirect /dashboard
    U->>P: Request /dashboard
    P->>DB: supabase.auth.getUser()
    P-->>U: Allow access or redirect /login
```

## 3. Zero-Knowledge Vault Flow (Module 05)
1. Operator enters a **Vault Passphrase** and secret plaintext in the browser.
2. Browser derives a 256-bit key locally using `PBKDF2 (SHA-256, 100,000 iterations)` + random 16-byte `salt` and encrypts with `AES-256-GCM` + random 12-byte `iv`.
3. Only `{ title, category, ciphertext, iv, salt }` are sent to `POST /api/modules/vault`.
4. PostgreSQL RLS enforces `owner_id = (SELECT auth.uid())`, preventing even `super_admin` from reading or decrypting another operator's vault items.
