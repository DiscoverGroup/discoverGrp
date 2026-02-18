# 🚨 Railway Deployment FIX - Crash Loop Resolution

**Status**: Your Railway deployment is in a crash loop  
**Date**: February 18, 2026  
**Project**: discovergroup-api

## 📊 Error Analysis

### 🔴 CRITICAL - MongoDB Connection Failed
```
querySrv ENOTFOUND _mongodb._tcp.discovergroup.s2s3291.mongodb.net
```

**Root Cause**: Railway cannot connect to your MongoDB Atlas cluster

**Why this happens**:
1. ❌ MONGODB_URI environment variable not set in Railway
2. ❌ MongoDB Atlas network access blocking Railway's IP addresses
3. ❌ MongoDB cluster doesn't exist or was deleted
4. ❌ Incorrect MongoDB URI format

---

### ⚠️ HIGH - Duplicate Schema Indexes
```
[MONGOOSE] Warning: Duplicate schema index on {"timestamp":1}
[MONGOOSE] Warning: Duplicate schema index on {"expiresAt":1}
```

**Root Cause**: Fields have both `index: true` AND schema-level index declarations

**Files affected**:
- `apps/api/src/models/AuditLog.ts` (timestamp field)
- `apps/api/src/models/RefreshToken.ts` (expiresAt field)

---

### ⚠️ MEDIUM - Node.js Deprecation
```
Node.js v18.20.5 will no longer be supported in January 2026
```

**Root Cause**: Railway is using Node.js v18 (will be unsupported soon)

---

### ℹ️ LOW - Missing STRIPE_SECRET_KEY
```
WARNING: Missing recommended environment variables: STRIPE_SECRET_KEY
```

**Impact**: Non-critical, only affects if you're using Stripe payments

---

## 🔧 FIXES (Apply in Order)

### ✅ FIX 1: Configure MongoDB in Railway (CRITICAL - Do This First!)

#### Step 1: Get Your MongoDB URI

Go to **MongoDB Atlas Dashboard**:
1. Open your MongoDB Atlas account: https://cloud.mongodb.com
2. Click on your cluster (if it exists)
3. Click "Connect" → "Connect your application"
4. Copy the connection string, should look like:
   ```
   mongodb+srv://<username>:<password>@cluster.mongodb.net/<database>?retryWrites=true&w=majority
   ```
5. Replace `<username>`, `<password>`, and `<database>` with your actual values

**Example**:
```
mongodb+srv://discovergroup_admin:MySecurePassword123@cluster0.abc123.mongodb.net/discovergroup?retryWrites=true&w=majority
```

#### Step 2: Add to Railway Environment Variables

Go to **Railway Dashboard**:
1. Open https://railway.app
2. Select your project: **discovergroup-api**
3. Click on your service (the crashed one)
4. Go to **"Variables"** tab
5. Click **"+ New Variable"**
6. Add these variables:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/discovergroup?retryWrites=true&w=majority
NODE_ENV=production
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters-long
SENDGRID_API_KEY=your-sendgrid-api-key
FRONTEND_URL=https://discover-grp.netlify.app
CLIENT_URL=https://discover-grp.netlify.app
ADMIN_URL=https://admin-discoverg.netlify.app
PORT=4000
```

**IMPORTANT**: Replace with your actual values!

7. Click **"Deploy"** to redeploy with new environment variables

#### Step 3: Allow Railway IP in MongoDB Atlas

**MongoDB Atlas Network Access**:
1. In MongoDB Atlas, go to **"Network Access"**
2. Click **"Add IP Address"**
3. Choose **"Allow Access from Anywhere"** (0.0.0.0/0)
   - OR add specific Railway IP ranges (see Railway docs)
4. Click **"Confirm"**

⚠️ **Security Note**: For production, restrict to specific IPs. Use 0.0.0.0/0 temporarily to fix the crash.

---

### ✅ FIX 2: Remove Duplicate Schema Indexes

I'll fix the duplicate index warnings in the code below.

---

### ✅ FIX 3: Update Node.js Version

Create `.node-version` file in your repository root to specify Node.js version.

---

### ✅ FIX 4: Add Missing Environment Variables (Optional)

If using Stripe payments:
```env
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
```

---

## 🚀 Quick Fix Commands (After Environment Variables Are Set)

### Verify MongoDB Connection Locally
```powershell
# Test your MongoDB URI
$env:MONGODB_URI="your-mongodb-uri-here"
npm run dev:api
```

### Check Railway Logs
```powershell
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# View logs
railway logs
```

### Trigger Manual Redeploy
After setting environment variables in Railway dashboard:
1. Go to **"Deployments"** tab
2. Click **"Deploy"** button (top right)
3. OR push a new commit to trigger auto-deploy

---

## 📋 Railway Environment Variables Checklist

Copy this to Railway Variables tab:

```env
# Database (CRITICAL - MUST SET)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/discovergroup?retryWrites=true&w=majority

# Server Configuration (REQUIRED)
NODE_ENV=production
PORT=4000

# Security (CRITICAL - MUST SET)
JWT_SECRET=generate-using-crypto-randomBytes-32-characters-minimum

# Email Service (REQUIRED for email features)
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here

# Frontend URLs (REQUIRED for CORS)
FRONTEND_URL=https://discover-grp.netlify.app
CLIENT_URL=https://discover-grp.netlify.app
ADMIN_URL=https://admin-discoverg.netlify.app

# Payment (OPTIONAL - only if using Stripe)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key

# Cloudflare R2 (OPTIONAL - only if using R2 storage)
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=discovergroup-images
R2_PUBLIC_URL=https://images.your-domain.com
```

---

## 🔍 Verification Steps

After applying fixes, check these:

### 1. Railway Deployment Status
- ✅ Status shows "Active" (not "Crashed")
- ✅ No restart loops in logs
- ✅ Server starts successfully

### 2. MongoDB Connection
Look for this in Railway logs:
```
✅ MongoDB connected successfully
```

### 3. No Warnings
These should disappear:
- ❌ Duplicate schema index warnings
- ❌ MongoDB connection errors
- ❌ Node.js deprecation warnings (after Node update)

### 4. Test API Endpoint
```powershell
# Test health endpoint
curl https://discovergroup-api-production.up.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-18T10:16:00.000Z",
  "mongodb": "connected"
}
```

---

## 🆘 Still Crashing? Debug Checklist

### Check 1: MongoDB URI Format
```env
# ✅ CORRECT
MONGODB_URI=mongodb+srv://user:pass@cluster0.abc123.mongodb.net/dbname?retryWrites=true&w=majority

# ❌ WRONG - Missing password
MONGODB_URI=mongodb+srv://user@cluster0.abc123.mongodb.net/dbname

# ❌ WRONG - Special characters not URL encoded
MONGODB_URI=mongodb+srv://user:p@ss!word@cluster.mongodb.net/dbname
# Should be: p%40ss%21word
```

### Check 2: MongoDB Atlas User Exists
1. Go to **Database Access** in MongoDB Atlas
2. Verify user exists with correct password
3. Ensure user has "Read and write to any database" permission

### Check 3: Railway Build Logs
1. In Railway, click **"Deployments"**
2. Click on latest deployment
3. Check **"Build Logs"** tab for errors

### Check 4: Railway Deployment Logs
1. Click **"Deploy Logs"** tab
2. Look for the exact error message
3. Scroll to bottom for most recent error

---

## 📞 Support Resources

### MongoDB Atlas
- Dashboard: https://cloud.mongodb.com
- Network Access: https://cloud.mongodb.com/network
- Database Access: https://cloud.mongodb.com/database-access

### Railway
- Dashboard: https://railway.app
- Docs: https://docs.railway.app
- Environment Variables: https://docs.railway.app/develop/variables

### Quick Links
- [Railway Variables Documentation](https://docs.railway.app/develop/variables)
- [MongoDB Atlas Network Access](https://www.mongodb.com/docs/atlas/security/ip-access-list/)
- [Node.js Railway Guide](https://docs.railway.app/guides/nodejs)

---

## ⏱️ Expected Recovery Time

- **Set environment variables**: 5 minutes
- **MongoDB network access**: 2 minutes
- **Railway redeploy**: 3-5 minutes
- **Total**: ~10-12 minutes

---

## 🎯 Success Criteria

✅ Railway deployment shows "Active" status  
✅ Logs show "✅ MongoDB connected successfully"  
✅ No duplicate index warnings  
✅ API responds to health check  
✅ Frontend can communicate with API  

---

**Next Steps After Fix**: 
1. Test your website: https://discover-grp.netlify.app
2. Test admin panel: https://admin-discoverg.netlify.app  
3. Check API health: https://your-api-url.railway.app/health
4. Monitor Railway logs for 10 minutes to ensure stability

**Created**: February 18, 2026  
**Priority**: 🔴 CRITICAL - Fix immediately to restore service
