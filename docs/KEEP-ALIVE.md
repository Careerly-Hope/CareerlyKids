# Keep-Alive Setup

## Why?
Render free tier services sleep after 15 minutes of inactivity.
Neon free tier databases also suspend.

## Solution
Cron jobs ping `/health/wake` endpoint every 14 minutes.

## Cron Jobs Setup

Using https://cron-job.org (free tier: 50 cron jobs)

### Jobs Configured

1. **Staging Wake**
   - URL: https://careerlykids-staging.onrender.com/health/wake
   - Frequency: Every 14 minutes
   - Purpose: Keep staging service + database awake

2. **Production Wake**
   - URL: https://careerlykids-production.onrender.com/health/wake
   - Frequency: Every 14 minutes
   - Purpose: Keep production service + database awake

## Monitoring

Check cron-job.org dashboard for:
- Execution history
- Success/failure rates
- Response times

## Expected Response Times

- **Cold start:** 30-60 seconds (if service was asleep)
- **Warm start:** 100-500ms (if service was awake)
- **Database wake:** 1-2 seconds added (if Neon was suspended)

## Troubleshooting

### Cron job failing (non-200 response)
1. Check service logs in Render
2. Verify endpoint manually: `curl <url>/health/wake`
3. Check Neon database status

### Service still sleeping
1. Verify cron frequency is 10 minutes (not 15+)
2. Check cron-job.org execution history
3. Ensure cron jobs are enabled