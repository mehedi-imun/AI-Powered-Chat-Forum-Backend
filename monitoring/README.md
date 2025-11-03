# Monitoring Configuration

এই ফোল্ডারে Chat Forum Application এর monitoring configuration রাখা আছে।

## Structure

```
monitoring/
├── prometheus.yml          # Prometheus scrape configuration
└── grafana/
    └── provisioning/
        ├── datasources/    # Prometheus datasource config
        │   └── prometheus.yml
        └── dashboards/     # Pre-configured dashboards
            ├── dashboards.yml
            ├── api-performance.json
            └── chat-forum-api.json
```

## Services

### Prometheus (Port 9090)
- **Purpose**: Metrics collection and storage
- **Config**: `prometheus.yml`
- **Scrape Interval**: 15 seconds
- **Target**: `backend:5000/metrics`

### Grafana (Port 3001)
- **Purpose**: Metrics visualization
- **Login**: admin / admin123
- **Datasource**: Prometheus (auto-provisioned)
- **Dashboards**: Auto-loaded from `provisioning/dashboards/`

## Available Dashboards

### 1. API Performance Dashboard
- **Metrics**:
  - P50, P95, P99 latency per endpoint
  - Request rate per endpoint
  - HTTP status code distribution
  - Memory and CPU usage
  
### 2. Chat Forum API Dashboard
- **Overview**: General system health
- **Includes**: Total requests, error rates, uptime

## Usage

### Start Monitoring Stack
```bash
docker-compose up -d prometheus grafana
```

### Access Grafana
```bash
# Open browser
open http://localhost:3001

# Login: admin / admin123
```

### View Metrics in Prometheus
```bash
# Open browser
open http://localhost:9090

# Query example:
http_request_duration_seconds_count{path="/api/v1/users"}
```

### Generate Test Traffic
```bash
# Send requests to see metrics
for i in {1..50}; do curl -s http://localhost:5000/api/v1/health > /dev/null; done
```

## Configuration Changes

### Update Scrape Interval
Edit `prometheus.yml`:
```yaml
global:
  scrape_interval: 15s  # Change this
```

### Add New Dashboard
1. Create JSON file in `grafana/provisioning/dashboards/`
2. Restart Grafana: `docker-compose restart grafana`

### Add New Prometheus Target
Edit `prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'new-service'
    static_configs:
      - targets: ['service:port']
```

## Troubleshooting

### Prometheus Not Scraping
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check backend metrics endpoint
curl http://localhost:5000/metrics
```

### Grafana Dashboard Not Loading
```bash
# Check Grafana logs
docker logs chat-forum-grafana --tail 50

# Verify provisioning files
docker exec chat-forum-grafana ls /etc/grafana/provisioning/dashboards/
```

### No Metrics in Dashboard
```bash
# 1. Check if Prometheus is scraping
curl http://localhost:9090/api/v1/query?query=up

# 2. Generate traffic
curl http://localhost:5000/api/v1/health

# 3. Wait 15-30 seconds for scrape
```

## Development vs Production

### Development
- Volume mount from `./backend/monitoring/`
- Easy to edit configs without rebuild
- Pretty logs enabled in Pino

### Production
- Consider managed Prometheus/Grafana
- Use environment-specific configs
- Enable authentication and SSL
- Set up alerting rules

## Related Documentation

- [GRAFANA-SETUP.md](../GRAFANA-SETUP.md) - Detailed setup guide
- [PROBLEM-SOLVED.md](../PROBLEM-SOLVED.md) - Path normalization fix
- [LOGGING.md](../LOGGING.md) - Pino logging configuration

## Metrics Collected

| Metric | Description | Labels |
|--------|-------------|--------|
| `http_request_duration_seconds` | Request latency histogram | `method`, `path`, `status_code` |
| `http_request_duration_seconds_count` | Total request count | `method`, `path`, `status_code` |
| `http_request_duration_seconds_sum` | Total request duration | `method`, `path`, `status_code` |
| `nodejs_heap_size_total_bytes` | Node.js heap size | - |
| `nodejs_heap_size_used_bytes` | Node.js heap used | - |
| `nodejs_eventloop_lag_seconds` | Event loop lag | - |

## Path Normalization

API paths are automatically normalized for metrics:
- `/api/v1/users/507f1f77bcf86cd799439011` → `/api/v1/users/:id`
- `/api/v1//users` → `/api/v1/users` (double slashes removed)
- Preserves query parameters

This allows proper aggregation and reduces metric cardinality.

---

**Last Updated**: November 3, 2024
**Maintainer**: Backend Team
