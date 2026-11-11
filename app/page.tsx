import Link from 'next/link';
import { SisFortressEmblem } from '@/components/dashboard/SecurityIcons';
import { SECURITY_MODULES } from '@/lib/modules/catalog';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#07080b] bg-tactical-grid text-zinc-100 flex flex-col">
      <header className="h-16 px-6 lg:px-12 border-b border-zinc-800/80 flex items-center justify-between bg-[#07080b]/85 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <SisFortressEmblem className="w-8 h-8" />
          <span className="text-sm font-bold tracking-wider">
            SIS <span className="text-amber-400">CYBER FORTRESS</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
          >
            Operator Sign In
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-amber-50 transition-colors"
          >
            Control Center →
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-14 space-y-12">
        <section className="text-center max-w-3xl mx-auto space-y-4">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-mono font-semibold uppercase tracking-[0.2em] bg-amber-500/10 text-amber-300 border border-amber-500/25">
            12-in-1 Enterprise Cybersecurity Ecosystem
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-100">
            Unified Security Operations &amp; Zero-Trust Defense
          </h1>
          <p className="text-sm sm:text-base text-zinc-400">
            Centralized Super Admin Control Center integrating 12 real-time cybersecurity modules with PostgreSQL Row Level Security, Zero-Knowledge AES-256-GCM Vaulting, and live TLS/DNS/IOC telemetry.
          </p>
          <div className="pt-2 flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-amber-400 text-zinc-950 hover:bg-amber-300 transition-colors"
            >
              Launch Command Center
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SECURITY_MODULES.map((mod) => (
            <div
              key={mod.slug}
              className="rounded-xl bg-[#0d0f14]/95 border border-zinc-800/90 p-4 space-y-1.5"
            >
              <span className="text-[10px] font-mono font-semibold text-amber-400">
                MODULE {mod.code} • {mod.category}
              </span>
              <h2 className="text-sm font-semibold text-zinc-100">{mod.name}</h2>
              <p className="text-xs text-zinc-400 line-clamp-2">{mod.summary}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
