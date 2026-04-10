"""
Booth Dashboard — Python API
Handles PPTX manipulation: replacing images and injecting brand logos
into the base presentation template.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import presentation

app = FastAPI(
    title="Booth Dashboard API",
    description="PPTX generation and brand asset manipulation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(presentation.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "booth-dashboard-api"}
