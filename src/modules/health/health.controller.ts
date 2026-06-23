import type { Request, Response } from "express";

export const HealthController = {
	check: (_req: Request, res: Response): void => {
		res.status(200).json({
			success: true,
			message: "Server is healthy",
			timestamp: new Date().toISOString(),
			version: "1.0.0",
			uptime: process.uptime(),
			data: "Server is running smoothly",
		});
	},
};
