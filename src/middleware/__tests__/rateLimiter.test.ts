import express, { type Application } from "express";
import request from "supertest";

// ---------------------------------------------------------------------------
// Module-level mock: getRedisClient — controlled per describe block via
// mockReturnValue / mockReturnValueOnce inside each beforeEach.
// ---------------------------------------------------------------------------
jest.mock("../../config/redis", () => ({
	getRedisClient: jest.fn().mockReturnValue(null),
	cacheService: {
		get: jest.fn().mockResolvedValue(null),
		set: jest.fn().mockResolvedValue(true),
		del: jest.fn().mockResolvedValue(true),
		exists: jest.fn().mockResolvedValue(false),
		setJSON: jest.fn().mockResolvedValue(true),
		getJSON: jest.fn().mockResolvedValue(null),
	},
}));

// ---------------------------------------------------------------------------
// Module-level mock: rate-limit-redis — replace RedisStore with a lightweight
// in-memory-compatible wrapper so tests never touch a real Redis connection.
// The mock store delegates to the in-memory express-rate-limit store by not
// supplying a store to the underlying rateLimit() call; we simply prevent the
// real RedisStore constructor from running.
// ---------------------------------------------------------------------------
jest.mock("rate-limit-redis", () => {
	const { MemoryStore } = jest.requireActual("express-rate-limit");
	return {
		__esModule: true,
		RedisStore: jest.fn().mockImplementation(() => new MemoryStore()),
	};
});

import { MemoryStore } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedisClient } from "../../config/redis";
// Import AFTER mocks are in place.
import { createRateLimiter } from "../rateLimiter";

// ---------------------------------------------------------------------------
// Helper: build a minimal Express app that mounts a single test route guarded
// by the supplied rate-limiter middleware.
// ---------------------------------------------------------------------------
const buildApp = (
	limiter: express.RequestHandler,
	method: "get" | "post" | "patch" | "delete" = "post",
): Application => {
	const app = express();
	app.use(express.json());

	if (method === "get") {
		app.get("/test", limiter, (_req, res) => {
			res.status(200).json({ success: true });
		});
	} else if (method === "post") {
		app.post("/test", limiter, (_req, res) => {
			res.status(200).json({ success: true });
		});
	} else if (method === "patch") {
		app.patch("/test", limiter, (_req, res) => {
			res.status(200).json({ success: true });
		});
	} else {
		app.delete("/test", limiter, (_req, res) => {
			res.status(200).json({ success: true });
		});
	}

	return app;
};

// ---------------------------------------------------------------------------
// Helper: build an app that exposes both GET and POST on the same path so we
// can verify skipRead behaviour on a single limiter instance.
// ---------------------------------------------------------------------------
const buildSkipReadApp = (limiter: express.RequestHandler): Application => {
	const app = express();
	app.use(express.json());
	app.get("/test", limiter, (_req, res) =>
		res.status(200).json({ success: true }),
	);
	app.post("/test", limiter, (_req, res) =>
		res.status(200).json({ success: true }),
	);
	app.head("/test", limiter, (_req, res) => res.status(200).end());
	app.options("/test", limiter, (_req, res) => res.status(200).end());
	app.delete("/test", limiter, (_req, res) =>
		res.status(200).json({ success: true }),
	);
	return app;
};

// ---------------------------------------------------------------------------
// Shared factory options used across tests
// ---------------------------------------------------------------------------
const BASE_OPTS = {
	windowMs: 60_000,
	prefix: "rl:test:",
	message: "Too many requests, please try again later.",
};

// ===========================================================================
// 1. In-memory store (Redis unavailable)
// ===========================================================================
describe("createRateLimiter — in-memory store (Redis null)", () => {
	beforeEach(() => {
		(getRedisClient as jest.Mock).mockReturnValue(null);
	});

	it("allows requests under the limit to pass through", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 2 });
		const app = buildApp(limiter);

		const res1 = await request(app).post("/test").send({});
		const res2 = await request(app).post("/test").send({});

		expect(res1.status).toBe(200);
		expect(res1.body.success).toBe(true);
		expect(res2.status).toBe(200);
		expect(res2.body.success).toBe(true);
	});

	it("returns HTTP 429 once max is exceeded", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 2 });
		const app = buildApp(limiter);

		await request(app).post("/test").send({});
		await request(app).post("/test").send({});
		const res = await request(app).post("/test").send({});

		expect(res.status).toBe(429);
	});

	it("returns standard error envelope on 429", async () => {
		const msg = "Too many requests, please try again later.";
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 1, message: msg });
		const app = buildApp(limiter);

		await request(app).post("/test").send({});
		const res = await request(app).post("/test").send({});

		expect(res.status).toBe(429);
		expect(res.body.success).toBe(false);
		expect(res.body.message).toBe(msg);
		expect(Array.isArray(res.body.errorSources)).toBe(true);
		expect(res.body.errorSources).toHaveLength(1);
		expect(res.body.errorSources[0].path).toBe("");
		expect(res.body.errorSources[0].message).toBe(msg);
	});

	it("does not throw or crash when Redis is unavailable", async () => {
		// Confirm no error is thrown — the app still serves requests normally.
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 10 });
		const app = buildApp(limiter);

		const res = await request(app).post("/test").send({});

		expect(res.status).toBe(200);
	});
});

// ===========================================================================
// 2. Standard response headers
// ===========================================================================
describe("createRateLimiter — response headers", () => {
	beforeEach(() => {
		(getRedisClient as jest.Mock).mockReturnValue(null);
	});

	it("includes RateLimit-* standard headers on successful responses", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 5 });
		const app = buildApp(limiter);

		const res = await request(app).post("/test").send({});

		// express-rate-limit v7+ uses draft-7 header names when standardHeaders: true
		// The header may appear as RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
		// or as a combined RateLimit header (draft-8). We check at least one is present.
		const hasStandardHeaders =
			"ratelimit-limit" in res.headers ||
			"ratelimit-remaining" in res.headers ||
			"ratelimit-reset" in res.headers ||
			"ratelimit" in res.headers;

		expect(hasStandardHeaders).toBe(true);
	});

	it("does NOT include legacy X-RateLimit-* headers", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 5 });
		const app = buildApp(limiter);

		const res = await request(app).post("/test").send({});

		expect(res.headers["x-ratelimit-limit"]).toBeUndefined();
		expect(res.headers["x-ratelimit-remaining"]).toBeUndefined();
		expect(res.headers["x-ratelimit-reset"]).toBeUndefined();
	});

	it("includes RateLimit-* standard headers on 429 responses", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 1 });
		const app = buildApp(limiter);

		await request(app).post("/test").send({});
		const res = await request(app).post("/test").send({});

		expect(res.status).toBe(429);

		const hasStandardHeaders =
			"ratelimit-limit" in res.headers ||
			"ratelimit-remaining" in res.headers ||
			"ratelimit-reset" in res.headers ||
			"ratelimit" in res.headers;

		expect(hasStandardHeaders).toBe(true);
		expect(res.headers["x-ratelimit-limit"]).toBeUndefined();
	});
});

// ===========================================================================
// 3. skipRead: true — GET / HEAD / OPTIONS bypass the limiter
// ===========================================================================
describe("createRateLimiter — skipRead: true", () => {
	beforeEach(() => {
		(getRedisClient as jest.Mock).mockReturnValue(null);
	});

	it("GET requests never consume budget and never get limited", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 2, skipRead: true });
		const app = buildSkipReadApp(limiter);

		// Fire many GET requests — none should trigger a 429
		for (let i = 0; i < 5; i++) {
			const res = await request(app).get("/test");
			expect(res.status).toBe(200);
		}
	});

	it("HEAD requests are not counted against the limit", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 1, skipRead: true });
		const app = buildSkipReadApp(limiter);

		// HEAD x5 should not trigger limit
		for (let i = 0; i < 5; i++) {
			const res = await request(app).head("/test");
			expect(res.status).toBe(200);
		}
	});

	it("OPTIONS requests are not counted against the limit", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 1, skipRead: true });
		const app = buildSkipReadApp(limiter);

		for (let i = 0; i < 3; i++) {
			const res = await request(app).options("/test");
			expect(res.status).toBe(200);
		}
	});

	it("POST requests are counted and limited when max is exceeded", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 2, skipRead: true });
		const app = buildSkipReadApp(limiter);

		await request(app).post("/test").send({});
		await request(app).post("/test").send({});
		const res = await request(app).post("/test").send({});

		expect(res.status).toBe(429);
	});

	it("DELETE requests are counted and limited when max is exceeded", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 2, skipRead: true });
		const app = buildSkipReadApp(limiter);

		await request(app).delete("/test");
		await request(app).delete("/test");
		const res = await request(app).delete("/test");

		expect(res.status).toBe(429);
	});

	it("GET requests pass after POST limit is exhausted (budgets are shared but reads skip)", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 2, skipRead: true });
		const app = buildSkipReadApp(limiter);

		// Exhaust POST budget
		await request(app).post("/test").send({});
		await request(app).post("/test").send({});
		const postRes = await request(app).post("/test").send({});
		expect(postRes.status).toBe(429);

		// GET should still pass because skipRead skips it entirely
		const getRes = await request(app).get("/test");
		expect(getRes.status).toBe(200);
	});
});

// ===========================================================================
// 4. skipRead: false (default) — all methods consume budget
// ===========================================================================
describe("createRateLimiter — skipRead: false (default)", () => {
	beforeEach(() => {
		(getRedisClient as jest.Mock).mockReturnValue(null);
	});

	it("GET requests consume the budget when skipRead is false", async () => {
		const limiter = createRateLimiter({
			...BASE_OPTS,
			max: 2,
			skipRead: false,
		});
		const app = buildSkipReadApp(limiter);

		await request(app).get("/test");
		await request(app).get("/test");
		const res = await request(app).get("/test");

		expect(res.status).toBe(429);
	});
});

// ===========================================================================
// 5. Independent counters per factory instance
// ===========================================================================
describe("createRateLimiter — separate instances have independent counters", () => {
	beforeEach(() => {
		(getRedisClient as jest.Mock).mockReturnValue(null);
	});

	it("exhausting one limiter does not affect a different limiter instance", async () => {
		const limiterA = createRateLimiter({
			...BASE_OPTS,
			prefix: "rl:a:",
			max: 2,
		});
		const limiterB = createRateLimiter({
			...BASE_OPTS,
			prefix: "rl:b:",
			max: 2,
		});

		const appA = buildApp(limiterA);
		const appB = buildApp(limiterB);

		// Exhaust limiter A
		await request(appA).post("/test").send({});
		await request(appA).post("/test").send({});
		const resA = await request(appA).post("/test").send({});
		expect(resA.status).toBe(429);

		// Limiter B should still have a fresh budget
		const resB1 = await request(appB).post("/test").send({});
		const resB2 = await request(appB).post("/test").send({});
		expect(resB1.status).toBe(200);
		expect(resB2.status).toBe(200);
	});
});

// ===========================================================================
// 6. Redis-backed path — mocked "ready" Redis client
// ===========================================================================
describe("createRateLimiter — Redis-backed path (mocked ready client)", () => {
	let mockRedisClient: { status: string; call: jest.Mock };

	beforeEach(() => {
		// Provide a fake Redis client whose status is "ready".
		// The RedisStore mock (declared at the top of this file) replaces
		// RedisStore with one backed by MemoryStore, so sendCommand is never
		// actually called — we just verify that the factory selects the Redis
		// path and that RedisStore is constructed.
		mockRedisClient = {
			status: "ready",
			call: jest.fn().mockResolvedValue("OK"),
		};
		(getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);
		// resetMocks: true (jest.config.ts) clears mockImplementation between tests,
		// so we must re-establish the RedisStore mock implementation here so that
		// `new RedisStore(...)` returns a valid MemoryStore-backed store instance.
		(RedisStore as unknown as jest.Mock).mockImplementation(
			() => new MemoryStore(),
		);
	});

	it("uses the RedisStore when client status is 'ready'", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 5 });
		const app = buildApp(limiter);

		// Trigger at least one request so the lazy Redis limiter is initialized.
		const res = await request(app).post("/test").send({});

		expect(res.status).toBe(200);
		// RedisStore should have been instantiated exactly once (lazy init).
		expect(RedisStore).toHaveBeenCalledTimes(1);
		// The store was constructed with the correct prefix.
		expect((RedisStore as unknown as jest.Mock).mock.calls[0][0]).toMatchObject(
			{
				prefix: BASE_OPTS.prefix,
			},
		);
	});

	it("RedisStore sendCommand references the active Redis client", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 5 });
		const app = buildApp(limiter);

		await request(app).post("/test").send({});

		// Extract the sendCommand passed to RedisStore and invoke it to confirm
		// it delegates to client.call().
		const storeCtorOptions = (RedisStore as unknown as jest.Mock).mock
			.calls[0][0] as {
			sendCommand: (...args: string[]) => Promise<unknown>;
		};
		await storeCtorOptions.sendCommand("PING");

		expect(mockRedisClient.call).toHaveBeenCalledWith("PING");
	});

	it("requests under the limit pass through via Redis-backed limiter", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 3 });
		const app = buildApp(limiter);

		const r1 = await request(app).post("/test").send({});
		const r2 = await request(app).post("/test").send({});

		expect(r1.status).toBe(200);
		expect(r2.status).toBe(200);
	});

	it("returns 429 once max is exceeded via Redis-backed limiter", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 2 });
		const app = buildApp(limiter);

		await request(app).post("/test").send({});
		await request(app).post("/test").send({});
		const res = await request(app).post("/test").send({});

		expect(res.status).toBe(429);
		expect(res.body.success).toBe(false);
		expect(res.body.errorSources).toBeDefined();
	});

	it("creates RedisStore only once for repeated requests (lazy singleton)", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 10 });
		const app = buildApp(limiter);

		await request(app).post("/test").send({});
		await request(app).post("/test").send({});
		await request(app).post("/test").send({});

		// Despite three requests, RedisStore constructor is called only once.
		expect(RedisStore).toHaveBeenCalledTimes(1);
	});
});

// ===========================================================================
// 7. Graceful fallback — client exists but status is NOT "ready"
// ===========================================================================
describe("createRateLimiter — Redis client not ready → falls back to in-memory", () => {
	beforeEach(() => {
		(getRedisClient as jest.Mock).mockReturnValue({
			status: "connecting",
			call: jest.fn(),
		});
		(RedisStore as unknown as jest.Mock).mockClear();
	});

	it("does not construct RedisStore when client status is not 'ready'", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 5 });
		const app = buildApp(limiter);

		await request(app).post("/test").send({});

		expect(RedisStore).not.toHaveBeenCalled();
	});

	it("still limits requests via in-memory fallback when client is not ready", async () => {
		const limiter = createRateLimiter({ ...BASE_OPTS, max: 2 });
		const app = buildApp(limiter);

		await request(app).post("/test").send({});
		await request(app).post("/test").send({});
		const res = await request(app).post("/test").send({});

		expect(res.status).toBe(429);
	});
});

// ===========================================================================
// 8. Custom 429 message is reflected in every part of the envelope
// ===========================================================================
describe("createRateLimiter — custom message propagation", () => {
	beforeEach(() => {
		(getRedisClient as jest.Mock).mockReturnValue(null);
	});

	it("uses the configured message in both top-level field and errorSources", async () => {
		const customMsg = "Slow down! You are posting too fast.";
		const limiter = createRateLimiter({
			...BASE_OPTS,
			max: 1,
			message: customMsg,
		});
		const app = buildApp(limiter);

		await request(app).post("/test").send({});
		const res = await request(app).post("/test").send({});

		expect(res.status).toBe(429);
		expect(res.body.message).toBe(customMsg);
		expect(res.body.errorSources[0].message).toBe(customMsg);
	});
});
