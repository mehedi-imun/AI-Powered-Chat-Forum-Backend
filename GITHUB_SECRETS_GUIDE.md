# GitHub Secrets Configuration Guide

This guide shows you **exactly** which GitHub Secrets to add for your CI/CD pipeline based on your working `.env` file.

## 📋 How to Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret below

---

## ✅ Section 1: Ready to Copy from Your .env (19 Secrets)

These values are already configured in your `.env` file. **Copy-paste them directly:**

### Database & Cache (2 secrets)

```plaintext
Name: DATABASE_URL
Value: mongodb+srv://mehediimun_db_user:c2tQmsP1QJIrsBlV@cluster0.hjpiy9v.mongodb.net/?appName=Cluster0
```

```plaintext
Name: REDIS_URL
Value: redis://default:j47s9tvBQe4jnSNgZoLlP6pv23P5isEz@redis-18241.crce185.ap-seast-1-1.ec2.redns.redis-cloud.com:18241
```

### JWT Configuration (4 secrets)

```plaintext
Name: JWT_SECRET
Value: dev-secret-key-change-in-production-12345678
```

```plaintext
Name: JWT_EXPIRES_IN
Value: 7d
```

```plaintext
Name: JWT_REFRESH_SECRET
Value: dev-refresh-secret-key-change-in-production-87654321
```

```plaintext
Name: JWT_REFRESH_EXPIRES_IN
Value: 7d
```

### RabbitMQ Configuration (2 secrets)

```plaintext
Name: RABBITMQ_DEFAULT_USER
Value: admin
```

```plaintext
Name: RABBITMQ_DEFAULT_PASS
Value: admin123
```

### Email (SMTP) Configuration (5 secrets)

```plaintext
Name: SMTP_HOST
Value: smtp.gmail.com
```

```plaintext
Name: SMTP_PORT
Value: 465
```

```plaintext
Name: SMTP_USER
Value: level2@programming-hero.com
```

```plaintext
Name: SMTP_PASSWORD
Value: tvnwbozqtlznzbvh
```

```plaintext
Name: EMAIL_FROM
Value: level2@programming-hero.com
```

### Rate Limiting (2 secrets)

```plaintext
Name: RATE_LIMIT_WINDOW_MS
Value: 900000
```

```plaintext
Name: RATE_LIMIT_MAX_REQUESTS
Value: 100
```

### AI (OpenRouter) Configuration (2 secrets)

```plaintext
Name: OPENROUTER_API_KEY
Value: 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
```

```plaintext
Name: OPENROUTER_MODEL
Value: mistralai/mistral-7b-instruct:free
```

### Grafana Configuration (2 secrets)

```plaintext
Name: GF_SECURITY_ADMIN_USER
Value: admin
```

```plaintext
Name: GF_SECURITY_ADMIN_PASSWORD
Value: admin123
```

---

## ❌ Section 2: You Need to Create These (9 Secrets)

### 1. Docker Hub Credentials (2 secrets)

**Create Docker Hub account and token:**

1. Go to https://hub.docker.com/
2. Sign up or login
3. Click your username → **Account Settings** → **Security** → **New Access Token**
4. Token name: `github-actions`, Access: **Read, Write, Delete**
5. Copy the token (only shown once!)

```plaintext
Name: DOCKERHUB_USERNAME
Value: [your-dockerhub-username]
```

```plaintext
Name: DOCKERHUB_TOKEN
Value: [your-access-token-from-step-3]
```

---

### 2. AWS EC2 IPs (3 secrets)

**Get IPs after running Pulumi:**

Run this command in `infra/` folder:

```bash
cd ../infra
pulumi up
```

After deployment completes, you'll see outputs like:

```
Outputs:
    backendPublicIp : "54.123.45.67"
    infraPublicIp   : "34.98.76.54"
```

```plaintext
Name: EC2_BACKEND_IP
Value: [backendPublicIp from pulumi output]
```

```plaintext
Name: EC2_INFRA_IP
Value: [infraPublicIp from pulumi output]
```

**Get private IP for RabbitMQ connection:**

SSH to infra instance:

```bash
ssh -i infra/my-key.pem ec2-user@[EC2_INFRA_IP]
hostname -I | awk '{print $1}'
```

```plaintext
Name: EC2_INFRA_PRIVATE_IP
Value: [output from hostname command, e.g., 10.0.1.123]
```

---

### 3. SSH Keys (2 secrets)

Both EC2 instances use the same SSH key. Read your existing key:

```bash
cat infra/my-key.pem
```

Copy the **entire output** (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`)

```plaintext
Name: EC2_BACKEND_SSH_KEY
Value: [entire content of infra/my-key.pem]
```

```plaintext
Name: EC2_INFRA_SSH_KEY
Value: [entire content of infra/my-key.pem - same as above]
```

---

### 4. Frontend & Site Configuration (2 secrets)

**After deploying to Vercel:**

```plaintext
Name: FRONTEND_URL
Value: [your-vercel-url, e.g., https://chat-forum.vercel.app]
```

```plaintext
Name: SITE_URL
Value: [same as FRONTEND_URL]
```

**Until Vercel deployment:**

- Use temporary value: `http://localhost:3000`
- Update after Vercel deployment

---

### 5. Site Name (1 secret)

```plaintext
Name: SITE_NAME
Value: Chat Forum
```

---

### 6. Webhook Secret (1 secret)

**Generate a secure random string:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```plaintext
Name: WEBHOOK_SECRET
Value: [output from command above]
```

---

## 📊 Summary Checklist

### ✅ Ready to Copy (19 secrets):

- [x] DATABASE_URL
- [x] REDIS_URL
- [x] JWT_SECRET
- [x] JWT_EXPIRES_IN
- [x] JWT_REFRESH_SECRET
- [x] JWT_REFRESH_EXPIRES_IN
- [x] RABBITMQ_DEFAULT_USER
- [x] RABBITMQ_DEFAULT_PASS
- [x] SMTP_HOST
- [x] SMTP_PORT
- [x] SMTP_USER
- [x] SMTP_PASSWORD
- [x] EMAIL_FROM
- [x] RATE_LIMIT_WINDOW_MS
- [x] RATE_LIMIT_MAX_REQUESTS
- [x] OPENROUTER_API_KEY
- [x] OPENROUTER_MODEL
- [x] GF_SECURITY_ADMIN_USER
- [x] GF_SECURITY_ADMIN_PASSWORD

### ❌ Need to Create (9 secrets):

- [ ] DOCKERHUB_USERNAME (create at hub.docker.com)
- [ ] DOCKERHUB_TOKEN (create at hub.docker.com)
- [ ] EC2_BACKEND_IP (from `pulumi up` output)
- [ ] EC2_INFRA_IP (from `pulumi up` output)
- [ ] EC2_INFRA_PRIVATE_IP (SSH and run `hostname -I`)
- [ ] EC2_BACKEND_SSH_KEY (from `infra/my-key.pem`)
- [ ] EC2_INFRA_SSH_KEY (from `infra/my-key.pem`)
- [ ] FRONTEND_URL (Vercel URL or temp: http://localhost:3000)
- [ ] SITE_URL (same as FRONTEND_URL)
- [ ] SITE_NAME (value: "Chat Forum")
- [ ] WEBHOOK_SECRET (generate with crypto command)

---

## 🚀 Deployment Steps

1. **Add all 28 GitHub Secrets** (19 ready + 9 to create)
2. **Deploy infrastructure:**
   ```bash
   cd infra
   pulumi up
   ```
3. **Get EC2 IPs** from Pulumi output and add to GitHub Secrets
4. **Deploy to Vercel** (frontend) and update `FRONTEND_URL` + `SITE_URL` secrets
5. **Push code to trigger CI/CD:**
   ```bash
   git add .
   git commit -m "Deploy with CI/CD"
   git push origin main
   ```
6. **Monitor deployment:** GitHub Actions → Actions tab
7. **Access services:**
   - Backend: `http://[EC2_BACKEND_IP]:5000`
   - RabbitMQ: `http://[EC2_INFRA_IP]:15672` (admin/admin123)
   - Grafana: `http://[EC2_INFRA_IP]:3000` (admin/admin123)
   - Prometheus: `http://[EC2_INFRA_IP]:9090`

---

## ⚠️ Security Notes

1. **Change these in production:**

   - JWT_SECRET and JWT_REFRESH_SECRET (use strong random strings)
   - RabbitMQ credentials (RABBITMQ_DEFAULT_USER/PASS)
   - Grafana credentials (GF_SECURITY_ADMIN_USER/PASSWORD)

2. **Never commit secrets to Git:**

   - `.env` files are in `.gitignore`
   - SSH keys are in `.gitignore`
   - All secrets stored in GitHub Secrets (encrypted)

3. **Rotate credentials regularly:**
   - Docker Hub tokens
   - API keys (OpenRouter, etc.)
   - Database passwords

---

## 🔧 Troubleshooting

### Secret not found error:

```
Error: Context access might be invalid: [SECRET_NAME]
```

**Solution:** Add the secret to GitHub Secrets

### SSH connection failed:

```
Permission denied (publickey)
```

**Solution:**

1. Check `EC2_BACKEND_SSH_KEY` and `EC2_INFRA_SSH_KEY` secrets
2. Ensure key has correct format (starts with `-----BEGIN`)
3. Check EC2 security group allows SSH (port 22)

### Docker pull failed:

```
unauthorized: authentication required
```

**Solution:**

1. Verify `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`
2. Check token has Read, Write, Delete permissions

### Service health check failed:

**Solution:**

1. SSH to EC2 instance
2. Check logs: `docker logs chat-forum-backend`
3. Verify environment variables in container: `docker exec chat-forum-backend env`

---

## 📝 Quick Reference

**Total Secrets Required:** 28

**Deployment Flow:**

```
Git Push → GitHub Actions → Build Docker Image →
Push to Docker Hub → Deploy to EC2 Backend →
Deploy to EC2 Infra (RabbitMQ, Grafana, Prometheus) →
Health Check → Done! 🎉
```

**Important Files:**

- `.env` - Local development (NOT committed)
- `.github/workflows/deploy.yml` - CI/CD pipeline
- `infra/index.ts` - Pulumi infrastructure
- `Dockerfile` - Production Docker build
- `docker-compose.yml` - Production compose

---

✅ **Your deployment is now fully automated!** Every push to `main` branch will trigger the complete deployment pipeline.
