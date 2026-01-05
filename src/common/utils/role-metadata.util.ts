import { UserRole, isValidUserRole } from '../enums/user-role.enum';

/**
 * Extract role from Clerk metadata with priority:
 * 1. privateMetadata.role (set by admins, more secure)
 * 2. publicMetadata.role (set by user/system)
 * 3. Default to STUDENT
 */
export function extractRoleFromMetadata(
  publicMetadata: Record<string, any>,
  privateMetadata: Record<string, any>,
): UserRole {
  // Priority 1: Private metadata (admin-set, more secure)
  const privateRole = privateMetadata?.role;
  if (privateRole && isValidUserRole(privateRole)) {
    return privateRole as UserRole;
  }

  // Priority 2: Public metadata
  const publicRole = publicMetadata?.role;
  if (publicRole && isValidUserRole(publicRole)) {
    return publicRole as UserRole;
  }

  // Default
  return UserRole.STUDENT;
}