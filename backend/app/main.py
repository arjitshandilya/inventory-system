"""
FastAPI application entrypoint.

Sets up:
- CORS (configurable via CORS_ORIGINS env var)
- Global exception handlers for consistent error JSON shape
- Auto table creation on startup (acceptable for this assignment scope;
  for a larger production system this would be replaced by Alembic
  migrations run as a separate deploy step)
- Route registration
"""
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.database import Base, engine
from app.routers import products, customers, orders, dashboard

app = FastAPI(
    title="Inventory & Order Management API",
    description="A production-ready API for managing products, customers, and orders.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # Creates tables if they don't already exist. Safe to run repeatedly.
    Base.metadata.create_all(bind=engine)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": exc.errors()},
    )


@app.exception_handler(SQLAlchemyError)
async def db_exception_handler(request: Request, exc: SQLAlchemyError):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "A database error occurred. Please try again."},
    )


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "Inventory & Order Management API"}


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}


app.include_router(products.router)
app.include_router(customers.router)
app.include_router(orders.router)
app.include_router(dashboard.router)
