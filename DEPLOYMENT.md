# Deploying Neon Tank Duel for FREE (Vercel + Render)

This guide explains how to deploy the game completely for free using a hybrid architecture.

- **Frontend (Next.js):** Deployed on **Vercel** (Free Hobby Tier)
- **Backend (Socket.io):** Deployed on **Render** (Free Web Service)

---

## Prerequisites

1. GitHub Account
2. Vercel Account (Sign up with GitHub)
3. Render Account (Sign up with GitHub)

---

## Step 1: Prepare Your Code (Already Done)

We have already:
1. Created `socket-entry.ts` (Lightweight socket server entry point)
2. Added `"start:socket-only": "tsx socket-entry.ts"` to `package.json`
3. Moved `tsx` to `dependencies` for production use
4. Updated `NetworkManager.ts` to look for `NEXT_PUBLIC_SOCKET_URL`

**Push these changes to GitHub:**

```bash
git add .
git commit -m "Prepare for Vercel + Render deployment"
git push
```

---

## Step 2: Deploy Backend to Render (Socket Server)

Render will host the WebSocket server. It has a free tier that spins down after 15 minutes of inactivity (takes ~50s to wake up).

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Select **"Build and deploy from a Git repository"**
4. Connect your GitHub account and select `NeonTank-Test`
5. Configure the service:
   - **Name:** `neontank-socket` (or similar)
   - **Region:** Choose one close to you (e.g., Singapore, Frankfurt, Oregon)
   - **Branch:** `master`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm run start:socket-only`
   - **Instance Type:** Free
6. **Environment Variables:**
   - Key: `NEXT_PUBLIC_APP_URL`
   - Value: `https://your-vercel-app-name.vercel.app` (You'll get this in Step 3, you can come back and update it later, or set it to `*` for now to allow all connections)
   - *Tip: Set `NEXT_PUBLIC_APP_URL` to `*` initially to avoid CORS issues during setup.*
7. Click **"Create Web Service"**

**Wait for deployment.** Once live, copy the URL from the top left (e.g., `https://neontank-socket.onrender.com`).

> **Note:** The first request after inactivity will be slow (cold start). You can use a free uptime monitor (like UptimeRobot) to ping this URL every 10 minutes to keep it awake if you want.

---

## Step 3: Deploy Frontend to Vercel

Vercel will host the game interface and static assets.

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import `NeonTank-Test` from GitHub
3. **Configure Project:**
   - **Framework Preset:** Next.js (default)
   - **Root Directory:** `./` (default)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)
4. **Environment Variables:**
   - Expand "Environment Variables"
   - Key: `NEXT_PUBLIC_SOCKET_URL`
   - Value: `https://neontank-socket.onrender.com` (Your Render URL from Step 2)
5. Click **"Deploy"**

**Important:** After deploying to Vercel, copy your Vercel URL (e.g., `https://neontank-test.vercel.app`) and go back to Render Dashboard -> Environment Variables -> Edit `NEXT_PUBLIC_APP_URL` to match this URL (remove trailing slash). This secures your game server.

---

## Step 4: Verify & Play

1. Open your Vercel URL (e.g., `https://neontank-test.vercel.app`)
2. Open the browser console (F12) to check for connection errors.
3. Click **"Online Battle"**.
4. If it says "Connecting...", wait a minute (Render might be waking up).
4. If it says "Connecting...", wait a minute (Render might be waking up).
5. Once connected, click **"COPY INVITE LINK"** and send it to a friend.
6. When they open the link, they will automatically join your game session!

---

## Troubleshooting

- **CORS Errors:** If you see CORS errors, check that `NEXT_PUBLIC_APP_URL` in Render matches your Vercel URL exactly (no trailing slash). Or set it to `*` to debug.
- **Connection Timeout:** Render's free tier sleeps. The first connection takes time. Be patient or reload.
- **Build Fails:** Check the logs on Vercel/Render.

---

## Keeping it Free

- **Vercel:** Free forever for hobby use.
- **Render:** Free web services spin down. To prevent this, use a free cron job service (like cron-job.org) to hit your Render URL (`/health`) every 14 minutes.

