# LexGuard Deployment Guide

## Backend on Render

1. Push this repository to GitHub.
2. In Render, create a new **Blueprint** or **Web Service** from the repo.
3. If using Blueprint, Render will read `render.yaml`.
4. Required Render environment variables:
   - `GROQ_API_KEY`
   - `GEMINI_API_KEY`
   - `CORS_ORIGINS`
5. Use this value for `CORS_ORIGINS` after the frontend is deployed:

```json
["http://localhost:3000","https://YOUR_FRONTEND_DOMAIN.vercel.app"]
```

6. Confirm backend health:

```text
https://YOUR_RENDER_SERVICE.onrender.com/health
```

## Frontend on Vercel

1. Import the same GitHub repo into Vercel.
2. Set the Vercel root directory to:

```text
frontend
```

3. Add this Vercel environment variable:

```text
NEXT_PUBLIC_API_URL=https://YOUR_RENDER_SERVICE.onrender.com
```

4. Deploy.

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
