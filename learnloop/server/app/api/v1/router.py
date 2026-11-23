from fastapi import APIRouter

from app.api.v1.routes import admin, ai, auth, health, progress

api_router = APIRouter(prefix="/api/v1")
for module in (health, auth, progress, ai, admin):
    api_router.include_router(module.router)
