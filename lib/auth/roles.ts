import type { UserRole } from '@/types/security';

export const VALID_ROLES: readonly UserRole[] = [
  'super_admin',
  'security_admin',
  'module_admin',
  'auditor',
  'admin',
  'analyst',
  'viewer',
];

export function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && VALID_ROLES.includes(role as UserRole);
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === 'super_admin' || role === 'admin';
}

export function canManageSecurityOps(role: UserRole): boolean {
  return (
    role === 'super_admin' ||
    role === 'security_admin' ||
    role === 'module_admin' ||
    role === 'admin' ||
    role === 'analyst'
  );
}

export function isReadOnlyRole(role: UserRole): boolean {
  return role === 'auditor' || role === 'viewer';
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'security_admin':
      return 'Security Admin';
    case 'module_admin':
      return 'Module Admin';
    case 'auditor':
      return 'Auditor';
    case 'admin':
      return 'Admin';
    case 'analyst':
      return 'Analyst';
    default:
      return 'Viewer';
  }
}
