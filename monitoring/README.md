# Monitoring Configuration

Chat Forum Application এর monitoring configuration 

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

