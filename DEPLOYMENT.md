# Backend Deployment Guide

## 🚀 Quick Start

### Development Mode (Local)
```bash
# Start all services (MongoDB, Redis, RabbitMQ, Backend)
npm run docker:dev

# View logs
npm run docker:dev:logs

# Stop services
npm run docker:dev:down
```

### Production Mode (Deploy)
```bash
# Start with production Dockerfile
npm run docker:prod

# With monitoring (Prometheus + Grafana)
npm run docker:monitoring

# View logs
npm run docker:prod:logs

# Stop services
npm run docker:prod:down
```

## 📋 Files Overview

- `docker-compose.yml` - **Production setup** (push to GitHub for CI/CD)
- `docker-compose.dev.yml` - Development setup (hot reload)
- `Dockerfile` - Production build
- `Dockerfile.dev` - Development with hot reload

## 🔐 Environment Variables

Create a `.env` file in the backend directory:

```env
# App
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-frontend-url.com

# Database
DATABASE_URL=mongodb://admin:admin123@mongodb:27017/chat_forum?authSource=admin

# Or use external MongoDB
# DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# Redis
REDIS_URL=redis://redis:6379

# RabbitMQ
RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672

# JWT
JWT_SECRET=your-production-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d

# AI
OPENROUTER_API_KEY=your-api-key
OPENROUTER_MODEL=mistralai/mistral-7b-instruct:free
SITE_URL=https://your-site.com
SITE_NAME=Chat Forum

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@chatforum.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🔧 CI/CD Setup

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Copy files to server
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_KEY }}
          source: "backend/*"
          target: "/var/www/chat-forum"
      
      - name: Deploy with Docker Compose
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /var/www/chat-forum/backend
            docker-compose down
            docker-compose up -d --build
```

## 🌐 Server Deployment (VPS/Cloud)

### 1. Clone Repository
```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo/backend
```

### 2. Setup Environment
```bash
cp .env.example .env
nano .env  # Edit with your values
```

### 3. Deploy
```bash
# Production
docker-compose up -d --build

# With monitoring
docker-compose --profile monitoring up -d --build
```

### 4. Check Status
```bash
docker-compose ps
docker-compose logs backend -f
```

## 📊 Monitoring

Access Grafana: `http://your-server:3001`
- Username: `admin` (or from env)
- Password: `admin123` (or from env)

Access Prometheus: `http://your-server:9090`

## 🔍 Useful Commands

```bash
# View logs
npm run logs:view

# Check container status
docker-compose ps

# Restart backend only
docker-compose restart backend

# Rebuild and restart
docker-compose up -d --build backend

# Clean up
docker-compose down -v  # Remove volumes too
```

## 🛠️ Troubleshooting

### Backend won't start
```bash
# Check logs
docker-compose logs backend

# Check environment
docker-compose exec backend env | grep NODE_ENV
```

### Database connection issues
```bash
# Check MongoDB
docker-compose exec mongodb mongosh -u admin -p admin123

# Check Redis
docker-compose exec redis redis-cli ping
```

### Port already in use
```bash
# Change ports in .env or docker-compose.yml
PORT=8000  # Different port
```

## 📦 Update Deployment

```bash
git pull origin main
docker-compose down
docker-compose up -d --build
```

## 🔐 Security Notes

1. **Never commit `.env` file** - It's in `.gitignore`
2. **Use strong passwords** in production
3. **Enable firewall** - Only expose necessary ports
4. **Use SSL/TLS** - Setup reverse proxy (nginx/traefik)
5. **Regular updates** - Keep Docker images updated

## 📞 Support

For issues, check logs first:
```bash
npm run logs:view
```
