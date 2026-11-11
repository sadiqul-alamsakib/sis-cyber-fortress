'use client';

import React, { useState } from 'react';
import { getRoleLabel, isSuperAdmin } from '@/lib/auth/roles';
import type { UserProfile, UserRole } from '@/types/security';

const ROLE_OPTIONS: UserRole[] = [
  'super_admin',
  'security_admin',
  'module_admin',
  'auditor',
  'viewer',
];

export default function UsersClient({
  currentProfile,
  initialUsers,
}: {
  currentProfile: UserProfile;
  initialUsers: UserProfile[];
}) {
  const [users, setUsers] = useState<UserProfile[]>(initialUsers);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canAssignRoles = isSuperAdmin(currentProfile.role);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setMessage(null);
    setUpdatingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const j = (await res.json()) as { user?: UserProfile; error?: string };
      if (!res.ok || !j.user) {
        setMessage(j.error ?? 'Failed to update role.');
      } else {
        setUsers((prev) => prev.map((u) => (u.id === userId ? j.user! : u)));
        setMessage(`Updated ${j.user.email} to ${getRoleLabel(j.user.role)}.`);
      }
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Enterprise Role-Based Access Control (RBAC)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Supports Super Admin, Security Admin, Module Admin, Auditor, and Viewer tiers enforced via PostgreSQL RLS.
          </p>
        </div>
        <span className="px-3 py-1 rounded-lg text-xs font-mono bg-amber-500/12 text-amber-300 border border-amber-500/30">
          Your Role: {getRoleLabel(currentProfile.role)}
        </span>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
          {message}
        </div>
      )}

      <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#090b0f] border-b border-zinc-800 text-[11px] font-mono uppercase text-zinc-400">
              <tr>
                <th className="py-3 px-5">Operator</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Current Role</th>
                <th className="py-3 px-5 text-right">Assign Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-800/30">
                  <td className="py-3.5 px-5 font-medium text-zinc-100">
                    {u.full_name || 'Operator'}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-zinc-300">{u.email}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/12 text-amber-300 border border-amber-500/25">
                      {getRoleLabel(u.role)}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    {canAssignRoles ? (
                      <select
                        value={u.role}
                        disabled={updatingId === u.id || u.id === currentProfile.id}
                        onChange={(e) => void handleRoleChange(u.id, e.target.value as UserRole)}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono bg-[#07080b] border border-zinc-700 text-zinc-200 disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {getRoleLabel(r)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[11px] text-zinc-500">Super Admin Only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
