# 🚂 Railway Deployment Guide - DiscoverGroup API

Complete guide for deploying your DiscoverGroup travel API to Railway with MongoDB Atlas.

## 📋 Prerequisites

- [ ] Railway account (https://railway.app)
- [ ] MongoDB Atlas account (https://cloud.mongodb.com)
- [ ] GitHub repository with your code
- [ ] Netlify sites deployed (frontend + admin)

## 🚀 Initial Deployment Setup

### Step 1: Create Railway Project

1. Go to https://railway.app
2. Click **"New Project"**
3. Choose **"Deploy from GitHub repo"**
4. Select your repository: `discoverGrp`
5. Railway will detect the project and start building

### Step 2: Configure Build Settings

Railway should auto-detect your `railway.json` configuration:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd apps/api && npm install && npm run build"
  },
  "deploy": {
    "startCommand": "cd apps/api && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}
```

### Step 3: Set Environment Variables

In Railway dashboard → **Variables** tab, add:

#### Required Variables
```env
# Database Connection (CRITICAL)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/discovergroup?retryWrites=true&w=majority

# Server Config
NODE_ENV=production
PORT=4000

# Security (Generate secure values)
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters-long

# Email Service
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here

# Frontend URLs (Update with your Netlify URLs)
FRONTEND_URL=https://discover-grp.netlify.app
CLIENT_URL=https://discover-grp.netlify.app
ADMIN_URL=https://admin-discoverg.netlify.app
```

#### Optional Variables (Add if needed)
```env
# Payment Integration
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key

# Cloudflare R2 Storage
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=discovergroup-images
R2_PUBLIC_URL=https://images.your-domain.com

# DragonPay (if using)
DRAGONPAY_MERCHANT_ID=your_merchant_id
DRAGONPAY_PASSWORD=your_dragonpay_password
DRAGONPAY_API_URL=https://test.dragonpay.ph/api
```

### Step 4: Configure MongoDB Atlas Network Access

1. Go to MongoDB Atlas → **Network Access**
2. Click **"Add IP Address"**
3. Choose **"Allow Access from Anywhere"** (0.0.0.0/0)
   - Or add specific Railway IP ranges (check Railway docs)
4. Click **"Confirm"**

### Step 5: Deploy

1. Click **"Deploy"** in Railway
2. Wait for build to complete (2-5 minutes)
3. Check deployment logs for success

## ✅ Verification

### Check Deployment Status

Railway dashboard should show:
- ✅ **Status**: Active (green)
- ✅ **Health Check**: Passing
- ✅ **Recent Logs**: No errors

### Test Health Endpoint

```powershell
# Get your Railway URL from dashboard
$API_URL = "https://discovergroup-api-production.up.railway.app"

# Test health endpoint
curl "$API_URL/health"
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-18T10:16:00.000Z",
  "mongodb": "connected",
  "environment": "production"
}
```

### Check Logs

In Railway:
1. Click on your service
2. Go to **"Deployments"** tab
3. Click latest deployment
4. View **"Deploy Logs"**

Look for:
```
✅ MongoDB connected successfully
✅ SendGrid initialized successfully in API
Server running on port 4000
```

## 🔧 Common Issues & Solutions

### Issue 1: MongoDB Connection Failed

**Error**: `querySrv ENOTFOUND _mongodb._tcp...`

**Solutions**:
1. Verify MONGODB_URI is set in Railway variables
2. Check MongoDB Atlas network access allows Railway
3. Test URI locally first
4. Ensure MongoDB user has correct permissions

### Issue 2: Build Failed

**Error**: Build fails during npm install

**Solutions**:
1. Check `package.json` is valid JSON
2. Verify all dependencies are listed
3. Check build logs for specific error
4. Try local build: `cd apps/api && npm install && npm run build`

### Issue 3: Duplicate Index Warnings

**Error**: `[MONGOOSE] Warning: Duplicate schema index`

**Solution**: Already fixed in code (removed duplicate index declarations)

### Issue 4: CORS Errors

**Error**: Frontend cannot connect to API

**Solutions**:
1. Verify FRONTEND_URL, CLIENT_URL, ADMIN_URL in Railway variables
2. Check CORS configuration in `apps/api/src/index.ts`
3. Ensure URLs match your Netlify deployments exactly

### Issue 5: Health Check Failing

**Error**: Railway shows "Unhealthy" status

**Solutions**:
1. Ensure `/health` endpoint exists
2. Check `healthcheckPath` in railway.json
3. Verify API is actually starting (check logs)

## 🔄 Update Deployment

### Automatic Deployment (Recommended)

Railway auto-deploys on every push to main branch:

```powershell
# Make your changes
git add .
git commit -m "Update API"
git push origin main

# Railway will automatically deploy
```

### Manual Deployment

In Railway dashboard:
1. Go to **"Deployments"** tab
2. Click **"Deploy"** button (top right)
3. Or click **"Redeploy"** on a previous deployment

## 📊 Monitoring & Logs

### View Live Logs

```powershell
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# View live logs
railway logs
```

### Deploy Logs vs Runtime Logs

- **Build Logs**: Show npm install, build process
- **Deploy Logs**: Show server startup, runtime errors

### Important Log Messages

✅ **Success**:
```
✅ MongoDB connected successfully
✅ SendGrid initialized successfully
Server running on port 4000
```

❌ **Errors to Watch For**:
```
❌ MongoDB connection error
❌ Failed to initialize server
Error: Cannot find module
```

## 🔒 Security Best Practices

### 1. Environment Variables

✅ **DO**:
- Use Railway's Variables tab
- Generate strong JWT_SECRET (32+ characters)
- Use separate MongoDB databases for dev/prod
- Rotate secrets regularly

❌ **DON'T**:
- Commit .env files to Git
- Share secrets in plain text
- Use weak/simple secrets
- Use same secrets for dev/prod

### 2. MongoDB Access

✅ **DO**:
- Restrict IP access when possible
- Use strong database passwords
- Create separate users for different environments
- Enable MongoDB audit logging

❌ **DON'T**:
- Use 0.0.0.0/0 in production (if avoidable)
- Share database credentials
- Use default/weak passwords

### 3. API Security

✅ **Already Implemented**:
- Helmet.js for security headers
- Rate limiting
- Input validation
- CORS configuration
- JWT authentication
- Password hashing
- XSS protection

## 🎯 Performance Optimization

### 1. Connection Pooling

Already configured in `apps/api/src/db.ts`:
```typescript
maxPoolSize: 10,
minPoolSize: 5,
```

### 2. Caching

Consider adding Redis for:
- Session storage
- API response caching
- Rate limiting storage

### 3. Database Indexes

Check that indexes are created:
```powershell
# Using MongoDB Compass or mongosh
db.tours.getIndexes()
db.users.getIndexes()
db.bookings.getIndexes()
```

## 📈 Scaling

### Horizontal Scaling

Railway supports multiple instances:
1. Go to **Settings** → **Scaling**
2. Adjust number of replicas
3. Configure load balancing

### Database Scaling

MongoDB Atlas auto-scales:
1. Cluster tier affects performance
2. Consider upgrading for production
3. Enable backups (already configured)

## 🔄 CI/CD Pipeline

### Current Setup

```
GitHub Push → Railway Auto-Deploy
     ↓
Build (npm install + build)
     ↓
Run Tests (if configured)
     ↓
Deploy (npm start)
     ↓
Health Check
     ↓
Live ✅
```

### Add GitHub Actions (Optional)

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Railway
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Railway CLI
        run: npm i -g @railway/cli
      - name: Deploy
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

## 📞 Support & Resources

### Railway
- Dashboard: https://railway.app
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway
- Status: https://status.railway.app

### MongoDB Atlas
- Dashboard: https://cloud.mongodb.com
- Docs: https://www.mongodb.com/docs/atlas
- Support: https://support.mongodb.com

### Your Services
- API Health: https://your-api.railway.app/health
- Frontend: https://discover-grp.netlify.app
- Admin: https://admin-discoverg.netlify.app

## 🎓 Best Practices Checklist

Deployment:
- [ ] All environment variables set
- [ ] MongoDB network access configured
- [ ] Health check endpoint working
- [ ] Logs show no errors
- [ ] CORS configured for Netlify URLs

Security:
- [ ] Strong JWT_SECRET (32+ chars)
- [ ] HTTPS only in production
- [ ] Rate limiting enabled
- [ ] Input validation active
- [ ] MongoDB credentials secured

Monitoring:
- [ ] Health checks passing
- [ ] Error tracking setup (consider Sentry)
- [ ] MongoDB backups configured
- [ ] Log monitoring active
- [ ] Performance metrics tracked

## 🚨 Emergency Rollback

If deployment fails:

### Option 1: Rollback via Dashboard
1. Go to **Deployments**
2. Find last working deployment
3. Click **"Redeploy"**

### Option 2: Rollback via CLI
```powershell
railway rollback
```

### Option 3: Git Revert
```powershell
git revert HEAD
git push origin main
```

---

**Last Updated**: February 18, 2026  
**Railway Version**: Latest  
**Node.js Version**: 20.18.0 LTS  
**MongoDB Driver**: 8.19.1
