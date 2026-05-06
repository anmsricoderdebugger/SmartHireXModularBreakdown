import os
import json
import time
import traceback
from functools import wraps

from flask import Flask, request, jsonify, render_template, send_file, redirect, url_for, session
from authlib.integrations.flask_client import OAuth

from config import Config
from helpers import (
    extract_text_from_file,
    extract_text_from_path,
    clean_json,
    clean_json_flexible,
    clean_html_to_text,
    safe_remove,
    create_jd_docx,
    create_jd_pdf,
    create_cv_report,
)
from integrations import (
    call_gemini,
    build_prompt,
    get_ceipal_token,
    get_ceipal_jobs,
    get_ceipal_submissions,
    download_resume,
)


app = Flask(__name__)
app.secret_key = Config.FLASK_SECRET_KEY

oauth = OAuth(app)

google = oauth.register(
    name="google",
    client_id=Config.GOOGLE_CLIENT_ID,
    client_secret=Config.GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


def login_required(func):
    @wraps(func)
    def decorated(*args, **kwargs):
        if not session.get("user"):
            return redirect("/login")
        return func(*args, **kwargs)

    return decorated


@app.route("/login")
def login_page():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Login - Smart AI Recruitment</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
            body {
                font-family: 'Inter', sans-serif;
                background: #f8fafc;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
            }
            .login-box {
                background: white;
                padding: 40px;
                border-radius: 16px;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                max-width: 400px;
                width: 90%;
            }
            .login-box h1 {
                font-size: 22px;
                margin-bottom: 8px;
                color: #0f172a;
            }
            .login-box p {
                color: #64748b;
                font-size: 14px;
                margin-bottom: 24px;
            }
            .google-btn {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                padding: 12px 28px;
                background: #2563eb;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                text-decoration: none;
            }
            .google-btn:hover {
                background: #1d4ed8;
            }
            .domain-note {
                margin-top: 16px;
                font-size: 12px;
                color: #94a3b8;
            }
        </style>
    </head>
    <body>
        <div class="login-box">
            <div style="font-size:40px; margin-bottom:12px;">🧠</div>
            <h1>Smart AI Recruitment</h1>
            <p>Sign in with your company Google account to continue</p>
            <a href="/auth/login" class="google-btn">🔐 Sign in with Google</a>
            <div class="domain-note">Only company accounts are allowed</div>
        </div>
    </body>
    </html>
    """


@app.route("/auth/login")
def auth_login():
    if app.debug:
        redirect_uri = url_for("auth_callback", _external=True)
    else:
        redirect_uri = url_for("auth_callback", _external=True, _scheme="https")

    print("Redirect URI:", redirect_uri)
    return google.authorize_redirect(redirect_uri)


@app.route("/auth/callback")
def auth_callback():
    try:
        token = google.authorize_access_token()
        user_info = token.get("userinfo")

        if not user_info:
            return redirect("/login?error=no_info")

        email = user_info.get("email", "")
        domain = email.split("@")[-1] if "@" in email else ""

        if domain != Config.ALLOWED_DOMAIN:
            return f"""
            <html>
            <body style="font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f8fafc;">
                <div style="text-align:center;background:white;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                    <div style="font-size:48px;margin-bottom:12px;">🚫</div>
                    <h2 style="color:#dc2626;">Access Denied</h2>
                    <p style="color:#64748b;">Only @{Config.ALLOWED_DOMAIN} accounts are allowed.</p>
                    <p style="color:#94a3b8;font-size:13px;">You signed in as: {email}</p>
                    <a href="/login" style="color:#2563eb;text-decoration:none;font-weight:600;">← Try again</a>
                </div>
            </body>
            </html>
            """

        session["user"] = {
            "email": email,
            "name": user_info.get("name", ""),
            "picture": user_info.get("picture", ""),
        }

        return redirect("/")

    except Exception as e:
        print(f"Auth Error: {e}")
        return redirect("/login?error=auth_failed")


@app.route("/auth/logout")
def auth_logout():
    session.clear()
    return redirect("/login")


@app.route("/")
@login_required
def index():
    return render_template("index.html", user=session.get("user"))


@app.route("/api/jd/generate-mcqs", methods=["POST"])
@login_required
def generate_mcqs():
    try:
        jd_file = request.files.get("jd_file")

        if not jd_file:
            return jsonify({"success": False, "error": "No file uploaded"}), 400

        jd_text = extract_text_from_file(jd_file)[:Config.MAX_JD_CHARS]

        if len(jd_text.strip()) == 0:
            return jsonify({"success": False, "error": "The uploaded JD file is blank."}), 400

        if len(jd_text.strip()) < 50:
            return jsonify({"success": False, "error": "The uploaded JD appears image-based."}), 400

        prompt = f"""
Analyze this job description and generate exactly 10 MCQ questions that will help refine and improve it.

Each question should target:
role clarity, required skills, experience level, compensation, work mode, team structure, growth path, culture fit, tools/tech, and diversity.

Return ONLY valid JSON:
{{"questions": [{{"question": "...", "options": ["A", "B", "C", "D"]}}]}}

No markdown. No extra text. Exactly 10 questions, 4 options each.

JD:
{jd_text}
"""

        response = call_gemini(prompt)
        parsed = clean_json_flexible(response.text)

        if isinstance(parsed, dict) and "questions" in parsed:
            questions = parsed["questions"]
        elif isinstance(parsed, list):
            questions = parsed
        else:
            questions = []

        return jsonify({"success": True, "questions": questions[:10]})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/jd/create-from-mcqs", methods=["POST"])
@login_required
def create_from_mcqs():
    try:
        jd_file = request.files.get("jd_file")
        answers = json.loads(request.form.get("answers", "{}"))

        jd_text = extract_text_from_file(jd_file)[:Config.MAX_JD_CHARS] if jd_file else ""

        if len(jd_text.strip()) == 0:
            return jsonify({"success": False, "error": "The uploaded JD file is blank."}), 400

        prompt = f"""
Create a professional, comprehensive job description based on the base JD and recruiter's MCQ answers.

FORMATTING:
Return ONLY valid JSON:
{{"jd_html": "<h3>SECTION</h3><p>Content</p>"}}

Use <h3>, <p>, <ul><li>, <strong>.
No markdown.

BASE JD:
{jd_text}

RECRUITER ANSWERS:
{json.dumps(answers)}
"""

        response = call_gemini(prompt)
        data = clean_json(response.text)

        return jsonify({"success": True, "jd_html": data.get("jd_html", "")})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/jd/create-manual", methods=["POST"])
@login_required
def create_manual():
    try:
        payload = request.json or {}

        prompt = f"""
Create a professional, comprehensive job description from these details:

Job Title: {payload.get("job_title", "")}
Department: {payload.get("department", "")}
Location: {payload.get("location", "")}
Experience: {payload.get("experience", "")}
Responsibilities: {payload.get("responsibilities", "")}
Skills: {payload.get("skills", "")}
Notes: {payload.get("notes", "")}

FORMATTING:
Return ONLY valid JSON:
{{"jd_html": "<h3>SECTION</h3><p>Content</p>"}}

Use <h3>, <p>, <ul><li>, <strong>.
Include: About the Role, Key Responsibilities, Requirements, Nice-to-Have, What We Offer.
No markdown.
"""

        response = call_gemini(prompt)
        data = clean_json(response.text)

        return jsonify({"success": True, "jd_html": data.get("jd_html", "")})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/jd/enhance", methods=["POST"])
@login_required
def enhance_jd():
    try:
        payload = request.json or {}

        original = payload.get("original_jd", "")
        instructions = payload.get("instructions", "")

        prompt = f"""
Enhance this job description based on the given instructions.

Instructions:
{instructions}

FORMATTING:
Return ONLY valid JSON:
{{"enhanced_html": "<h3>SECTION</h3><p>Content</p>"}}

Use <h3>, <p>, <ul><li>, <strong>.
Wrap enhanced/changed sections in <mark> tags.
No markdown.

ORIGINAL JD:
{original}
"""

        response = call_gemini(prompt)
        data = clean_json(response.text)

        return jsonify({"success": True, "enhanced_html": data.get("enhanced_html", "")})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/jd/enhance-mcqs", methods=["POST"])
@login_required
def enhance_mcqs():
    try:
        payload = request.json or {}
        original_jd = payload.get("original_jd", "")[:3000]

        prompt = f"""
Generate 10 short MCQ questions to improve this job description.

Topics:
tone, skills detail, inclusivity, compensation, remote policy, growth path, team info, interview process, tech stack, DEI.

Rules:
- Each question max 15 words
- Each option max 8 words
- Exactly 4 options per question
- Return ONLY JSON array

FORMAT:
[{{"question": "short question?", "options": ["A", "B", "C", "D"]}}]

JD:
{original_jd}
"""

        response = call_gemini(prompt)
        parsed = clean_json_flexible(response.text)

        if isinstance(parsed, dict) and "questions" in parsed:
            questions = parsed["questions"]
        elif isinstance(parsed, list):
            questions = parsed
        else:
            questions = []

        return jsonify({"success": True, "questions": questions[:10]})

    except Exception:
        print(f"[ENHANCE-MCQ ERROR] {traceback.format_exc()}")
        return jsonify({"success": False, "error": "Failed to generate enhancement MCQs"}), 500


@app.route("/api/jd/download-docx", methods=["POST"])
@login_required
def download_docx():
    try:
        html_content = request.json.get("html", "")
        buffer = create_jd_docx(html_content)

        return send_file(
            buffer,
            as_attachment=True,
            download_name="Job_Description.docx",
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

    except Exception:
        print(f"DOCX Download Error: {traceback.format_exc()}")
        return jsonify({"success": False, "error": "DOCX generation failed"}), 500


@app.route("/api/jd/download-pdf", methods=["POST"])
@login_required
def download_pdf():
    try:
        html_content = request.json.get("html", "")
        buffer = create_jd_pdf(html_content)

        return send_file(
            buffer,
            as_attachment=True,
            download_name="Job_Description.pdf",
            mimetype="application/pdf",
        )

    except Exception:
        print(f"PDF Error: {traceback.format_exc()}")
        return jsonify({"success": False, "error": "PDF generation failed"}), 500


@app.route("/api/screen/manual", methods=["POST"])
@login_required
def screen_cv_manual():
    try:
        jd_file = request.files.get("jd")
        cv_file = request.files.get("cv")
        notes = request.form.get("notes", "")

        if not cv_file:
            return jsonify({"success": False, "error": "CV file missing"}), 400

        jd_text = extract_text_from_file(jd_file) if jd_file else "Not provided"
        cv_text = extract_text_from_file(cv_file)

        if not cv_text or len(cv_text.strip()) == 0:
            return jsonify({"success": False, "error": f"'{cv_file.filename}' appears blank."}), 400

        if len(cv_text.strip()) < 50:
            return jsonify({"success": False, "error": f"'{cv_file.filename}' appears image-based."}), 400

        jd_text = jd_text[:Config.MAX_JD_CHARS]
        cv_text = cv_text[:Config.MAX_CV_CHARS]

        prompt = build_prompt(jd_text, cv_text, notes, cv_file.filename)
        response = call_gemini(prompt)

        return jsonify({"success": True, "data": clean_json(response.text)})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/screen/ats", methods=["POST"])
@login_required
def screen_cv_ats():
    try:
        data = request.get_json() or {}

        notes = data.get("notes", "")
        job_code = data.get("job_code", "")

        if not job_code:
            return jsonify({"success": False, "error": "Job code missing"}), 400

        access_token = get_ceipal_token()

        if not access_token:
            return jsonify({"success": False, "error": "CEIPAL token failed"}), 401

        job_data = get_ceipal_jobs(access_token, job_code)

        if not job_data or not job_data.get("results"):
            return jsonify({
                "success": False,
                "error": "No job found for given job code",
                "results": [],
            }), 200

        job_info = job_data["results"][0]
        job_description_html = job_info.get("requisition_description", "")
        job_id = job_info.get("id")

        if not job_id:
            return jsonify({"success": False, "error": "Job ID missing"}), 400

        submissions = get_ceipal_submissions(access_token, job_id)

        if not submissions or "results" not in submissions:
            return jsonify({"success": False, "error": "No submissions found"}), 400

        candidates = submissions.get("results", [])
        final_results = []

        jd_text = clean_html_to_text(job_description_html)[:Config.MAX_JD_CHARS]

        for candidate in candidates:
            submission_id = candidate.get("submission_id")
            resume_url = candidate.get("resume")

            result = {
                "candidate_name": f"Candidate_{submission_id}",
                "overallScore": 0,
                "recommendation": "Failed",
                "rationale": "",
                "strengths": {},
                "proximity_matches": [],
                "gaps": {},
                "jd_enhancement": {},
            }

            if not resume_url:
                result["rationale"] = "No resume URL"
                final_results.append(result)
                continue

            file_path = download_resume(resume_url, access_token)

            if not file_path:
                result["rationale"] = "Resume download failed"
                final_results.append(result)
                continue

            try:
                cv_text = extract_text_from_path(file_path)[:Config.MAX_CV_CHARS]

                if not cv_text or len(cv_text.strip()) < 50:
                    result["rationale"] = "Unreadable CV"
                    final_results.append(result)
                    continue

                prompt = build_prompt(jd_text, cv_text, notes, submission_id)
                response = call_gemini(prompt)
                parsed = clean_json(response.text)

                result.update(parsed)
                result["recommendation"] = result.get("recommendation", "Processed")

            except Exception as e:
                result["rationale"] = f"AI failed: {str(e)}"

            finally:
                safe_remove(file_path)

            final_results.append(result)

        return jsonify({
            "success": True,
            "job_description_html": job_description_html,
            "results": final_results,
        })

    except Exception as e:
        print(f"ATS Screening Error: {traceback.format_exc()}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/cv/download-report", methods=["POST"])
@login_required
def download_cv_report():
    try:
        results = request.json.get("results", [])

        if not results:
            return jsonify({"success": False, "error": "No results"}), 400

        buffer = create_cv_report(results)

        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"Candidate_Audit_Report_{time.strftime('%Y-%m-%d')}.docx",
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

    except Exception:
        print(f"Report Error: {traceback.format_exc()}")
        return jsonify({"success": False, "error": "Report generation failed"}), 500


if __name__ == "__main__":
    app.run(
        debug=True,
        host="0.0.0.0",
        port=Config.PORT,
    )