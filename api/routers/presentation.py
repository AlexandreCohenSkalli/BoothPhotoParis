import io
import os
import base64
import requests
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from pptx import Presentation
from pptx.oxml.ns import qn

router = APIRouter()

NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"

TEMPLATE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "templates", "base-presentation.pptx"
)


class GenerateRequest(BaseModel):
    brand_name: str
    website: Optional[str] = None
    cover_image_url: Optional[str] = None
    cabine_top_url: Optional[str] = None
    cabine_bottom_url: Optional[str] = None
    kiosk_url: Optional[str] = None
    goodies_top_url: Optional[str] = None
    goodies_bottom_url: Optional[str] = None


def get_image_bytes(url_or_data: str) -> bytes:
    """Get image bytes from either a base64 data URL or an http URL."""
    if url_or_data.startswith("data:"):
        # data:image/png;base64,<b64>
        header, b64 = url_or_data.split(",", 1)
        return base64.b64decode(b64)
    return download_image(url_or_data)


def download_image(url: str, retries: int = 5) -> bytes:
    """Download image with retry/backoff — handles Pollinations 429/500."""
    import time
    for attempt in range(retries + 1):
        try:
            resp = requests.get(url, timeout=60)
            if resp.status_code == 200:
                return resp.content
            if resp.status_code in (429, 500, 503) and attempt < retries:
                delay = min(2 ** attempt * 2, 20)  # 2s, 4s, 8s, 16s, 20s
                print(f"Pollinations {resp.status_code} — retry {attempt+1}/{retries} in {delay}s")
                time.sleep(delay)
                continue
            resp.raise_for_status()
        except requests.exceptions.Timeout:
            if attempt < retries:
                print(f"Pollinations timeout — retry {attempt+1}/{retries}")
                time.sleep(5)
                continue
            raise
    raise RuntimeError(f"download_image failed after {retries} retries: {url}")


def get_shape(slide, name: str):
    """Return shape by name, searching inside groups too."""
    for shape in slide.shapes:
        if shape.name == name:
            return shape
        if shape.shape_type == 6:  # GROUP
            for child in shape.shapes:
                if child.name == name:
                    return child
    return None


def replace_blip(slide_part, shape, img_bytes: bytes) -> bool:
    """Replace the blipFill image inside a freeform or group shape."""
    spTree = shape._element
    blip = spTree.find(".//" + qn("a:blip"))
    if blip is None:
        return False
    rid = blip.get("{%s}embed" % NS_R)
    if not rid:
        return False
    try:
        slide_part._rels[rid].target_part._blob = img_bytes
        return True
    except Exception:
        return False


def replace_text(slide, old: str, new: str):
    """Replace text occurrences across all shapes in a slide."""
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        for para in shape.text_frame.paragraphs:
            for run in para.runs:
                if old in run.text:
                    run.text = run.text.replace(old, new)


@router.post("/generate-presentation")
def generate_presentation(req: GenerateRequest):
    if not os.path.exists(TEMPLATE_PATH):
        raise HTTPException(
            status_code=404, detail=f"Template not found: {TEMPLATE_PATH}"
        )

    prs = Presentation(TEMPLATE_PATH)

    # (slide_index, shape_name, image_url)
    zones = [
        (0,  "Freeform 3",  req.cover_image_url),
        (4,  "Freeform 25", req.cabine_top_url),
        (4,  "Freeform 24", req.cabine_bottom_url),
        (5,  "Freeform 8",  req.kiosk_url),
        (10, "Group 2",     req.goodies_top_url),
        (10, "Group 4",     req.goodies_bottom_url),
    ]

    # Download images sequentially with delay to avoid Pollinations 429
    active_zones = [(idx, name, url) for idx, name, url in zones if url]
    downloaded: dict[str, bytes] = {}

    import time
    for i, (idx, name, url) in enumerate(active_zones):
        if i > 0 and not url.startswith("data:"):
            time.sleep(3)
        try:
            downloaded[name] = get_image_bytes(url)
        except Exception as e:
            print(f"Warning: failed to get image '{name}': {e}")

    for idx, name, url in active_zones:
        img_bytes = downloaded.get(name)
        if not img_bytes:
            continue
        shape = get_shape(prs.slides[idx], name)
        if shape is None:
            print(f"Warning: shape '{name}' not found on slide {idx}")
            continue
        replaced = replace_blip(prs.slides[idx].part, shape, img_bytes)
        if not replaced:
            print(f"Warning: could not replace blip for '{name}'")

    # Replace brand text (Chanel → new brand)
    brand_title = req.brand_name.title()
    brand_upper = req.brand_name.upper()
    website = req.website or ""

    for slide in prs.slides:
        replace_text(slide, "CHANEL", brand_upper)
        replace_text(slide, "Chanel", brand_title)
        replace_text(slide, "chanel", req.brand_name.lower())
        if website:
            replace_text(slide, "chanel.com", website)

    out = io.BytesIO()
    prs.save(out)
    out.seek(0)

    fname = req.brand_name.replace(" ", "_") + "_x_Booth.pptx"
    return StreamingResponse(
        out,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.get("/health")
def health():
    return {
        "status": "ok",
        "template_exists": os.path.exists(TEMPLATE_PATH),
    }

