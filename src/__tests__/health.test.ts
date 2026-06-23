import request from "supertest";
import httpStatus from "http-status";
import app from "../app";

afterEach(() => jest.clearAllMocks());

describe("GET /health", () => {
	it("returns 200 with success: true", async () => {
		const res = await request(app).get("/health");
		expect(res.status).toBe(httpStatus.OK);
		expect(res.body).toHaveProperty("success", true);
	});

	it("returns version field equal to 1.0.0", async () => {
		const res = await request(app).get("/health");
		expect(res.status).toBe(httpStatus.OK);
		expect(res.body).toHaveProperty("version", "1.0.0");
	});

	it("returns uptime field that is a positive number", async () => {
		const res = await request(app).get("/health");
		expect(res.status).toBe(httpStatus.OK);
		expect(res.body).toHaveProperty("uptime");
		expect(typeof res.body.uptime).toBe("number");
		expect(res.body.uptime).toBeGreaterThan(0);
	});

	it("returns timestamp in ISO 8601 format", async () => {
		const res = await request(app).get("/health");
		expect(res.status).toBe(httpStatus.OK);
		expect(res.body).toHaveProperty("timestamp");
		const parsed = new Date(res.body.timestamp);
		expect(parsed.toISOString()).toBe(res.body.timestamp);
	});

	it("returns message equal to Server is healthy", async () => {
		const res = await request(app).get("/health");
		expect(res.status).toBe(httpStatus.OK);
		expect(res.body).toHaveProperty("message", "Server is healthy");
	});

	it("returns 200 without an auth token (public endpoint)", async () => {
		const res = await request(app).get("/health");
		expect(res.status).toBe(httpStatus.OK);
		expect(res.body).toHaveProperty("success", true);
	});

	it("returns uptime on second call that is >= uptime from first call", async () => {
		const first = await request(app).get("/health");
		const second = await request(app).get("/health");
		expect(first.status).toBe(httpStatus.OK);
		expect(second.status).toBe(httpStatus.OK);
		expect(second.body.uptime).toBeGreaterThanOrEqual(first.body.uptime);
	});

	it("returns data field equal to Server is running smoothly", async () => {
		const res = await request(app).get("/health");
		expect(res.status).toBe(httpStatus.OK);
		expect(res.body).toHaveProperty("data", "Server is running smoothly");
	});
});
