# SmartHireX Modular Flask App

## 🔄 Project Flow & Architecture

The application handles job descriptions, CV screening, external ATS integration, and report generation through a modular service pipeline.

### Flow Breakdown

1. **Job Description Processing (`/api/jd/*`)**
   * Client submits JD requirements or raw text via frontend.
   * `app/routes/` routes request to `app/services/` (Gemini API integration).
   * `app/utils/` parses and structures raw input into standardized JSON payload.

2. **Manual Candidate Screening (`/api/screen/manual`)**
   * Resumes (PDF/DOCX) are uploaded via client interface.
   * File text extracted using file parsing utilities in `app/utils/`.
   * Resume data and target JD are evaluated via Gemini service scoring models.
   * Structured match analysis and candidate insights returned to frontend.

3. **ATS Integration (`/api/screen/ats`)**
   * Fetch applicant profiles and JDs directly from Ceipal ATS API (`app/services/ceipal.py`).
   * Authenticated request processed via auth helpers in `app/utils/`.
   * Automated match scoring performed against ATS candidate records.

4. **Report Generation (`/api/cv/download-report`)**
   * Aggregates evaluation results and screening breakdown.
   * Triggers report generation service to build exportable PDF/HTML candidate evaluation reports.
  
# SmartHireX Modular Flask App

## 🚀 Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python run.py

[ Frontend / UI ]
       │
       ├──> 1. Job Description API  ──> (/api/jd/*)       ──> Gemini Service / Utils
       ├──> 2. Manual Screening     ──> (/api/screen/manual) ──> File Extractor + Gemini Evaluation
       ├──> 3. ATS Integration      ──> (/api/screen/ats)    ──> Ceipal API Service
       └──> 4. Report Generation    ──> (/api/cv/download-report) ──> PDF/Report Service
