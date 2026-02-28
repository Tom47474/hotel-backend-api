#!/bin/bash
set -e

JD_CLOUD_HOST="${JD_CLOUD_HOST}"
JD_CLOUD_USER="${JD_CLOUD_USER}"
JD_CLOUD_PORT="${JD_CLOUD_PORT:-22}"
JD_CLOUD_DEPLOY_PATH="${JD_CLOUD_DEPLOY_PATH}"
APP_PORT="${JD_CLOUD_APP_PORT:-4090}"
NODE_ENV="production"

if [ -z "$JD_CLOUD_HOST" ] || [ -z "$JD_CLOUD_USER" ] || [ -z "$JD_CLOUD_DEPLOY_PATH" ]; then
  echo "❌ Missing required environment variables"
  exit 1
fi

echo "Deploying to: $JD_CLOUD_USER@$JD_CLOUD_HOST:$JD_CLOUD_PORT"
echo "Deploy path: $JD_CLOUD_DEPLOY_PATH"
echo "App port: $APP_PORT"

echo "Uploading deployment package..."
rsync -av --progress --partial --inplace --checksum \
  -e "ssh -p $JD_CLOUD_PORT -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o Compression=no -o ControlMaster=auto -o ControlPath=~/.ssh/control-%r@%h:%p -o ControlPersist=10m" \
  deploy.tar.gz "$JD_CLOUD_USER@$JD_CLOUD_HOST:/tmp/deploy.tar.gz"

ssh -p "$JD_CLOUD_PORT" -i ~/.ssh/id_rsa "$JD_CLOUD_USER@$JD_CLOUD_HOST" << EOF
set -e

export HOME=/root
export NVM_DIR="/root/.nvm"

if [ ! -s "\$NVM_DIR/nvm.sh" ]; then
  echo "❌ nvm not found at \$NVM_DIR"
  exit 1
fi

. "\$NVM_DIR/nvm.sh"
NODE_VERSION=22
nvm use \$NODE_VERSION || nvm install \$NODE_VERSION

echo "Node path: \$(which node)"
echo "Node version: \$(node -v)"

mkdir -p "$JD_CLOUD_DEPLOY_PATH"
cd "$JD_CLOUD_DEPLOY_PATH"

if [ -d "current" ]; then
  echo "Backing up current version..."
  mv current "backup-\$(date +%Y%m%d-%H%M%S)"
fi

echo "Extracting new version..."
mkdir current
tar -xzf /tmp/deploy.tar.gz -C current
rm -f /tmp/deploy.tar.gz

cd current

echo "Setting up environment variables..."
cat > .env << ENVEOF
DB_HOST=${DB_HOST}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
DB_PORT=${DB_PORT}
PORT=${PORT}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES=${JWT_EXPIRES}
AMAP_POI_KEY=${AMAP_POI_KEY}
COS_BUCKET=${COS_BUCKET}
COS_REGION=${COS_REGION}
COS_SECRET_ID=${COS_SECRET_ID}
COS_SECRET_KEY=${COS_SECRET_KEY}
ENVEOF

echo "Restarting application..."
if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 not found, installing..."
  npm install -g pm2
fi

pm2 stop "hotel-backend" 2>/dev/null || true
pm2 delete "hotel-backend" 2>/dev/null || true

cat > ecosystem.config.cjs << PM2EOF
module.exports = {
  apps: [{
    name: "hotel-backend",
    script: "npm",
    args: "start",
    cwd: "$JD_CLOUD_DEPLOY_PATH/current",
    env: {
      NODE_ENV: "$NODE_ENV",
      PORT: $APP_PORT,
      DB_HOST: "${DB_HOST}",
      DB_USER: "${DB_USER}",
      DB_PASSWORD: "${DB_PASSWORD}",
      DB_NAME: "${DB_NAME}",
      DB_PORT: "${DB_PORT}",
      JWT_SECRET: "${JWT_SECRET}",
      JWT_EXPIRES: "${JWT_EXPIRES}",
      AMAP_POI_KEY: "${AMAP_POI_KEY}"
      COS_BUCKET: "${COS_BUCKET}",
      COS_REGION: "${COS_REGION}",
      COS_SECRET_ID: "${COS_SECRET_ID}",
      COS_SECRET_KEY: "${COS_SECRET_KEY}"
    }
  }]
}
PM2EOF

pm2 start ecosystem.config.cjs
pm2 save
pm2 list

echo "Environment: NODE_ENV=\$NODE_ENV, PORT=\$APP_PORT"
pm2 logs "hotel-backend" --lines 10 --nostream 2>/dev/null || echo "No logs yet"

echo "✅ Deployment completed successfully"
EOF

echo "🎉 Deployment to JD Cloud Server completed!"