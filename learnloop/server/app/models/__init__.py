"""Import every model here so Alembic's autogenerate and metadata see them."""
from app.models.progress import AiUsage, UserProgress
from app.models.user import RefreshToken, User, UserRole

__all__ = ["AiUsage", "RefreshToken", "User", "UserProgress", "UserRole"]
