from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import frontmatter
import os
import glob
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DISPATCHES_DIR = os.path.join(BASE_DIR, "dispatches")
ASSETS_DIR = os.path.join(BASE_DIR, "assets", "incite-headers")

# Mount assets directory for HTTP serving
app.mount("/assets", StaticFiles(directory=os.path.join(BASE_DIR, "assets")), name="assets")

os.makedirs(DISPATCHES_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)

class DispatchModel(BaseModel):
    id: str
    title: str
    category: str
    bgImage: str
    date: str
    description: str
    content: str

def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z0-9_-]+', '-', text)
    return text.strip('-') or 'dispatch'

@app.get("/api/dispatches")
def list_dispatches():
    articles = []
    files = glob.glob(os.path.join(DISPATCHES_DIR, "*.md")) + glob.glob(os.path.join(DISPATCHES_DIR, "*.markdown"))
    
    for file_path in files:
        post = frontmatter.load(file_path)
        file_id = post.get("id", os.path.splitext(os.path.basename(file_path))[0])
        
        articles.append({
            "id": str(file_id),
            "title": post.get("title", "Untitled"),
            "category": post.get("category", "burj"),
            "bgImage": post.get("bgImage", "ustreasury.jpg"),
            "date": str(post.get("date", "")),
            "description": post.get("description", ""),
            "content": post.content,
            "filename": os.path.basename(file_path)
        })
    
    articles.sort(key=lambda x: x.get("date", ""), reverse=True)
    return articles

@app.get("/api/dispatches/{dispatch_id}")
def get_dispatch(dispatch_id: str):
    file_path = os.path.join(DISPATCHES_DIR, f"{dispatch_id}.md")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dispatch file not found")
    
    post = frontmatter.load(file_path)
    return {
        "id": dispatch_id,
        "title": post.get("title", ""),
        "category": post.get("category", "burj"),
        "bgImage": post.get("bgImage", ""),
        "date": str(post.get("date", "")),
        "description": post.get("description", ""),
        "content": post.content
    }

@app.post("/api/dispatches")
def save_dispatch(payload: DispatchModel):
    file_id = slugify(payload.id) if payload.id else slugify(payload.title)
    file_path = os.path.join(DISPATCHES_DIR, f"{file_id}.md")
    
    post = frontmatter.Post(
        payload.content,
        id=file_id,
        title=payload.title,
        category=payload.category,
        bgImage=payload.bgImage,
        date=payload.date,
        description=payload.description
    )
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(frontmatter.dumps(post))
        
    return {"status": "success", "id": file_id, "file": f"{file_id}.md"}

@app.get("/api/assets")
def list_assets():
    assets = []
    # Scan root assets folder and incite-headers subdirectory
    asset_root = os.path.join(BASE_DIR, "assets")
    if os.path.exists(asset_root):
        for root, dirs, files in os.walk(asset_root):
            for file in files:
                if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.svg')):
                    rel_path = os.path.relpath(os.path.join(root, file), BASE_DIR)
                    # Normalize backslashes to forward slashes for web paths
                    assets.append(rel_path.replace("\\", "/"))
    return assets
    
@app.post("/api/upload")
async def upload_asset(file: UploadFile = File(...)):
    target_dir = os.path.join(BASE_DIR, "assets", "incite-headers")
    os.makedirs(target_dir, exist_ok=True)
    target_path = os.path.join(target_dir, file.filename)
    
    with open(target_path, "wb") as buffer:
        buffer.write(await file.read())
        
    return {"status": "success", "asset_path": f"assets/incite-headers/{file.filename}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
