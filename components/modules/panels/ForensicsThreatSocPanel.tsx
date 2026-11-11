'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type {
  ForensicsCase,
  ForensicsEvidence,
  ModuleSlug,
  SocIncident,
  ThreatIOC,
} from '@/types/security';

export default function ForensicsThreatSocPanel({ slug }: { slug: ModuleSlug }) {
  const isForensics = slug === '08-digital-forensics';
  const isThreatIntel = slug === '10-threat-intelligence';

  const [cases, setCases] = useState<ForensicsCase[]>([]);
  const [evidence, setEvidence] = useState<ForensicsEvidence[]>([]);
  const [iocs, setIocs] = useState<ThreatIOC[]>([]);
  const [incidents, setIncidents] = useState<SocIncident[]>([]);
  const [busy, setBusy] = useState(false);

  // Forensics inputs
  const [caseTitle, setCaseTitle] = useState('');
  const [caseSummary, setCaseSummary] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [evidenceLabel, setEvidenceLabel] = useState('');
  const [custodyNote, setCustodyNote] = useState('');

  // IOC inputs
  const [iocType, setIocType] = useState<'domain' | 'url' | 'ip' | 'hash'>('domain');
  const [indicator, setIndicator] = useState('');
  const [iocSeverity, setIocSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high');

  // SOC incident inputs
  const [incTitle, setIncTitle] = useState('');
  const [incDesc, setIncDesc] = useState('');
  const [incSeverity, setIncSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high');

  const loadData = useCallback(async () => {
    if (isForensics) {
      const res = await fetch('/api/modules/forensics');
      if (res.ok) {
        const j = (await res.json()) as {
          cases?: ForensicsCase[];
          evidence?: ForensicsEvidence[];
        };
        const c = j.cases ?? [];
        setCases(c);
        setEvidence(j.evidence ?? []);
        if (c.length > 0 && !selectedCaseId) {
          setSelectedCaseId(c[0].id);
        }
      }
    } else if (isThreatIntel) {
      const res = await fetch('/api/modules/threat-intel');
      if (res.ok) {
        const j = (await res.json()) as { iocs?: ThreatIOC[] };
        setIocs(j.iocs ?? []);
      }
    } else {
      const res = await fetch('/api/incidents');
      if (res.ok) {
        const j = (await res.json()) as { incidents?: SocIncident[] };
        setIncidents(j.incidents ?? []);
      }
    }
  }, [isForensics, isThreatIntel, selectedCaseId]);

  useEffect(() => {
    let active = true;
    if (isForensics) {
      fetch('/api/modules/forensics')
        .then((res) =>
          res.ok
            ? (res.json() as Promise<{ cases?: ForensicsCase[]; evidence?: ForensicsEvidence[] }>)
            : null
        )
        .then((j) => {
          if (!active || !j) return;
          const c = j.cases ?? [];
          setCases(c);
          setEvidence(j.evidence ?? []);
          if (c.length > 0) {
            setSelectedCaseId((prev) => prev || c[0].id);
          }
        });
    } else if (isThreatIntel) {
      fetch('/api/modules/threat-intel')
        .then((res) => (res.ok ? (res.json() as Promise<{ iocs?: ThreatIOC[] }>) : null))
        .then((j) => {
          if (active && j) setIocs(j.iocs ?? []);
        });
    } else {
      fetch('/api/incidents')
        .then((res) => (res.ok ? (res.json() as Promise<{ incidents?: SocIncident[] }>) : null))
        .then((j) => {
          if (active && j) setIncidents(j.incidents ?? []);
        });
    }
    return () => {
      active = false;
    };
  }, [isForensics, isThreatIntel]);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseTitle.trim() || !caseSummary.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/modules/forensics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'case',
          title: caseTitle.trim(),
          summary: caseSummary.trim(),
          severity: 'high',
        }),
      });
      if (res.ok) {
        setCaseTitle('');
        setCaseSummary('');
        await loadData();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !evidenceLabel.trim() || !custodyNote.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/modules/forensics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'evidence',
          case_id: selectedCaseId,
          evidence_label: evidenceLabel.trim(),
          artifact_type: 'log_bundle',
          custody_note: custodyNote.trim(),
        }),
      });
      if (res.ok) {
        setEvidenceLabel('');
        setCustodyNote('');
        await loadData();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleExportForensicsJson = () => {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), cases, evidence }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sis-forensics-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddIoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!indicator.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/modules/threat-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ioc_type: iocType,
          indicator: indicator.trim(),
          severity: iocSeverity,
        }),
      });
      if (res.ok) {
        setIndicator('');
        await loadData();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incTitle.trim() || !incDesc.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: incTitle.trim(),
          description: incDesc.trim(),
          severity: incSeverity,
          module_source: '12-cyber-soc',
        }),
      });
      if (res.ok) {
        setIncTitle('');
        setIncDesc('');
        await loadData();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateIncidentStatus = async (id: string, status: string) => {
    await fetch('/api/incidents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await loadData();
  };

  if (isForensics) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleCreateCase}
            className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-3"
          >
            <h3 className="text-sm font-semibold text-zinc-100">Create Forensics Case</h3>
            <input
              type="text"
              value={caseTitle}
              onChange={(e) => setCaseTitle(e.target.value)}
              placeholder="Case Title"
              className="w-full px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            />
            <textarea
              rows={2}
              value={caseSummary}
              onChange={(e) => setCaseSummary(e.target.value)}
              placeholder="Investigation scope and timeline summary..."
              className="w-full px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 cursor-pointer"
            >
              Open Case
            </button>
          </form>

          <form
            onSubmit={handleAddEvidence}
            className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">
                Log Chain-of-Custody Evidence (SHA-256)
              </h3>
              <button
                type="button"
                onClick={handleExportForensicsJson}
                className="text-[11px] font-mono text-amber-300 hover:text-amber-200 cursor-pointer"
              >
                Export JSON Report ↓
              </button>
            </div>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_code} — {c.title}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={evidenceLabel}
              onChange={(e) => setEvidenceLabel(e.target.value)}
              placeholder="Artifact Label (e.g., nginx-access.log)"
              className="w-full px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            />
            <input
              type="text"
              value={custodyNote}
              onChange={(e) => setCustodyNote(e.target.value)}
              placeholder="Custody Note"
              className="w-full px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            />
            <button
              type="submit"
              disabled={busy || !selectedCaseId}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30 cursor-pointer"
            >
              Acquire &amp; Hash Evidence
            </button>
          </form>
        </div>

        <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-100">
              Evidence Chain-of-Custody Log ({evidence.length})
            </h3>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {evidence.map((ev) => (
              <div key={ev.id} className="p-4 text-xs space-y-1">
                <p className="font-semibold text-zinc-100">{ev.evidence_label}</p>
                <p className="text-zinc-400">{ev.custody_note}</p>
                <p className="font-mono text-[11px] text-amber-300 break-all">
                  SHA-256: {ev.sha256_checksum}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isThreatIntel) {
    return (
      <div className="space-y-6">
        <form
          onSubmit={handleAddIoc}
          className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-zinc-100">
            Add Indicator of Compromise (IOC)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={iocType}
              onChange={(e) => setIocType(e.target.value as 'domain' | 'url' | 'ip' | 'hash')}
              className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            >
              <option value="domain">Domain</option>
              <option value="url">URL</option>
              <option value="ip">IP Address</option>
              <option value="hash">SHA-256 Hash</option>
            </select>
            <input
              type="text"
              value={indicator}
              onChange={(e) => setIndicator(e.target.value)}
              placeholder="malicious-example.xyz or 203.0.113.10"
              className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            />
            <select
              value={iocSeverity}
              onChange={(e) =>
                setIocSeverity(e.target.value as 'low' | 'medium' | 'high' | 'critical')
              }
              className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={busy || !indicator.trim()}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 cursor-pointer"
          >
            Publish IOC to Threat Feed
          </button>
        </form>

        <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-100">Active IOC Repository ({iocs.length})</h3>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {iocs.map((ioc) => (
              <div key={ioc.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-900 text-amber-300 border border-zinc-700 mr-2">
                    {ioc.ioc_type}
                  </span>
                  <span className="font-mono text-zinc-100">{ioc.indicator}</span>
                  <p className="text-[11px] text-zinc-500 mt-1">Feed: {ioc.source_feed}</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase bg-rose-500/12 text-rose-400 border border-rose-500/35">
                  {ioc.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreateIncident}
        className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-3"
      >
        <h3 className="text-sm font-semibold text-zinc-100">Create Cyber SOC Incident</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={incTitle}
            onChange={(e) => setIncTitle(e.target.value)}
            placeholder="Incident Title"
            className="sm:col-span-2 px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
          />
          <select
            value={incSeverity}
            onChange={(e) =>
              setIncSeverity(e.target.value as 'low' | 'medium' | 'high' | 'critical')
            }
            className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <textarea
          rows={2}
          value={incDesc}
          onChange={(e) => setIncDesc(e.target.value)}
          placeholder="Incident description & affected module..."
          className="w-full px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
        />
        <button
          type="submit"
          disabled={busy || !incTitle.trim() || !incDesc.trim()}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 cursor-pointer"
        >
          Escalate SOC Incident
        </button>
      </form>

      <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-100">SOC Incident Queue ({incidents.length})</h3>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {incidents.map((inc) => (
            <div key={inc.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold text-zinc-100">{inc.title}</p>
                <p className="text-zinc-400 mt-0.5">{inc.description}</p>
              </div>
              <select
                value={inc.status}
                onChange={(e) => void handleUpdateIncidentStatus(inc.id, e.target.value)}
                className="px-2.5 py-1 rounded-lg text-xs font-mono bg-[#07080b] border border-zinc-700 text-amber-300"
              >
                <option value="open">open</option>
                <option value="investigating">investigating</option>
                <option value="contained">contained</option>
                <option value="resolved">resolved</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
