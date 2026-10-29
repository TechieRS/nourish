import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.api.routes import router
from app.core.config import get_settings

FRONTEND_URL=https://nourish-dto7.vercel.app/
CORS_ORIGINS=https://nourish-dto7.vercel.app/

app = FastAPI(
    title="Nourish API",
    version="1.0.0",
    description="Public fictional wellness demo. Production requires authentication and role-based access.",
)
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(
        set(
            [settings.frontend_url]
            + [x.strip() for x in settings.cors_origins.split(",") if x.strip()]
        )
    ),
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def no_cache(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.exception_handler(IntegrityError)
async def conflict(request: Request, exc: IntegrityError):
    # Session context closes/rolls back the failed transaction before this response.
    name = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
    if name == "uq_active_slot":
        return JSONResponse(
            status_code=409,
            content={
                "detail": "That time was just booked. Please choose another slot."
            },
        )
    logging.getLogger("nourish").warning(
        "Database integrity constraint rejected a request: %s", name
    )
    return JSONResponse(
        status_code=409,
        content={
            "detail": "This change conflicts with the current appointment. Please refresh and try again."
        },
    )


@app.exception_handler(SQLAlchemyError)
async def database_error(request: Request, exc: SQLAlchemyError):
    logging.getLogger("nourish").error(
        "Database operation failed (%s)", type(exc).__name__
    )
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Our booking service is temporarily unavailable. Please try again shortly."
        },
    )


app.include_router(router)

# Root endpoint
@app.get("/", tags=["Health"])
async def home():
    return {
        "message": "Welcome to Nourish API",
        "status": "success",
        "application": "Nourish Wellness Platform",
        "version": "1.0.0",
        "documentation": "/docs"
    }


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "Nourish API",
        "version": "1.0.0"
    }
