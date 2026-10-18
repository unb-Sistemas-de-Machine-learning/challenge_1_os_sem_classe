import os
from pydantic import BaseModel
from typing import Optional

class Settings(BaseModel):
    # Server configs
    PORT: int = int(os.getenv("PORT", "3001"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    ENV: str = os.getenv("ENV", "development")
    
    # External APIs
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY", "")
    GOOGLE_FACTCHECK_KEY: Optional[str] = os.getenv("GOOGLE_FACTCHECK_KEY", "")
    PUBMED_API_KEY: Optional[str] = os.getenv("PUBMED_API_KEY", "")
    PUBMED_EMAIL: str = os.getenv("PUBMED_EMAIL", "medfact@unb.br")
    
    # Database and Storage paths
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "medfact_ml.db"))
    MODELS_DIR: str = os.getenv("MODELS_DIR", os.path.join(os.path.dirname(__file__), "ml_models"))
    
    # MLflow Tracking
    MLFLOW_TRACKING_URI: str = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5001")
    MLFLOW_EXPERIMENT_NAME: str = os.getenv("MLFLOW_EXPERIMENT_NAME", "medfact-misinformation-detector")

settings = Settings()
