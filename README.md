# CareerlyKids API

Backend API for CareerlyKids application built with NestJS, Prisma, and PostgreSQL.

## 🚀 Quick Start

### Prerequisites
- Node.js 18.x or 20.x
- npm or yarn
- PostgreSQL (or Neon account)

### Installation
```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/CareerlyKids.git
cd CareerlyKids

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL

# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run start:dev
```

Visit http://localhost:3000/api/docs for Swagger documentation.

## 🌍 Environments

| Environment | Branch | URL | Status |
|------------|--------|-----|--------|
| Development | `development` | Local | - |
| Staging | `staging` | [staging.onrender.com](https://careerlykids-staging.onrender.com) | ![Staging](https://img.shields.io/badge/status-live-green) |
| Production | `main` | [production.onrender.com](https://careerlykids-production.onrender.com) | ![Production](https://img.shields.io/badge/status-live-green) |

## 📚 Documentation

- [Deployment Guide](docs/DEPLOYMENT.md)
- [Keep-Alive Setup](docs/KEEP-ALIVE.md)
- [API Documentation](https://careerlykids-production.onrender.com/api/docs)

## 🛠️ Tech Stack

- **Framework:** NestJS v10
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL (Neon)
- **Deployment:** Render
- **CI/CD:** GitHub Actions
- **API Docs:** Swagger/OpenAPI
- **Testing:** Jest

## 📝 Available Scripts
```bash
# Development
npm run start:dev          # Start dev server with hot reload
npm run start:debug        # Start dev server with debugging

# Building
npm run build             # Build for production

# Testing
npm run test              # Run unit tests
npm run test:watch        # Run tests in watch mode
npm run test:cov          # Generate coverage report
npm run test:e2e          # Run e2e tests

# Code Quality
npm run lint              # Run ESLint
npm run format            # Format with Prettier

# Database
npm run prisma:generate   # Generate Prisma Client
npm run prisma:migrate    # Run migrations in dev
npm run prisma:studio     # Open Prisma Studio
```

## 🔄 Development Workflow

### Creating a New Feature
```bash
# 1. Create feature branch from development
git checkout development
git pull origin development
git checkout -b feature/your-feature-name

# 2. Make changes and commit
git add .
git commit -m "feat: add your feature"

# 3. Push to development
git push origin development

# 4. Create PR: development → staging
# 5. After review, merge to staging
# 6. Test on staging environment
# 7. Create PR: staging → main
# 8. Merge to production
```

### Branch Strategy

- `development` - Active development (direct pushes allowed)
- `staging` - Pre-production testing (PR from development only)
- `main` - Production (PR from staging only)

## 🏥 Health Checks

### Endpoints

- `GET /health` - Basic health check
- `GET /health/wake` - Wake service and database
- `GET /health/detailed` - Comprehensive system info
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

### Keep-Alive

Cron jobs ping `/health/wake` every 14 minutes to prevent Render and Neon from sleeping.

## 🧪 Testing
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch
```

## 🔐 Environment Variables

Required environment variables:
```env
DATABASE_URL="postgresql://user:pass@host:5432/db"
NODE_ENV="development"
PORT=3000
```

See `.env.example` for complete list.

## 🚀 Deployment

Deployments are automatic:

- Push to `staging` branch → Deploys to staging
- Push to `main` branch → Deploys to production

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## 📄 License

This project is licensed under the MIT License.

## 👥 Authors

- Your Name - [@yourhandle](https://github.com/yourhandle)

## 🙏 Acknowledgments

- NestJS team
- Prisma team
- Neon database
- Render platform