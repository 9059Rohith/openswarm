# LexGuard OpenSwarm App

This repository is the deployable LexGuard app.

## Frontend
- Path: `frontend`
- Framework: Next.js 14 App Router
- Deployed URL: `https://openswarm.vercel.app/`

## Backend
- Path: `backend`
- Framework: FastAPI
- Application entrypoint: `backend.main:app`
- Deployed URL: `https://openswarm.onrender.com/`

## OpenSwarm integration surface
- App manifest: `meta.json`
- App schema: `schema.json`
- Static launch document: `index.html`
- Swarm status polling: `GET /api/swarm/status/{contract_id}`
- Analysis trigger: `POST /api/analyze/upload`

## Notes
- Keep the frontend and backend deployed independently.
- Do not depend on any temporary OpenSwarm workspace files at runtime.
- The existing `backend/swarm/` package provides the orchestration layer used by the app.
