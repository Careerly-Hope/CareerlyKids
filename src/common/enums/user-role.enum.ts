/**
 * Centralized User Role Management
 * This mirrors the Prisma UserRole enum but as a TypeScript enum for runtime access
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  STUDENT = 'STUDENT',
  GUEST = 'GUEST',
}

/**
 * Role groups for common access patterns
 */
export const RoleGroups = {
  // Roles allowed during self-registration
  SELF_REGISTRATION: [UserRole.STUDENT, UserRole.ADMIN] as const,

  // All authenticated users
  ALL_AUTHENTICATED: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STUDENT] as const,

  // Admin-level roles
  ADMIN_ROLES: [UserRole.SUPER_ADMIN, UserRole.ADMIN] as const,

  // User + Guest
  USER_AND_GUEST: [UserRole.STUDENT, UserRole.GUEST] as const,
} as const;

/**
 * Type for self-registration roles only
 */
export type SelfRegistrationRole = (typeof RoleGroups.SELF_REGISTRATION)[number];

/**
 * Helper to check if a role is valid for self-registration
 * FIXED: Proper type narrowing
 */
export function isValidRegistrationRole(role: string): role is SelfRegistrationRole {
  return (RoleGroups.SELF_REGISTRATION as readonly string[]).includes(role);
}

/**
 * Helper to validate role string against UserRole enum
 */
export function isValidUserRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole);
}
