import os
from dotenv import load_dotenv

# Load .env before importing routers/services, which read env vars at import time.
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routers import auth, transcripts, analysis, chat, export

app = FastAPI(
    title="Recall. API",
    description="Backend API for the Recall meeting intelligence platform",
    version="1.0.0",
)

# In production the frontend calls the API through a Vercel rewrite (same origin),
# so CORS only matters for local dev and direct calls. Auth uses bearer tokens,
# not cookies, so credentials are not needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o],
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app"),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(transcripts.router)
app.include_router(analysis.router)
app.include_router(chat.router)
app.include_router(export.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Always answer with JSON so the frontend can show a readable message.
    print(f"Unhandled error on {request.method} {request.url.path}: {exc!r}")
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server. Please try again."})


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api")
def read_root():
    return {"message": "Welcome to Recall. API", "status": "running"}
