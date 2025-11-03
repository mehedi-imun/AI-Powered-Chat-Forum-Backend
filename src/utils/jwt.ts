import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import env from "../config/env";

export interface TokenPayload {
	userId: string;
	email: string;
	role: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
	return jwt.sign(payload, env.JWT_SECRET, {
		expiresIn: env.JWT_EXPIRES_IN,
	} as SignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
	return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
		expiresIn: env.JWT_REFRESH_EXPIRES_IN,
	} as SignOptions);
};

export const verifyAccessToken = (token: string): TokenPayload => {
	try {
		return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
	} catch (_error) {
		throw new Error("Invalid or expired access token");
	}
};

export const verifyRefreshToken = (token: string): TokenPayload => {
	try {
		return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
	} catch (_error) {
		throw new Error("Invalid or expired refresh token");
	}
};

export const generatePasswordResetToken = (): string => {
	return crypto.randomBytes(32).toString("hex");
};

export const hashResetToken = (token: string): string => {
	return crypto.createHash("sha256").update(token).digest("hex");
};
