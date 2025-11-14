# Contributing to CareerlyKids

Thank you for considering contributing to CareerlyKids!

## Development Process

1. **Fork the repository**
2. **Clone your fork**
```bash
   git clone https://github.com/YOUR_USERNAME/CareerlyKids.git
```
3. **Create a branch from `development`**
```bash
   git checkout development
   git checkout -b feature/your-feature
```
4. **Make your changes**
5. **Write tests**
6. **Run tests locally**
```bash
   npm run test
   npm run test:e2e
   npm run lint
```
7. **Commit using conventional commits**
```bash
   git commit -m "feat: add new feature"
```
8. **Push to your fork**
9. **Create Pull Request to `development` branch**

## Code Style

- Use TypeScript
- Follow ESLint rules
- Format with Prettier
- Write tests for new features
- Document public APIs

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `test:` - Tests
- `refactor:` - Refactoring
- `chore:` - Maintenance

Examples:
```
feat: add user authentication
fix: resolve database connection timeout
docs: update API documentation
test: add unit tests for user service
```

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Follow the PR template
4. Request review
5. Address feedback
6. Wait for CI checks to pass
7. Maintainer will merge

## Testing
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov

# Linting
npm run lint
```

## Questions?

Open an issue or reach out to maintainers.