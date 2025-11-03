# 📊 Monitoring & Logging Stack

## 🎯 Overview

Complete monitoring and logging solution for Chat Forum Application with:

- **Pino** - Fast, structured JSON logging
- **Pino-Pretty** - Beautiful console logs for development
- **Prometheus** - Metrics collection and monitoring
- **Grafana** - Beautiful dashboards and visualization

---

## 🚀 Quick Start

### Start All Services
```bash
docker-compose up -d
```

This starts:
- ✅ Backend API (Port 5000) with Pino logging
- ✅ Prometheus (Port 9090) - Metrics database
- ✅ Grafana (Port 3001) - Dashboards

### Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| **Backend API** | http://localhost:5000 | - |
| **Metrics Endpoint** | http://localhost:5000/metrics | - |
| **Prometheus** | http://localhost:9090 | - |
| **Grafana** | http://localhost:3001 | admin / admin123 |

---

## 📝 Pino Logging

### Features

- **Fast Performance**: 5x faster than Winston
- **Structured JSON**: Easy to parse and analyze
- **Pretty Printing**: Colorized logs in development
- **Auto HTTP Logging**: via `pino-http` middleware
- **File Logging**: Separate error.log and combined.log (production)

### Log Levels

```typescript
logger.debug("Debug message");    // 🐛 Debug
logger.info("Info message");      // ℹ️  Info
logger.warn("Warning message");   // ⚠️  Warning
logger.error("Error message");    // ❌ Error
```

### Development Logs (Pretty)

```bash
docker logs chat-forum-backend -f
```

Output:
```
[2025-11-03 17:05:10.482 +0000] INFO:  ✅ MongoDB connected successfully
[2025-11-03 17:05:10.588 +0000] INFO:  🚀 Server is running on port 5000
```

### Production Logs (JSON)

In production, logs are written as structured JSON:

```json
{
  "level": "info",
  "time": 1730656010482,
  "pid": 25,
  "hostname": "backend-container",
  "msg": "✅ MongoDB connected successfully"
}
```

### File Locations

- `/app/logs/combined.log` - All logs
- `/app/logs/error.log` - Error logs only

---

## 📊 Prometheus Metrics

### Available Metrics

**System Metrics:**
- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `nodejs_heap_size_used_bytes` - Heap memory
- `nodejs_eventloop_lag_seconds` - Event loop lag

**HTTP Metrics:**
- `http_request_duration_seconds` - Request latency
- `http_request_duration_seconds_count` - Request count
- `http_request_duration_seconds_sum` - Total request time

### Query Examples

#### Request Rate (per second)
```promql
rate(http_request_duration_seconds_count[5m])
```

#### 95th Percentile Latency
```promql
histogram_quantile(0.95, 
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, method, path)
) * 1000
```

#### Error Rate (4xx + 5xx)
```promql
sum(rate(http_request_duration_seconds_count{status_code=~"[45].."}[5m]))
```

#### Memory Usage
```promql
process_resident_memory_bytes / 1024 / 1024
```

### Access Metrics

**Via API:**
```bash
curl http://localhost:5000/metrics
```

**Via Prometheus UI:**
```
http://localhost:9090
```

---

## 📈 Grafana Dashboards

### Pre-configured Dashboard: "Chat Forum API"

**Panels:**
1. **Backend Status** - Service health (up/down)
2. **Request Rate** - Requests per second by endpoint
3. **Response Time** - p50 and p95 latency
4. **HTTP Status Codes** - 2xx, 4xx, 5xx breakdown
5. **CPU Usage** - Process CPU percentage
6. **Memory Usage** - RSS, Heap Total, Heap Used

### Access Dashboard

1. Open Grafana: http://localhost:3001
2. Login: `admin` / `admin123`
3. Go to **Dashboards** → **Chat Forum API Dashboard**

### Create Custom Dashboard

1. Click **+** → **Dashboard**
2. Add Panel → Select **Prometheus** datasource
3. Enter PromQL query
4. Customize visualization
5. Save dashboard

---

## 🔍 Monitoring Best Practices

### 1. Watch Key Metrics

**Golden Signals:**
- **Latency**: Response time (p50, p95, p99)
- **Traffic**: Request rate
- **Errors**: Error rate (4xx, 5xx)
- **Saturation**: CPU, Memory, Event Loop Lag

### 2. Set Up Alerts (Future)

Add alerting rules in Prometheus:

```yaml
# monitoring/alerts.yml
groups:
  - name: chat_forum_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_request_duration_seconds_count{status_code=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
```

### 3. Log Aggregation

For production, consider:
- **Loki** (Grafana) - Log aggregation
- **ELK Stack** - Elasticsearch, Logstash, Kibana
- **Datadog** - Commercial solution

---

## 🛠️ Troubleshooting

### Prometheus Not Scraping?

1. Check target status:
   ```bash
   curl http://localhost:9090/api/v1/targets
   ```

2. Verify backend metrics endpoint:
   ```bash
   curl http://localhost:5000/metrics
   ```

3. Check Prometheus logs:
   ```bash
   docker logs chat-forum-prometheus
   ```

### Grafana Dashboard Empty?

1. Wait 30 seconds for data collection
2. Generate traffic:
   ```bash
   for i in {1..10}; do curl http://localhost:5000/health; done
   ```
3. Check datasource connection in Grafana

### Logs Not Showing?

1. Check backend logs:
   ```bash
   docker logs chat-forum-backend -f
   ```

2. Verify Pino is installed:
   ```bash
   docker exec chat-forum-backend npm list pino
   ```

3. Check log files (production):
   ```bash
   docker exec chat-forum-backend ls -la /app/logs/
   ```

---

## 📦 Environment Variables

### Logging Configuration

```env
NODE_ENV=development  # Use 'production' for JSON logs
```

### Monitoring Ports

```yaml
# docker-compose.yml
ports:
  - '5000:5000'  # Backend + /metrics
  - '9090:9090'  # Prometheus UI
  - '3001:3000'  # Grafana UI
```

---

## 🎓 Learning Resources

**Pino:**
- Docs: https://getpino.io/
- Best Practices: https://github.com/pinojs/pino/blob/master/docs/best-practices.md

**Prometheus:**
- Docs: https://prometheus.io/docs/
- Query Examples: https://prometheus.io/docs/prometheus/latest/querying/examples/

**Grafana:**
- Docs: https://grafana.com/docs/
- Dashboards: https://grafana.com/grafana/dashboards/

**PromQL:**
- Tutorial: https://prometheus.io/docs/prometheus/latest/querying/basics/
- Functions: https://prometheus.io/docs/prometheus/latest/querying/functions/

---

## 🔥 Hot Reload

Monitoring stack supports hot reload:
- Edit `monitoring/prometheus.yml` → Prometheus auto-reloads
- Edit dashboards in Grafana → Auto-saved
- Backend code changes → Auto-restart with metrics intact

---

## 📊 Metrics Retention

**Default Settings:**
- Prometheus: 15 days
- Grafana: Forever (annotations & dashboards)

**To change retention:**

```yaml
# docker-compose.yml
prometheus:
  command:
    - '--storage.tsdb.retention.time=30d'  # Change to 30 days
```

---

## 🚀 Next Steps

1. **Generate Traffic**: Test APIs to see metrics flow
2. **Explore Grafana**: Create custom dashboards
3. **Set Alerts**: Configure Prometheus alerting rules
4. **Log Analysis**: Use Grafana Loki for log aggregation
5. **APM**: Consider adding distributed tracing (Jaeger/Zipkin)

---

## 📞 Support

Need help? Check:
- Backend logs: `docker logs chat-forum-backend`
- Prometheus: http://localhost:9090/targets
- Grafana: http://localhost:3001

Happy Monitoring! 📊✨
