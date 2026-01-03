# AI Workflow Automation Platform

Agent-orchestrated workflow automation with human-in-the-loop capabilities.

## Project Structure

```
.
├── frontend/          # React + TypeScript frontend
├── server/            # FastAPI backend
├── docker-compose.yml # Local development services
└── README.md
```

## Quick Start

### 1. Start Infrastructure

```bash
docker-compose up -d
```

This starts PostgreSQL and Redis.

### 2. Setup Backend

```bash
cd server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your database URL and API keys

# Run migrations
alembic upgrade head

# Start server
uvicorn main:app --reload
```

Backend runs at http://localhost:8000

### 3. Setup Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs at http://localhost:3000

## Architecture

- **Frontend**: React with TypeScript, Tailwind CSS, React Router
- **Backend**: FastAPI with SQLAlchemy, Alembic migrations
- **Database**: PostgreSQL for persistence
- **Queue**: Redis for background jobs
- **AI**: Gemini API for agent execution

## API Endpoints

- `GET /api/workflows` - List workflows
- `POST /api/workflows` - Create workflow
- `GET /api/runs` - List workflow runs
- `POST /api/runs` - Start workflow run
- `GET /api/tasks` - List human tasks
- `POST /api/tasks/{id}/approve` - Approve task

## Next Steps

1. Add database models and migrations
2. Implement workflow execution engine
3. Integrate React Flow for visual builder
4. Add AI agent execution
5. Implement HITL approval flow

See Plan.md for full project specification.
