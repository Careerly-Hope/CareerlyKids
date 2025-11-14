# Deployment Guide

## Environments

### Development
- **Branch:** `development`
- **Local only** - not deployed
- **Database:** Local Neon instance or dev database

### Staging
- **Branch:** `staging`
- **URL:** https://careerlykids-staging.onrender.com
- **Swagger:** https://careerlykids-staging.onrender.com/api/docs
- **Database:** Neon staging database
- **Auto-deploy:** On push to `staging` branch

### Production
- **Branch:** `main`
- **URL:** https://careerlykids-production.onrender.com
- **Swagger:** https://careerlykids-production.onrender.com/api/docs
- **Database:** Neon production database
- **Auto-deploy:** On push to `main` branch

## Deployment Flow
```
Local Development → development branch
                          ↓
                    PR to staging
                          ↓
              Staging Environment Deploy
                          ↓
                    PR to main
                          ↓
            Production Environment Deploy
```

## How to Deploy

### To Staging
1. Make changes on `development` branch
2. Test locally
3. Push to `development`
4. Create PR: `development` → `staging`
5. Wait for CI checks to pass
6. Merge PR
7. Staging auto-deploys

### To Production
1. Verify staging is working
2. Create PR: `staging` → `main`
3. Wait for CI checks to pass
4. Get approval (if required)
5. Merge PR
6. Production auto-deploys

## Manual Deployment

You can manually trigger deployments from GitHub Actions:

1. Go to **Actions** tab
2. Select **Manual Deploy** workflow
3. Click **Run workflow**
4. Choose environment (staging/production)
5. Click **Run workflow**

## Rollback Procedure

If a deployment fails:

### Quick Rollback
1. Go to Render dashboard
2. Select the service
3. Click **Manual Deploy**
4. Select previous successful commit
5. Click **Deploy**

### Git Rollback
1. Identify the last good commit
2. Create a revert commit:
```bash
   git revert <bad-commit-hash>
   git push origin <branch>
```
3. Auto-deploy will trigger

## Environment Variables

### Required Variables

**Staging:**
```
NODE_ENV=staging
PORT=10000
DATABASE_URL=<neon-staging-url>
```

**Production:**
```
NODE_ENV=production
PORT=10000
DATABASE_URL=<neon-production-url>
```

### Adding New Environment Variables

1. Go to Render dashboard
2. Select service
3. **Environment** tab
4. **Add Environment Variable**
5. Save changes
6. Redeploy service

## Database Migrations

Migrations run automatically on deployment via:
```bash
npx prisma migrate deploy
```

### Manual Migration

If needed, run manually:
```bash
# Connect to Render shell
render shell <service-name>

# Run migration
npx prisma migrate deploy
```

## Monitoring

### Health Checks

**Staging:** https://careerlykids-staging.onrender.com/health
**Production:** https://careerlykids-production.onrender.com/health

### Detailed Health

**Staging:** https://careerlykids-staging.onrender.com/health/detailed
**Production:** https://careerlykids-production.onrender.com/health/detailed

### Logs

View logs in Render dashboard:
1. Select service
2. **Logs** tab
3. Real-time logs displayed

## Troubleshooting

### Service Not Starting

1. Check Render logs
2. Verify environment variables
3. Check database connection
4. Verify build succeeded

### Database Connection Issues

1. Check DATABASE_URL is correct
2. Verify Neon database is active
3. Check Prisma schema is valid
4. Run wake endpoint: `/health/wake`

### Build Failures

1. Check Node version compatibility
2. Verify all dependencies installed
3. Check Prisma generate succeeded
4. Review build logs in Render

## Free Tier Limitations

### Render
- Services sleep after 15 minutes of inactivity
- Cold start takes ~30 seconds
- 750 hours/month free

### Neon
- Database suspends after inactivity
- Wakes in 1-2 seconds
- 3 projects on free tier

**Solution:** Keep-alive cron jobs (Phase 8)