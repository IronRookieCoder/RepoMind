# 部署和运维指南

## 概述

本文档详细说明了RepoMind系统的部署、配置和运维方案，涵盖从开发环境到生产环境的完整部署流程。

## 系统要求

### 最小系统要求

| 组件 | CPU | 内存 | 存储 | 网络 |
|------|-----|------|------|------|
| 应用服务器 | 4核 | 8GB | 100GB | 100Mbps |
| 数据库服务器 | 2核 | 4GB | 200GB | 100Mbps |
| 缓存服务器 | 2核 | 4GB | 20GB | 100Mbps |

### 推荐生产环境配置

| 组件 | CPU | 内存 | 存储 | 网络 |
|------|-----|------|------|------|
| 应用服务器 | 16核 | 32GB | 500GB SSD | 1Gbps |
| 数据库服务器 | 8核 | 16GB | 1TB SSD | 1Gbps |
| 缓存服务器 | 4核 | 8GB | 100GB SSD | 1Gbps |
| 负载均衡器 | 4核 | 8GB | 50GB | 1Gbps |

### 软件依赖

```yaml
基础环境:
  - Node.js: >=18.0.0
  - Python: >=3.9.0
  - Git: >=2.30.0
  - Docker: >=20.10.0
  - Docker Compose: >=2.0.0

数据库:
  - PostgreSQL: >=13.0
  - Redis: >=6.0

监控工具:
  - Prometheus: >=2.30.0
  - Grafana: >=8.0.0
  - Nginx: >=1.20.0
```

## 部署架构

### 单机部署架构

```
┌─────────────────────────────────────┐
│           单机部署架构               │
├─────────────────────────────────────┤
│  ┌─────────────────────────────────┐ │
│  │         Nginx (反向代理)        │ │
│  └─────────────┬───────────────────┘ │
│                │                     │
│  ┌─────────────▼───────────────────┐ │
│  │      RepoMind 应用服务          │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │  Knowledge Builder Agent    │ │ │
│  │  └─────────────────────────────┘ │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │  Query Engine               │ │ │
│  │  └─────────────────────────────┘ │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │  MCP Server                 │ │ │
│  │  └─────────────────────────────┘ │ │
│  └─────────────┬───────────────────┘ │
│                │                     │
│  ┌─────────────▼───────────────────┐ │
│  │        数据存储层               │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │  PostgreSQL (元数据)        │ │ │
│  │  └─────────────────────────────┘ │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │  Redis (缓存)               │ │ │
│  │  └─────────────────────────────┘ │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │  Git Repository (知识库)    │ │ │
│  │  └─────────────────────────────┘ │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 分布式部署架构

```
                     ┌─────────────────┐
                     │   Load Balancer │
                     │     (Nginx)     │
                     └─────────┬───────┘
                               │
                 ┌─────────────┼─────────────┐
                 │             │             │
        ┌────────▼────────┐   ┌▼────────┐   ┌▼────────┐
        │  App Server 1   │   │App Srv 2│   │App Srv 3│
        │ ┌─────────────┐ │   │         │   │         │
        │ │ Builder     │ │   │ Query   │   │   MCP   │
        │ │ Agent       │ │   │ Engine  │   │ Server  │
        │ └─────────────┘ │   │         │   │         │
        └─────────┬───────┘   └─────────┘   └─────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼────┐   ┌───▼────┐   ┌───▼────┐
│Redis   │   │PostgreSQL│   │ Git   │
│Cluster │   │ Cluster  │   │Repos  │
└────────┘   └──────────┘   └───────┘
```

## Docker部署

### 1. 单机Docker部署

创建`docker-compose.yml`文件：

```yaml
version: '3.8'

services:
  repomind-app:
    build: .
    container_name: repomind-app
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      # 注意: Claude Code SDK 不需要CLAUDE_API_KEY
      - DATABASE_URL=postgresql://repomind:password@postgres:5432/repomind
      - REDIS_URL=redis://redis:6379
      - GIT_ACCESS_TOKEN=${GIT_ACCESS_TOKEN}
      - CLAUDE_SYSTEM_PROMPT=你是一个代码分析专家
    depends_on:
      - postgres
      - redis
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped

  postgres:
    image: postgres:13
    container_name: repomind-postgres
    environment:
      - POSTGRES_DB=repomind
      - POSTGRES_USER=repomind
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:6-alpine
    container_name: repomind-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: repomind-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - repomind-app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 2. Dockerfile

```dockerfile
# 多阶段构建
FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY packages/*/package*.json ./packages/*/

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产环境镜像
FROM node:18-alpine AS production

WORKDIR /app

# 安装必要的系统依赖
RUN apk add --no-cache git

# 复制构建结果
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 创建非root用户
RUN addgroup -g 1001 -S repomind && \
    adduser -S repomind -u 1001

# 设置文件权限
RUN chown -R repomind:repomind /app
USER repomind

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

### 3. 启动部署

```bash
# 设置环境变量  
# 注意: Claude Code SDK 不需要CLAUDE_API_KEY
export GIT_ACCESS_TOKEN="your-git-token"
export CLAUDE_SYSTEM_PROMPT="你是一个代码分析专家"

# 启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f repomind-app
```

## Kubernetes部署

### 1. 命名空间

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: repomind
```

### 2. 配置映射

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: repomind-config
  namespace: repomind
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "3000"
  DATABASE_URL: "postgresql://repomind:password@postgres-service:5432/repomind"
  REDIS_URL: "redis://redis-service:6379"
  CLAUDE_SYSTEM_PROMPT: "你是一个代码分析专家"
```

### 3. 密钥

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: repomind-secrets
  namespace: repomind
type: Opaque
data:
  # 注意: Claude Code SDK 不需要CLAUDE_API_KEY
  GIT_ACCESS_TOKEN: <base64-encoded-token>
  DATABASE_PASSWORD: <base64-encoded-password>
```

### 4. 应用部署

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: repomind-app
  namespace: repomind
spec:
  replicas: 3
  selector:
    matchLabels:
      app: repomind-app
  template:
    metadata:
      labels:
        app: repomind-app
    spec:
      containers:
      - name: repomind
        image: repomind/app:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: repomind-config
        - secretRef:
            name: repomind-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: data-volume
          mountPath: /app/data
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: repomind-pvc
```

### 5. 服务和Ingress

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: repomind-service
  namespace: repomind
spec:
  selector:
    app: repomind-app
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP

---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: repomind-ingress
  namespace: repomind
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  tls:
  - hosts:
    - repomind.example.com
    secretName: repomind-tls
  rules:
  - host: repomind.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: repomind-service
            port:
              number: 80
```

## 配置管理

### 1. 环境配置

```typescript
// config/production.ts
export default {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['*'],
      credentials: true
    }
  },
  
  claudeCode: {
    // Claude Code SDK 配置 - 不需要API Key
    sessionOptions: {
      tools: ['read', 'glob', 'grep', 'bash'],
      systemPrompt: process.env.CLAUDE_SYSTEM_PROMPT || '你是一个代码分析专家',
      maxMessages: parseInt(process.env.CLAUDE_MAX_MESSAGES || '100')
    },
    timeout: parseInt(process.env.CLAUDE_TIMEOUT || '60000')
  },
  
  database: {
    url: process.env.DATABASE_URL!,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      max: parseInt(process.env.DB_POOL_MAX || '10'),
      acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000')
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    }
  },
  
  redis: {
    url: process.env.REDIS_URL!,
    keyPrefix: process.env.REDIS_PREFIX || 'repomind:',
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3')
  },
  
  git: {
    accessToken: process.env.GIT_ACCESS_TOKEN!,
    defaultBranch: process.env.GIT_DEFAULT_BRANCH || 'main',
    cloneDepth: parseInt(process.env.GIT_CLONE_DEPTH || '1'),
    timeout: parseInt(process.env.GIT_TIMEOUT || '300000')
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    file: {
      enabled: process.env.LOG_FILE_ENABLED === 'true',
      path: process.env.LOG_FILE_PATH || './logs/app.log',
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
      maxSize: process.env.LOG_MAX_SIZE || '10m'
    }
  },
  
  monitoring: {
    prometheus: {
      enabled: process.env.PROMETHEUS_ENABLED === 'true',
      port: parseInt(process.env.PROMETHEUS_PORT || '9090'),
      path: process.env.PROMETHEUS_PATH || '/metrics'
    },
    healthCheck: {
      enabled: true,
      path: '/health',
      timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000')
    }
  }
};
```

### 2. Nginx配置

```nginx
# nginx.conf
upstream repomind {
    least_conn;
    server repomind-app:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name repomind.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name repomind.example.com;
    
    ssl_certificate /etc/nginx/ssl/repomind.crt;
    ssl_certificate_key /etc/nginx/ssl/repomind.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # 基本配置
    client_max_body_size 100M;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }
    
    # API代理
    location /api/ {
        proxy_pass http://repomind/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # MCP代理
    location /mcp/ {
        proxy_pass http://repomind/mcp/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 健康检查
    location /health {
        access_log off;
        proxy_pass http://repomind/health;
    }
    
    # 主应用
    location / {
        proxy_pass http://repomind/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 监控和日志

### 1. Prometheus监控配置

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'repomind'
    static_configs:
      - targets: ['repomind-app:9090']
    scrape_interval: 30s
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']
```

### 2. Grafana Dashboard

```json
{
  "dashboard": {
    "title": "RepoMind Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Knowledge Base Updates",
        "targets": [
          {
            "expr": "increase(knowledge_base_updates_total[1h])",
            "legendFormat": "Updates per hour"
          }
        ]
      },
      {
        "title": "Query Success Rate",
        "targets": [
          {
            "expr": "rate(queries_successful_total[5m]) / rate(queries_total[5m]) * 100",
            "legendFormat": "Success Rate %"
          }
        ]
      }
    ]
  }
}
```

### 3. 日志配置

```yaml
# docker-compose.logging.yml
version: '3.8'

x-logging: &default-logging
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"

services:
  repomind-app:
    logging: *default-logging
    
  fluentd:
    image: fluent/fluentd:v1.14-1
    volumes:
      - ./fluentd:/fluentd/etc
      - /var/log:/var/log:ro
    ports:
      - "24224:24224"
      - "24224:24224/udp"

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.15.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  kibana:
    image: docker.elastic.co/kibana/kibana:7.15.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200

volumes:
  elasticsearch_data:
```

## 备份和恢复

### 1. 数据库备份

```bash
#!/bin/bash
# backup.sh

# 配置
DB_HOST="localhost"
DB_PORT="5432" 
DB_NAME="repomind"
DB_USER="repomind"
BACKUP_DIR="/backup/postgres"
RETENTION_DAYS="30"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 生成备份文件名
BACKUP_FILE="$BACKUP_DIR/repomind_$(date +%Y%m%d_%H%M%S).sql"

# 执行备份
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME > $BACKUP_FILE

# 压缩备份文件
gzip $BACKUP_FILE

# 清理旧备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

### 2. Git仓库备份

```bash
#!/bin/bash
# git-backup.sh

REPOS_DIR="/data/repositories"
BACKUP_DIR="/backup/git"
DATE=$(date +%Y%m%d)

# 创建备份目录
mkdir -p $BACKUP_DIR/$DATE

# 备份所有仓库
for repo in $(ls $REPOS_DIR); do
    echo "Backing up repository: $repo"
    tar -czf "$BACKUP_DIR/$DATE/${repo}.tar.gz" -C $REPOS_DIR $repo
done

# 同步到远程存储
aws s3 sync $BACKUP_DIR/$DATE s3://repomind-backups/git/$DATE/
```

### 3. 自动备份定时任务

```bash
# crontab配置
# 每天凌晨2点备份数据库
0 2 * * * /opt/repomind/scripts/backup.sh

# 每6小时备份Git仓库
0 */6 * * * /opt/repomind/scripts/git-backup.sh

# 每周日清理日志文件
0 3 * * 0 /opt/repomind/scripts/cleanup-logs.sh
```

## 安全配置

### 1. 防火墙规则

```bash
# UFW防火墙配置
ufw default deny incoming
ufw default allow outgoing

# 允许SSH
ufw allow ssh

# 允许HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# 允许特定IP访问数据库
ufw allow from 10.0.0.0/8 to any port 5432

# 启用防火墙
ufw enable
```

### 2. SSL/TLS配置

```bash
# 使用Let's Encrypt生成证书
certbot certonly --nginx -d repomind.example.com

# 自动续期
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

### 3. 应用安全

```typescript
// 安全中间件配置
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}));

// 请求限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 限制每个IP 1000次请求
  message: 'Too many requests from this IP'
});

app.use('/api', limiter);

// API密钥验证
app.use('/api', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !isValidApiKey(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
});
```

## 故障排除

### 常见问题和解决方案

#### 1. Claude Code SDK连接问题
```bash
# 检查Claude Code SDK连接
# 注意: Claude Code SDK 不需要API密钥验证
# SDK会直接与本地Claude Code实例通信

# 检查Claude Code是否安装
claude --version

# 验证SDK连接
node -e "const { ClaudeCodeSDK } = require('@anthropic/claude-code-sdk'); console.log('SDK loaded successfully');"

# 检查防火墙规则
ufw status
```

#### 2. 数据库连接问题
```bash
# 检查数据库状态
docker-compose exec postgres pg_isready

# 检查连接配置
psql -h localhost -U repomind -d repomind -c "SELECT 1;"

# 查看连接数
psql -h localhost -U repomind -d repomind -c "SELECT count(*) FROM pg_stat_activity;"
```

#### 3. 内存不足
```bash
# 检查内存使用
free -h
docker stats

# 增加swap空间
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
```

#### 4. Git仓库访问权限
```bash
# 测试Git访问
git ls-remote https://github.com/user/repo.git

# 检查访问令牌
curl -H "Authorization: token $GIT_ACCESS_TOKEN" \
     https://api.github.com/user
```

### 日志分析

```bash
# 查看应用日志
docker-compose logs repomind-app | grep ERROR

# 分析请求日志
tail -f /var/log/nginx/access.log | grep "POST /api"

# 监控系统资源
top -p $(pgrep -f repomind)
```

## 性能优化

### 1. 数据库优化

```sql
-- 创建索引
CREATE INDEX idx_repositories_name ON repositories(name);
CREATE INDEX idx_knowledge_updated_at ON knowledge_bases(updated_at);
CREATE INDEX idx_queries_created_at ON query_logs(created_at);

-- 分析表统计信息
ANALYZE repositories;
ANALYZE knowledge_bases;

-- 查看慢查询
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

### 2. 缓存优化

```typescript
// Redis缓存配置
const cacheConfig = {
  // 查询结果缓存
  queryCache: {
    ttl: 3600, // 1小时
    maxSize: 1000
  },
  
  // 知识库缓存
  knowledgeCache: {
    ttl: 86400, // 24小时
    maxSize: 100
  },
  
  // 会话缓存
  sessionCache: {
    ttl: 1800, // 30分钟
    maxSize: 500
  }
};
```

### 3. 应用优化

```typescript
// 连接池配置
const dbConfig = {
  pool: {
    min: 5,
    max: 20,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000
  }
};

// 并发控制
const concurrencyLimiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 100
});
```

这套完整的部署和运维方案确保了RepoMind系统能够稳定、安全、高效地运行在生产环境中。