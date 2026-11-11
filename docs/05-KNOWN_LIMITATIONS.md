# Known Limitations & Future Improvements

## Current Limitations
1. **Web Platform Scope Only:** This repository implements the Next.js Web Application, Central Super Admin Dashboard, REST APIs (`/api/*`), and Supabase PostgreSQL database. A native Kotlin Jetpack Compose Android client and standalone NestJS microservice split are outside this web repository's current implementation.
2. **External Paid Threat Feeds:** Module 02 (Phishing Shield) and Module 10 (Threat Intelligence) use deterministic URL heuristics, live DNS resolution, and the internal `threat_iocs` database rather than paid commercial feeds (e.g., VirusTotal / AbuseIPDB API keys).
3. **Lab Environment Deployment:** Currently configured for `http://localhost:3000` with Google OAuth in Testing mode until deployed to a production domain (e.g., Vercel) and added to Google Cloud & Supabase Redirect URLs.
4. **In-Browser Vault Key Management:** Vault passphrases in Module 05 are kept strictly in browser memory for zero-knowledge privacy; if an operator forgets their passphrase, stored ciphertexts cannot be recovered by the server.

## Planned Future Improvements
- **Kotlin Android App Integration:** Connect the Android Endpoint Guardian & Network Sentinel app via signed Supabase JWTs to stream real device policy & Wi-Fi telemetry into `/api/assets` and `/api/modules/network`.
- **Firebase Cloud Messaging (FCM):** Add real-time mobile push notifications for `Critical` SOC incidents.
- **External Threat Feed Connectors:** Add optional VirusTotal / URLhaus / AbuseIPDB API adapters via environment secrets.
- **Automated CI/CD Pipeline:** Configure GitHub Actions to run `npm test`, `npm run lint`, and `npm run build` on every pull request.
