import request from "supertest";
import httpStatus from "http-status";
import app from "../app";

afterEach(() => jest.clearAllMocks());

describe("GET /health", () => {
	it("returns 200 with success: true", async () => {
		const response = await request(app).get("/health");

		expect(response.status).toBe(httpStatus.OK);
		expect(response.body).toHaveProperty("success", true);
	});

	it("returns version field equal to '1.0.0'", async () => {
		const response = await request(app).get("/health");

		expect(response.body).toHaveProperty("version", "1.0.0");
	});

	it("returns uptime field that is a positive number", async () => {
		const response = await request(app).get("/health");

		expect(response.body).toHaveProperty("uptime");
		expect(typeof response.body.uptime).toBe("number");
		expect(response.body.uptime).toBeGreaterThan(0);
	});

	it("returns timestamp field in ISO 8601 format", async () => {
		const response = await request(app).get("/health");

		expect(response.body).toHaveProperty("timestamp");
		const parsed = new Date(response.body.timestamp);
		expect(parsed.toISOString()).toBe(response.body.timestamp);
	});

	it("returns message 'Server is healthy'", async () => {
		const response = await request(app).get("/health");

		expect(response.body).toHaveProperty("message", "Server is healthy");
	});

	it("works without any auth token (public endpoint)", async () => {
		// No Authorization header or cookie — endpoint must still return 200
		const response = await request(app)
			.get("/health")
			.unset("Authorization");

		expect(response.status).toBe(httpStatus.OK);
		expect(response.body).toHaveProperty("success", true);
	});

	it("uptime increases between two calls (second uptime >= first)", async () => {
		const first = await request(app).get("/health");
		const second = await request(app).get("/health");

		expect(second.body.uptime).toBeGreaterThanOrEqual(first.body.uptime);
	});
});
