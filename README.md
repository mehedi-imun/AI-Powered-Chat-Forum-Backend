# AI-Powered Chat Forum - Backend

A robust, scalable backend system for a modern chat forum with AI-powered features including content moderation, thread summarization, and real-time updates.

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-green.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Running the Application](#running-the-application)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Development Tools](#development-tools)
- [Testing](#testing)
- [Deployment](#deployment)
- [Monitoring & Logging](#monitoring--logging)
- [Assumptions & Trade-offs](#assumptions--trade-offs)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Core Features

- ✅ **User Authentication & Authorization**: JWT-based authentication with role-based access control (User, Moderator, Admin)
- ✅ **Thread & Post Management**: Create, read, update, delete threads and posts with nested replies
- ✅ **Real-Time Updates**: WebSocket support via Socket.IO for instant notifications and live updates
- ✅ **AI Content Moderation**: Automatic content screening using OpenAI GPT-4 API
- ✅ **AI Thread Summarization**: Automatic thread summary generation using OpenAI GPT-4
- ✅ **Advanced Search**: Full-text search for threads with indexing
- ✅ **Notification System**: Real-time and stored notifications for mentions and replies
- ✅ **User Mentions**: Tag users in posts with @username
- ✅ **Vote System**: Upvote/downvote posts with vote tracking
- ✅ **Report System**: Report inappropriate content and users
- ✅ **Admin Dashboard**: Comprehensive admin panel with statistics and moderation tools
- ✅ **Webhook Support**: Incoming webhook endpoints for external service integration
- ✅ **Email Notifications**: Email verification, password reset, and digest emails
- ✅ **Caching**: Redis-based caching for improved performance
- ✅ **Message Queue**: RabbitMQ for background job processing
- ✅ **Rate Limiting**: API rate limiting to prevent abuse

### Advanced Features

- ✅ **Background Workers**: Separate worker processes for AI tasks and notifications
- ✅ **Cron Jobs**: Scheduled tasks for cleanup, digests, and system maintenance
- ✅ **Metrics & Monitoring**: Prometheus metrics and Grafana dashboards
- ✅ **Structured Logging**: Pino logger with JSON output and file rotation
- ✅ **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT signals
- ✅ **Health Checks**: Health endpoints for service monitoring
- ✅ **CORS Configuration**: Secure cross-origin resource sharing
- ✅ **Security Headers**: Helmet middleware for security
- ✅ **Input Validation**: Zod schema validation for all inputs
- ✅ **Error Handling**: Centralized error handling with detailed error responses

---

## Architecture Overview

The application follows a **modular, layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────┐
│                     CLIENT                          │
│            (Frontend - Next.js App)                 │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ HTTP/WebSocket
                  ▼
┌─────────────────────────────────────────────────────┐
│              API GATEWAY LAYER                      │
│  • Express.js Server                                │
│  • Rate Limiting                                    │
│  • CORS & Security Headers                          │
│  • Request Logging                                  │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│           APPLICATION LAYER                         │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Auth      │  │   Threads   │  │   Posts    │ │
│  │   Module    │  │   Module    │  │   Module   │ │
│  └─────────────┘  └─────────────┘  └────────────┘ │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Users     │  │Notifications│  │   Admin    │ │
│  │   Module    │  │   Module    │  │   Module   │ │
│  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│          INFRASTRUCTURE LAYER                       │
│                                                     │
│  ┌──────────┐   ┌──────────┐   ┌───────────────┐  │
│  │  Cache   │   │  Queue   │   │   Database    │  │
│  │  Redis   │   │ RabbitMQ │   │   MongoDB     │  │
│  └──────────┘   └──────────┘   └───────────────┘  │
└─────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│            WORKER PROCESSES                         │
│  • AI Moderation Worker                             │
│  • AI Summary Worker                                │
│  • Notification Worker                              │
│  • Webhook Worker                                   │
└─────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Modular Design**: Each feature is a self-contained module with routes, controllers, services, and validation
2. **Separation of Concerns**: Clear boundaries between API layer, business logic, and data access
3. **Async Processing**: Time-consuming tasks (AI, emails) processed in background workers
4. **Caching Strategy**: Redis cache for frequently accessed data (user sessions, thread lists)
5. **Real-Time Communication**: WebSocket connections for instant updates
6. **Scalability**: Horizontal scaling support with load balancer and stateless API servers

**For detailed architecture, see [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)**

---

## Technology Stack

| Category           | Technology         | Version | Purpose                 |
| ------------------ | ------------------ | ------- | ----------------------- |
| **Runtime**        | Node.js            | 20.x    | JavaScript runtime      |
| **Language**       | TypeScript         | 5.9     | Type-safe development   |
| **Framework**      | Express.js         | 5.1     | Web framework           |
| **Database**       | MongoDB            | 6.x     | NoSQL database          |
| **ODM**            | Mongoose           | 8.19    | MongoDB object modeling |
| **Cache**          | Redis              | 7.x     | In-memory data store    |
| **Message Queue**  | RabbitMQ           | 3.x     | Message broker          |
| **Real-Time**      | Socket.IO          | 4.8     | WebSocket library       |
| **Authentication** | JWT                | 9.0     | Token-based auth        |
| **Validation**     | Zod                | 4.1     | Schema validation       |
| **AI Integration** | OpenAI             | 6.7     | GPT-4 API client        |
| **Email**          | Nodemailer         | 7.0     | Email sending           |
| **Logging**        | Pino               | 10.1    | High-performance logger |
| **Monitoring**     | Prometheus         | -       | Metrics collection      |
| **Visualization**  | Grafana            | -       | Metrics dashboards      |
| **Security**       | Helmet             | 8.1     | Security headers        |
| **Rate Limiting**  | express-rate-limit | 8.1     | API rate limiting       |
| **Code Quality**   | Biome              | 2.3.2   | Linter & formatter      |

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v20.x or higher ([Download](https://nodejs.org/))
- **npm**: v10.x or higher (comes with Node.js)
- **Docker**: v24.x or higher ([Download](https://www.docker.com/)) - **Recommended**
- **Docker Compose**: v2.x or higher (comes with Docker Desktop)

**Alternative (Manual Setup):**

- MongoDB 6.x ([Installation Guide](https://docs.mongodb.com/manual/installation/))
- Redis 7.x ([Installation Guide](https://redis.io/docs/getting-started/))
- RabbitMQ 3.x ([Installation Guide](https://www.rabbitmq.com/download.html))

---

## Installation & Setup

### Option 1: Docker Setup (Recommended)

Docker setup is the easiest and most reliable way to run the application with all dependencies.

#### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd Chat\ Forum\ Application/backend
```

#### Step 2: Create Environment File

Create a `.env` file in the `backend` directory:

```bash
cp .env.example .env
```

Edit `.env` and configure all required variables (see [Environment Variables](#environment-variables) section).

#### Step 3: Start All Services with Docker

```bash
npm run docker:dev
```

This command will:

- Start MongoDB (port 27017)
- Start Redis (port 6379)
- Start RabbitMQ (port 5672, Management UI: 15672)
- Build and start the Backend (port 5000)
- Initialize all workers
- Set up health checks

#### Step 4: Verify Services

Check if all services are running:

```bash
docker-compose -f docker-compose.dev.yml ps
```

All services should show status as "healthy" or "running".

#### Step 5: Seed Admin User (Optional)

```bash
npm run seed:admin
```

**Admin Credentials:**

- Email: `admin@example.com`
- Password: `Admin@123`

#### Step 6: View Logs

```bash
npm run logs:view    # Backend logs
npm run logs:all     # All services
npm run logs:errors  # Error logs only
```

---

### Option 2: Manual Setup (Development)

If you prefer to run services manually without Docker.

#### Step 1: Install Dependencies

```bash
npm install
```

#### Step 2: Start Infrastructure Services

**MongoDB:**

```bash
mongod --dbpath /path/to/data/db
```

**Redis:**

```bash
redis-server
```

**RabbitMQ:**

```bash
rabbitmq-server
```

#### Step 3: Configure Environment

Create `.env` file with local service URLs:

```env
MONGODB_URI=mongodb://localhost:27017/chat-forum
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
```

#### Step 4: Run Development Server

```bash
npm run dev
```

Server will start on `http://localhost:5000`

---

## Running the Application

### Development Mode

**With Docker (Hot Reload):**

```bash
npm run docker:dev
```

**Without Docker:**

```bash
npm run dev
```

### Production Mode

**Build TypeScript:**

```bash
npm run build
```

**Start Production Server:**

```bash
npm start
```

**Or with Docker:**

```bash
npm run docker:prod
```

---

## Environment Variables

The application requires **21 environment variables**. Create a `.env` file in the `backend` directory:

### Required Variables

```env
# Server Configuration
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://mongodb:27017/chat-forum

# Redis
REDIS_URL=redis://redis:6379

# RabbitMQ
RABBITMQ_URL=amqp://rabbitmq:5672

# JWT Secrets
JWT_ACCESS_SECRET=your-super-secret-access-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key-here

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourforum.com

# Webhook Configuration
WEBHOOK_SECRET=your-webhook-secret-for-signature-verification

# Application Settings
MAX_THREADS_PER_DAY=10
MAX_POSTS_PER_DAY=50
```

### Environment Variable Details

| Variable                 | Description                          | Default     | Required |
| ------------------------ | ------------------------------------ | ----------- | -------- |
| `NODE_ENV`               | Environment (development/production) | development | Yes      |
| `PORT`                   | Server port                          | 5000        | Yes      |
| `FRONTEND_URL`           | Frontend URL for CORS                | -           | Yes      |
| `MONGODB_URI`            | MongoDB connection string            | -           | Yes      |
| `REDIS_URL`              | Redis connection URL                 | -           | Yes      |
| `RABBITMQ_URL`           | RabbitMQ connection URL              | -           | Yes      |
| `JWT_ACCESS_SECRET`      | JWT access token secret              | -           | Yes      |
| `JWT_REFRESH_SECRET`     | JWT refresh token secret             | -           | Yes      |
| `JWT_ACCESS_EXPIRES_IN`  | Access token expiry                  | 15m         | Yes      |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry                 | 7d          | Yes      |
| `OPENAI_API_KEY`         | OpenAI API key for AI features       | -           | Yes      |
| `SMTP_HOST`              | Email server host                    | -           | Yes      |
| `SMTP_PORT`              | Email server port                    | 587         | Yes      |
| `SMTP_USER`              | Email username                       | -           | Yes      |
| `SMTP_PASS`              | Email password                       | -           | Yes      |
| `EMAIL_FROM`             | Sender email address                 | -           | Yes      |
| `WEBHOOK_SECRET`         | Webhook signature secret             | -           | Yes      |
| `MAX_THREADS_PER_DAY`    | Thread creation limit                | 10          | Yes      |
| `MAX_POSTS_PER_DAY`      | Post creation limit                  | 50          | Yes      |

**Note:** All variables are **required**. The application will fail to start if any variable is missing.

### Getting API Keys

**OpenAI API Key:**

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create new secret key
5. Copy and paste into `.env` file

**SMTP Configuration (Gmail):**

1. Enable 2-factor authentication on your Google account
2. Go to Google Account → Security → App Passwords
3. Generate app password for "Mail"
4. Use this password in `SMTP_PASS`

---

## Project Structure

```
backend/
├── src/
│   ├── app.ts                    # Express app configuration
│   ├── server.ts                 # Server entry point
│   ├── config/
│   │   └── env.ts                # Environment configuration
│   ├── errors/
│   │   ├── AppError.ts           # Custom error class
│   │   ├── handleCastError.ts
│   │   ├── handleValidationError.ts
│   │   ├── handleZodError.ts
│   │   └── handleDuplicateError.ts
│   ├── interface/
│   │   └── error.ts              # Error interfaces
│   ├── middleware/
│   │   ├── authenticate.ts       # JWT authentication
│   │   ├── authorize.ts          # Role-based authorization
│   │   ├── validateRequest.ts    # Zod validation
│   │   └── globalErrorHandler.ts # Centralized error handling
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.validation.ts
│   │   │   └── auth.interface.ts
│   │   ├── user/
│   │   ├── thread/
│   │   ├── post/
│   │   ├── notification/
│   │   ├── admin/
│   │   └── webhook/
│   ├── services/
│   │   ├── cron.service.ts       # Cron job definitions
│   │   ├── email.service.ts      # Email sending
│   │   ├── socketio.service.ts   # WebSocket handling
│   │   └── rabbitmq.service.ts   # Message queue
│   ├── workers/
│   │   ├── aiModeration.worker.ts
│   │   ├── aiSummary.worker.ts
│   │   ├── notification.worker.ts
│   │   └── webhook.worker.ts
│   ├── utils/
│   │   ├── catchAsync.ts         # Async error handler
│   │   ├── sendResponse.ts       # Standard response format
│   │   ├── jwt.ts                # JWT utilities
│   │   ├── logger.ts             # Pino logger
│   │   └── queryBuilder.ts       # Query helper
│   └── scripts/
│       └── seed-admin.ts         # Admin seeding script
├── monitoring/
│   ├── prometheus/
│   │   └── prometheus.yml
│   └── grafana/
│       └── dashboards/
├── logs/                         # Application logs
├── docker-compose.yml            # Production Docker config
├── docker-compose.dev.yml        # Development Docker config
├── Dockerfile                    # Docker image definition
├── package.json
├── tsconfig.json
├── biome.json                    # Biome configuration
├── .env                          # Environment variables
├── README.md                     # This file
├── SYSTEM_DESIGN.md              # System architecture
├── DATABASE_DESIGN.md            # Database schema
└── API_DOCUMENTATION.md          # API reference
```

---

## API Documentation

### Base URL

**Development:** `http://localhost:5000/api/v1`  
**Production:** `https://api.yourforum.com/api/v1`

### API Modules

- **Authentication** (`/auth`): Register, login, token refresh, password reset
- **Users** (`/users`): User profiles, updates, deletion
- **Threads** (`/threads`): Thread CRUD, search, summarization
- **Posts** (`/posts`): Post CRUD, voting, replies
- **Notifications** (`/notifications`): User notifications, read/unread
- **Admin** (`/admin`): Dashboard, moderation, reports, statistics
- **Webhooks** (`/webhook`): Incoming webhook endpoints

### Complete API Reference

See **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** for:

- Detailed endpoint descriptions
- Request/response examples
- Authentication requirements
- Error handling
- WebSocket events
- Postman collection

### Quick Examples

**Register User:**

```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "confirmPassword": "SecurePass123!"
  }'
```

**Get All Threads:**

```bash
curl http://localhost:5000/api/v1/threads?page=1&limit=20
```

**Create Thread (Authenticated):**

```bash
curl -X POST http://localhost:5000/api/v1/threads \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "How to use async/await?",
    "description": "I need help understanding async patterns...",
    "tags": ["javascript", "async"]
  }'
```

---

## Development Tools

### Code Quality

**Biome (Linter & Formatter):**

```bash
# Check code
npx @biomejs/biome check src/

# Auto-fix issues
npx @biomejs/biome check src/ --write --unsafe
```

**TypeScript Compilation:**

```bash
# Check for type errors
npx tsc --noEmit
```

### Database Tools

**Seed Admin User:**

```bash
npm run seed:admin
```

**Delete Non-Admin Users:**

```bash
npm run delete:non-admin
```

### Docker Commands

**Start Development:**

```bash
npm run docker:dev
```

**Stop Services:**

```bash
npm run docker:dev:down
```

**Restart Backend:**

```bash
npm run docker:dev:restart
```

**View Logs:**

```bash
npm run logs:view      # Backend logs
npm run logs:all       # All services
npm run logs:errors    # Error logs only
npm run logs:mongodb   # MongoDB logs
npm run logs:redis     # Redis logs
npm run logs:rabbitmq  # RabbitMQ logs
```

**Clear Logs:**

```bash
npm run logs:clear
```

---

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Verbose output
npm run test:verbose
```

### Manual Testing

**Health Check:**

```bash
curl http://localhost:5000/health
```

**API Test:**

```bash
curl http://localhost:5000/api/v1/threads
```

**RabbitMQ Management:**
Open http://localhost:15672

- Username: `guest`
- Password: `guest`

---

## Deployment

### Docker Production Deployment

#### Step 1: Configure Production Environment

Create `.env` with production values:

```env
NODE_ENV=production
MONGODB_URI=mongodb://your-prod-db:27017/chat-forum
REDIS_URL=redis://your-prod-redis:6379
RABBITMQ_URL=amqp://your-prod-rabbitmq:5672
# ... other variables
```

#### Step 2: Build and Start

```bash
npm run docker:prod:build
```

#### Step 3: Verify Deployment

```bash
docker-compose ps
npm run docker:prod:logs
```

### Manual Deployment

#### Step 1: Build TypeScript

```bash
npm run build
```

#### Step 2: Start Production Server

```bash
NODE_ENV=production npm start
```

### Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production database URLs
- [ ] Set secure JWT secrets (min 32 characters)
- [ ] Configure SMTP for email
- [ ] Set webhook secret for signature verification
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall rules
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure log rotation
- [ ] Set up automated backups
- [ ] Configure rate limiting
- [ ] Test health endpoints

---

## Monitoring & Logging

### Application Logs

**Log Locations:**

- **Development (Docker)**: Container stdout/stderr
- **Production**: `logs/` directory with rotation

**Log Levels:**

- `fatal`: System failures
- `error`: Application errors
- `warn`: Warnings
- `info`: General information
- `debug`: Debug information (dev only)

**View Logs:**

```bash
npm run logs:view      # Live backend logs
npm run logs:errors    # Error logs only
npm run logs:all       # All services
```

### Metrics (Prometheus)

**Metrics Endpoint:** `http://localhost:5000/metrics`

**Available Metrics:**

- HTTP request duration
- Request count by endpoint
- Error rate
- Active connections
- Database connection pool
- Cache hit/miss rate
- Queue message count

### Grafana Dashboards

**Access Grafana:** `http://localhost:3001`  
**Credentials:**

- Username: `admin`
- Password: `admin` (change on first login)

**Pre-configured Dashboards:**

- API Performance
- System Resources
- Database Metrics
- Cache Performance
- Queue Statistics

**Start Monitoring Stack:**

```bash
npm run docker:monitoring
```

---

## Assumptions & Trade-offs

### Design Decisions

#### 1. **MongoDB as Primary Database**

**Assumption:**

- Data model benefits from flexible schema
- Relationships are mostly embedded or denormalized
- High read-to-write ratio

**Trade-off:**

- **Pro**: Fast reads, flexible schema evolution
- **Con**: Potential data duplication, no ACID across collections
- **Mitigation**: Use transactions for critical operations

---

#### 2. **JWT for Authentication**

**Assumption:**

- Stateless authentication preferred for scalability
- Short-lived tokens (15 min) acceptable

**Trade-off:**

- **Pro**: Scalable, no session storage needed
- **Con**: Can't invalidate tokens before expiry
- **Mitigation**: Short token lifetime + refresh token rotation

---

#### 3. **RabbitMQ for Background Jobs**

**Assumption:**

- AI processing and email sending are time-consuming
- Async processing improves user experience

**Trade-off:**

- **Pro**: Better performance, resilience, retry logic
- **Con**: Added complexity, eventual consistency
- **Mitigation**: Proper error handling and dead-letter queues

---

#### 4. **Redis for Caching**

**Assumption:**

- Thread lists and user data accessed frequently
- Cache invalidation manageable

**Trade-off:**

- **Pro**: Significant performance improvement
- **Con**: Cache invalidation complexity, memory usage
- **Mitigation**: TTL-based expiration + explicit invalidation

---

#### 5. **AI Moderation (Async)**

**Assumption:**

- Some delay in moderation acceptable
- False positives handled by human moderators

**Trade-off:**

- **Pro**: No blocking user posts, cost-effective
- **Con**: Inappropriate content may be visible briefly
- **Mitigation**: Quick processing queue, flag for review

---

#### 6. **Socket.IO for Real-Time**

**Assumption:**

- Real-time updates essential for chat forum UX
- Sticky sessions or Redis adapter for clustering

**Trade-off:**

- **Pro**: Instant updates, better engagement
- **Con**: Increased server load, connection management
- **Mitigation**: Rate limiting on WebSocket events

---

#### 7. **Nodemailer (SMTP) vs SendGrid**

**Assumption:**

- SMTP sufficient for current scale
- Webhook infrastructure ready for future migration

**Trade-off:**

- **Pro**: No vendor lock-in, cost-effective
- **Con**: Less reliable than dedicated email service
- **Mitigation**: Retry logic, queue-based sending

---

#### 8. **Soft Deletes**

**Assumption:**

- Content recovery may be needed
- Audit trail important for moderation

**Trade-off:**

- **Pro**: Easy recovery, better audit trail
- **Con**: Increased storage, query complexity
- **Mitigation**: Periodic cleanup cron jobs

---

#### 9. **Monolithic Architecture**

**Assumption:**

- Current scale doesn't justify microservices
- Easier development and deployment

**Trade-off:**

- **Pro**: Simple deployment, easier debugging
- **Con**: Limited independent scaling
- **Migration Path**: Workers are separate processes (step toward microservices)

---

#### 10. **TypeScript with Strict Mode**

**Assumption:**

- Type safety reduces bugs in production
- Team comfortable with TypeScript

**Trade-off:**

- **Pro**: Better code quality, IDE support
- **Con**: Slower initial development
- **Mitigation**: Extensive use of interfaces and types

---

### Performance Considerations

**Assumed Load:**

- 10,000 daily active users
- 1,000 concurrent connections
- 100 requests per second (peak)

**If scale exceeds:**

- Add horizontal scaling with load balancer
- Use MongoDB replica sets
- Implement Redis cluster
- Split workers to separate servers
- Consider CDN for static assets

---

### Security Assumptions

**Current Measures:**

- JWT with short expiry
- bcrypt password hashing
- Helmet security headers
- Rate limiting on endpoints
- Input validation (Zod)
- CORS configuration
- HMAC webhook verification

**Not Implemented (Future):**

- OAuth2 providers (Google, GitHub)
- Two-factor authentication (2FA)
- Advanced DDoS protection
- Intrusion detection system

---

## Contributing

### Development Workflow

1. **Clone Repository**
2. **Create Feature Branch**: `git checkout -b feature/your-feature`
3. **Make Changes** with proper commits
4. **Run Tests**: `npm test`
5. **Check Code Quality**: `npx @biomejs/biome check src/`
6. **Commit**: Use descriptive commit messages
7. **Push**: `git push origin feature/your-feature`
8. **Create Pull Request**

### Code Style

- Follow existing patterns in modules
- Use TypeScript strict mode
- Add JSDoc comments for complex logic
- Keep functions small and focused
- Use descriptive variable names

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

**Types:** feat, fix, docs, style, refactor, test, chore

---

## License

This project is licensed under the ISC License.

---

## Support

For issues, questions, or contributions:

- **Documentation**: See `SYSTEM_DESIGN.md`, `DATABASE_DESIGN.md`, `API_DOCUMENTATION.md`
- **Issues**: Open an issue on the repository
- **Email**: support@yourforum.com

---

## Acknowledgments

- OpenAI for GPT-4 API
- MongoDB team for excellent documentation
- Express.js community
- Socket.IO team
- All open-source contributors

---

**Built with ❤️ using Node.js, TypeScript, and modern web technologies.**

**Last Updated:** November 2025
