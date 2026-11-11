'use client';

import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      alert('Login Failed: ' + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080b] bg-tactical-grid flex items-center justify-center px-4 relative overflow-hidden">
      {/* Subtle amber ambient glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[540px] h-[320px] rounded-full bg-amber-500/10 blur-[120px]"
        aria-hidden="true"
      />

      <div className="relative max-w-md w-full bg-[#0d0f14]/95 border border-zinc-800/90 rounded-2xl p-8 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)] backdrop-blur-md">
        {/* Top precision gold hairline */}
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-1.5 rounded-2xl bg-[#04070d] border border-amber-500/30 shadow-[0_0_30px_-8px_rgba(245,158,11,0.35)] mb-4 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sis-logo.jpg"
              alt="SIS Cyber Fortress Logo"
              className="w-48 h-28 object-cover rounded-xl"
            />
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-[0.22em] bg-amber-500/10 text-amber-300 border border-amber-500/25 mb-3">
            Zero-Trust Clearance
          </span>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-wider">
            SIS <span className="text-amber-400">CYBER FORTRESS</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Enterprise Cybersecurity Operations Center
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-zinc-100 hover:bg-amber-50 text-zinc-950 font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-amber-500/10 cursor-pointer disabled:opacity-60"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.19v3.15C3.17 21.36 7.24 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.19C.43 8.1 0 9.99 0 12s.43 3.9 1.19 5.42l4.09-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.24 0 3.17 2.64 1.19 6.58l4.09 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          {loading ? 'Authenticating...' : 'Continue with Google'}
        </button>

        <p className="mt-6 text-center text-[11px] font-mono text-zinc-500">
          AES-256-GCM • mTLS 1.3 ENFORCED SESSION
        </p>
      </div>
    </div>
  );
}
