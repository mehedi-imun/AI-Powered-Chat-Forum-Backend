# 🤖 AI-Powered Chat Forum

A modern, scalable forum application with AI-powered content moderation and thread summarization capabilities.

## 🌐 Live Demo
**Frontend:** `https://main.dvxyjp4nr52h2.amplifyapp.com`

**Backend API:** `https://mehediimun.duckdns.org`

## 📋 Local Setup Instructions for backend

### Docker Compose

```bash
git clone https://github.com/mehedi-imun/AI-Powered-Chat-Forum-Backend.git
cd AI-Powered-Chat-Forum-Backend

# Copy environment file
cp .env.example .env
# Start all services with Docker
npm run docker:dev
npm run docker:dev:down

# View logs
npm run docker:dev:logs
```
#### Access the Application
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000

---

## 🏗️ Architecture Overview

### System Design

```
┌────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                        │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│              EXPRESS.JS MONOLITH                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Security: Helmet, CORS, Rate Limiter            │   │
│  │ Auth: JWT (Access 15m + Refresh 7d)             │   │
│  │ Validation: Zod schemas                         │   │ 
│  └─────────────────────────────────────────────────┘   │
│                                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 7 Business Modules:                             │   │
│  │ Auth, Users, Threads, Posts,                    │   │
│  │ Notifications, Admin, Webhooks                  │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────┬───────────────────────────────────┘
                     │
          ┌──────────┼──────────┐
          │          │          │
          ▼          ▼          ▼
    ┌─────────┐ ┌─────────┐ ┌──────────┐
    │ MongoDB │ │  Redis  │ │ RabbitMQ │
    │ (Data)  │ │ (Cache) │ │ (Queue)  │
    └─────────┘ └─────────┘ └─────┬────┘
                                  │
                     ┌────────────┴──────────────┐
                     │                           │
                     ▼                           ▼
              ┌────────────┐              ┌────────────┐
              │ 4 Workers: │              │ 6 Cron Jobs│
              │ • AI Mod   │              │ • Cleanup  │
              │ • Summary  │              │ • Digest   │
              │ • Email    │              │ • Stats    │
              │ • Webhook  │              │ • Health   │
              └────────────┘              └────────────┘
                     │
                     ▼
              ┌────────────┐
              │ OpenRouter │
              └────────────┘
```


### Key Technologies

| Component      | Technology           | Purpose                        |
| -------------- | -------------------- | ------------------------------ |
| **Runtime**    | Node.js + TypeScript | Type-safe JavaScript           |
| **Framework**  | Express.js           | RESTful API                    |
| **Database**   | MongoDB + Mongoose   | Document store                 |
| **Cache**      | Redis + IORedis      | Performance boost              |
| **Queue**      | RabbitMQ             | Async job processing           |
| **Real-time**  | Socket.IO            | Live updates                   |
| **AI**         | Open Router          | Content moderation + summaries |
| **Auth**       | JWT (jsonwebtoken)   | Stateless authentication       |
| **Validation** | Zod                  | Schema validation              |
| **Email**      | Nodemailer           | SMTP email sending             |
| **Logging**    | Pino                 | Structured JSON logs           |
| **Security**   | Helmet, CORS, bcrypt | Multi-layer protection         |
| **Monitoring** | Prometheus           | API response times             |
| **Metrics**    | Grafana              |real-time system monitoring     |


## 🔑 Key Features
### Core Functionality

✅ **User Management**: Registration, login, profile, email verification  
✅ **Threads & Posts**: Create, edit, delete discussions with nested replies  
✅ **Real-time Updates**: WebSocket-based live thread updates  
✅ **Search**: Full-text search across threads  
✅ **Notifications**: In-app notifications for mentions/replies

### AI Features
🤖 **Content Moderation**: ai automatically flags inappropriate content  
📝 **Thread Summaries**: AI-generated summaries of long discussions

### Admin Features
👨‍💼 **User Management**: Ban/unban users, role management  
📊 **Analytics Dashboard**: User/thread/post statistics  
🚨 **Report System**: Users can report inappropriate content  
📜 **Activity Logs**: Track admin actions

### Security
🔒 **JWT Authentication** (access + refresh tokens)  
🛡️ **Role-based Access Control** (User, Moderator, Admin)  
⏱️ **Rate Limiting** (20 req/15min for auth, 100 for others)  
🔐 **Password Hashing** (bcrypt with salt rounds: 12)  
🚫 **Input Validation** (Zod schemas on all endpoints)  
📧 **Email Verification** required for posting

---

## 📁 Project Structure

```
chat-forum/
├── backend/
│   ├── src/
│   │   ├── modules/           
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── threads/
│   │   │   ├── posts/
│   │   │   ├── notifications/
│   │   │   ├── admin/
│   │   │   └── webhook/
│   │   ├── workers/           
│   │   │   ├── ai-moderation.worker.ts
│   │   │   ├── ai-summary.worker.ts
│   │   │   ├── notification.worker.ts
│   │   │   └── webhook.worker.ts
│   │   ├── services/          
│   │   │   ├── email.service.ts
│   │   │   ├── ai.service.ts
│   │   │   ├── queue.service.ts
│   │   │   └── cron.service.ts
│   │   ├── middlewares/       
│   │   ├── utils/             
│   │   ├── config/           
│   │   ├── app.ts  
│   │   ├── app.ts             
│   │   ├── Tests/                       
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── docker-compose.dev.yml  
└── ├── README.md
```
---

## Testing

```bash
# Unit tests, integration tests, E2E tests
npm run test
# Coverage report
npm run test:coverage
npm run test:watch
npm run test:verbose
```
    
---
## Deployment Production 
platforms:
- **Backend:**  AWS EC2 instance-1
- **Database:** MongoDB Atlas 
- **redis** Redis Cloud
- **Grafana/Prometheus/RMQ:** AWS EC2 instance-2
---

### Known Limitations
⚠️ **File Uploads**: Not supported (text-only posts)  
⚠️ **Search**: Basic text search (no advanced filters)  
⚠️ **Internationalization**: English only

### Future Improvements
🔮 Microservices architecture for better scalability  
🔮 GraphQL API for flexible queries  
🔮 Image/file upload support (S3 integration)  
🔮 Advanced search with Elasticsearch  
🔮 Push notifications (FCM/APNS)  
🔮 Two-factor authentication (2FA)  
🔮 Social login (OAuth: Google, GitHub)

---

