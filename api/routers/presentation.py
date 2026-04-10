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

# Chanel X Booth — utilisé comme BASE TEMPLATE (layout cabines/kiosk/goodies correct)
CHANEL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "exemple", "Chanel X Booth.pptx"
)


class GenerateRequest(BaseModel):
    brand_name: str
    website: Optional[str] = None
    primary_color: Optional[str] = None   # hex sans '#', ex: "C5A028"
    logo_url: Optional[str] = None        # URL du logo de la marque
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


def _delete_slide(prs, slide_idx: int):
    """Remove a slide from the presentation by index (slide stays in package but hidden)."""
    sld_id_lst = prs.presentation.find(qn("p:sldIdLst"))
    sld_ids = sld_id_lst.findall(qn("p:sldId"))
    sld_id_lst.remove(sld_ids[slide_idx])


def _set_shape_solid_fill(shape, hex_color: str):
    """Replace any fill on a shape with a solid color (hex without '#')."""
    from lxml import etree as _etree
    sp_pr = shape._element.find(qn("p:spPr"))
    if sp_pr is None:
        return
    for tag in ("a:blipFill", "a:solidFill", "a:gradFill", "a:pattFill", "a:noFill"):
        el = sp_pr.find(qn(tag))
        if el is not None:
            sp_pr.remove(el)
    solid = _etree.SubElement(sp_pr, qn("a:solidFill"))
    srgb = _etree.SubElement(solid, qn("a:srgbClr"))
    srgb.set("val", hex_color.lstrip("#").upper())


def inject_picture_at_shape(slide, shape_name: str, img_bytes: bytes):
    """Add an image as a new picture at the exact position/size of an existing shape."""
    import io
    target = get_shape(slide, shape_name)
    if target is None:
        print(f"Warning: shape '{shape_name}' not found for picture injection")
        return
    try:
        slide.shapes.add_picture(
            io.BytesIO(img_bytes),
            target.left, target.top,
            target.width, target.height,
        )
    except Exception as e:
        print(f"Warning: inject_picture_at_shape failed for '{shape_name}': {e}")


def set_cover_overlay_color(slide, hex_color: str):
    """Change the solidFill of Freeform 3 (inside Group 2) on the cover slide to the brand primary color."""
    clean = hex_color.lstrip("#").upper()
    if len(clean) != 6:
        return
    for shape in slide.shapes:
        if shape.name == "Group 2" and shape.shape_type == 6:
            for child in shape.shapes:
                if child.name == "Freeform 3":
                    solid = child._element.find(".//" + qn("a:solidFill"))
                    if solid is not None:
                        srgb = solid.find(qn("a:srgbClr"))
                        if srgb is not None:
                            srgb.set("val", clean)
                    return


def update_cover_texts(slide):
    """Update cover slide textbox labels to match the Booth template standard."""
    # Chanel cover uses TextBox 4 and 5 ; neutral uses TextBox 6 and 7
    mapping = {
        "TextBox 4": "PHOTOBOOTH | BRANDED BOOTH",
        "TextBox 5": "PRÉSENTATION DES SERVICES | LOCATION LONGUE DURÉE 2025/2026",
        "TextBox 6": "PHOTOBOOTH | BRANDED BOOTH",
        "TextBox 7": "PRÉSENTATION DES SERVICES | LOCATION LONGUE DURÉE 2025/2026",
    }
    for shape in slide.shapes:
        new_text = mapping.get(shape.name)
        if new_text and shape.has_text_frame:
            for para in shape.text_frame.paragraphs:
                runs = para.runs
                if runs:
                    runs[0].text = new_text
                    for run in runs[1:]:
                        run.text = ""
                    new_text = ""  # only update first paragraph


@router.post("/generate-presentation")
def generate_presentation(req: GenerateRequest):
    # Base = Chanel (layout correct : 4 colonnes cabines, 3 colonnes kiosk, 2 goodies)
    # Fallback = template neutre si Chanel introuvable
    base_path = CHANEL_PATH if os.path.exists(CHANEL_PATH) else TEMPLATE_PATH
    if not os.path.exists(base_path):
        raise HTTPException(status_code=404, detail=f"Template not found: {base_path}")

    prs = Presentation(base_path)

    # Supprimer slide 9 de Chanel ("La location longue durée") — absente du neutre
    if base_path == CHANEL_PATH:
        try:
            _delete_slide(prs, 9)
        except Exception as e:
            print(f"Warning: could not delete extra Chanel slide: {e}")

    # ── Zones brand à remplacer (replace_blip sur shapes existantes) ──────────
    # Slide 0  : logo marque centré (Freeform 5 dans Chanel)
    # Slide 4  : Freeform 25 = cabine top, Freeform 24 = cabine bottom
    # Slide 5  : Freeform 8  = kiosk brand
    # Slide 9  : Group 2 = goodies haut, Group 4 = goodies bas
    blip_zones = [
        (0, "Freeform 3",  req.logo_url),          # logo marque (blipFill rId3 sur cover)
        (4, "Freeform 25", req.cabine_top_url),
        (4, "Freeform 24", req.cabine_bottom_url),
        (5, "Freeform 8",  req.kiosk_url),
        (9, "Group 2",     req.goodies_top_url),
        (9, "Group 4",     req.goodies_bottom_url),
    ]

    # ── Téléchargements ────────────────────────────────────────────────────────
    import time
    fetched: dict[str, bytes] = {}
    items = [(f"{idx}_{name}", url) for idx, name, url in blip_zones if url]

    for i, (key, url) in enumerate(items):
        if i > 0 and not url.startswith("data:"):
            time.sleep(1)
        try:
            fetched[key] = get_image_bytes(url)
        except Exception as e:
            print(f"Warning: failed to fetch '{key}': {e}")

    # ── Appliquer ─────────────────────────────────────────────────────────────
    for idx, name, url in blip_zones:
        if not url:
            continue
        img_bytes = fetched.get(f"{idx}_{name}")
        if not img_bytes:
            continue
        slide = prs.slides[idx]
        shape = get_shape(slide, name)
        if shape is None:
            print(f"Warning: shape '{name}' not found on slide {idx}")
            continue
        if not replace_blip(slide.part, shape, img_bytes):
            print(f"Warning: replace_blip failed for '{name}' on slide {idx}")

    # ── Cover : fond brand + logo centré + textes standard ────────────────────
    cover_slide = prs.slides[0]
    # 1. Freeform 2 = fond de la cover → couleur primaire de la marque
    #    Freeform 3 = emplacement du logo → NE PAS peindre (replace_blip déjà fait ci-dessus)
    bg_color = req.primary_color.lstrip("#") if req.primary_color else "0D0D0D"
    shape_bg = get_shape(cover_slide, "Freeform 2")
    if shape_bg:
        try:
            _set_shape_solid_fill(shape_bg, bg_color)
        except Exception as e:
            print(f"Warning: fill Freeform 2: {e}")
    # 2. Fallback si Freeform 3 introuvable : add_picture centré
    logo_bytes = fetched.get("0_Freeform 3")
    if logo_bytes and not get_shape(cover_slide, "Freeform 3"):
        W, H = prs.slide_width, prs.slide_height
        lw, lh = int(W * 0.22), int(H * 0.22)
        cover_slide.shapes.add_picture(io.BytesIO(logo_bytes), (W - lw) // 2, (H - lh) // 2, lw, lh)
    # 3. Textes standard
    try:
        update_cover_texts(cover_slide)
    except Exception as e:
        print(f"Warning: cover text update failed: {e}")

    # ── Remplacement du texte de marque ───────────────────────────────────────
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

