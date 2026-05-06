import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY")

    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

    ALLOWED_DOMAIN = os.getenv("ALLOWED_DOMAIN", "intellismith.com")

    PROJECT_ID = os.getenv("PROJECT_ID")
    REGION = os.getenv("REGION", "us-central1")

    CEIPAL_EMAIL = os.getenv("CEIPAL_EMAIL")
    CEIPAL_PASSWORD = os.getenv("CEIPAL_PASSWORD")
    CEIPAL_API_KEY = os.getenv("CEIPAL_API_KEY")

    MAX_CV_CHARS = int(os.getenv("MAX_CV_CHARS", 8000))
    MAX_JD_CHARS = int(os.getenv("MAX_JD_CHARS", 5000))

    PORT = int(os.getenv("PORT", 8080))