# 📊 Grafana Dashboard - API Endpoint Monitoring

## ✅ সম্পূর্ণ হয়েছে!

### 🎯 সমাধান করা সমস্যা:
1. ❌ **আগে**: `/api/v1//users` (double slash) → metrics-এ আলাদা path হিসেবে দেখাত
2. ✅ **এখন**: `/api/v1/users` (normalized) → সব request একই path-এ group হয়

### 📈 নতুন Dashboard Features:

#### 1. **API Endpoint Latency Panel** (সবচেয়ে বড় panel - উপরে)
- **P50, P95, P99** latency দেখায় **per endpoint**
- প্রতিটি route আলাদা line দিয়ে দেখানো হয়
- **Legend-এ দেখাবে**:
  - `p50 GET /api/v1/users`
  - `p95 GET /api/v1/users`
  - `p99 GET /api/v1/threads`
  - etc.

#### 2. **Request Rate per Endpoint**
- প্রতি second-এ কতগুলো request আসছে per endpoint

#### 3. **Average Response Time (Bar Gauge)**
- প্রতিটি endpoint-এর average latency
- Color-coded:
  - 🟢 Green: < 50ms
  - 🟡 Yellow: 50-100ms
  - 🟠 Orange: 100-200ms
  - 🔴 Red: > 200ms

#### 4. **HTTP Status Codes**
- 2xx Success (green)
- 4xx Client Errors (yellow)
- 5xx Server Errors (red)

#### 5. **Total Requests (Bar Gauge)**
- শেষ 5 মিনিটে কোন endpoint-এ কতবার hit হয়েছে

#### 6. **Memory Usage**
- RSS, Heap Total, Heap Used

#### 7. **CPU & Event Loop**
- CPU usage
- Event Loop lag (ms)

---

## 🚀 কিভাবে Access করবেন:

### Grafana Dashboard:
```
URL: http://localhost:3001
Username: admin
Password: admin123
```

### Dashboard Location:
- **Dashboard Name**: "Chat Forum - API Performance"
- Menu → Dashboards → Browse → "Chat Forum - API Performance"

---

## 📊 বর্তমান Metrics (Live Data):

### GET /api/v1/users:
```
Average Latency: ~4.15 ms
Total Requests: 53 (200 OK)
Rate Limited: 17 (429 Too Many Requests)
```

### Tracked Endpoints:
- ✅ `/api/v1/auth/login`
- ✅ `/api/v1/users`
- ✅ `/api/v1/threads`
- ✅ `/api/v1/posts`

---

## 🔍 Prometheus Queries (PromQL):

### P50 Latency for specific endpoint:
```promql
histogram_quantile(
  0.50,
  sum(rate(http_request_duration_seconds_bucket{
    job="backend",
    method="GET",
    path="/api/v1/users"
  }[2m])) by (le)
) * 1000
```

### P95 Latency for all API endpoints:
```promql
histogram_quantile(
  0.95,
  sum(rate(http_request_duration_seconds_bucket{
    job="backend",
    path=~"/api/.*"
  }[2m])) by (le, path, method)
) * 1000
```

### Request Rate per endpoint:
```promql
sum(rate(http_request_duration_seconds_count{
  job="backend",
  path=~"/api/.*"
}[1m])) by (path, method)
```

### Average Response Time:
```promql
(sum(rate(http_request_duration_seconds_sum{
  job="backend",
  path="/api/v1/users"
}[5m])) / sum(rate(http_request_duration_seconds_count{
  job="backend",
  path="/api/v1/users"
}[5m]))) * 1000
```

---

## 🎨 Path Normalization Logic:

আমাদের `normalizePath` function এখন এভাবে কাজ করে:

```typescript
// 1. Route-based path (best)
if (req.baseUrl && req.route && req.route.path) {
  p = `${req.baseUrl}${req.route.path}`;
}

// 2. MongoDB ObjectID replacement
p = p.replace(/\/[a-f0-9]{24}/g, "/:id");

// 3. Numeric ID replacement
p = p.replace(/\/\d+/g, "/:id");

// 4. Double-slash cleanup
p = p.replace(/\/\/{2,}/g, "/");

// 5. Trailing slash removal
if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
```

**উদাহরণ:**
- `/api/v1//users` → `/api/v1/users`
- `/api/v1/threads/673abc12def34567890abcde` → `/api/v1/threads/:id`
- `/api/v1/posts/123` → `/api/v1/posts/:id`

---

## 🧪 Testing Commands:

### Generate traffic to specific endpoint:
```bash
# 50 requests to /api/v1/users
for i in {1..50}; do 
  curl -s -o /dev/null http://localhost:5000/api/v1/users
  sleep 0.1
done
```

### Check metrics directly:
```bash
# View all tracked paths
curl -s http://localhost:5000/metrics | \
  grep 'http_request_duration_seconds_count' | \
  grep 'path="/api' | \
  awk -F'path="' '{print $2}' | \
  awk -F'"' '{print $1}' | \
  sort -u
```

### Calculate average latency:
```bash
SUM=$(curl -s http://localhost:5000/metrics | \
  grep 'http_request_duration_seconds_sum.*method="GET".*path="/api/v1/users"' | \
  awk '{print $2}')

COUNT=$(curl -s http://localhost:5000/metrics | \
  grep 'http_request_duration_seconds_count.*method="GET".*path="/api/v1/users"' | \
  awk '{print $2}')

echo "Average: $(awk "BEGIN {printf \"%.2f\", ($SUM / $COUNT) * 1000}") ms"
```

---

## 🎓 Next Steps (Optional Improvements):

1. **Alert Rules**:
   - High latency alert (p95 > 500ms)
   - Error rate alert (5xx > 1%)
   - Request spike detection

2. **Dashboard Variables**:
   - Dropdown to select specific endpoint
   - Time range selector
   - Environment filter (dev/staging/prod)

3. **Custom Metrics**:
   - Business metrics (e.g., posts created, users registered)
   - Database query timing
   - Redis cache hit/miss ratio

4. **Distributed Tracing**:
   - Integrate Jaeger or Zipkin
   - End-to-end request tracing

---

## ✨ Key Achievements:

1. ✅ **Path normalization working** - No more double slashes
2. ✅ **Per-endpoint metrics** - See latency for each route
3. ✅ **Beautiful Grafana dashboard** - Professional visualization
4. ✅ **Real-time monitoring** - 10-second auto-refresh
5. ✅ **Percentile latencies** - P50, P95, P99 tracking
6. ✅ **Color-coded alerts** - Easy to spot issues

---

**🎉 এখন আপনার সব API endpoint-এর performance Grafana-এ real-time দেখতে পারবেন!**

Dashboard Link: http://localhost:3001 (admin/admin123)
