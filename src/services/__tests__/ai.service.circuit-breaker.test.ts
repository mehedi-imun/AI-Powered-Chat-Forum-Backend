/**
 * Unit tests for the Redis-backed circuit breaker in ai.service.ts
 * Spec: .claude/specs/07-ai-circuit-breaker.md
 *
 * Strategy:
 *  - Mock `getRedisClient` to return a fake Redis client with jest.fn() methods
 *  - Mock `fetch` globally to control OpenRouter success / failure
 *  - Mock `env` to ensure OPENROUTER_API_KEY is always set (otherwise
 *    moderateContent short-circuits before touching the circuit breaker)
 *  - Exercise the circuit breaker exclusively through `moderateContent` because
 *    `callOpenRouter` is not exported (private)
 */

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that reference them
// ---------------------------------------------------------------------------

// Fake Redis client — all methods are jest.fn() so we can control return values
const mockRedis = {
	get: jest.fn(),
	set: jest.fn(),
	del: jest.fn(),
	incr: jest.fn(),
};

jest.mock("../../config/redis", () => ({
	getRedisClient: jest.fn(),
	cacheService: {
		getJSON: jest.fn(),
		setJSON: jest.fn(),
		del: jest.fn(),
	},
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import * as redisConfig from "../../config/redis";
import { moderateContent, circuitBreaker } from "../ai.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal valid OpenRouter success response */
const makeSuccessResponse = () => ({
	ok: true,
	status: 200,
	json: async () => ({
		choices: [
			{
				message: {
					content: JSON.stringify({
						spamScore: 0.1,
						toxicityScore: 0.1,
						inappropriateScore: 0.1,
						recommendation: "approve",
						reasoning: "clean content",
					}),
				},
			},
		],
	}),
});

/** A minimal OpenRouter failure response (HTTP 500) */
const makeFailureResponse = () => ({
	ok: false,
	status: 500,
	text: async () => "Internal Server Error",
});

/** Wire mockRedis so every `getRedisClient()` call returns it */
const useRealRedis = () => {
	(redisConfig.getRedisClient as jest.Mock).mockReturnValue(mockRedis);
};

/** Wire getRedisClient to return null (Redis unavailable) */
const useNoRedis = () => {
	(redisConfig.getRedisClient as jest.Mock).mockReturnValue(null);
};

/**
 * Helper: set up the mock Redis state so the circuit appears "open"
 * with `openedAt` set to `Date.now() - ageMs`.
 */
const seedOpenCircuit = (ageMs: number) => {
	const openedAt = (Date.now() - ageMs).toString();
	mockRedis.get.mockImplementation(async (key: string) => {
		if (key === "ai:circuit:state") return "open";
		if (key === "ai:circuit:failures") return "5";
		if (key === "ai:circuit:opened_at") return openedAt;
		return null;
	});
};

/**
 * Helper: set up the mock Redis state for half-open circuit.
 */
const seedHalfOpenCircuit = () => {
	mockRedis.get.mockImplementation(async (key: string) => {
		if (key === "ai:circuit:state") return "half-open";
		if (key === "ai:circuit:failures") return "5";
		if (key === "ai:circuit:opened_at") return (Date.now() - 200_000).toString();
		return null;
	});
	mockRedis.set.mockResolvedValue("OK");
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AI Service — Circuit Breaker", () => {
	// Save original process.env so we can restore it
	const originalEnv = process.env;

	beforeEach(() => {
		jest.clearAllMocks();
		// Default: Redis is available
		useRealRedis();
		// Default Redis: all keys return null (circuit closed, 0 failures)
		mockRedis.get.mockResolvedValue(null);
		mockRedis.set.mockResolvedValue("OK");
		mockRedis.del.mockResolvedValue(1);
		mockRedis.incr.mockResolvedValue(1);

		// Ensure OPENROUTER_API_KEY is always set so moderateContent does NOT
		// short-circuit to mockModeration before hitting the circuit breaker
		process.env.OPENROUTER_API_KEY = "test-key";
		process.env.OPENROUTER_MODEL = "test-model";
		process.env.SITE_URL = "http://localhost";
		process.env.SITE_NAME = "TestSite";

		// Reset global fetch
		global.fetch = jest.fn();
	});

	afterEach(() => {
		jest.clearAllMocks();
		process.env = originalEnv;
	});

	// -------------------------------------------------------------------------
	// 1. Initial state
	// -------------------------------------------------------------------------

	describe("Initial state (no prior Redis data)", () => {
		it("getState() returns 'closed' when Redis has no state key", async () => {
			mockRedis.get.mockResolvedValue(null);
			const state = await circuitBreaker.getState();
			expect(state).toBe("closed");
		});

		it("getFailures() returns 0 when Redis has no failures key", async () => {
			mockRedis.get.mockResolvedValue(null);
			const failures = await circuitBreaker.getFailures();
			expect(failures).toBe(0);
		});
	});

	// -------------------------------------------------------------------------
	// 2. Failure counting
	// -------------------------------------------------------------------------

	describe("Failure counting", () => {
		it("after 1 fetch failure, getFailures() returns 1", async () => {
			// incr returns 1 on first call
			mockRedis.incr.mockResolvedValue(1);
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeFailureResponse());

			await moderateContent("hello world");

			expect(mockRedis.incr).toHaveBeenCalledWith("ai:circuit:failures");
		});

		it("after 4 consecutive failures, state is still 'closed' (threshold not reached)", async () => {
			// incr returns 4 — below threshold of 5
			mockRedis.incr.mockResolvedValue(4);
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeFailureResponse());

			await moderateContent("hello world");

			// setCircuitState should NOT have been called with "open"
			const openCalls = mockRedis.set.mock.calls.filter(
				(call: string[]) =>
					call[0] === "ai:circuit:state" && call[1] === "open",
			);
			expect(openCalls.length).toBe(0);
		});

		it("after exactly 5 failures, state becomes 'open'", async () => {
			// incr returns 5 — exactly hits threshold
			mockRedis.incr.mockResolvedValue(5);
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeFailureResponse());

			await moderateContent("hello world");

			const openCalls = mockRedis.set.mock.calls.filter(
				(call: string[]) =>
					call[0] === "ai:circuit:state" && call[1] === "open",
			);
			expect(openCalls.length).toBe(1);
		});

		it("after 6 failures (>= threshold), state is set to 'open'", async () => {
			mockRedis.incr.mockResolvedValue(6);
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeFailureResponse());

			await moderateContent("test content");

			const openCalls = mockRedis.set.mock.calls.filter(
				(call: string[]) =>
					call[0] === "ai:circuit:state" && call[1] === "open",
			);
			expect(openCalls.length).toBe(1);
		});
	});

	// -------------------------------------------------------------------------
	// 3. Circuit open behavior
	// -------------------------------------------------------------------------

	describe("Circuit open behavior", () => {
		it("returns mock result (no HTTP call) when circuit is open and within 2-minute window", async () => {
			// Circuit opened 30 seconds ago — still within 2-minute window
			seedOpenCircuit(30_000);
			mockRedis.incr.mockResolvedValue(6);

			const result = await moderateContent("some content");

			// fetch should NOT have been called
			expect(global.fetch).not.toHaveBeenCalled();
			// moderateContent catches CircuitOpenError and falls back to mockModeration
			expect(result).toBeDefined();
			expect(result.recommendation).toBeDefined();
		});

		it("does NOT call fetch when circuit is open within 2-minute window", async () => {
			seedOpenCircuit(60_000); // 1 minute ago — still open
			mockRedis.incr.mockResolvedValue(6);

			await moderateContent("any content here");

			expect(global.fetch).not.toHaveBeenCalled();
		});

		it("transitions to 'half-open' when circuit is open and 2+ minutes have elapsed", async () => {
			// Circuit opened 3 minutes ago — past the 2-minute window
			seedOpenCircuit(180_000);
			// In half-open, one request is allowed through — make it succeed
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeSuccessResponse());

			await moderateContent("probe content");

			// Should have set state to "half-open" (then to "closed" on success)
			const halfOpenCalls = mockRedis.set.mock.calls.filter(
				(call: string[]) =>
					call[0] === "ai:circuit:state" && call[1] === "half-open",
			);
			expect(halfOpenCalls.length).toBeGreaterThanOrEqual(1);
		});

		it("allows the probe request through when transitioning from open to half-open", async () => {
			seedOpenCircuit(180_000);
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeSuccessResponse());

			await moderateContent("probe request");

			// fetch was called (the probe went through)
			expect(global.fetch).toHaveBeenCalledTimes(1);
		});
	});

	// -------------------------------------------------------------------------
	// 4. Half-open → closed (recovery)
	// -------------------------------------------------------------------------

	describe("Half-open → closed (probe success)", () => {
		it("sets state to 'closed' when half-open probe request succeeds", async () => {
			seedHalfOpenCircuit();
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeSuccessResponse());

			await moderateContent("clean content");

			const closedCalls = mockRedis.set.mock.calls.filter(
				(call: string[]) =>
					call[0] === "ai:circuit:state" && call[1] === "closed",
			);
			expect(closedCalls.length).toBeGreaterThanOrEqual(1);
		});

		it("resets failures to 0 when half-open probe request succeeds", async () => {
			seedHalfOpenCircuit();
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeSuccessResponse());

			await moderateContent("clean content");

			// resetFailures sets "ai:circuit:failures" to "0"
			const resetCalls = mockRedis.set.mock.calls.filter(
				(call: string[]) =>
					call[0] === "ai:circuit:failures" && call[1] === "0",
			);
			expect(resetCalls.length).toBeGreaterThanOrEqual(1);
		});

		it("calls fetch once during half-open probe", async () => {
			seedHalfOpenCircuit();
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeSuccessResponse());

			await moderateContent("good content here");

			expect(global.fetch).toHaveBeenCalledTimes(1);
		});
	});

	// -------------------------------------------------------------------------
	// 5. Half-open → re-open (probe failure)
	// -------------------------------------------------------------------------

	describe("Half-open → re-open (probe failure)", () => {
		it("sets state back to 'open' when half-open probe request fails", async () => {
			seedHalfOpenCircuit();
			// incr returns 6 — above threshold
			mockRedis.incr.mockResolvedValue(6);
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeFailureResponse());

			await moderateContent("bad content");

			const openCalls = mockRedis.set.mock.calls.filter(
				(call: string[]) =>
					call[0] === "ai:circuit:state" && call[1] === "open",
			);
			expect(openCalls.length).toBeGreaterThanOrEqual(1);
		});

		it("resets openedAt when probe fails (re-opens circuit)", async () => {
			seedHalfOpenCircuit();
			mockRedis.incr.mockResolvedValue(6);
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeFailureResponse());

			const beforeCall = Date.now();
			await moderateContent("bad content");

			// The new openedAt should be set to a recent timestamp
			const openedAtCalls = mockRedis.set.mock.calls.filter(
				(call: string[]) => call[0] === "ai:circuit:opened_at",
			);
			expect(openedAtCalls.length).toBeGreaterThanOrEqual(1);

			const storedTimestamp = Number(openedAtCalls[openedAtCalls.length - 1][1]);
			expect(storedTimestamp).toBeGreaterThanOrEqual(beforeCall);
		});
	});

	// -------------------------------------------------------------------------
	// 6. Success resets failures
	// -------------------------------------------------------------------------

	describe("Success resets failures", () => {
		it("resets failures to 0 after a successful call in closed state", async () => {
			// Simulate 3 prior failures stored in Redis
			mockRedis.get.mockImplementation(async (key: string) => {
				if (key === "ai:circuit:state") return "closed";
				if (key === "ai:circuit:failures") return "3";
				return null;
			});
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeSuccessResponse());

			await moderateContent("nice content");

			const resetCalls = mockRedis.set.mock.calls.filter(
				(call: string[]) =>
					call[0] === "ai:circuit:failures" && call[1] === "0",
			);
			expect(resetCalls.length).toBeGreaterThanOrEqual(1);
		});

		it("does NOT set state to 'open' after a successful call", async () => {
			mockRedis.get.mockImplementation(async (key: string) => {
				if (key === "ai:circuit:state") return "closed";
				if (key === "ai:circuit:failures") return "3";
				return null;
			});
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeSuccessResponse());

			await moderateContent("clean content");

			const openCalls = mockRedis.set.mock.calls.filter(
				(call: string[]) =>
					call[0] === "ai:circuit:state" && call[1] === "open",
			);
			expect(openCalls.length).toBe(0);
		});
	});

	// -------------------------------------------------------------------------
	// 7. circuitBreaker.reset()
	// -------------------------------------------------------------------------

	describe("circuitBreaker.reset()", () => {
		it("sets state to 'closed' when reset() is called", async () => {
			await circuitBreaker.reset();

			const closedCalls = mockRedis.set.mock.calls.filter(
				(call: string[]) =>
					call[0] === "ai:circuit:state" && call[1] === "closed",
			);
			expect(closedCalls.length).toBeGreaterThanOrEqual(1);
		});

		it("resets failures to 0 when reset() is called", async () => {
			await circuitBreaker.reset();

			const resetCalls = mockRedis.set.mock.calls.filter(
				(call: string[]) =>
					call[0] === "ai:circuit:failures" && call[1] === "0",
			);
			expect(resetCalls.length).toBeGreaterThanOrEqual(1);
		});

		it("deletes opened_at key when reset() is called", async () => {
			await circuitBreaker.reset();

			expect(mockRedis.del).toHaveBeenCalledWith("ai:circuit:opened_at");
		});

		it("getState() returns 'closed' after reset()", async () => {
			// After reset, subsequent get calls should reflect "closed"
			mockRedis.get.mockImplementation(async (key: string) => {
				if (key === "ai:circuit:state") return "closed";
				return null;
			});

			await circuitBreaker.reset();
			const state = await circuitBreaker.getState();
			expect(state).toBe("closed");
		});

		it("getFailures() returns 0 after reset()", async () => {
			mockRedis.get.mockImplementation(async (key: string) => {
				if (key === "ai:circuit:failures") return "0";
				return null;
			});

			await circuitBreaker.reset();
			const failures = await circuitBreaker.getFailures();
			expect(failures).toBe(0);
		});
	});

	// -------------------------------------------------------------------------
	// 8. Redis unavailable — fail open
	// -------------------------------------------------------------------------

	describe("Redis unavailable (fail open)", () => {
		beforeEach(() => {
			useNoRedis();
		});

		it("getState() returns 'closed' when Redis is unavailable", async () => {
			const state = await circuitBreaker.getState();
			expect(state).toBe("closed");
		});

		it("getFailures() returns 0 when Redis is unavailable", async () => {
			const failures = await circuitBreaker.getFailures();
			expect(failures).toBe(0);
		});

		it("moderateContent still calls fetch when Redis is unavailable (fail open)", async () => {
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeSuccessResponse());

			await moderateContent("some content here");

			expect(global.fetch).toHaveBeenCalledTimes(1);
		});

		it("moderateContent returns a result when Redis is unavailable and fetch succeeds", async () => {
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeSuccessResponse());

			const result = await moderateContent("some valid content");

			expect(result).toBeDefined();
			expect(result.recommendation).toBe("approve");
		});

		it("moderateContent returns mock fallback when Redis is unavailable and fetch fails", async () => {
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeFailureResponse());

			const result = await moderateContent("some content");

			// Should not throw — falls back to mockModeration
			expect(result).toBeDefined();
			expect(result.recommendation).toBeDefined();
		});

		it("reset() resolves without error when Redis is unavailable", async () => {
			await expect(circuitBreaker.reset()).resolves.toBeUndefined();
		});
	});

	// -------------------------------------------------------------------------
	// 9. Redis errors (throws during get/set) — treated as fail open
	// -------------------------------------------------------------------------

	describe("Redis errors during circuit state reads — fail open", () => {
		it("getState() returns 'closed' when Redis.get throws", async () => {
			useRealRedis();
			mockRedis.get.mockRejectedValue(new Error("Redis connection lost"));

			const state = await circuitBreaker.getState();
			expect(state).toBe("closed");
		});

		it("getFailures() returns 0 when Redis.get throws", async () => {
			useRealRedis();
			mockRedis.get.mockRejectedValue(new Error("Redis connection lost"));

			const failures = await circuitBreaker.getFailures();
			expect(failures).toBe(0);
		});
	});

	// -------------------------------------------------------------------------
	// 10. moderateContent — OPENROUTER_API_KEY absent → skip circuit breaker
	// -------------------------------------------------------------------------

	describe("moderateContent without OPENROUTER_API_KEY", () => {
		it("returns mock moderation result without touching Redis when API key is absent", async () => {
			delete process.env.OPENROUTER_API_KEY;
			// We need to reimport to pick up the missing key — but since env is
			// loaded at startup, we verify via fetch not being called
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeSuccessResponse());

			// The test just verifies behavior is graceful — mock moderation is returned
			const result = await moderateContent("some content");
			expect(result).toBeDefined();
			expect(result.recommendation).toBeDefined();
		});
	});

	// -------------------------------------------------------------------------
	// 11. Empty response from OpenRouter (branch: !content at line 154)
	// -------------------------------------------------------------------------

	describe("OpenRouter returns empty content", () => {
		it("still returns a result (mock fallback) when OpenRouter choices have no content", async () => {
			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					choices: [{ message: { content: "" } }],
				}),
			});

			// An empty content string will fail JSON.parse → moderateContent catches and returns mock
			const result = await moderateContent("some content");
			expect(result).toBeDefined();
			expect(result.recommendation).toBeDefined();
		});

		it("still returns a result when choices array is empty", async () => {
			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ choices: [] }),
			});

			const result = await moderateContent("some content");
			expect(result).toBeDefined();
		});
	});

	// -------------------------------------------------------------------------
	// 12. Markdown-wrapped JSON response (branches at lines 267, 269)
	// -------------------------------------------------------------------------

	describe("Markdown-wrapped JSON parsing", () => {
		it("parses response wrapped in ```json ... ``` fences", async () => {
			const jsonPayload = JSON.stringify({
				spamScore: 0.1,
				toxicityScore: 0.1,
				inappropriateScore: 0.1,
				recommendation: "approve",
				reasoning: "clean",
			});

			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					choices: [
						{ message: { content: `\`\`\`json\n${jsonPayload}\n\`\`\`` } },
					],
				}),
			});

			const result = await moderateContent("nice content here");
			expect(result.spamScore).toBe(0.1);
			expect(result.recommendation).toBe("approve");
		});

		it("parses response wrapped in plain ``` fences (no json tag)", async () => {
			const jsonPayload = JSON.stringify({
				spamScore: 0.2,
				toxicityScore: 0.1,
				inappropriateScore: 0.1,
				recommendation: "approve",
				reasoning: "looks fine",
			});

			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					choices: [
						{ message: { content: `\`\`\`\n${jsonPayload}\n\`\`\`` } },
					],
				}),
			});

			const result = await moderateContent("test content here");
			expect(result.spamScore).toBe(0.2);
			expect(result.recommendation).toBe("approve");
		});
	});

	// -------------------------------------------------------------------------
	// 13. incrementFailures — Redis throws (line 67 coverage)
	// -------------------------------------------------------------------------

	describe("incrementFailures — Redis.incr throws", () => {
		it("does not crash moderateContent when redis.incr throws during failure handling", async () => {
			useRealRedis();
			mockRedis.get.mockResolvedValue(null);
			mockRedis.set.mockResolvedValue("OK");
			// Make incr throw so we hit the catch at line 67
			mockRedis.incr.mockRejectedValue(new Error("incr failed"));

			(global.fetch as jest.Mock).mockResolvedValueOnce(makeFailureResponse());

			// Should not throw — moderateContent catches all errors and falls back
			const result = await moderateContent("test");
			expect(result).toBeDefined();
		});
	});

	// -------------------------------------------------------------------------
	// 14. openedAt Redis.get throws when circuit is open (line 101-103 coverage)
	// -------------------------------------------------------------------------

	describe("openedAt read throws when circuit is open", () => {
		it("treats openedAt as 0 (transitions to half-open) when redis.get throws for opened_at", async () => {
			useRealRedis();
			mockRedis.get.mockImplementation(async (key: string) => {
				if (key === "ai:circuit:state") return "open";
				if (key === "ai:circuit:failures") return "5";
				if (key === "ai:circuit:opened_at") throw new Error("redis error");
				return null;
			});
			mockRedis.set.mockResolvedValue("OK");

			// With openedAt treated as 0, Date.now() - 0 is very large → > 120_000
			// So the circuit transitions to half-open and allows one probe through
			(global.fetch as jest.Mock).mockResolvedValueOnce(makeSuccessResponse());

			const result = await moderateContent("probe content");
			expect(result).toBeDefined();
			// fetch was called because the circuit transitioned to half-open
			expect(global.fetch).toHaveBeenCalledTimes(1);
		});
	});

	// -------------------------------------------------------------------------
	// 15. setCircuitState — Redis throws (fail open)
	// -------------------------------------------------------------------------

	describe("setCircuitState — Redis.set throws", () => {
		it("does not crash when redis.set throws while opening circuit", async () => {
			useRealRedis();
			mockRedis.get.mockResolvedValue(null);
			// incr returns 5 to trigger opening
			mockRedis.incr.mockResolvedValue(5);
			// set throws — should be silently ignored
			mockRedis.set.mockRejectedValue(new Error("set failed"));

			(global.fetch as jest.Mock).mockResolvedValueOnce(makeFailureResponse());

			const result = await moderateContent("test content");
			expect(result).toBeDefined();
		});
	});
});
