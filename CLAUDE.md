# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SPH Control de Accesos is a React + TypeScript web application for generating and managing QR access codes for visitors. Users can generate QR codes for different visitor types (General Use and Administrative) with daily limits and inventory tracking. The app includes WhatsApp sharing functionality and visitor management.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run ESLint
npm run lint

# Preview production build
npm run preview

# Docker build (requires env vars)
docker build --build-arg VITE_SUPABASE_URL=xxx --build-arg VITE_SUPABASE_ANON_KEY=xxx -t sph-qr .
```

## Architecture

### Tech Stack
- **React 19** with TypeScript in Vite
- **Supabase** for authentication and PostgreSQL database
- **Tailwind CSS v4** for styling (using @theme syntax in index.css)
- **html2canvas** for QR image generation
- **react-qr-code** for QR code rendering
- **lucide-react** for icons

### Project Structure

```
src/
├── main.tsx           # React entry point
├── App.tsx            # Main application component (all-in-one)
├── lib/
│   └── supabaseClient.ts  # Supabase client initialization
├── types/
│   └── db.ts          # TypeScript interfaces for database tables
└── index.css          # Tailwind imports and SPH theme colors
```

### Database Schema (Supabase)

Key tables referenced in `src/types/db.ts`:
- `catUsers` - User catalog with company associations
- `empresas` - Companies with QR limits (qrDiarios, qrLigero, qrCarga)
- `qrEmpresas` - QR packs/inventory by type (tipoQR, disponibles, vigente)
- `datosVisitantes` - Visitor registry with vehicle info and ID images
- `qrGenerados` - Generated QR codes with access keys and validity

### Authentication Flow

Supabase Auth is used. Users are stored in `catUsers` table linked by `uid` to Supabase auth users. The app uses `supabase.auth.getSession()` for session management and stores user email in localStorage for convenience.

### Key Business Logic

**QR Types:**
- **Uso General** (General Use): Limited by daily quota (`qrDiarios` from empresa table)
- **Administrativo** (Administrative): Unlimited, no daily restrictions

**Daily Usage Calculation** (`fetchCompanyUsage` in App.tsx:117-165):
- Queries `qrGenerados` filtered by company's QR packs
- Uses chunked queries to avoid URL length limits (Supabase/PostgREST)
- Filters by `tipoQR = 'Uso General'` and `fc` (creation date) for today

**Visitor Images:**
- Uploaded to Supabase Storage bucket `identificaciones`
- Path pattern: `{idEmpresa}/{randomFileName}`
- Public URLs stored in `datosVisitantes.urlIdentificacion`

### Theme Colors

SPH brand colors defined in both `tailwind.config.js` and `index.css`:
- `sph-light`: #F2F2F2 (background)
- `sph-text`: #6B6B6B (text)
- `sph-primary`: #1F2D4A (navy blue)

### Docker Deployment

Multi-stage Dockerfile:
1. Builder stage: Node 20 Alpine, builds with Vite using build args for env vars
2. Production stage: nginx Alpine with custom nginx.conf
- Environment variables must be passed as build args, not runtime env vars

### Important Notes

- The app is a single-page application with all logic in `App.tsx`
- Phone number formatting follows Mexican format: (###) ###-####
- WhatsApp sharing uses Web Share API with clipboard fallback
- Session state persists via Supabase auth listeners
- Email is remembered in localStorage between sessions
