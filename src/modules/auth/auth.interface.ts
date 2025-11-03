export interface ILoginResponse {
  user: {
    _id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    organizationId?: string; // DEPRECATED: Use organizationIds
    organizationIds?: string[]; // NEW: Multi-organization support
    mustChangePassword?: boolean; // Force password change flag
  };
  accessToken: string;
  refreshToken: string;
  mustChangePassword?: boolean; // Top-level flag for easy frontend access
}

export interface IRefreshTokenResponse {
  accessToken: string;
}
