import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Access Control Decorators
 *
 * 🔴 @SuperAdminOnly() - Super Admin Only
 * 🔵 @AdminOnly() - Admin Only (Bulk purchasers)
 * 🟢 @RegisteredUserOnly() - Registered User Only
 * 🟣 @UserAndGuest() - User + Guest (Authenticated users)
 * 🟡 @AllAuthenticated() - User + Admin (All authenticated)
 * 🟠 @GuestOnly() - Guest Only (No registration)
 */
export const SuperAdminOnly = () => Roles(UserRole.SUPER_ADMIN);
export const AdminOnly = () => Roles(UserRole.ADMIN);
export const RegisteredUserOnly = () => Roles(UserRole.STUDENT);
export const UserAndGuest = () => Roles(UserRole.STUDENT, UserRole.GUEST);
export const AllAuthenticated = () => Roles(UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN);
export const GuestOnly = () => Roles(UserRole.GUEST);
