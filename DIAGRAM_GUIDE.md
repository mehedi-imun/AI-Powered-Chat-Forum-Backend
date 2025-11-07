# System Design Diagram Guide for Excalidraw

## Complete Backend System Architecture Diagram

Ei guide use kore tumi Excalidraw (https://excalidraw.com) te backend er pura system design draw korte parbe.

---

## Diagram 1: High-Level System Architecture (Main Diagram)

### Layout Structure (Top to Bottom):

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Browser    │  │   Mobile     │  │  Desktop     │              │
│  │   (React)    │  │   (Native)   │  │   (Electron) │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                      │
│         └──────────────────┴──────────────────┘                      │
│                            │                                         │
│                      HTTP/WebSocket                                  │
└────────────────────────────┼─────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API GATEWAY LAYER                             │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Load Balancer (Nginx)                      │  │
│  │              • SSL Termination                                │  │
│  │              • Rate Limiting                                  │  │
│  │              • Request Routing                                │  │
│  └─────────────────────────┬─────────────────────────────────────┘  │
│                            │                                         │
│                            ▼                                         │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              Express.js API Server (Port 5000)                │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐   │  │
│  │  │   Helmet    │  │     CORS     │  │  Rate Limiter      │   │  │
│  │  │  (Security) │  │  (Security)  │  │  (Protection)      │   │  │
│  │  └─────────────┘  └──────────────┘  └────────────────────┘   │  │
│  └───────────────────────────┬─────────────────────────────────────┘  │
└────────────────────────────┼─────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Middleware Layer                           │   │
│  │  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐   │   │
│  │  │ Authenticate │  │  Authorize  │  │  Validate        │   │   │
│  │  │    (JWT)     │  │   (RBAC)    │  │  Request (Zod)   │   │   │
│  │  └──────────────┘  └─────────────┘  └──────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Business Logic Modules                     │   │
│  │                                                              │   │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │   Auth   │  │   Users   │  │ Threads  │  │  Posts   │  │   │
│  │  │  Module  │  │  Module   │  │  Module  │  │  Module  │  │   │
│  │  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └────┬─────┘  │   │
│  │       │              │              │              │        │   │
│  │  ┌────▼─────┐  ┌─────▼─────┐  ┌────▼─────┐  ┌────▼─────┐  │   │
│  │  │  Admin   │  │ Notificat.│  │ Webhooks │  │  Reports │  │   │
│  │  │  Module  │  │  Module   │  │  Module  │  │  Module  │  │   │
│  │  └──────────┘  └───────────┘  └──────────┘  └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            │                                        │
│                            ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Service Layer                              │   │
│  │  • Business Logic Implementation                             │   │
│  │  • Data Transformation                                       │   │
│  │  • External Service Calls                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                             │
│                                                                     │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────┐  │
│  │   Cache Layer    │   │   Queue Layer    │   │  Real-Time   │  │
│  │                  │   │                  │   │              │  │
│  │  ┌────────────┐  │   │  ┌────────────┐  │   │  ┌────────┐  │  │
│  │  │   Redis    │  │   │  │  RabbitMQ  │  │   │  │Socket  │  │  │
│  │  │  (Cache)   │  │   │  │  (Queue)   │  │   │  │  .IO   │  │  │
│  │  └────────────┘  │   │  └────────────┘  │   │  └────────┘  │  │
│  │                  │   │                  │   │              │  │
│  │  • Session       │   │  • AI Jobs       │   │  • Live      │  │
│  │  • User Data     │   │  • Emails        │   │    Updates   │  │
│  │  • Thread Lists  │   │  • Webhooks      │   │  • Notifs    │  │
│  └──────────────────┘   └──────────────────┘   └──────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Database Layer                            │   │
│  │                                                              │   │
│  │              ┌────────────────────────────┐                 │   │
│  │              │      MongoDB (Primary)     │                 │   │
│  │              │                            │                 │   │
│  │              │  Collections:              │                 │   │
│  │              │  • users                   │                 │   │
│  │              │  • threads                 │                 │   │
│  │              │  • posts                   │                 │   │
│  │              │  • notifications           │                 │   │
│  │              │  • reports                 │                 │   │
│  │              │  • webhooklogs             │                 │   │
│  │              └────────────────────────────┘                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     WORKER PROCESSES                                │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ AI Moderation│  │  AI Summary  │  │ Notification │            │
│  │    Worker    │  │    Worker    │  │    Worker    │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                  │                    │
│         └──────────────────┴──────────────────┘                    │
│                            │                                        │
│                 Consume from RabbitMQ Queues                       │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                                 │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │   OpenAI     │  │  SMTP Server │  │  Webhook Providers   │    │
│  │   GPT-4 API  │  │  (Email)     │  │  (SendGrid/Mailgun)  │    │
│  └──────────────┘  └──────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Diagram 2: Request Flow Diagram

### User Registration Flow:

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ 1. POST /auth/register
     ▼
┌────────────────┐
│  API Gateway   │ 2. Validate Request (Zod)
└────┬───────────┘
     │
     │ 3. Hash Password (bcrypt)
     ▼
┌────────────────┐
│ Auth Service   │ 4. Create User
└────┬───────────┘
     │
     │ 5. Save to DB
     ▼
┌────────────────┐
│    MongoDB     │
└────┬───────────┘
     │
     │ 6. User Created
     ▼
┌────────────────┐
│ Email Service  │ 7. Queue Verification Email
└────┬───────────┘
     │
     │ 8. Publish to Queue
     ▼
┌────────────────┐
│   RabbitMQ     │
└────┬───────────┘
     │
     │ 9. Worker Consumes
     ▼
┌────────────────┐
│ Email Worker   │ 10. Send Email via SMTP
└────┬───────────┘
     │
     │ 11. Generate JWT Tokens
     ▼
┌────────────────┐
│     Client     │ 12. Return Access + Refresh Token
└────────────────┘
```

---

## Diagram 3: Post Creation with AI Moderation Flow

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ 1. POST /posts (with auth token)
     ▼
┌─────────────────┐
│ Authenticate    │ 2. Verify JWT Token
│   Middleware    │
└────┬────────────┘
     │
     │ 3. Check Email Verified
     ▼
┌─────────────────┐
│ Post Controller │ 4. Validate Input (Zod)
└────┬────────────┘
     │
     │ 5. Create Post
     ▼
┌─────────────────┐
│  Post Service   │ 6. Save to MongoDB
└────┬────────────┘
     │
     ├──────────────────┬─────────────────────┐
     │                  │                     │
     ▼                  ▼                     ▼
┌──────────┐   ┌────────────────┐   ┌──────────────┐
│ MongoDB  │   │   RabbitMQ     │   │  Socket.IO   │
│          │   │ (AI Moderation │   │              │
└──────────┘   │     Queue)     │   └──────────────┘
               └────┬───────────┘            │
                    │                        │
                    │ 7. Worker Consumes     │ 8. Emit 'new-post'
                    ▼                        ▼
          ┌──────────────────┐      ┌──────────────┐
          │ AI Mod Worker    │      │  Connected   │
          │                  │      │   Clients    │
          └────┬─────────────┘      └──────────────┘
               │
               │ 9. Call OpenAI API
               ▼
          ┌──────────────────┐
          │   OpenAI GPT-4   │
          └────┬─────────────┘
               │
               │ 10. Moderation Result
               ▼
          ┌──────────────────┐
          │  Update Post     │ 11. Mark as checked
          │  in MongoDB      │     (flag if inappropriate)
          └──────────────────┘
```

---

## Diagram 4: Real-Time Communication (Socket.IO)

```
┌─────────────────────────────────────────────────────────────┐
│                    Socket.IO Architecture                   │
└─────────────────────────────────────────────────────────────┘

     ┌──────────┐         ┌──────────┐         ┌──────────┐
     │ Client 1 │         │ Client 2 │         │ Client 3 │
     └────┬─────┘         └────┬─────┘         └────┬─────┘
          │                     │                     │
          │ WebSocket           │ WebSocket           │ WebSocket
          │ Connection          │ Connection          │ Connection
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Socket.IO Server    │
                    │   (Express.js)        │
                    └───────────────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
            ┌──────────┐ ┌──────────┐ ┌──────────┐
            │  Room:   │ │  Room:   │ │  User:   │
            │ Thread-1 │ │ Thread-2 │ │  userID  │
            └──────────┘ └──────────┘ └──────────┘

Events:
• join-thread → Client joins thread room
• leave-thread → Client leaves thread room
• new-post → Broadcast to thread room
• post-updated → Broadcast to thread room
• notification → Send to specific user
```

---

## Diagram 5: Caching Strategy (Redis)

```
┌────────────────────────────────────────────────────────────┐
│                    Caching Flow                            │
└────────────────────────────────────────────────────────────┘

         ┌──────────────────┐
         │   API Request    │
         │ GET /threads     │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │  Check Redis     │ ──────────┐
         │  Cache           │           │
         └────────┬─────────┘           │
                  │                     │
         ┌────────┴────────┐            │
         │                 │            │
    Cache HIT         Cache MISS        │
         │                 │            │
         ▼                 ▼            │
    ┌─────────┐    ┌──────────────┐    │
    │ Return  │    │ Query MongoDB│    │
    │ Cached  │    └──────┬───────┘    │
    │  Data   │           │            │
    └─────────┘           ▼            │
                   ┌──────────────┐    │
                   │ Store in     │────┘
                   │ Redis Cache  │
                   └──────┬───────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ Return Data  │
                   └──────────────┘

Cache Keys:
• thread:list:{page}:{limit}
• thread:{threadId}
• user:{userId}
• user:session:{token}

Cache Invalidation:
• On UPDATE → Delete specific key
• On DELETE → Delete specific key
• TTL → Auto-expire after time
```

---

## Diagram 6: Background Job Processing (RabbitMQ)

```
┌─────────────────────────────────────────────────────────────┐
│              Message Queue Architecture                     │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    Message Producers                         │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Post Service│  │ Auth Service│  │Thread Service│        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
                   ┌────────────────┐
                   │   RabbitMQ     │
                   │   Exchange     │
                   └────────┬───────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐     ┌──────────┐
    │  Queue:  │      │  Queue:  │     │  Queue:  │
    │    AI    │      │  Email   │     │ Webhook  │
    │Moderation│      │Notification    │          │
    └────┬─────┘      └────┬─────┘     └────┬─────┘
         │                 │                 │
         ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐     ┌──────────┐
    │   AI     │      │  Email   │     │ Webhook  │
    │Moderation│      │  Worker  │     │  Worker  │
    │  Worker  │      │          │     │          │
    └────┬─────┘      └────┬─────┘     └────┬─────┘
         │                 │                 │
         ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐     ┌──────────┐
    │  OpenAI  │      │   SMTP   │     │  MongoDB │
    │   API    │      │  Server  │     │  (Log)   │
    └──────────┘      └──────────┘     └──────────┘

Features:
• Retry Logic (3 attempts with exponential backoff)
• Dead Letter Queue for failed messages
• Message Persistence
• Acknowledgment-based delivery
```

---

## Diagram 7: Authentication & Authorization Flow

```
┌─────────────────────────────────────────────────────────────┐
│            JWT Authentication Flow                          │
└─────────────────────────────────────────────────────────────┘

1. LOGIN:
   ┌──────────┐
   │  Client  │ POST /auth/login
   └────┬─────┘ (email + password)
        │
        ▼
   ┌──────────────────┐
   │  Auth Controller │
   └────┬─────────────┘
        │
        │ 1. Validate credentials
        │ 2. Compare password (bcrypt)
        ▼
   ┌──────────────────┐
   │   Auth Service   │
   └────┬─────────────┘
        │
        │ 3. Generate Tokens:
        │    • Access Token (15 min)
        │    • Refresh Token (7 days)
        ▼
   ┌──────────────────┐
   │  Return Tokens   │
   │  to Client       │
   └──────────────────┘

2. AUTHENTICATED REQUEST:
   ┌──────────┐
   │  Client  │ GET /threads
   └────┬─────┘ Authorization: Bearer <token>
        │
        ▼
   ┌─────────────────────┐
   │ Authenticate        │ 1. Extract token from header
   │   Middleware        │ 2. Verify signature
   └────┬────────────────┘ 3. Check expiry
        │
        │ Token Valid?
        │
   ┌────┴────┐
   │         │
   YES       NO
   │         │
   │         └──────> 401 Unauthorized
   │
   ▼
┌─────────────────┐
│   Authorize     │ Check user role (RBAC)
│   Middleware    │
└────┬────────────┘
     │
     │ Role matches?
     │
┌────┴────┐
│         │
YES       NO
│         │
│         └──────> 403 Forbidden
│
▼
┌─────────────────┐
│  Controller     │ Execute business logic
│   Handler       │
└─────────────────┘

3. TOKEN REFRESH:
   ┌──────────┐
   │  Client  │ POST /auth/refresh-token
   └────┬─────┘ (refresh token)
        │
        ▼
   ┌──────────────────┐
   │  Verify Refresh  │
   │      Token       │
   └────┬─────────────┘
        │
        │ Generate new Access Token
        ▼
   ┌──────────────────┐
   │  Return New      │
   │  Access Token    │
   └──────────────────┘
```

---

## Diagram 8: Database Schema (ER Diagram)

```
┌─────────────────────────────────────────────────────────────┐
│              MongoDB Collections Relationships              │
└─────────────────────────────────────────────────────────────┘

        ┌─────────────────────┐
        │       USERS         │
        │ ─────────────────── │
        │ _id (PK)            │
        │ name                │
        │ email (unique)      │
        │ password (hash)     │
        │ role                │
        │ isVerified          │
        │ isBanned            │
        │ avatar              │
        │ bio                 │
        └──────┬──────────────┘
               │
               │ 1:N
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌─────────────┐  ┌─────────────────┐
│  THREADS    │  │     POSTS       │
│─────────────│  │─────────────────│
│ _id (PK)    │  │ _id (PK)        │
│ title       │  │ threadId (FK)   │
│ description │  │ authorId (FK)   │
│ authorId(FK)│  │ content         │
│ status      │  │ parentId (FK)   │◄──┐
│ isPinned    │  │ status          │   │
│ viewCount   │  │ mentions[]      │   │
│ postCount   │  │ votes           │   │
│ tags[]      │  │ aiModeration    │   │
│ summary     │  │ isEdited        │   │
└──────┬──────┘  └────┬────────────┘   │
       │              │                │
       │ 1:N          │ 1:N (self)     │
       │              └────────────────┘
       └──────┐
              │
              ▼
       ┌─────────────────┐
       │  NOTIFICATIONS  │
       │─────────────────│
       │ _id (PK)        │
       │ userId (FK)     │
       │ type            │
       │ message         │
       │ relatedId       │
       │ isRead          │
       │ expiresAt       │
       └─────────────────┘

       ┌─────────────────┐
       │    REPORTS      │
       │─────────────────│
       │ _id (PK)        │
       │ reporterId (FK) │
       │ reportedUserId  │
       │ contentType     │
       │ contentId       │
       │ reason          │
       │ status          │
       │ reviewedBy (FK) │
       └─────────────────┘

       ┌─────────────────┐
       │  WEBHOOK_LOGS   │
       │─────────────────│
       │ _id (PK)        │
       │ event           │
       │ payload         │
       │ source          │
       │ status          │
       │ timestamp       │
       └─────────────────┘

Relationships:
• Users → Threads (1:N) - One user creates many threads
• Users → Posts (1:N) - One user creates many posts
• Threads → Posts (1:N) - One thread has many posts
• Posts → Posts (1:N) - One post has many replies (self-reference)
• Users → Notifications (1:N) - One user receives many notifications
• Users → Reports (N:M) - Many users can report many users/content
```

---

## Diagram 9: Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                  Security Architecture                      │
└─────────────────────────────────────────────────────────────┘

Layer 1: Network Security
┌─────────────────────────────────────────────────────────────┐
│                         HTTPS/TLS                           │
│                    SSL Certificate                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
Layer 2: API Gateway Security
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ Rate Limit  │  │    CORS     │  │  Helmet Headers  │   │
│  │ (DDoS)      │  │  (Origin)   │  │  (XSS, etc)      │   │
│  └─────────────┘  └─────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
Layer 3: Authentication
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────┐  │
│  │         JWT Token Verification                        │  │
│  │  • Signature validation                               │  │
│  │  • Expiry check                                       │  │
│  │  • Issuer validation                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
Layer 4: Authorization
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────┐  │
│  │      Role-Based Access Control (RBAC)                │  │
│  │  • User → Basic operations                           │  │
│  │  • Moderator → Moderation + User                     │  │
│  │  • Admin → Full access                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
Layer 5: Input Validation
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Zod Schema Validation                       │  │
│  │  • Type checking                                      │  │
│  │  • Length validation                                  │  │
│  │  • Format validation                                  │  │
│  │  • Sanitization                                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
Layer 6: Data Security
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Password Hashing (bcrypt)                     │  │
│  │         Sensitive Data Encryption                     │  │
│  │         SQL Injection Prevention (NoSQL)              │  │
│  │         XSS Prevention                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Color Coding for Excalidraw:

### Layer Colors:

- **Client Layer**: Light Blue (#B3D9FF)
- **API Gateway**: Orange (#FFB366)
- **Application Layer**: Green (#B3FFB3)
- **Infrastructure**: Purple (#D9B3FF)
- **Workers**: Yellow (#FFFF99)
- **External Services**: Gray (#CCCCCC)

### Component Colors:

- **Security Components**: Red (#FFB3B3)
- **Database**: Dark Blue (#6699FF)
- **Cache**: Light Green (#99FF99)
- **Queue**: Light Orange (#FFCC99)
- **Real-Time**: Light Purple (#CC99FF)

### Arrow Colors:

- **HTTP Request**: Black (solid)
- **WebSocket**: Blue (dashed)
- **Async Job**: Orange (dashed)
- **Database Query**: Green (solid)
- **Cache Request**: Purple (dashed)

---

## How to Draw in Excalidraw:

1. **Go to**: https://excalidraw.com
2. **Create rectangles** for each layer/component
3. **Use arrows** to show data flow
4. **Add text labels** for descriptions
5. **Group related components** together
6. **Use colors** as specified above
7. **Export as PNG** or **copy link** to share
8. **Take screenshot** and save

---

## Tips for Better Diagrams:

1. **Start from top (Client) and work down**
2. **Keep spacing consistent** between components
3. **Use alignment tools** in Excalidraw
4. **Add icons** from Excalidraw library (optional)
5. **Keep text readable** (min font size 16)
6. **Use rounded rectangles** for components
7. **Use straight arrows** with labels
8. **Group layers visually** with background rectangles

---

## Screenshot Dimensions:

**Recommended sizes:**

- Full system diagram: 1920x1080 (landscape)
- Flow diagrams: 1200x800 (landscape)
- Component diagrams: 800x600 (square-ish)

---

Ei guide follow kore tumi easily Excalidraw te complete backend system design draw korte parbe!
