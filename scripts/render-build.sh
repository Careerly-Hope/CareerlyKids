#!/bin/bash
set -e

echo "🔨 Starting Render build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

# Build application
echo "🏗️ Building application..."
npm run build

echo "✅ Build completed successfully!"