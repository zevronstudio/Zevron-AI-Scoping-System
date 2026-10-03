# Zevron Scope — AI Client Discovery & Scoping Agent

> **An agency-grade autonomous discovery workspace built for software studios and digital agencies.**  
> Transform ambiguous client concepts into crystal-clear, verified technical specifications, feature roadmaps, and structured Project Briefs (SRS) in minutes.

---

## 🏢 Why Agencies Use Zevron Scope

During client onboarding, agencies spend dozens of billable hours back-and-forth on discovery calls, clarifying requirements, and drafting proposals. **Zevron Scope** automates this entire discovery phase:

1. **Intelligent Conversational Discovery**: Acts as your agency's lead technical advisor, asking targeted questions without overwhelming the client.
2. **Interactive Smart Dropdowns**: Clients can answer categorical questions with one click (e.g., *Web App, Mobile App, Website, Automation Bot, E-Commerce, Stripe checkout, B2B vs B2C, timeline brackets*).
3. **Real-time Project Intel**: Displays extracted features, target audiences, constraints, and confirmed requirements side-by-side with the chat.
4. **Production-Ready Project Brief (SRS)**: Automatically writes executive summaries, target personas, functional requirements, technical architecture, and milestone roadmaps.
5. **Targeted Section Revisions**: Clients and project managers can request targeted changes on specific brief sections without regenerating the whole document.
6. **Executive Client Export**: One-click Markdown download, formatted clipboard copy, and print-ready documentation for contracts.

---

## 🏛️ System Architecture

```text
┌────────────────────────┐      ┌────────────────────────┐      ┌─────────────────────────┐
│   Next.js 16 Client    │ ───► │  Next.js /api/v1 Proxy │ ───► │   FastAPI Backend API   │
│ (React 19, Strict TS)  │      │   (Timeout: 180s)      │      │  (Python 3.12, Uvicorn) │
└────────────────────────┘      └────────────────────────┘      └────────────┬────────────┘
                                                                             │
                                              ┌──────────────────────────────┴──────────────┐
                                              ▼                                             ▼
                                 ┌────────────────────────┐                    ┌─────────────────────────┐
                                 │   OpenAI Agents SDK    │                    │  Database & Repository  │
                                 │ (GPT-4o / LLM Model)   │                    │  (SQLite / PostgreSQL)  │
                                 │ Strict Pydantic Output │                    │  Alembic Migrations     │
                                 └────────────────────────┘                    └─────────────────────────┘
```

- **Frontend**: Next.js 16 (App Router), React 19, Strict TypeScript, Executive Pure Monochrome CSS (deep dark mode `#000000` / clean light mode), zero distracting scrollbars.
- **Backend**: FastAPI, SQLAlchemy 2.0 (async/sync transactional turns), Alembic migrations, Pydantic v2 schemas.
- **Agent Intelligence**: Single-agent pipeline powered by OpenAI Agents SDK. Generates validated, structured JSON schema output with automatic payload normalization and bounded correction recovery.
- **Database**: Zero-configuration SQLite (`zevron.db`) for instant local development, with full PostgreSQL production support.

---

## 🤖 LLM Model & Provider Compatibility

Zevron Scope is designed to work seamlessly with **OpenAI** or any standard **OpenAI-compatible LLM endpoint**:

| Provider Mode | Recommended Models | Description |
| :--- | :--- | :--- |
| **`openai`** *(Recommended)* | `gpt-4o`, `gpt-4o-mini` | Official OpenAI API. Fast, high-accuracy structured outputs. |
| **`local`** | `llama-3.3-70b`, `qwen-2.5-72b` | Self-hosted via vLLM, Ollama, LM Studio, or LocalAI. |
| **OpenAI-Compatible** | Any hosted API base | Any model hosting platform offering an OpenAI Chat Completions endpoint. |

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Python**: Version 3.12 or newer
- **Node.js**: Version 20 or newer (Node 24 LTS recommended)
- **Git**

---

### 2. Environment Configuration

Clone the repository and copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Open `.env` and set your OpenAI or LLM model credentials:

```dotenv
DATABASE_URL=sqlite:///./zevron.db

# LLM Provider Configuration
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-proj-your-openai-api-key-here
LLM_MODEL=gpt-4o

FRONTEND_URL=http://localhost:3000
ENVIRONMENT=development
AGENT_TIMEOUT_SECONDS=120
BACKEND_URL=http://127.0.0.1:8000
```

> **Note**: For local SQLite development, no database installation is required! `zevron.db` will be created automatically.

---

### 3. Backend Setup

From the project root:

```bash
# 1. Create a Python virtual environment
python -m venv .venv

# 2. Activate the virtual environment
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
source .venv/bin/activate

# 3. Install dependencies from requirements.txt
pip install -r requirements.txt

# 4. Run database migrations
cd backend
python -m alembic upgrade head

# 5. Start the FastAPI development server
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend health check will be live at `http://127.0.0.1:8000/api/v1/health`.

---

### 4. Frontend Setup

In a new terminal window:

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start the Next.js development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser to launch the discovery workspace.

---

## ⚙️ Environment Variables Reference

| Variable | Target | Default | Description |
| :--- | :--- | :--- | :--- |
| `LLM_PROVIDER` | Backend | `openai` | Provider type: `openai`, `local`, or other hosted API |
| `LLM_BASE_URL` | Backend | `https://api.openai.com/v1` | Base URL for Chat Completions endpoint |
| `LLM_API_KEY` | Backend | `""` | API key for the LLM model provider |
| `LLM_MODEL` | Backend | `gpt-4o` | Model identifier (e.g. `gpt-4o`, `gpt-4o-mini`) |
| `OPENAI_API_KEY` | Backend | `""` | Optional fallback key if using standard OpenAI variable |
| `DATABASE_URL` | Backend | `sqlite:///./zevron.db` | Database connection string (SQLite or PostgreSQL) |
| `AGENT_TIMEOUT_SECONDS`| Backend | `120` | Maximum timeout allowed for LLM inference |
| `FRONTEND_URL` | Backend | `http://localhost:3000` | Allowed CORS origin |
| `BACKEND_URL` | Frontend | `http://127.0.0.1:8000` | Internal proxy target for Next.js API route |
| `POSTGRES_PASSWORD` | Docker | `""` | Database password when running PostgreSQL via Docker |

---

## 📦 Python Dependencies (`requirements.txt`)

A complete [`requirements.txt`](requirements.txt) is provided in both root and `backend/`:

```txt
# Core Framework & Server
fastapi>=0.115.0,<1.0.0
uvicorn[standard]>=0.34.0,<1.0.0
python-dotenv>=1.0.0

# Database & ORM
sqlalchemy>=2.0.0,<3.0.0
alembic>=1.14.0,<2.0.0
psycopg[binary]>=3.2.0,<4.0.0

# Pydantic & Validation
pydantic>=2.10.0,<3.0.0
pydantic-settings>=2.7.0,<3.0.0

# LLM & OpenAI Agent SDK
openai>=1.50.0
openai-agents>=0.23.0,<1.0.0

# Testing & Dev
pytest>=8.0.0,<10.0.0
httpx>=0.28.0,<1.0.0
ruff>=0.11.0,<1.0.0
```

---

## 🐳 Docker Deployment

To launch the full production stack (PostgreSQL + FastAPI + Next.js):

```bash
# Set your POSTGRES_PASSWORD and LLM_API_KEY in .env, then:
docker compose up --build
```

- PostgreSQL runs with persistent volume storage.
- Backend runs with non-root security permissions and automated migration check.
- Frontend runs an optimized standalone production build on port `3000`.

---

## 🧪 Testing & Quality Assurance

Run backend unit & reliability tests:
```bash
cd backend
python -m pytest -p no:cacheprovider
```

Run frontend tests, linting, and production build check:
```bash
cd frontend
npm test          # Runs 5 Vitest component tests
npm run lint      # Runs ESLint with zero warnings
npm run build     # Compiles production Next.js bundle
```

---

## 🛡️ Enterprise & Agency Security

- **Strict Server-Side Isolation**: All LLM API keys and model calls remain strictly server-side. Zero client-side API key exposure.
- **Guest Sessions**: Secured by cryptographically hashed, HTTP-only session cookies.
- **Atomic Persistence**: Discovery turns persist atomically; failed requests preserve client drafts and state without data loss.
- **Rate-Limiting & Guardrails**: Built-in per-guest request limits and lease locking to prevent duplicate concurrent executions.

---

## 📄 License

Proprietary software developed for **Zevron Studio**. All rights reserved.
