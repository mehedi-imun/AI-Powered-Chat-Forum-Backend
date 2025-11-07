# System Design - AI-Powered Chat Forum Application

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [System Components](#system-components)
4. [Data Flow](#data-flow)
5. [Scalability](#scalability)
6. [Security](#security)
7. [Performance Optimization](#performance-optimization)

---

## Overview

The AI-Powered Chat Forum is a full-stack web application that enables users to create discussion threads, post messages, reply to others, and participate in real-time conversations. The system integrates AI for content moderation and thread summarization, implements asynchronous processing for notifications, and provides webhook support for external service integration.

### Key Features

- User authentication and authorization (JWT-based)
- Real-time communication (Socket.IO)
- Thread and post management with nested replies
- AI-powered content moderation and summarization
- Asynchronous notification system
- Webhook integration for external services
- Caching and performance optimization

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│  Next.js Frontend (Separate Deployment)                            │
│  - Server-Side Rendering (SSR)                                     │
│  - Client-Side Rendering (CSR)                                     │
│  - Socket.IO Client                                                │
│  - REST API Client                                                 │
└─────────────────────────────────────────────────────────────────────┘
                              ↓ ↑
                         HTTP/WebSocket
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│  Express.js Server                                                  │
│  - Route Handlers                                                   │
│  - Middleware (Auth, Validation, Error Handling)                    │
│  - CORS, Helmet, Rate Limiting                                      │
│  - Socket.IO Server                                                 │
└─────────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER                             │
├─────────────────────────────────────────────────────────────────────┤
│  Business Logic (Services)                                          │
│  ├── Auth Service          ├── Thread Service                      │
│  ├── User Service          ├── Post Service                        │
│  ├── Notification Service  ├── Webhook Service                     │
│  └── AI Services (Moderation, Summarization)                       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌──────────────────────┬──────────────────────┬──────────────────────┐
│   CACHE LAYER        │   MESSAGE QUEUE      │   BACKGROUND WORKERS │
├──────────────────────┼──────────────────────┼──────────────────────┤
│  Redis               │  RabbitMQ            │  AI Moderation       │
│  - Session Store     │  - Notifications     │  AI Summary          │
│  - Data Cache        │  - AI Processing     │  Notification        │
│  - Rate Limiting     │  - Webhooks          │  Webhook             │
└──────────────────────┴──────────────────────┴──────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────────┐
│                       PERSISTENCE LAYER                             │
├─────────────────────────────────────────────────────────────────────┤
│  MongoDB (Primary Database)                                         │
│  - Users, Threads, Posts, Notifications                             │
│  - Webhook Logs, Reports                                            │
│  - Indexes for performance                                          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                              │
├─────────────────────────────────────────────────────────────────────┤
│  - OpenAI API (Content Moderation & Summarization)                 │
│  - Email Service (SMTP/SendGrid)                                    │
│  - External Webhooks (Slack, Discord, etc.)                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Architecture Pattern

**Modular Monolith with Microservices-Ready Design**

- Organized by feature modules (auth, user, thread, post, etc.)
- Clear separation of concerns (controller → service → model)
- Easy to extract into microservices if needed

---

## System Components

### 1. API Server (Express.js)

**Responsibilities:**

- Handle HTTP requests and responses
- Route management and middleware processing
- WebSocket connection management (Socket.IO)
- Request validation and error handling

**Technology Stack:**

- Express.js (v4.x)
- TypeScript (strict mode)
- Helmet (security headers)
- CORS (cross-origin resource sharing)
- Morgan (HTTP logging)

### 2. Authentication & Authorization

**Authentication:**

- JWT (JSON Web Tokens) based authentication
- Access tokens (short-lived, 15 minutes)
- Refresh tokens (long-lived, 7 days)
- Password hashing with bcrypt (salt rounds: 10)

**Authorization:**

- Role-based access control (RBAC)
- Roles: user, moderator, admin
- Middleware-based route protection

**Security Features:**

- Email verification required
- Password reset with time-limited tokens
- Rate limiting per user/IP
- Secure cookie handling

### 3. Real-Time Communication (Socket.IO)

**Features:**

- JWT-based socket authentication
- Room-based message broadcasting
- Typing indicators
- Online user presence

**Events:**

- `new-thread` - New thread created
- `thread-updated` - Thread modified
- `thread-deleted` - Thread removed
- `new-post` - New post/reply created
- `post-updated` - Post modified
- `new-notification` - User notification
- `user-typing` - Typing indicator

**Architecture:**

```
Client Socket.IO ←→ Socket.IO Server ←→ Redis Adapter (for scaling)
```

### 4. AI Integration

**AI Moderation Worker:**

- Analyzes posts for inappropriate content
- Detects spam and offensive language
- Uses OpenAI GPT-4 API
- Async processing via RabbitMQ

**AI Summarization Worker:**

- Generates thread summaries on demand
- Summarizes long discussions
- Uses OpenAI GPT-4 API
- Cached for performance

**Processing Flow:**

```
Post Creation → Queue → AI Worker → Analysis → Action (flag/approve)
```

### 5. Notification System

**Types:**

- In-app notifications (stored in DB)
- Email notifications (SMTP)
- Real-time notifications (Socket.IO)

**Notification Worker:**

- Processes notification queue
- Sends emails asynchronously
- Handles @mentions
- Supports batch processing (digest emails)

**Queue-Based Processing:**

```
Event → RabbitMQ Queue → Notification Worker → Send Email/Notification
```

### 6. Webhook System

**Purpose:**

- Receive callbacks from external services
- Enable event-driven integrations
- Support asynchronous communication

**Components:**

- Incoming webhook endpoints
- HMAC-SHA256 signature verification
- Database logging (WebhookLog model)
- Background worker for processing

**Flow:**

```
External Service → POST /webhook/* → Verify → Queue → Worker → Process
```

### 7. Caching Layer (Redis)

**Cache Strategy:**

- **Cache-Aside Pattern** for frequently accessed data
- Thread lists cached for 5 minutes
- User sessions cached
- Rate limiting counters

**Cache Keys:**

```
thread:list:{query_hash}
thread:{id}
user:{id}
ratelimit:{ip}:{endpoint}
```

### 8. Message Queue (RabbitMQ)

**Queues:**

- `notifications` - Email and in-app notifications
- `ai-moderation` - Content moderation tasks
- `ai-summary` - Thread summarization tasks
- `webhooks` - Webhook processing

**Pattern:**

- Work Queue pattern
- Durable queues for reliability
- Prefetch limit for load balancing

### 9. Database (MongoDB)

**Collections:**

- `users` - User accounts
- `threads` - Discussion threads
- `posts` - Posts and replies
- `notifications` - User notifications
- `reports` - Content reports
- `webhooklogs` - Webhook event logs

**Design Principles:**

- Embedded documents for one-to-few relationships
- References for one-to-many and many-to-many
- Indexes on frequently queried fields
- TTL indexes for temporary data

---

## Data Flow

### 1. User Registration Flow

```
1. Client → POST /api/v1/auth/register
             ↓
2. Validate input (Zod schema)
             ↓
3. Check if email exists
             ↓
4. Hash password (bcrypt)
             ↓
5. Create user in MongoDB
             ↓
6. Generate verification token (JWT)
             ↓
7. Queue email notification (RabbitMQ)
             ↓
8. Return success response
             ↓
9. [Background] Email worker sends verification email
```

### 2. Create Post Flow (with AI Moderation)

```
1. Client → POST /api/v1/posts
             ↓
2. Authenticate user (JWT)
             ↓
3. Validate input (Zod)
             ↓
4. Create post in MongoDB
             ↓
5. Queue AI moderation (RabbitMQ)
             ↓
6. Emit Socket.IO event (real-time update)
             ↓
7. Queue mention notifications (if any)
             ↓
8. Return success response
             ↓
9. [Background] AI worker analyzes content
             ↓
10. [If flagged] Update post status, notify user
             ↓
11. [Background] Notification worker sends emails
```

### 3. Real-Time Thread Update Flow

```
1. User A creates post in Thread X
             ↓
2. Server emits Socket.IO event to room "thread:X"
             ↓
3. User B (in Thread X) receives event instantly
             ↓
4. Frontend updates UI without page refresh
```

### 4. Webhook Processing Flow

```
1. External Service → POST /webhook/email/status
                       ↓
2. Verify HMAC signature
                       ↓
3. Log to WebhookLog (MongoDB)
                       ↓
4. Publish to RabbitMQ queue
                       ↓
5. Return 200 OK (fast response)
                       ↓
6. [Background] Webhook worker processes event
                       ↓
7. Log success/failure
```

---

## Scalability

### Horizontal Scaling

**Stateless Application:**

- No session data stored in memory
- JWT tokens eliminate server-side sessions
- Redis for shared session/cache
- Socket.IO with Redis adapter for multi-instance

**Load Balancing:**

```
                Load Balancer (Nginx/AWS ALB)
                      ↓    ↓    ↓
              Instance 1  Instance 2  Instance 3
                      ↓    ↓    ↓
              Redis (Shared State)
                      ↓
                  MongoDB
```

### Vertical Scaling

**Database:**

- MongoDB replica sets for read scaling
- Sharding for large datasets
- Indexed queries for performance

**Caching:**

- Redis cluster for high availability
- Increased cache memory as needed

### Message Queue Scaling

**RabbitMQ:**

- Multiple workers per queue
- Worker prefetch limits
- Queue-based load distribution
- Dead letter queues for failed messages

---

## Security

### 1. Authentication Security

- **Password Hashing:** bcrypt with 10 salt rounds
- **JWT Tokens:**
  - Access: 15 minutes expiry
  - Refresh: 7 days expiry
  - Stored in httpOnly cookies (XSS protection)
- **Token Rotation:** Refresh token rotation on use

### 2. API Security

- **Input Validation:** Zod schemas on all endpoints
- **SQL Injection Protection:** Mongoose query sanitization
- **XSS Protection:** Helmet middleware
- **CSRF Protection:** SameSite cookie attribute
- **Rate Limiting:** Redis-based rate limiter
  - Auth endpoints: 5 requests/15 minutes
  - API endpoints: 100 requests/15 minutes

### 3. Authorization

- **Role-Based Access Control (RBAC)**
- **Middleware-based permission checks**
- **Resource ownership verification**

### 4. Data Security

- **Environment Variables:** All secrets in .env
- **Database Security:**
  - Connection string encryption
  - MongoDB authentication
  - No default credentials
- **Webhook Security:** HMAC-SHA256 signature verification

### 5. Network Security

- **HTTPS Only** in production
- **CORS:** Whitelist allowed origins
- **Security Headers:** Helmet.js
  - X-Content-Type-Options
  - X-Frame-Options
  - X-XSS-Protection
  - Strict-Transport-Security

---

## Performance Optimization

### 1. Database Optimization

**Indexes:**

```javascript
// Users
email: unique index
createdAt: index

// Threads
authorId: index
status: index
createdAt: -1 (descending)

// Posts
threadId + createdAt: compound index
authorId: index
status: index
```

**Query Optimization:**

- Projection (select only needed fields)
- Limit and pagination
- Lean queries (plain JS objects)
- Populate only when necessary

### 2. Caching Strategy

**Redis Caching:**

- Thread lists: 5 minutes TTL
- User profiles: 10 minutes TTL
- Cache invalidation on updates

**Cache Patterns:**

- Cache-Aside (Lazy Loading)
- Write-Through for critical data
- Cache warming for popular content

### 3. Asynchronous Processing

**Background Jobs:**

- Email sending (non-blocking)
- AI processing (heavy computation)
- Webhook processing (external calls)
- Notification aggregation (batch processing)

**Benefits:**

- Fast API responses (< 200ms)
- Better user experience
- Resource optimization

### 4. API Response Optimization

**Techniques:**

- Pagination (default: 20 items per page)
- Field selection (sparse fieldsets)
- Compression (gzip)
- ETags for cache validation

### 5. Real-Time Optimization

**Socket.IO:**

- Room-based broadcasting (reduce message volume)
- Binary data support
- Connection pooling
- Heartbeat mechanism

---

## Monitoring & Logging

### Logging Strategy

**Logger:** Pino (high-performance JSON logger)

**Log Levels:**

- `error` - Application errors
- `warn` - Warning conditions
- `info` - Informational messages
- `debug` - Debug information

**Log Outputs:**

- **Development:** Console (pretty print)
- **Production:** Files (JSON format) + Console

**Log Rotation:**

- Daily rotation
- 14 days retention
- Compressed archives

### Monitoring

**Health Checks:**

- `/health` endpoint
- Database connection status
- Redis connection status
- RabbitMQ connection status

**Metrics:**

- Request rate
- Response time
- Error rate
- Queue depth
- Cache hit ratio

---

## Deployment Architecture

### Docker-Based Deployment

```yaml
Services:
  - backend (Express.js API)
  - mongodb (Database)
  - redis (Cache)
  - rabbitmq (Message Queue)
  - prometheus (Metrics - Optional)
  - grafana (Visualization - Optional)
```

### Environment Separation

- **Development:** `docker-compose.dev.yml` with hot reload
- **Production:** `docker-compose.yml` with optimizations

### Graceful Shutdown

- Close HTTP server
- Disconnect from MongoDB
- Close Redis connections
- Close RabbitMQ connections
- Wait for in-flight requests to complete

---

## Technology Stack Summary

| Component        | Technology  | Version      |
| ---------------- | ----------- | ------------ |
| Runtime          | Node.js     | 20.x         |
| Language         | TypeScript  | 5.x          |
| Framework        | Express.js  | 4.x          |
| Database         | MongoDB     | 6.x          |
| ODM              | Mongoose    | 8.x          |
| Cache            | Redis       | 7.x          |
| Message Queue    | RabbitMQ    | 3.x          |
| Real-Time        | Socket.IO   | 4.x          |
| Validation       | Zod         | 3.x          |
| Authentication   | JWT         | jsonwebtoken |
| Password Hashing | bcrypt      | 5.x          |
| HTTP Client      | Axios       | 1.x          |
| Logger           | Pino        | 8.x          |
| Process Manager  | ts-node-dev | Dev          |
| Code Quality     | Biome       | 2.x          |
| AI Service       | OpenAI API  | GPT-4        |
| Email            | Nodemailer  | 6.x          |

---

## Future Enhancements

1. **Microservices Migration**

   - Extract AI services
   - Separate notification service
   - API Gateway pattern

2. **Advanced Features**

   - Full-text search (Elasticsearch)
   - Media upload (S3/Cloudinary)
   - Voice/video chat (WebRTC)
   - Analytics dashboard

3. **Performance**

   - CDN for static assets
   - GraphQL for flexible queries
   - Server-side caching (Varnish)

4. **Monitoring**
   - APM (Application Performance Monitoring)
   - Error tracking (Sentry)
   - Log aggregation (ELK Stack)

---

**Last Updated:** November 2025
