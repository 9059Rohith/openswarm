# LexGuard Deployment Guide

## Backend on Render

1. Push this repository to GitHub.
2. In Render, create a new **Blueprint** or **Web Service** from the repo.
3. If using Blueprint, Render will read `render.yaml`.
4. Required Render environment variables:
   - `GROQ_API_KEY`
   - `GEMINI_API_KEY`
   - `CORS_ORIGINS`
5. Before the frontend is deployed, this value is enough for local testing:

```json
["http://localhost:3000","http://127.0.0.1:3000"]
```

6. After Vercel gives you the frontend URL, update `CORS_ORIGINS` to include it:

```json
["http://localhost:3000","http://127.0.0.1:3000","https://YOUR_FRONTEND_DOMAIN.vercel.app"]
```

7. Confirm backend health:

```text
https://openswarm.onrender.com/health
```

## Frontend on Vercel

1. Import the same GitHub repo into Vercel.
2. Set the Vercel root directory to:

```text
frontend
```

3. Add this Vercel environment variable:

```text
NEXT_PUBLIC_API_URL=https://openswarm.onrender.com
```

4. Deploy.
5. After deployment, copy the Vercel URL and add it to Render `CORS_ORIGINS`.

## Demo Login

```text
Email: demo@lexguard.ai
Password: demo1234
```

The demo account is created automatically by the backend on first login.

## Local Run

Backend:

```powershell
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd frontend
npm run dev
```

Open:

```text
http://localhost:3000/login
```
