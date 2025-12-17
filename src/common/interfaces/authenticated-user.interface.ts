import { User as ClerkUser } from '@clerk/backend';

/**
 * Extended user object that combines Clerk authentication data
 * with database user information.
 * 
 * This is attached to req.user after successful authentication.
 */
export interface AuthenticatedUser extends ClerkUser {
  /**
   * Database user data - use dbUser.id for foreign keys in your services
   */
  dbUser: {
    id: string;           // UUID from database - USE THIS for foreign keys
    clerkId: string;      // Matches ClerkUser.id
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;         // SUPER_ADMIN, ADMIN, STUDENT, GUEST
    status: string;       // ACTIVE, INACTIVE, SUSPENDED
    imageUrl: string | null;
    phoneNumber: string | null;
    dateOfBirth: Date | null;
    grade: string | null;
    school: string | null;
    bio: string | null;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
  };
}