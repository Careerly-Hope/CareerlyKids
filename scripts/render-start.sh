#!/bin/bash
set -e

echo "🚀 Starting Render deployment process..."

# Run migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# Start application
echo "▶️ Starting application..."
npm run start:prod