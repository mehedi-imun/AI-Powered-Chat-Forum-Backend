# Development Mode Setup (Hot Reload)

## 🔥 Hot Reload এখন Active!

এখন আপনি code change করলে **আর Docker rebuild করতে হবে না**। Server automatically restart হবে।

## কিভাবে কাজ করে?

### 1. Development Dockerfile (`Dockerfile.dev`)
- সব dependencies (devDependencies সহ) install করে
- `ts-node-dev` use করে যা file changes detect করে
- Source code volume mount করা থাকে

### 2. Volume Mounting
```yaml
volumes:
  - ./backend/src:/app/src  # Source code live sync
  - ./backend/logs:/app/logs # Logs folder
```

### 3. Auto-Restart
- `ts-node-dev` file watcher হিসেবে কাজ করে
- কোনো `.ts` file change হলে server automatic restart হয়
- সাধারণত **2-4 seconds** লাগে restart হতে

## Development Commands

### Start করুন (hot reload সহ):
```bash
docker-compose up -d backend
```

### Logs দেখুন:
```bash
docker logs chat-forum-backend -f
```

### Stop করুন:
```bash
docker-compose stop backend
```

### Restart করুন (যদি লাগে):
```bash
docker-compose restart backend
```

## কখন Rebuild লাগবে?

শুধুমাত্র এই cases-এ rebuild করতে হবে:

1. **`package.json` change** (নতুন dependency add করলে):
   ```bash
   docker-compose build backend
   docker-compose up -d backend
   ```

2. **`Dockerfile.dev` change** করলে

3. **Environment variables** (docker-compose.yml-এ) change করলে:
   ```bash
   docker-compose up -d backend  # শুধু recreate, rebuild না
   ```

## ⚠️ Important Notes

- **`.ts` files**: Auto-reload ✅
- **`.env` file**: Manual restart লাগবে
- **`package.json`**: Rebuild লাগবে
- **Static files** (যদি থাকে): Auto-reload ✅

## Production Mode

Production-এ deploy করার সময় original `Dockerfile` use হবে:

```yaml
build:
  context: ./backend
  dockerfile: Dockerfile  # Change from Dockerfile.dev
environment:
  NODE_ENV: production
```

## Troubleshooting

### Hot reload কাজ করছে না?

1. Check logs:
   ```bash
   docker logs chat-forum-backend --tail 50
   ```

2. `ts-node-dev` running আছে কিনা:
   ```bash
   docker exec chat-forum-backend ps aux | grep ts-node
   ```

3. Volume mount ঠিক আছে কিনা:
   ```bash
   docker exec chat-forum-backend ls -la /app/src
   ```

### Server crash হচ্ছে?

```bash
# Full logs দেখুন
docker logs chat-forum-backend

# Container status
docker ps -a | grep backend
```

## Example Workflow

1. Code edit করুন (`backend/src/services/ai.service.ts`)
2. File save করুন
3. Wait 2-4 seconds
4. Check logs: `docker logs chat-forum-backend --tail 20`
5. দেখবেন "🚀 Server is running on port 5000" message নতুন timestamp-এ

🎉 **Enjoy fast development without constant rebuilds!**
