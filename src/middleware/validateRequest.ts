import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodObject, type ZodRawShape } from "zod";

export const validateRequest =
	(zodSchema: ZodObject<ZodRawShape>) =>
	async (req: Request, _res: Response, next: NextFunction) => {
		try {
			if (req.body?.data) {
				try {
					req.body = JSON.parse(req.body.data);
				} catch {
					return next(
						new ZodError([
							{
								path: ["data"],
								message: "Invalid JSON string",
								code: "custom" as any,
							},
						]),
					);
				}
			}

			const validationData = {
				body: req.body,
				query: req.query,
				params: req.params,
			};

			const validated = await zodSchema.parseAsync(validationData);

			req.body = validated.body;
			if (validated.params) req.params = validated.params as any;

			next();
		} catch (error) {
			next(error);
		}
	};
