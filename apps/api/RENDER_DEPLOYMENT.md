# Render Deployment Configuration

## ⚠️ Critical: Memory Issue Fix

The API was failing deployment with **"Out of memory (used over 512MB)"** error because it was using `ts-node` to compile TypeScript at runtime.

## ✅ Solution

Use **pre-compiled JavaScript** instead of runtime compilation:

### Current Configuration (render.yaml)

```yaml
services:
  - type: web
    name: discovergroup-api
    rootDir: apps/api
    buildCommand: npm install && npm run build  # ← Compiles TS to JS
    startCommand: npm start                      # ← Runs compiled JS
```

### What This Does

1. **Build Phase**: `npm run build` → Compiles TypeScript to JavaScript in `dist/` folder
2. **Start Phase**: `npm start` → Runs `node dist/index.js` (low memory usage)

### Memory Comparison

| Method | Memory Usage | Status |
|--------|--------------|--------|
| ❌ `ts-node src/index.ts` | >512MB | Failed |
| ✅ `node dist/index.js` | <200MB | Success |

## 🔧 Manual Configuration (If not using render.yaml)

If Render doesn't pick up the `render.yaml` file, manually configure in dashboard:

### 1. Go to Render Dashboard
https://dashboard.render.com → Your Service → Settings

### 2. Update Build & Deploy Settings

**Root Directory:**
```
apps/api
```

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm start
```

### 3. Environment Variables

Set these in Render Dashboard → Environment:

**Required:**
- `NODE_ENV` = `production`
- `PORT` = `4000`
- `JWT_SECRET` = (your secret)
- `MONGODB_URI` = (your MongoDB connection)

**Frontend URLs:**
- `FRONTEND_URL` = `https://discovergroup.netlify.app`
- `CLIENT_URL` = `https://discovergroup.netlify.app`
- `ADMIN_URL` = `https://admin--discovergrp.netlify.app`

**Email (SendGrid):**
- `SENDGRID_API_KEY` = (your API key)

**Storage (Cloudflare R2):**
- `R2_ENDPOINT` = (your R2 endpoint)
- `R2_ACCESS_KEY_ID` = (your access key)
- `R2_SECRET_ACCESS_KEY` = (your secret key)
- `R2_BUCKET_NAME` = (your bucket name)
- `R2_PUBLIC_URL` = (your public URL)

## 📊 Deployment Process

```
GitHub Push
    ↓
Render Auto-Deploy Triggered
    ↓
Build Phase (3-5 minutes)
  - Clone repository
  - cd apps/api
  - npm install (385 packages)
  - npm run build (compile TS → JS)
    ↓
Start Phase (10-30 seconds)
  - npm start
  - node dist/index.js
  - Server listens on port 4000
    ↓
✅ Live: https://discovergroup.onrender.com
```

## 🐛 Troubleshooting

### If deployment still fails:

1. **Check Start Command in Render Dashboard**
   - Should be: `npm start`
   - NOT: `npx ts-node src/index.ts`
   - NOT: `ts-node src/index.ts`

2. **Clear Build Cache**
   - Render Dashboard → Settings
   - Scroll to "Build & Deploy"
   - Click "Clear build cache"
   - Deploy again

3. **Verify package.json scripts**
   ```json
   {
     "scripts": {
       "start": "node dist/index.js",
       "build": "tsc -p tsconfig.json"
     }
   }
   ```

4. **Check tsconfig.json output**
   ```json
   {
     "compilerOptions": {
       "outDir": "dist",
       "rootDir": "src"
     }
   }
   ```

## 📝 Notes

- **Free Tier**: Render spins down after 15 min inactivity (first request takes 30-60s)
- **Memory Limit**: 512MB on free tier
- **Build Time**: Usually 3-5 minutes
- **Deploy Trigger**: Auto-deploys on every push to `main` branch

## 🚀 Quick Deploy

After pushing changes:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

Render will automatically:
1. Detect the push
2. Build the code
3. Deploy to production

Monitor at: https://dashboard.render.com

## ✅ Success Indicators

Deployment successful when you see:

```
==> Build successful 🎉
==> Deploying...
==> Your service is live 🎉
```

API will be available at: `https://discovergroup.onrender.com`

---

**Last Updated**: February 16, 2026  
**Status**: ✅ Optimized for low memory usage
