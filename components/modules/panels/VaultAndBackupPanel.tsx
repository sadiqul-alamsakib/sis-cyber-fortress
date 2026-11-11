'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { BackupPolicy, ModuleSlug, VaultItemCipher } from '@/types/security';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export default function VaultAndBackupPanel({ slug }: { slug: ModuleSlug }) {
  const isVault = slug === '05-vault-guardian';
  const isRansomware = slug === '06-ransomware-guardian';

  // Vault state
  const [vaultItems, setVaultItems] = useState<VaultItemCipher[]>([]);
  const [passphrase, setPassphrase] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'credential' | 'secure_note' | 'recovery_key' | 'document'>('secure_note');
  const [secretPlaintext, setSecretPlaintext] = useState('');
  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});
  const [vaultError, setVaultError] = useState<string | null>(null);

  // Backup / Ransomware state
  const [policies, setPolicies] = useState<BackupPolicy[]>([]);
  const [policyName, setPolicyName] = useState('');
  const [cronExpr, setCronExpr] = useState('0 2 * * *');
  const [retentionDays, setRetentionDays] = useState(30);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    if (isVault) {
      const res = await fetch('/api/modules/vault');
      if (res.ok) {
        const j = (await res.json()) as { items?: VaultItemCipher[] };
        setVaultItems(j.items ?? []);
      }
    } else {
      const res = await fetch('/api/modules/backups');
      if (res.ok) {
        const j = (await res.json()) as { policies?: BackupPolicy[] };
        setPolicies(j.policies ?? []);
      }
    }
  }, [isVault]);

  useEffect(() => {
    let active = true;
    if (isVault) {
      fetch('/api/modules/vault')
        .then((r) => (r.ok ? (r.json() as Promise<{ items?: VaultItemCipher[] }>) : null))
        .then((j) => {
          if (active && j) setVaultItems(j.items ?? []);
        });
    } else {
      fetch('/api/modules/backups')
        .then((r) => (r.ok ? (r.json() as Promise<{ policies?: BackupPolicy[] }>) : null))
        .then((j) => {
          if (active && j) setPolicies(j.policies ?? []);
        });
    }
    return () => {
      active = false;
    };
  }, [isVault]);

  const handleSaveVaultItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultError(null);
    if (!passphrase || !title.trim() || !secretPlaintext) {
      setVaultError('Title, secret content, and your local Vault Passphrase are required.');
      return;
    }

    setBusy(true);
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveAesKey(passphrase, salt);
      const encryptedBuf = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(secretPlaintext)
      );

      const res = await fetch('/api/modules/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          ciphertext: toBase64(new Uint8Array(encryptedBuf)),
          iv: toBase64(iv),
          salt: toBase64(salt),
        }),
      });
      if (res.ok) {
        setTitle('');
        setSecretPlaintext('');
        await loadData();
      } else {
        const j = (await res.json()) as { error?: string };
        setVaultError(j.error ?? 'Failed to save encrypted vault item.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDecryptItem = async (item: VaultItemCipher) => {
    setVaultError(null);
    if (!passphrase) {
      setVaultError('Enter your local Vault Passphrase above to decrypt in-browser.');
      return;
    }
    try {
      const key = await deriveAesKey(passphrase, fromBase64(item.salt));
      const iv = fromBase64(item.iv);
      const cipher = fromBase64(item.ciphertext);
      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        key,
        cipher.buffer as ArrayBuffer
      );
      setDecryptedMap((prev) => ({
        ...prev,
        [item.id]: new TextDecoder().decode(plainBuf),
      }));
    } catch {
      setVaultError('Decryption failed: incorrect Vault Passphrase for this item.');
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/modules/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy_name: policyName.trim(),
          schedule_cron: cronExpr.trim(),
          retention_days: retentionDays,
        }),
      });
      if (res.ok) {
        setPolicyName('');
        await loadData();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyBackup = async (id: string) => {
    setBusy(true);
    try {
      await fetch('/api/modules/backups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action: isRansomware ? 'simulate_restore_drill' : 'verify_integrity',
        }),
      });
      await loadData();
    } finally {
      setBusy(false);
    }
  };

  if (isVault) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl bg-[#0d0f14] border border-amber-500/30 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Zero-Knowledge Client-Side Encrypted Vault (AES-256-GCM)
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Encryption &amp; decryption happen strictly in your browser via Web Crypto API. Only ciphertext, IV, and salt are stored in PostgreSQL — Super Admin cannot read plaintext.
            </p>
          </div>

          {vaultError && (
            <p className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/35 text-xs text-rose-300">
              {vaultError}
            </p>
          )}

          <form onSubmit={handleSaveVaultItem} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Local Vault Passphrase (never leaves browser)"
                className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-amber-500/30 text-zinc-100"
              />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Item Title (e.g., Root Recovery Note)"
                className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
              />
              <select
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value as 'credential' | 'secure_note' | 'recovery_key' | 'document'
                  )
                }
                className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
              >
                <option value="secure_note">Secure Note</option>
                <option value="credential">Credential</option>
                <option value="recovery_key">Recovery Key</option>
                <option value="document">Encrypted Document</option>
              </select>
            </div>
            <textarea
              rows={3}
              value={secretPlaintext}
              onChange={(e) => setSecretPlaintext(e.target.value)}
              placeholder="Secret plaintext (encrypted with AES-256-GCM before transmission)..."
              className="w-full px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 cursor-pointer"
            >
              {busy ? 'Encrypting Locally...' : 'Encrypt & Store in Vault'}
            </button>
          </form>
        </div>

        <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-100">
              Encrypted Vault Records ({vaultItems.length})
            </h3>
          </div>
          {vaultItems.length === 0 ? (
            <p className="p-6 text-xs text-zinc-500">
              Your encrypted vault is empty. Create a client-encrypted secret above.
            </p>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {vaultItems.map((item) => (
                <div key={item.id} className="p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-zinc-100">{item.title}</span>
                      <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-amber-300 border border-zinc-700">
                        {item.category}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDecryptItem(item)}
                      className="px-3 py-1 rounded-md text-[11px] font-medium bg-teal-500/12 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 cursor-pointer"
                    >
                      Decrypt Locally
                    </button>
                  </div>
                  <p className="font-mono text-[11px] text-zinc-500 truncate">
                    Ciphertext: {item.ciphertext}
                  </p>
                  {decryptedMap[item.id] !== undefined && (
                    <div className="p-2.5 rounded-lg bg-[#07080b] border border-teal-500/30 font-mono text-teal-300 whitespace-pre-wrap">
                      {decryptedMap[item.id]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isRansomware && (
        <div className="rounded-xl bg-[#0d0f14] border border-amber-500/25 p-5 space-y-2">
          <h3 className="text-sm font-semibold text-amber-300">
            Ransomware Readiness &amp; Safe Recovery Protocol
          </h3>
          <p className="text-xs text-zinc-400">
            Verify offline/immutable encrypted backup snapshots and run non-destructive recovery drills. Live ransomware execution is strictly prohibited.
          </p>
        </div>
      )}

      <form
        onSubmit={handleCreatePolicy}
        className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold text-zinc-100">
          Create Encrypted Cloud Backup Policy
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={policyName}
            onChange={(e) => setPolicyName(e.target.value)}
            placeholder="Policy Name (e.g., SOC Audit Vault Backup)"
            className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
          />
          <input
            type="text"
            value={cronExpr}
            onChange={(e) => setCronExpr(e.target.value)}
            placeholder="Cron Schedule (0 2 * * *)"
            className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100 font-mono"
          />
          <input
            type="number"
            min={7}
            max={365}
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !policyName.trim()}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 cursor-pointer"
        >
          {busy ? 'Saving...' : 'Create Encrypted Backup Policy'}
        </button>
      </form>

      <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-100">
            Backup Policies &amp; Integrity Status ({policies.length})
          </h3>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {policies.map((p) => (
            <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold text-zinc-100">{p.policy_name}</p>
                <p className="font-mono text-[11px] text-zinc-400">
                  Cron: {p.schedule_cron} • Retention: {p.retention_days}d • {p.encryption_standard} • Integrity:{' '}
                  {p.integrity_verified ? 'Verified' : 'Pending'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleVerifyBackup(p.id)}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-teal-500/12 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 cursor-pointer"
              >
                {isRansomware ? 'Run Safe Recovery Drill' : 'Verify Snapshot Integrity'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
