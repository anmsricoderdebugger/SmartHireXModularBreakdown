import os
import json
import time
import uuid
import requests
import traceback
import xml.etree.ElementTree as ET

import google.auth
import vertexai
from vertexai.generative_models import GenerativeModel

from config import Config


def init_vertex_ai():
    try:
        credentials, project = google.auth.default()
        vertexai.init(
            project=Config.PROJECT_ID,
            location=Config.REGION,
            credentials=credentials,
        )
    except Exception:
        vertexai.init(
            project=Config.PROJECT_ID,
            location=Config.REGION,
        )


init_vertex_ai()

MODELS = [
    GenerativeModel("gemini-2.5-flash"),
    GenerativeModel("gemini-2.5-pro"),
    GenerativeModel("gemini-2.0-flash"),
]


def call_gemini(prompt, retries=2):
    for model in MODELS:
        for attempt in range(retries):
            try:
                return model.generate_content(prompt)
            except Exception as e:
                error_text = str(e).lower()

                if any(key in error_text for key in ["503", "429", "unavailable", "exhausted"]):
                    time.sleep((attempt + 1) * 3)
                else:
                    raise

    raise Exception("All Gemini models failed")


def build_prompt(jd_text, cv_text, notes, candidate_id):
    return f"""
Act as a Strategic Talent Architect. Conduct a forensic audit of the CV against the JD.

Identify candidate name from CV. If missing use Candidate_{candidate_id}.

Recruiter Notes:
{notes or "None"}

Rules:
- Each point: Label: Short description
- Max 3 items
- No markdown
- Do not hallucinate
- Score only based on evidence found in CV

Return ONLY JSON:

{{
    "candidate_name": "",
    "overallScore": 0,
    "recommendation": "",
    "rationale": "",

    "strengths": {{
        "NIRF_and_Pedigree": [],
        "Experience_Alignment": [],
        "Projects_and_Quantifiable_Impact": []
    }},

    "proximity_matches": [],

    "gaps": {{
        "Functional_Gaps": [],
        "Domain_Mismatch": []
    }},

    "jd_enhancement": {{
        "missing_in_jd": []
    }}
}}

JD:
{jd_text}

CV:
{cv_text}
"""


def get_ceipal_token():
    print("\n[Ceipal Auth] Initiating token request...")

    url = "https://api.ceipal.com/v1/createAuthtoken"

    payload = {
        "email": Config.CEIPAL_EMAIL,
        "password": Config.CEIPAL_PASSWORD,
        "api_key": Config.CEIPAL_API_KEY,
    }

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        print(f"[Ceipal Auth] HTTP Status Code: {response.status_code}")

        raw_body = response.text.strip()
        print(f"[Ceipal Auth] Raw Response Body: {raw_body[:300]}")

        if not raw_body:
            return None

        if raw_body.startswith("<?xml") or raw_body.startswith("<root"):
            root = ET.fromstring(raw_body)
            token_element = root.find("access_token")

            if token_element is not None:
                token = token_element.text
                print(f"[Ceipal Auth] SUCCESS XML Token: {token[:15]}...")
                return token

        data = response.json()
        token_data = data.get("access_token")

        if isinstance(token_data, list) and token_data:
            token = token_data[0]
        else:
            token = token_data

        if token:
            print(f"[Ceipal Auth] SUCCESS JSON Token: {token[:15]}...")
            return token

        print("[Ceipal Auth] FAILED: access_token not found.")
        return None

    except Exception as e:
        print(f"[Ceipal Auth] EXCEPTION: {str(e)}")
        return None


def detect_resume_extension(content_type):
    content_type = (content_type or "").lower()

    if "pdf" in content_type:
        return ".pdf"

    if content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return ".docx"

    if content_type == "application/msword":
        return ".doc"

    if "word" in content_type or "docx" in content_type:
        return ".docx"

    return ".pdf"


def download_resume(url, access_token):
    try:
        headers = {
            "Authorization": f"Bearer {access_token}",
        }

        response = requests.get(url, headers=headers, timeout=60)

        if response.status_code != 200:
            print("❌ Resume download failed:", response.status_code)
            return None

        content_type = response.headers.get("Content-Type", "")
        ext = detect_resume_extension(content_type)

        file_path = f"/tmp/{uuid.uuid4()}{ext}"

        with open(file_path, "wb") as f:
            f.write(response.content)

        print("✅ Resume saved:", file_path)
        return file_path

    except Exception as e:
        print("❌ Resume download error:", e)
        return None


def get_ceipal_jobs(access_token, job_code):
    try:
        url = "https://api.ceipal.com/v1/getJobPostingsList"

        params = {
            "searchkey": f'"{job_code}"',
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
        }

        print("\n========== CEIPAL JOB API REQUEST ==========")
        print("URL:", url)
        print("Params:", params)

        response = requests.get(url, headers=headers, params=params, timeout=30)

        print("\n========== CEIPAL JOB API RESPONSE ==========")
        print("Status Code:", response.status_code)
        print("Raw:", response.text[:500])

        return response.json()

    except Exception as e:
        print("\n❌ CEIPAL JOB FETCH ERROR:", str(e))
        return None


def get_ceipal_submissions(access_token, job_id):
    print(f"\n[Ceipal Submissions] Requesting data for Job ID: {job_id}")

    url = (
        f"https://api.ceipal.com/v1/getSubmissionsList"
        f"?bearer%20token={access_token}&job_id={job_id}&isPipeline=1"
    )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}",
    }

    try:
        response = requests.get(url, headers=headers, timeout=30)

        print(f"[Ceipal Submissions] HTTP Status Code: {response.status_code}")
        print(f"[Ceipal Submissions] Raw Response: {response.text[:300]}")

        if not response.text.strip():
            return None

        return response.json()

    except Exception:
        print(f"[Ceipal Submissions] ERROR: {traceback.format_exc()}")
        return None