
# GitHub Actions Workflows

This directory contains CI/CD workflows for CareerlyKids.

## Workflows

### 1. CI (ci.yml)
Runs on every push and PR to development, staging, and main branches.

**Jobs:**
- Lint and Test (Node 18.x, 20.x)
- Build Application
- E2E Tests (with PostgreSQL)
- Security Scan

### 2. PR to Staging (pr-staging.yml)
Validates PRs from development → staging.

**Checks:**
- Source branch must be `development`
- All tests must pass
- Build must succeed

### 3. PR to Main (pr-main.yml)
Validates PRs from staging → main (production).

**Checks:**
- Source branch must be `staging`
- Full test suite
- Migration validation
- Production build

### 4. Status Checks (status-checks.yml)
Additional PR validations.

**Checks:**
- PR title follows conventional commits
- PR has labels

## Branch Protection

- `main`: Only PRs from `staging`
- `staging`: Only PRs from `development`
- `development`: Direct pushes allowed

## Required Status Checks

All branches require these checks to pass:
- Lint and Test
- Build Application
- E2E Tests