import re
import os
import json
import time
import uuid
import requests
import traceback
import xml.etree.ElementTree as ET
from urllib.parse import quote
import google.auth
import vertexai
from vertexai.generative_models import GenerationConfig, GenerativeModel

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
    GenerativeModel("gemini-2.5-pro")
]

MAX_CV_CHARS = 8000
MAX_JD_CHARS = 5000
MAX_WORKERS = 4
MANUAL_SCREENING_CACHE = {}

def call_gemini(prompt, retries=2):
    for model in MODELS:
        for attempt in range(retries):
            try:
                return model.generate_content(prompt,
                    generation_config=GenerationConfig(
                    temperature=0,
                    top_p=0.1,
                    top_k=1,
                    candidate_count=1,
                    max_output_tokens=8192,
                    response_mime_type="application/json"
                ))
            except Exception as e:
                error_text = str(e).lower()

                if any(key in error_text for key in ["503", "429", "unavailable", "exhausted"]):
                    time.sleep((attempt + 1) * 3)
                else:
                    raise

    raise Exception("All Gemini models failed")



# def build_prompt(jd_text, cv_text, notes, candidate_id):
#     return f"""
#         Return ONLY valid JSON. No markdown. No explanation.

#         You are a strict ATS scoring engine.
#         Compare CV against JD using only CV evidence.

#         Extract candidate_name from CV. If missing use Candidate_{candidate_id}.
#         Extract phone_number only if explicitly present. Else "".

#         IMPORTANT JSON RULES:
#         - Return one valid JSON object only.
#         - Every array must contain maximum one string.
#         - Do not use multiline strings.
#         - Do not use quotes inside string values.
#         - Do not use commas inside string values.
#         - No trailing commas.
#         - No markdown.

#         SCORING:
#         overallScore = skills + experience + projects + education + domain

#         skills: max 35
#         experience: max 25
#         projects: max 20
#         education: max 10
#         domain: max 10

#         ratings:
#         0 no evidence
#         1 very weak
#         2 weak
#         3 partial
#         4 good
#         5 strong

#         recommendation:
#         75-100 Strong Fit
#         60-74 Good Fit
#         45-59 Borderline
#         0-44 Low Fit

#         Return this exact JSON structure:

#         {{
#         "candidate_name": "",
#         "phone_number": "",
#         "overallScore": 0,
#         "recommendation": "",
#         "rationale": "",
#         "ratings": {{
#             "jd_match": 0,
#             "skills": 0,
#             "experience": 0,
#             "projects": 0,
#             "education": 0
#         }},
#         "strengths": {{
#             "NIRF_and_Pedigree": [""],
#             "Experience_Alignment": [""],
#             "Projects_and_Quantifiable_Impact": [""]
#         }},
#         "proximity_matches": [""],
#         "gaps": {{
#             "Functional_Gaps": [""],
#             "Domain_Mismatch": [""]
#         }},
#         "jd_enhancement": {{
#             "missing_in_jd": [""]
#         }}
#         }}

#         Recruiter Notes:
#         {notes or "None"}

#         JD:
#         {jd_text[:MAX_JD_CHARS]}

#         CV:
#         {cv_text[:MAX_CV_CHARS]}
# """




def build_prompt(jd_text, cv_text, notes, candidate_id):
    return f"""
        Return ONLY valid JSON. No markdown. No explanation.

        Act as a strict ATS scoring engine.
        Compare CV with JD using only CV evidence.

        Extract candidate_name from CV. If missing use Candidate_{candidate_id}.
        Extract phone_number only if explicitly present. Else "".

        Rules:
        - overallScore must be 0 to 100.
        - ratings must be 0 to 5.
        - rationale under 16 words.
        - Each array maximum 1 item.
        - Each array item under 6 words.
        - No paragraphs.
        - No commas inside string values.
        - No quotes inside string values.
        - No markdown.
        - Valid JSON only.

        IMPORTANT SCORING RULE:
        - Do not calculate final overallScore.
        - Set overallScore as 0.
        - Only give ratings from 0 to 5.
        - Backend will calculate final score using weighted formula:
          Skills 35%, Experience 25%, Projects 20%, Education 10%, Domain/JD Match 10%.

        Recommendation:
        75-100 Strong Fit
        60-74 Good Fit
        45-59 Borderline
        0-44 Low Fit

        Return exact JSON:

        {{
        "candidate_name": "",
        "phone_number": "",
        "overallScore": 0,
        "recommendation": "",
        "rationale": "",
        "ratings": {{
            "jd_match": 0,
            "skills": 0,
            "experience": 0,
            "projects": 0,
            "education": 0
        }},
        "strengths": {{
            "NIRF_and_Pedigree": [""],
            "Experience_Alignment": [""],
            "Projects_and_Quantifiable_Impact": [""]
        }},
        "proximity_matches": [""],
        "gaps": {{
            "Functional_Gaps": [""],
            "Domain_Mismatch": [""]
        }},
        "jd_enhancement": {{
            "missing_in_jd": [""]
        }}
        }}

        Recruiter Notes:
        {notes or "None"}

        JD:
        {jd_text[:MAX_JD_CHARS]}

        CV:
        {cv_text[:MAX_CV_CHARS]}
    """



def get_ceipal_token():
    print("\n[Ceipal Auth] Initiating token request...")

    url = "https://api.ceipal.com/v2/createAuthtoken"

    payload = {
        "email": Config.CEIPAL_EMAIL,
        "password": Config.CEIPAL_PASSWORD,
        "apiKey": Config.CEIPAL_API_KEY,
    }

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
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


# def download_resume(url, access_token):
#     try:
#         headers = {
#             "Authorization": f"Bearer {access_token}",
#         }

#         response = requests.get(url, headers=headers)

#         if response.status_code != 200:
#             print("❌ Resume download failed:", response.status_code)
#             return None

#         content_type = response.headers.get("Content-Type", "")
#         ext = detect_resume_extension(content_type)

#         file_path = f"/tmp/{uuid.uuid4()}{ext}"

#         with open(file_path, "wb") as f:
#             f.write(response.content)

#         print("✅ Resume saved:", file_path)
#         return file_path

#     except Exception as e:
#         print("❌ Resume download error:", e)
#         return None

# def download_resume(resume_url, access_token):
#     try:

#         print("\n========== DOWNLOADING RESUME ==========")
#         print("Original URL:", resume_url)

#         if not resume_url:
#             print("Resume URL missing")
#             return None

#         # Preserve special chars safely
#         safe_url = resume_url.replace(" ", "%20")

#         print("Safe URL:", safe_url)

#         headers = {
#             "Authorization": f"Bearer {access_token}",
#             "User-Agent": "Mozilla/5.0"
#         }

#         response = requests.get(
#             safe_url,
#             headers=headers,
#             stream=True,
#             timeout=60,
#             allow_redirects=True
#         )

#         print("Download Status:", response.status_code)

#         if response.status_code != 200:
#             print(f"❌ Resume download failed: {response.status_code}")
#             print(response.text[:1000])
#             return None

#         content_type = response.headers.get("Content-Type", "").lower()

#         print("Content-Type:", content_type)

#         ext = ".pdf"

#         if "word" in content_type or "docx" in content_type:
#             ext = ".docx"

#         elif "msword" in content_type:
#             ext = ".doc"

#         file_name = f"resume_{uuid.uuid4().hex}{ext}"

#         save_path = os.path.join("temp_resumes", file_name)

#         os.makedirs("temp_resumes", exist_ok=True)

#         with open(save_path, "wb") as f:
#             for chunk in response.iter_content(chunk_size=8192):
#                 if chunk:
#                     f.write(chunk)

#         print("✅ Resume saved:", save_path)

#         return save_path

#     except Exception as e:
#         print("\n========== RESUME DOWNLOAD EXCEPTION ==========")
#         import traceback
#         traceback.print_exc()
#         return None
    
    
def download_resume_by_token(resume_token, access_token):
    try:
        url = "https://api.ceipal.com/v2/documentDownload/"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}"
        }

        payload = {
            "resumeToken": resume_token
        }

        response = requests.post(
            url,
            headers=headers,
            json=payload
        )

        print("Document Download Status:", response.status_code)
        print("Content-Type:", response.headers.get("Content-Type"))

        if response.status_code != 200:
            print("Document Download Failed:", response.text[:500])
            return None, None

        content_type = response.headers.get("Content-Type", "").lower()

        if "application/json" in content_type:
            print("Unexpected JSON:", response.text[:500])
            return None, None

        ext = ".pdf"
        if "word" in content_type or "docx" in content_type:
            ext = ".docx"
        elif "msword" in content_type:
            ext = ".doc"

        file_name = f"resume_{uuid.uuid4().hex}{ext}"
        file_path = os.path.join("temp_resumes", file_name)

        os.makedirs("temp_resumes", exist_ok=True)

        with open(file_path, "wb") as f:
            f.write(response.content)

        return file_path, file_name

    except Exception:
        print("Document Download Error:", traceback.format_exc())
        return None, None
    


def remove_empty_strings(obj):
    if isinstance(obj, dict):
        return {k: remove_empty_strings(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [x for x in obj if str(x).strip()]
    return obj


def get_ceipal_jobs(access_token, job_code):
    try:
        url = "https://api.ceipal.com/v2/getJobPostingsList"

        params = {
            "searchKey": f'"{job_code}"',
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
        }

        print("\n========== CEIPAL JOB API REQUEST ==========")
        print("URL:", url)
        print("Params:", params)

        response = requests.get(url, headers=headers, params=params)

        print("\n========== CEIPAL JOB API RESPONSE ==========")
        print("Status Code:", response.status_code)
        print("Raw:", response.text[:500])

        return response.json()

    except Exception as e:
        print("\n❌ CEIPAL JOB FETCH ERROR:", str(e))
        return None


# def get_ceipal_submissions(access_token, job_id, screening_type):
#     print(f"\n[Ceipal Submissions] Requesting data for Job ID: {job_id}")

#     url = (
#         f"https://api.ceipal.com/v2/getSubmissionsList"
#         #f"?bearer%20token={access_token}&job_id={job_id}&isPipeline=1"
#     )

#     params = {
#             "bearer token": access_token,
#             "job_id": job_id
#     }

#     if screening_type == "pipeline":
#             params["isPipeline"] = 1

#     headers = {
#         "Content-Type": "application/json",
#         "Authorization": f"Bearer {access_token}",
#     }

#     try:
#         response = requests.get(url, headers=headers, params=params)

#         print(f"[Ceipal Submissions] HTTP Status Code: {response.status_code}")
#         print(f"[Ceipal Submissions] Raw Response: {response.text[:300]}")

#         if not response.text.strip():
#             return None

#         return response.json()

#     except Exception:
#         print(f"[Ceipal Submissions] ERROR: {traceback.format_exc()}")
#         return None
    

def get_ceipal_submissions(access_token, job_id, screening_type):
    print(f"\n[Ceipal Submissions] Requesting data for Job ID: {job_id}")

    if screening_type == "pipeline":
        url = (
            f"https://api.ceipal.com/v2/getSubmissionsList"
            f"?isPipeline=1&jobId={job_id}"
        )
    else:
        url = (
            f"https://api.ceipal.com/v2/getSubmissionsList"
            f"?jobId={job_id}"
        )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}"
    }

    try:
        print("Final URL:", url)

        response = requests.get(
            url,
            headers=headers
        )

        print(f"[Ceipal Submissions] HTTP Status Code: {response.status_code}")
        print(f"[Ceipal Submissions] Raw Response: {response.text[:1000]}")

        if response.status_code != 200:
            return None

        if not response.text.strip():
            return None

        return response.json()

    except Exception:
        print(f"[Ceipal Submissions] ERROR: {traceback.format_exc()}")
        return None

def normalize_indian_phone(phone):
    phone = str(phone or "").strip()
    phone = re.sub(r"\D", "", phone)

    if len(phone) == 10:
        return "+91", phone

    if len(phone) == 12 and phone.startswith("91"):
        return "+91", phone[-10:]

    raise ValueError("Invalid Indian phone number")


def send_interakt_shortlist_message(candidate_name, phone_number, job_title="the role"):
    if not Config.INTERAKT_API_KEY:
        return {
            "success": False,
            "error": "INTERAKT_API_KEY missing in .env"
        }

    try:
        country_code, clean_phone = normalize_indian_phone(phone_number)

        url = "https://api.interakt.ai/v1/public/message/"

        headers = {
            "Authorization": f"Basic {Config.INTERAKT_API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "countryCode": country_code,
            "phoneNumber": clean_phone,
            "callbackData": f"SmartHireX Shortlist - {candidate_name}",
            "type": "Template",
            "template": {
                "name": Config.INTERAKT_SHORTLIST_TEMPLATE,
                "languageCode": Config.INTERAKT_LANGUAGE_CODE,
                "bodyValues": [
                    candidate_name or "Candidate",
                    job_title or "the role"
                ]
            }
        }

        response = requests.post(url, headers=headers, json=payload)

        try:
            response_data = response.json()
        except Exception:
            response_data = {"raw_response": response.text}

        if response.status_code in [200, 201]:
            return {
                "success": True,
                "message": "WhatsApp message sent successfully",
                "interakt_response": response_data
            }

        return {
            "success": False,
            "status_code": response.status_code,
            "error": response.text
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }