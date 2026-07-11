from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

import os

# Database Setup
# We use an environment variable so we can point to a persistent volume on Railway
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./namma.db")
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class DBUser(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    reports_count = Column(Integer, default=0)

class DBReport(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    lat = Column(Float)
    lng = Column(Float)
    severity = Column(String, default="low")
    image_base64 = Column(String, nullable=True)
    cleanup_image_base64 = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    supports = Column(Integer, default=0)

Base.metadata.create_all(bind=engine)

import sqlite3
try:
    db_path = SQLALCHEMY_DATABASE_URL.replace("sqlite:///", "")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("ALTER TABLE reports ADD COLUMN cleanup_image_base64 VARCHAR")
    conn.commit()
    conn.close()
except Exception:
    pass

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UserCreate(BaseModel):
    name: str

class UserResponse(BaseModel):
    id: int
    name: str
    xp: int
    level: int
    reports_count: int

class CleanupCreate(BaseModel):
    username: str
    cleanup_image_base64: str

class ReportCreate(BaseModel):
    username: str
    lat: float
    lng: float
    severity: str = "low"
    image_base64: Optional[str] = None

class ReportResponse(BaseModel):
    id: int
    pos: List[float]
    reports: int
    severity: str
    image_base64: Optional[str] = None
    cleanup_image_base64: Optional[str] = None

class FeedResponse(BaseModel):
    id: int
    username: str
    lat: float
    lng: float
    image_base64: Optional[str] = None
    cleanup_image_base64: Optional[str] = None
    timestamp: datetime
    supports: int
    severity: str = "low"

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/login", response_model=UserResponse)
def login(user: UserCreate):
    db = SessionLocal()
    db_user = db.query(DBUser).filter(DBUser.name == user.name).first()
    if not db_user:
        db_user = DBUser(name=user.name, xp=0, level=1, reports_count=0)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    db.close()
    return db_user

@app.get("/user/{name}", response_model=UserResponse)
def get_user(name: str):
    db = SessionLocal()
    db_user = db.query(DBUser).filter(DBUser.name == name).first()
    if not db_user:
        db_user = DBUser(name=name, xp=0, level=1, reports_count=0)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    db.close()
    return db_user

@app.get("/leaderboard", response_model=List[UserResponse])
def get_leaderboard():
    db = SessionLocal()
    users = db.query(DBUser).order_by(DBUser.xp.desc()).all()
    db.close()
    return users

@app.post("/reports")
def create_report(report: ReportCreate):
    db = SessionLocal()
    
    # Save Report WITH image
    db_report = DBReport(
        username=report.username, 
        lat=report.lat, 
        lng=report.lng, 
        severity=report.severity,
        image_base64=report.image_base64
    )
    db.add(db_report)
    
    # Update User XP (auto-create if missing)
    db_user = db.query(DBUser).filter(DBUser.name == report.username).first()
    if not db_user:
        db_user = DBUser(name=report.username, xp=0, level=1, reports_count=0)
        db.add(db_user)
    
    db_user.xp += 10
    db_user.reports_count += 1
    db_user.level = (db_user.xp // 50) + 1
    
    db.commit()
    db.close()
    return {"status": "success"}

@app.get("/reports", response_model=List[ReportResponse])
def get_reports():
    db = SessionLocal()
    reports = db.query(DBReport).all()
    db.close()
    
    result = []
    for r in reports:
        result.append({
            "id": r.id,
            "pos": [r.lat, r.lng],
            "reports": 1,
            "severity": r.severity,
            "image_base64": r.image_base64,
            "cleanup_image_base64": r.cleanup_image_base64
        })
    return result

@app.get("/feed", response_model=List[FeedResponse])
def get_feed():
    db = SessionLocal()
    reports = db.query(DBReport).order_by(DBReport.timestamp.desc()).all()
    db.close()
    
    result = []
    for r in reports:
        result.append({
            "id": r.id,
            "username": r.username,
            "lat": r.lat,
            "lng": r.lng,
            "image_base64": r.image_base64,
            "cleanup_image_base64": r.cleanup_image_base64,
            "timestamp": r.timestamp,
            "supports": r.supports or 0,
            "severity": r.severity
        })
    return result

@app.post("/reports/{report_id}/support")
def support_report(report_id: int):
    db = SessionLocal()
    db_report = db.query(DBReport).filter(DBReport.id == report_id).first()
    if db_report:
        db_report.supports = (db_report.supports or 0) + 1
        db.commit()
    db.close()
    return {"status": "success"}

@app.post("/reports/{report_id}/cleanup")
def cleanup_report(report_id: int, cleanup: CleanupCreate):
    db = SessionLocal()
    db_report = db.query(DBReport).filter(DBReport.id == report_id).first()
    if db_report:
        db_report.cleanup_image_base64 = cleanup.cleanup_image_base64
        
        # Give user XP for cleanup
        db_user = db.query(DBUser).filter(DBUser.name == cleanup.username).first()
        if not db_user:
            db_user = DBUser(name=cleanup.username, xp=0, level=1, reports_count=0)
            db.add(db_user)
        
        db_user.xp += 20
        db_user.level = (db_user.xp // 50) + 1
        
        db.commit()
    db.close()
    return {"status": "success"}

class XpClaim(BaseModel):
    username: str
    amount: int

@app.post("/add_xp")
def add_xp(claim: XpClaim):
    db = SessionLocal()
    db_user = db.query(DBUser).filter(DBUser.name == claim.username).first()
    if not db_user:
        db_user = DBUser(name=claim.username, xp=0, level=1, reports_count=0)
        db.add(db_user)
    db_user.xp += claim.amount
    db_user.level = (db_user.xp // 50) + 1
    db.commit()
    db.close()
    return {"status": "success", "new_xp": db_user.xp}
