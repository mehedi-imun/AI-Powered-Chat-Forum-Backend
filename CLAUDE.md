# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (hot reload via ts-node-dev)
npm run dev

# Start all Docker services (MongoDB, Redis, RabbitMQ)
npm run docker:dev
npm run docker:dev:down

# Build TypeScript to dist/
npm run build

# Run all tests
npm test

# Run a single test file
npx jest src/modules/auth/__tests__/auth.service.test.ts

# Run tests with coverage (must stay ≥70% branches/functions/lines/statements)
npm run test:coverage

# Lint + format with Biome
npx biome check src/
npx biome check --write src/

# Seed the admin user
npm run seed:admin

# Live logs
npm run logs:view       # backend only
npm run logs:errors     # filter to errors
npm run logs:all        # all services
```

## Architecture

### Startup Sequence (`src/server.ts`)
On boot, the server connects in order: **MongoDB → Redis (optional, non-fatal) → RabbitMQ → starts 4 workers → creates HTTP server → attaches Socket.IO → starts cron jobs**. If RabbitMQ fails the server still starts but AI moderation and notifications won't queue.

### Module Pattern
Every feature lives in `src/modules/<name>/` and always contains the same 6 files:

```
*.interface.ts   → TypeScript types only
*.model.ts       → Mongoose schema + model
*.validation.ts  → Zod schemas used by validateRequest middleware
*.service.ts     → All business logic (DB, cache, queue calls go here)
*.controller.ts  → Thin HTTP layer — calls service, calls sendResponse()
*.routes.ts      → Express router wiring middleware + controller
```

Controllers must never contain business logic. Services must never call `res`/`req`.

### Request Pipeline
```
Request → metricsMiddleware → pinoHttp → helmet → cors → rateLimit (auth only)
        → authenticate (JWT verify + DB lookup → req.user)
        → authorize(...roles) (role check)
        → requireEmailVerification (optional)
        → validateRequest(zodSchema) (throws 400 on fail)
        → controller → catchAsync(fn) → service
        → sendResponse() or globalErrorHandler
```

`catchAsync` wraps every controller function — never use try/catch in controllers, just `throw new AppError(statusCode, message)`.

### Error Handling
`globalErrorHandler` normalises 5 error types into a standard shape: Zod → 400, Mongoose ValidationError → 400, CastError (bad ObjectId) → 400, duplicate key (11000) → 409, `AppError` → its own statusCode. Stack trace only included in `development` mode.

### AI Moderation Pipeline
Every post create/update publishes to `QUEUES.AI_MODERATION` via `publishAIModeration()`. The worker (`src/workers/ai-moderation.worker.ts`) picks it up, calls `AIService.moderateContent()` (OpenRouter), scores spam/toxicity/inappropriate (0–1), then:
- score > 0.7 → `moderationStatus: "rejected"`, `status: "deleted"`, auto-creates a Report, sends notification
- score 0.3–0.7 → `moderationStatus: "flagged"`, creates a Report for human review
- score < 0.3 → `moderationStatus: "approved"`

Thread summaries follow the same pattern via `QUEUES.AI_SUMMARY`.

### Socket.IO Rooms
- `user:<userId>` — joined automatically on connect; used for personal notifications
- `thread:<threadId>` — joined via client `thread:join` event; used for live post events

Emit helpers in `src/config/socket.ts`: `emitToThread()`, `emitToUser()`, `emitToAll()`.

### Caching (Redis)
`cacheService` from `src/config/redis.ts` exposes `getJSON/setJSON/del`. Thread detail is cached for 5 minutes. Thread list caching is intentionally disabled (the `setJSON` call is commented out in `thread.service.ts` — re-enable when list query performance becomes a bottleneck). Always call `invalidateThreadCache()` after any write.

### QueryBuilder (`src/utils/queryBuilder.ts`)
Chainable Mongoose query builder. Supports `.search(fields)` (regex on field list), `.filter()` (strips pagination/sort keys, skips empty values), `.sort()` (comma-separated), `.paginate()`, `.fields()` (comma-separated projection). Used in thread list — re-use for any new paginated endpoint.

### Roles
Three roles: `Admin` > `Moderator` > `Member`. Use `authorize("Admin", "Moderator")` for multi-role guards. The `authenticate` middleware puts `{ userId, email, role, emailVerified }` on `req.user`.

### Response Shape
All success responses go through `sendResponse(res, { statusCode, success, message, meta?, data })`. All list responses include `meta: { page, limit, total, totalPage }`.

### Testing
- `src/__tests__/setup.ts` — spins up `MongoMemoryServer`, mocks `emailService`, clears all collections between non-e2e tests.
- `src/__tests__/utils/testHelpers.ts` — `createTestUser()`, `createTestAdmin()`, `generateTestToken()`, `mockAuthRequest()`.
- Tests live in `__tests__/` inside each module, named `*.test.ts`.
- e2e tests in `src/__tests__/e2e/` — collections are **not** cleared between tests in e2e files.

### Environment Variables
`src/config/env.ts` validates all variables at startup and throws immediately on any missing value. Required: `NODE_ENV PORT FRONTEND_URL DATABASE_URL JWT_SECRET JWT_EXPIRES_IN JWT_REFRESH_SECRET JWT_REFRESH_EXPIRES_IN REDIS_URL RABBITMQ_URL SMTP_* EMAIL_FROM RATE_LIMIT_* OPENROUTER_API_KEY OPENROUTER_MODEL SITE_URL SITE_NAME`.

### Linting
Biome (not ESLint). Tab indentation, double quotes for JS strings. Run `npx biome check --write src/` to auto-fix. CI should run `npx biome check src/`.

### Cron Jobs (`src/services/cron.service.ts`)
Only `unbanExpired` (hourly) has a real implementation. `cleanupSessions`, `dailyDigest`, `updateStats`, `healthCheck` are stubs — they log but do nothing.

### Ports (Docker Compose dev)
| Service | Port |
|---|---|
| Express API | 5000 |
| MongoDB | 27017 |
| Redis | 6379 |
| RabbitMQ AMQP | 5672 |
| RabbitMQ Management UI | 15672 |
| Prometheus | 9090 |
