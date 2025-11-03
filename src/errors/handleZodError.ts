import type { ZodError } from "zod";
import type { TErrorSources, TGenericErrorResponse } from "../interface/error";

/**
 * Converts a Zod validation error into a standard error response
 * @param err ZodError instance
 * @returns TGenericErrorResponse
 */
const handleZodError = (err: ZodError): TGenericErrorResponse => {
	const errorSources: TErrorSources = err.issues.map((issue) => ({
		path: (issue.path[issue.path.length - 1] as string | number) ?? "unknown",
		message: issue.message,
	}));

	return {
		statusCode: 400,
		message: "Validation Error",
		errorSources,
	};
};

export default handleZodError;
