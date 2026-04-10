import io
import os
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


def download_image(url: str) -> bytes:
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.content


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

    for idx, name, url in zones:
        if not url:
            continue
        shape = get_shape(prs.slides[idx], name)
        if shape is None:
            print(f"Warning: shape '{name}' not found on slide {idx}")
            continue
        try:
            img_bytes = download_image(url)
            replaced = replace_blip(prs.slides[idx].part, shape, img_bytes)
            if not replaced:
                print(f"Warning: could not replace blip for '{name}'")
        except Exception as e:
            print(f"Warning: failed to process '{name}': {e}")

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

