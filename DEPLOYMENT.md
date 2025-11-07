# CI/CD Deployment Guide

## 🚀 Quick Setup

### 1. Deploy Infrastructure (One-time)

```bash
cd infra/
pulumi up
```

Get the outputs:

- Backend EC2 IP
- Infra EC2 IP
- Infra EC2 Private IP

### 2. Setup EC2 Instances (One-time)

**Backend EC2:**

```bash
ssh -i your-key.pem ec2-user@<BACKEND_IP>

# Install Docker
sudo yum update -y
sudo amazon-linux-extras install docker -y
sudo service docker start
sudo systemctl enable docker
sudo usermod -a -G docker ec2-user

# Install docker-compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create app directory
mkdir -p /home/ec2-user/app
exit
```

**Infra EC2 (same steps):**

```bash
ssh -i your-key.pem ec2-user@<INFRA_IP>
# Run same commands as above
```

### 3. Configure GitHub Secrets

Go to: **Settings → Secrets and variables → Actions → New repository secret**

#### Required Secrets:

**Docker Hub:**

- `DOCKERHUB_USERNAME` - Your Docker Hub username
- `DOCKERHUB_TOKEN` - Docker Hub access token (create at hub.docker.com/settings/security)

**EC2 Access:**

- `EC2_BACKEND_IP` - Backend EC2 public IP
- `EC2_BACKEND_SSH_KEY` - SSH private key content (PEM file)
- `EC2_INFRA_IP` - Infra EC2 public IP
- `EC2_INFRA_PRIVATE_IP` - Infra EC2 **private** IP (for RabbitMQ connection)
- `EC2_INFRA_SSH_KEY` - SSH private key content (PEM file)

**Database & Cache (External Services):**

- `MONGO_URI` - MongoDB Atlas connection string
- `REDIS_HOST` - Redis Cloud host
- `REDIS_PORT` - Redis Cloud port (default: 16379)
- `REDIS_PASSWORD` - Redis Cloud password

**Application:**

- `JWT_SECRET` - Minimum 32 characters
- `JWT_REFRESH_SECRET` - Minimum 32 characters
- `OPENAI_API_KEY` - OpenAI API key
- `OPENROUTER_API_KEY` - OpenRouter API key (optional)
- `OPENROUTER_MODEL` - Model name (default: mistralai/mistral-7b-instruct:free)
- `WEBHOOK_SECRET` - Webhook secret (optional)

**Email (SMTP):**

- `SMTP_HOST` - SMTP server (e.g., smtp.gmail.com)
- `SMTP_PORT` - SMTP port (587 or 465)
- `SMTP_USER` - SMTP username/email
- `SMTP_PASSWORD` - SMTP password (use App Password for Gmail)
- `EMAIL_FROM` - From email address

**Admin:**

- `ADMIN_EMAIL` - Admin user email
- `ADMIN_PASSWORD` - Admin user password

**Services:**

- `RABBITMQ_USER` - RabbitMQ username (e.g., admin)
- `RABBITMQ_PASSWORD` - RabbitMQ password
- `GRAFANA_ADMIN_USER` - Grafana username (e.g., admin)
- `GRAFANA_ADMIN_PASSWORD` - Grafana password

**Frontend:**

- `FRONTEND_URL` - Frontend URL on Vercel (e.g., https://your-app.vercel.app)

### 4. Push to Deploy

```bash
git add .
git commit -m "feat: setup CI/CD"
git push origin main
```

## 📊 CI/CD Flow

```
Push to main
    ↓
Build Docker Image (Dockerfile)
    ↓
Push to Docker Hub
    ↓
├─→ Deploy Backend EC2
│   ├─ SSH to instance
│   ├─ Create docker-compose.yml
│   ├─ Create .env file
│   ├─ Pull Docker image
│   └─ Start container
│
└─→ Deploy Infra EC2
    ├─ SSH to instance
    ├─ Create docker-compose.yml (RabbitMQ, Grafana, Prometheus)
    ├─ Create prometheus.yml
    ├─ Create .env file
    └─ Start containers
    ↓
Health Checks
    ↓
✅ Complete
```

## 🌐 Access Services

After deployment:

- **Backend API:** `http://<BACKEND_IP>:5000`
- **API Health:** `http://<BACKEND_IP>:5000/health`
- **API Docs:** `http://<BACKEND_IP>:5000/api/v1`
- **RabbitMQ Management:** `http://<INFRA_IP>:15672`
- **Grafana:** `http://<INFRA_IP>:3000`
- **Prometheus:** `http://<INFRA_IP>:9090`

## 🔧 Manual Commands

### View Logs

**Backend:**

```bash
ssh -i key.pem ec2-user@<BACKEND_IP>
cd /home/ec2-user/app
docker-compose logs -f
```

**Infra:**

```bash
ssh -i key.pem ec2-user@<INFRA_IP>
cd /home/ec2-user/app
docker-compose logs -f
```

### Restart Services

```bash
docker-compose restart
```

### Manual Deployment

```bash
docker pull <DOCKERHUB_USERNAME>/chat-forum-backend:latest
docker-compose down
docker-compose up -d
```

## ⚠️ Important Notes

1. **SSH Keys:** Keep `.pem` files secure, never commit
2. **Private IP:** Use infra instance's **private IP** for RabbitMQ connection from backend
3. **Security Groups:** Ensure ports are open:
   - Backend: 22 (SSH), 5000 (API)
   - Infra: 22 (SSH), 5672 (RabbitMQ), 15672 (RabbitMQ UI), 3000 (Grafana), 9090 (Prometheus)
4. **MongoDB Atlas:** Whitelist EC2 backend public IP
5. **Redis Cloud:** Whitelist EC2 backend public IP

## 🛠️ Troubleshooting

### Deployment Failed

Check GitHub Actions logs or SSH to EC2:

```bash
ssh -i key.pem ec2-user@<IP>
cd /home/ec2-user/app
docker ps -a
docker-compose logs
```

### Container Won't Start

```bash
docker-compose down
docker system prune -af
docker pull <image>:latest
docker-compose up -d
```

### Health Check Failed

```bash
curl http://<BACKEND_IP>:5000/health
docker logs chat-forum-backend
```

## 📋 Pre-Deployment Checklist

- [ ] Pulumi infrastructure deployed
- [ ] EC2 instances running
- [ ] Docker installed on both EC2 instances
- [ ] All GitHub secrets configured
- [ ] MongoDB Atlas cluster ready with whitelisted IP
- [ ] Redis Cloud instance ready with whitelisted IP
- [ ] Docker Hub account created
- [ ] SSH keys available
- [ ] Security groups configured correctly

## 🔄 Rollback

If deployment fails, redeploy previous version:

```bash
ssh -i key.pem ec2-user@<BACKEND_IP>
cd /home/ec2-user/app
docker pull <DOCKERHUB_USERNAME>/chat-forum-backend:<previous-commit-sha>
# Edit docker-compose.yml to use old tag
docker-compose up -d
```

Or re-run previous GitHub Actions workflow.
