export interface ILoginResponse {
  user: {
    _id: string;
    email: string;
    name: string;
    role: string;
    avatar?: string;
    bio?: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface IRefreshTokenResponse {
  accessToken: string;
}

export interface ITokenPayload {
  userId: string;
  email: string;
  role: "Admin" | "Moderator" | "Member";
}
