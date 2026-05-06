# SmartHireX Modular Flask App

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python run.py
```

## Important

- Keep `.env` local only.
- Push `.env.example`, not `.env`.
- Existing frontend endpoints are preserved:
  - `/api/jd/*`
  - `/api/screen/manual`
  - `/api/screen/ats`
  - `/api/cv/download-report`

## Structure

- `app/routes/` — Flask blueprints
- `app/services/` — Gemini, Ceipal, report generation
- `app/utils/` — file extraction, JSON parsing, auth helpers
- `app/static/` — JS/CSS
- `app/templates/` — HTML templates
