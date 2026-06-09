from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import httpx
import logging
import json
import os
# Setup logging format
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sigex-proxy")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"],
)
# Get the directory where this current python file lives
current_dir = os.path.dirname(os.path.abspath(__file__))

# 1. Serve the index.html on the root path
@app.get("/")
async def serve_frontend():
    html_path = os.path.join(current_dir, "index.html")
    return FileResponse(html_path)

SIGEX_BASE = "https://sigex.kz/api"

@app.post("/api/auth")
async def auth(request: Request):
    body = await request.json()
    incoming_cookies = request.cookies
    
    logger.info("--- AUTH START ---")
    logger.info(f"Incoming Body: {json.dumps(body)}")
    logger.info(f"Incoming Cookies from Browser: {incoming_cookies}")

    async with httpx.AsyncClient() as client:
        logger.info(f"Forwarding Auth to Sigex: {SIGEX_BASE}/auth")
        sigex_resp = await client.post(
            f"{SIGEX_BASE}/auth", 
            json=body, 
            cookies=incoming_cookies
        )
        
        logger.info(f"Sigex Auth Response Status: {sigex_resp.status_code}")
        logger.info(f"Sigex Response Body: {sigex_resp.text}")
        
        # FIXED LINE BELOW: changed getlist to get_list
        logger.info(f"Sigex Set-Cookie Headers: {sigex_resp.headers.get_list('set-cookie')}")

        proxy_res = Response(
            content=sigex_resp.content,
            status_code=sigex_resp.status_code,
            media_type=sigex_resp.headers.get("content-type", "application/json")
        )
        
        # Transfer cookies from Sigex to the Browser
        for cookie_name, cookie_value in sigex_resp.cookies.items():
            logger.info(f"Setting Cookie for Browser: {cookie_name}")
            proxy_res.set_cookie(
                key=cookie_name,
                value=cookie_value,
                httponly=True,
                samesite="lax",
                secure=False,
                domain=None
            )
        
        return proxy_res

@app.post("/api/{doc_id}")
async def save_signature(doc_id: str, request: Request):
    body = await request.json()
    incoming_cookies = request.cookies

    logger.info(f"--- SAVE SIGNATURE START (ID: {doc_id}) ---")
    logger.info(f"Incoming Body keys: {list(body.keys())}")
    logger.info(f"Incoming Cookies from Browser: {incoming_cookies}")

    # Check specifically for JWT
    if "jwt" not in incoming_cookies:
        logger.warning("!!! WARNING: No JWT cookie found in incoming request from browser !!!")

    async with httpx.AsyncClient() as client:
        logger.info(f"Forwarding Signature to Sigex: {SIGEX_BASE}/{doc_id}")
        sigex_resp = await client.post(
            f"{SIGEX_BASE}/{doc_id}",
            json=body,
            cookies=incoming_cookies
        )
        
        logger.info(f"Sigex Save Response Status: {sigex_resp.status_code}")
        logger.info(f"Sigex Save Response Body: {sigex_resp.text}")

        return Response(
            content=sigex_resp.content,
            status_code=sigex_resp.status_code,
            media_type=sigex_resp.headers.get("content-type")
        )

@app.get("/api/{path:path}")
async def proxy_get(path: str, request: Request):
    logger.info(f"--- GET PROXY: {path} ---")
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{SIGEX_BASE}/{path}", cookies=request.cookies)
        logger.info(f"GET Response Status: {resp.status_code}")
        return Response(
            content=resp.content, 
            status_code=resp.status_code, 
            media_type=resp.headers.get("content-type")
        )
    
# 2. SERVE YOUR STATIC JS/PDF FILES
# This allows the browser to find app.js, ncalayer-client.js, etc.
app.mount("/static", StaticFiles(directory="static"), name="static")