# Booth Dashboard

Outil interne Booth Photo Paris — génération de visuels de marque par IA et export de présentations personnalisées.

---

## Architecture

```
Booth/
├── frontend/          # Next.js 14 (App Router, TypeScript, Tailwind)
│   ├── app/           # Pages et routes API
│   │   ├── page.tsx               → Dashboard home
│   │   ├── login/                 → Authentification
│   │   ├── brands/                → Gestion des marques (CRUD)
│   │   ├── generate/              → Workflow génération IA
│   │   ├── jobs/                  → Historique des générations
│   │   └── api/                   → API routes Next.js
│   │       ├── brands/            → CRUD marques
│   │       ├── generate/          → Déclenchement Imagen 3
│   │       ├── export/            → Export PPTX (via Python API)
│   │       └── upload/logo/       → Upload logo Supabase Storage
│   ├── components/    # Composants React
│   │   ├── layout/    → Sidebar
│   │   ├── ui/        → Design system (Button, Card, Badge, Toast...)
│   │   ├── auth/      → LoginForm
│   │   ├── brands/    → BrandForm, BrandCard, LogoUploader, BrandDetail
│   │   ├── generate/  → Workflow en 5 étapes
│   │   ├── jobs/      → Historique + JobStatusBadge
│   │   └── dashboard/ → DashboardHome
│   ├── lib/
│   │   ├── imagen.ts         → Client Google Imagen 3
│   │   ├── supabase/         → Clients server/browser Supabase
│   │   └── utils.ts          → Helpers (cn, formatDate...)
│   └── types/
│       └── supabase.ts       → Types TypeScript générés du schéma
│
├── api/               # Python FastAPI — manipulation PPTX
│   ├── main.py        → Entry point + CORS
│   ├── routers/
│   │   └── presentation.py  → Injection logo + images dans le .pptx
│   └── requirements.txt
│
├── supabase/
│   └── schema.sql     → Schéma PostgreSQL (à coller dans Supabase)
│
└── templates/         → Déposer ici la présentation de base
    └── base-presentation.pptx  ← À UPLOADER dans Supabase Storage
```

---

## Stack

| Couche | Technologie |
|---|---|
| Frontend | Next.js 14 · TypeScript · Tailwind CSS |
| Base de données | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Stockage fichiers | Supabase Storage (`brand-assets`) |
| Génération IA | Google Imagen 3 via AI Studio |
| Manipulation PPTX | Python · FastAPI · python-pptx |
| Déploiement | Vercel (frontend) · Railway (Python API) |

---

## Setup rapide

### 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Dans **Database > SQL Editor**, exécuter le contenu de `supabase/schema.sql`
3. Dans **Storage**, créer un bucket public nommé `brand-assets`
4. Dans **Authentication > Users**, créer l'utilisateur éditeur
5. Récupérer `Project URL` et `anon key` dans **Settings > API**

### 2. Google AI Studio (Imagen 3)

1. Aller sur [aistudio.google.com](https://aistudio.google.com)
2. Créer une clé API
3. Vérifier que le modèle `imagen-3.0-generate-002` est disponible dans ton projet

### 3. Frontend (Next.js)

```bash
cd frontend
cp .env.example .env.local
# Remplir les variables dans .env.local

npm install
npm run dev
# → http://localhost:3000
```

### 4. Python API (FastAPI)

```bash
cd api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

uvicorn main:app --reload --port 8000
# → http://localhost:8000
```

### 5. Uploader la présentation base

Dans Supabase Storage > `brand-assets`, uploader le fichier `.pptx` de base à ce chemin exact :
```
templates/base-presentation.pptx
```

---

## Workflow de génération

```
1. Sélectionner une marque (ou en créer une)
   ↓
2. Configurer : nb d'images (1-4), instructions custom
   ↓
3. Génération : Google Imagen 3 crée les visuels (30-60s)
   Status polled toutes les 2.5s via /api/generate/[id]
   ↓
4. Sélection : choisir quelles images injecter
   ↓
5. Export : Python injecte logo + images dans le .pptx
   → Téléchargement automatique du .pptx final
```

---

## Variables d'environnement

### `frontend/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de ton projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon publique Supabase |
| `GOOGLE_AI_STUDIO_API_KEY` | Clé API Google AI Studio |
| `PYTHON_API_URL` | URL de l'API Python (local : `http://localhost:8000`) |

---

## Déploiement

### Frontend → Vercel

```bash
cd frontend
npx vercel
# Ajouter les env vars dans le dashboard Vercel
```

### Python API → Railway

```bash
# Pusher le dossier api/ sur un repo GitHub
# Connecter à Railway, sélectionner le repo
# Railway détecte automatiquement Python/FastAPI
# Ajouter PYTHON_API_URL dans les env vars Vercel
```

---

## Ajouter une nouvelle marque — Checklist

- [ ] Aller dans **Marques > Nouvelle marque**
- [ ] Renseigner nom, type de client
- [ ] Uploader le logo (PNG transparent recommandé)
- [ ] Ajouter couleur principale + mots-clés de style
- [ ] Sauvegarder → aller sur **Générer** pour créer les visuels

---

## Notes techniques

**Remplacement d'images PPTX :** `python-pptx` remplace les images en trouvant les shapes de type `picture` dans le fichier. La logique cherche d'abord le logo sur le slide 0 (couverture), puis remplace les images suivantes slide par slide.

**Génération asynchrone :** La génération Imagen est déclenchée en fire-and-forget côté serveur. Le frontend poll l'endpoint `/api/generate/[id]` toutes les 2.5 secondes pour récupérer le statut.

**Supabase Storage :** Structure du bucket `brand-assets` :
```
logos/[brand_id]/logo.png
generations/[job_id]/image_1.png
exports/[brand_id]/[job_id]_timestamp.pptx
templates/base-presentation.pptx
```
