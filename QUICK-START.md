# 🚀 Development Quick Start

## Start Development Server (with Hot Reload)
```bash
docker-compose up -d backend
docker logs chat-forum-backend -f  # Watch logs
```

## Make Code Changes
1. Edit any `.ts` file in `backend/src/`
2. Save the file
3. Server will auto-restart in 2-4 seconds ✅
4. **NO REBUILD NEEDED!** 🎉

## When DO You Need to Rebuild?

### Only rebuild if you:
- ✅ Add/remove npm packages (`package.json` changed)
- ✅ Modify `Dockerfile.dev`

```bash
docker-compose build backend
docker-compose up -d backend
```

### Don't rebuild if you:
- ❌ Edit `.ts` files → Auto-reload handles it
- ❌ Add new files in `src/` → Auto-reload handles it
- ❌ Modify `.env` → Just restart: `docker-compose restart backend`

## Common Commands

```bash
# View logs
docker logs chat-forum-backend -f

# Restart (if needed)
docker-compose restart backend

# Stop
docker-compose stop backend

# Stop and remove
docker-compose down backend

# Check status
docker ps | grep backend
```

## Development vs Production

| Aspect | Development | Production |
|--------|------------|-----------|
| Dockerfile | `Dockerfile.dev` | `Dockerfile` |
| Command | `npx ts-node-dev` | `node dist/server.js` |
| NODE_ENV | `development` | `production` |
| Hot Reload | ✅ Yes | ❌ No |
| Build Time | Fast (no rebuild) | Slower (TypeScript compile) |
| Dependencies | All (including dev) | Production only |

## Troubleshooting

**Server not responding?**
```bash
docker logs chat-forum-backend --tail 50
```

**Hot reload not working?**
```bash
docker-compose restart backend
```

**Need fresh start?**
```bash
docker-compose down backend
docker-compose up -d backend
```

---

📖 For detailed info, see: [DEV-MODE.md](./DEV-MODE.md)
