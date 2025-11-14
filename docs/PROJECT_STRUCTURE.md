# Project Structure
```
CareerlyKids/
├── .github/
│   ├── workflows/          # GitHub Actions CI/CD
│   │   ├── ci.yml         # Main CI pipeline
│   │   ├── pr-staging.yml # PR to staging validation
│   │   └── pr-main.yml    # PR to main validation
│   ├── ISSUE_TEMPLATE/    # Issue templates
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/                   # Documentation
│   ├── DEPLOYMENT.md      # Deployment guide
│   ├── KEEP-ALIVE.md      # Keep-alive setup
│   └── PROJECT_STRUCTURE.md
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
├── scripts/               # Utility scripts
│   ├── render-build.sh   # Render build script
│   └── render-start.sh   # Render start script
├── src/
│   ├── app.module.ts     # Root module
│   ├── main.ts           # Application entry
│   ├── health/           # Health check module
│   │   ├── health.module.ts
│   │   ├── health.controller.ts
│   │   ├── health.service.ts
│   │   └── dto/
│   ├── prisma/           # Prisma module
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   └── [your-modules]/   # Your feature modules
├── test/                  # E2E tests
├── .env.example          # Environment template
├── .eslintrc.js          # ESLint config
├── .gitignore
├── .prettierrc           # Prettier config
├── jest.config.js        # Jest config
├── nest-cli.json         # Nest CLI config
├── package.json
├── render.yaml           # Render config
├── tsconfig.json         # TypeScript config
├── CONTRIBUTING.md       # Contribution guide
└── README.md             # Main documentation
```

## Module Organization

Each feature module should follow this structure:
```
feature/
├── feature.module.ts     # Module definition
├── feature.controller.ts # HTTP endpoints
├── feature.service.ts    # Business logic
├── feature.repository.ts # Data access (optional)
├── dto/                  # Data Transfer Objects
│   ├── create-feature.dto.ts
│   └── update-feature.dto.ts
├── entities/            # Prisma models reference
│   └── feature.entity.ts
└── tests/
    ├── feature.controller.spec.ts
    └── feature.service.spec.ts
```

## Naming Conventions

- **Files:** kebab-case (e.g., `user-profile.service.ts`)
- **Classes:** PascalCase (e.g., `UserProfileService`)
- **Methods:** camelCase (e.g., `getUserProfile()`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `MAX_RETRY_COUNT`)
- **Interfaces:** PascalCase with 'I' prefix (e.g., `IUserProfile`)

## Best Practices

1. **One module per feature**
2. **Keep controllers thin** - business logic in services
3. **Use DTOs** for request/response validation
4. **Write tests** for all services and controllers
5. **Use Prisma** for all database operations
6. **Document APIs** with Swagger decorators
7. **Handle errors** gracefully with proper HTTP status codes