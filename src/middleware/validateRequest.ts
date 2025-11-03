import { NextFunction, Request, Response } from "express";
import { ZodError, ZodObject, ZodRawShape } from "zod";

/**
 * Middleware to validate request body with Zod schema
 * @param zodSchema Zod schema to validate against
 */
export const validateRequest =
  (zodSchema: ZodObject<ZodRawShape>) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // If body.data exists (sent as JSON string), parse it
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
            ])
          );
        }
      }

      // Prepare validation data - wrap in appropriate structure
      const validationData = {
        body: req.body,
        query: req.query,
        params: req.params,
      };

      // Validate asynchronously
      const validated = await zodSchema.parseAsync(validationData);

      // Update request with validated data
      req.body = validated.body;
      if (validated.query) req.query = validated.query as any;
      if (validated.params) req.params = validated.params as any;

      next();
    } catch (error) {
      next(error);
    }
  };
