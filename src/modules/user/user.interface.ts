export interface IUser {
  _id?: string;
  organizationId?: string; // DEPRECATED: Use organizationIds instead. Kept for backward compatibility
  organizationIds?: string[]; // NEW: Support multiple organizations per user
  email: string;
  password: string;
  name: string;

  // NEW: Simplified Single Role Field
  // 5 clear roles that cover all use cases
  role: "SuperAdmin" | "Admin" | "OrgOwner" | "OrgAdmin" | "OrgMember";

  // Team Management (for managers)
  managedTeamIds?: string[]; // Array of team IDs this user manages

  // Status
  isActive: boolean;
  status: "active" | "suspended" | "inactive" | "pending"; // Real field with default "pending"

  // First Login & Password Management
  mustChangePassword?: boolean; // Force password change on first login
  firstLogin?: Date; // Track first login timestamp
  invitedBy?: string; // User ID who invited this user
  invitedAt?: Date; // When they were invited

  // Email Verification
  emailVerified?: boolean; // Whether email is verified
  emailVerificationToken?: string; // Token for email verification
  emailVerificationExpires?: Date; // Expiry time for verification token

  // Password Reset
  passwordResetToken?: string;
  passwordResetExpires?: Date;

  // Account Setup (for invited users)
  setupToken?: string;
  setupTokenExpires?: Date;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date; // Track last login time
}

export type IUserWithoutPassword = Omit<IUser, "password">;

export interface IUserLogin {
  email: string;
  password: string;
}

export interface IUserCreate {
  email: string;
  password: string;
  name: string;
  role: "SuperAdmin" | "Admin" | "OrgOwner" | "OrgAdmin" | "OrgMember";
  organizationId?: string; // Optional for Platform Admins
}

export interface IUserUpdate {
  name?: string;
  role?: "SuperAdmin" | "Admin" | "OrgOwner" | "OrgAdmin" | "OrgMember";
  isActive?: boolean;
  managedTeamIds?: string[];
}
