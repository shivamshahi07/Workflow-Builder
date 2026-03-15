# AI Workflow Automation Platform

## Cursor Cloud specific instructions

### Architecture
- **Frontend**: React + TypeScript (CRA) at `frontend/`, dev server on port 3000
- **Backend**: Python FastAPI at `server/`, dev server on port 8000
- **Infrastructure**: PostgreSQL 16 + Redis 7 via `docker-compose.yml`

### Running services
Standard commands are documented in `README.md`. Key caveats below:

- **Docker must be running** before `sudo docker compose up -d` (start with `sudo dockerd &>/tmp/dockerd.log &`). All docker commands require `sudo`.
- **Backend**: activate venv first: `cd server && source .venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000`
- **Frontend**: must set `REACT_APP_API_URL=http://localhost:8000` so API calls reach the backend: `cd frontend && REACT_APP_API_URL=http://localhost:8000 npm start`
- The backend `.env` file requires `DATABASE_URL` set to a PostgreSQL connection string matching the docker-compose credentials (see `docker-compose.yml` and `server/.env.example`).

### Lint / Test / Build
- **Frontend lint**: `cd frontend && npx eslint src/`
- **Frontend build**: `cd frontend && npx react-scripts build`
- **Frontend tests**: `cd frontend && CI=true npx react-scripts test --watchAll=false --passWithNoTests` (no test files exist yet)
- **Backend syntax check**: `cd server && source .venv/bin/activate && python -m py_compile main.py`
- No pytest test suite exists for the backend yet.

### Database migrations
Run from `server/` with venv activated: `alembic upgrade head`. The Alembic env.py reads `DATABASE_URL` from `server/.env` via pydantic-settings.

### Gotchas
- The `server/.env` file is git-ignored; it must be created from `.env.example` with valid credentials on each fresh setup.
- The `alembic.ini` has a placeholder `sqlalchemy.url` that is overridden at runtime by `alembic/env.py` using `settings.DATABASE_URL`.
- Frontend proxy is **not** configured in `package.json`; the `REACT_APP_API_URL` env var is the only way to point the SPA at the backend during development.
