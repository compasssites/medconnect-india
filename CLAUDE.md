# CLAUDE.md — MedConnect India

## Project Vision

A free, direct doctor-patient consultation platform for India. No middlemen, no platform commissions. Doctors register, set their terms, and patients find them directly. Think "doctor-direct marketplace" — cutting out Practo/Apollo-style commercial intermediaries.

**Core philosophy:** By the doctors, for the patients. The platform only monetizes through small, subtle, relevant ads. All consultation fees go directly doctor-to-patient via UPI or their preferred payment method.

---

## Tech Stack (All Cloudflare)

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | **Astro 6** on **Cloudflare Workers** | SSR pages, islands architecture, SEO-friendly doctor profiles |
| UI Components | **Starwind UI** + **Tailwind CSS v4** | Astro-native shadcn-style components, zero JS overhead |
| Interactive Islands | **Preact** (only for chat window) | Lightweight reactive island for real-time WebSocket chat |
| API | **Hono** (mounted inside Astro via catch-all route) | All backend API routes — fast, typed, Cloudflare-native |
| Database | **Cloudflare D1** (SQLite) | Main relational data — users, doctors, patients, consultations |
| Real-time Chat | **Cloudflare Durable Objects** with WebSocket Hibernation | 1:1 doctor-patient consultation chat rooms |
| File Storage | **Cloudflare R2** | Medical reports, prescriptions, images, documents |
| Sessions/Cache | **Cloudflare Workers KV** | Session tokens, OTP codes, doctor search cache |
| OTP/SMS | **MSG91** (or Twilio as fallback) | Phone-based OTP authentication (essential for India) |

### Why This Stack

- **Astro** — renders pages as static HTML by default, adds JS only where needed (islands). Doctor profiles, search pages, landing page = zero JS. Only the chat window needs interactivity.
- **Starwind UI** — shadcn/ui but native Astro components + vanilla JS. No React dependency. `npx starwind add button` and you own the code. 45+ components including dialog, input, badge, card, sidebar — everything we need.
- **Hono** — ultra-fast API framework, first-class Cloudflare Workers support. Typed routes, middleware, Zod validation built-in. Way better DX than raw Workers fetch handlers.
- **Preact** — used ONLY for the chat island. 3KB, React-compatible API, perfect for the one highly interactive component (WebSocket chat). Everything else stays as Astro components with zero client JS.
- **No Next.js** — Astro + Hono is GA on Cloudflare. No adapter issues, no edge runtime quirks.

### Key Technical Decisions

- **No external chat SDK** — Durable Objects handles real-time chat at near-zero cost
- **No separate backend server** — everything runs on Cloudflare's edge
- **D1 is SQLite** — use SQLite-compatible syntax, no Postgres features
- **One Durable Object per consultation** — each doctor-patient chat gets its own DO
- **WebSocket Hibernation enabled** — DOs sleep when idle, wake on message
- **R2 for all file uploads** — zero egress fees, S3-compatible API
- **Phone number is the primary identity** — both doctors and patients authenticate via OTP
- **Preact only for chat** — everything else is Astro components (Starwind UI) with no client JS

---

## Project Structure

```
medconnect/
├── CLAUDE.md                       # This file
├── wrangler.toml                   # Cloudflare Workers config (D1, R2, KV, DO bindings)
├── astro.config.mjs                # Astro config with Cloudflare adapter
├── package.json
├── tsconfig.json
├── src/
│   ├── layouts/
│   │   ├── BaseLayout.astro        # HTML shell, meta tags, nav, footer
│   │   ├── DashboardLayout.astro   # Sidebar layout for doctor/patient dashboards
│   │   └── AuthLayout.astro        # Minimal layout for login/register
│   ├── pages/
│   │   ├── index.astro             # Landing page (static, prerendered)
│   │   ├── about.astro             # About the platform (static)
│   │   ├── auth/
│   │   │   ├── login.astro         # Phone + OTP login
│   │   │   └── register.astro      # Role selection + profile creation
│   │   ├── doctors/
│   │   │   ├── index.astro         # Doctor search/discovery (SSR)
│   │   │   └── [slug].astro        # Individual doctor profile (SSR, SEO)
│   │   ├── dashboard/
│   │   │   ├── index.astro         # Redirect based on role
│   │   │   ├── doctor/
│   │   │   │   ├── index.astro     # Doctor dashboard — requests, active consultations
│   │   │   │   ├── profile.astro   # Edit own doctor profile
│   │   │   │   └── settings.astro  # Availability, terms, payment settings
│   │   │   └── patient/
│   │   │       ├── index.astro     # Patient dashboard — consultations
│   │   │       └── profile.astro   # Edit patient profile
│   │   ├── consultation/
│   │   │   ├── request/
│   │   │   │   └── [doctorId].astro # Send consultation request
│   │   │   └── [id].astro          # Active consultation chat room (has Preact island)
│   │   └── api/                    # Hono API routes
│   │       └── [...route].ts       # Catch-all route that mounts the Hono app
│   ├── api/                        # Hono app definition
│   │   ├── index.ts               # Main Hono app with all route groups
│   │   ├── middleware/
│   │   │   ├── auth.ts            # Auth middleware — validates session from KV
│   │   │   └── cors.ts
│   │   ├── routes/
│   │   │   ├── auth.ts            # POST /api/auth/send-otp, /api/auth/verify-otp, /api/auth/logout
│   │   │   ├── doctors.ts         # GET /api/doctors, GET /api/doctors/:id
│   │   │   ├── patients.ts        # GET/PUT /api/patients/me
│   │   │   ├── consultation.ts    # CRUD + accept/reject/complete
│   │   │   └── upload.ts          # POST /api/upload — file upload to R2
│   │   └── validators/
│   │       └── schemas.ts         # Zod schemas for all API inputs
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts          # Drizzle ORM schema definitions
│   │   │   ├── queries.ts         # Reusable query helpers
│   │   │   └── migrations/
│   │   │       └── 0001_initial.sql
│   │   ├── auth/
│   │   │   ├── otp.ts             # OTP generation, send via MSG91, verify
│   │   │   └── session.ts         # Create/validate/destroy sessions in KV
│   │   ├── chat/
│   │   │   ├── ChatRoom.ts        # Durable Object class
│   │   │   └── types.ts           # Message types, WebSocket protocol
│   │   ├── storage/
│   │   │   └── r2.ts              # R2 upload/download/presigned URL helpers
│   │   └── utils/
│   │       ├── ulid.ts            # ULID generation
│   │       └── phone.ts           # Indian phone number validation/formatting
│   ├── components/
│   │   ├── ui/                    # Starwind UI components (added via CLI)
│   │   │   ├── button.astro
│   │   │   ├── input.astro
│   │   │   ├── card.astro
│   │   │   ├── badge.astro
│   │   │   ├── dialog.astro
│   │   │   ├── select.astro
│   │   │   ├── textarea.astro
│   │   │   ├── avatar.astro
│   │   │   ├── separator.astro
│   │   │   ├── skeleton.astro
│   │   │   ├── tabs.astro
│   │   │   ├── alert.astro
│   │   │   └── ... (add as needed via `npx starwind add <component>`)
│   │   ├── common/
│   │   │   ├── Navbar.astro
│   │   │   ├── MobileNav.astro
│   │   │   ├── Footer.astro
│   │   │   ├── Logo.astro
│   │   │   └── SearchBar.astro
│   │   ├── doctors/
│   │   │   ├── DoctorCard.astro
│   │   │   ├── DoctorProfile.astro
│   │   │   ├── DoctorProfileForm.astro
│   │   │   ├── AvailabilityBadge.astro
│   │   │   ├── SpecializationTag.astro
│   │   │   └── SearchFilters.astro
│   │   ├── consultation/
│   │   │   ├── RequestForm.astro
│   │   │   ├── ConsultationCard.astro
│   │   │   ├── StatusBadge.astro
│   │   │   └── AcceptRejectActions.astro
│   │   ├── patient/
│   │   │   └── PatientProfileForm.astro
│   │   ├── auth/
│   │   │   ├── PhoneInput.astro
│   │   │   └── OtpInput.astro
│   │   └── chat/                       # Preact island for chat
│   │       ├── ChatWindow.tsx          # Main chat component (client:only="preact")
│   │       ├── MessageBubble.tsx
│   │       ├── ChatInput.tsx
│   │       ├── FileUpload.tsx
│   │       ├── FilePreview.tsx
│   │       └── TypingIndicator.tsx
│   └── styles/
│       └── global.css                  # Tailwind imports + custom medical theme
├── public/
│   ├── favicon.svg
│   └── og-image.png
└── worker/
    └── chat-do.ts                      # Durable Object entry (if separate worker needed)
```

### Architecture Notes

**Hono inside Astro:** The Hono app is mounted as an Astro API route via a catch-all `[...route].ts` file. This means both the frontend (Astro SSR) and API (Hono) deploy as a single Cloudflare Worker. The Hono app accesses D1, R2, KV bindings through `c.env`.

```typescript
// src/pages/api/[...route].ts
import type { APIRoute } from "astro";
import { app } from "../../api";

export const ALL: APIRoute = async ({ request, locals }) => {
  return app.fetch(request, locals.runtime.env);
};
```

**Preact only for chat:** The chat window is the only Preact island. It's loaded with `client:only="preact"` so it renders entirely on the client (no SSR for the chat UI — it needs WebSocket anyway). All other components are pure Astro (.astro files from Starwind UI) with zero client JS.

```astro
<!-- src/pages/consultation/[id].astro -->
---
import DashboardLayout from "../../layouts/DashboardLayout.astro";
import ChatWindow from "../../components/chat/ChatWindow";
// ... fetch consultation data server-side
---
<DashboardLayout>
  <ChatWindow
    client:only="preact"
    consultationId={id}
    currentUser={user}
    wsUrl={`/api/chat/${id}`}
  />
</DashboardLayout>
```

---

## Database Schema (D1 via Drizzle ORM)

Use **Drizzle ORM** with the `drizzle-orm/d1` driver. All IDs are ULIDs (sortable, no auto-increment issues with distributed SQLite).

### Tables

```sql
-- Users (both doctors and patients)
CREATE TABLE users (
  id TEXT PRIMARY KEY,               -- ULID
  phone TEXT NOT NULL UNIQUE,        -- Indian phone number with +91 prefix
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('doctor', 'patient')),
  avatar_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Doctor profiles (extends users)
CREATE TABLE doctor_profiles (
  id TEXT PRIMARY KEY,               -- ULID
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  slug TEXT NOT NULL UNIQUE,         -- URL-friendly unique identifier
  specialization TEXT NOT NULL,      -- e.g., "Cardiologist", "General Physician"
  qualification TEXT NOT NULL,       -- e.g., "MBBS, MD"
  registration_number TEXT NOT NULL, -- NMC/State Medical Council reg number
  registration_council TEXT NOT NULL,-- e.g., "Maharashtra Medical Council"
  experience_years INTEGER,
  bio TEXT,                          -- Doctor's description
  languages TEXT,                    -- JSON array as TEXT: '["Hindi", "English", "Marathi"]'
  city TEXT,
  state TEXT,
  clinic_name TEXT,
  clinic_address TEXT,

  -- Consultation settings
  consultation_fee INTEGER,          -- In whole INR
  consultation_mode TEXT NOT NULL DEFAULT 'both' CHECK(consultation_mode IN ('online', 'offline', 'both')),
  payment_mode TEXT NOT NULL DEFAULT 'prepaid' CHECK(payment_mode IN ('prepaid', 'postpaid', 'flexible')),
  upi_id TEXT,                       -- UPI payment address
  terms TEXT,                        -- Doctor's consultation terms (free text)

  -- Availability
  is_available INTEGER NOT NULL DEFAULT 1,  -- 0 or 1 (SQLite boolean)
  available_hours TEXT,              -- JSON: '{"mon": ["09:00-12:00", "16:00-19:00"], ...}'

  -- Verification
  is_verified INTEGER NOT NULL DEFAULT 0,
  verified_at INTEGER,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Patient profiles (extends users)
CREATE TABLE patient_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  date_of_birth TEXT,               -- ISO date string
  gender TEXT CHECK(gender IN ('male', 'female', 'other')),
  blood_group TEXT,
  city TEXT,
  state TEXT,
  medical_history TEXT,             -- Brief summary, optional
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Consultations
CREATE TABLE consultations (
  id TEXT PRIMARY KEY,               -- ULID
  doctor_id TEXT NOT NULL REFERENCES users(id),
  patient_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN (
    'requested',    -- Patient sent request
    'accepted',     -- Doctor accepted
    'rejected',     -- Doctor rejected
    'in_progress',  -- Active consultation (chat open)
    'completed',    -- Doctor marked complete
    'cancelled'     -- Either party cancelled
  )),

  -- Request details (from patient)
  chief_complaint TEXT NOT NULL,     -- Brief reason for consultation
  symptoms TEXT,                     -- Detailed symptoms
  duration_of_symptoms TEXT,
  existing_conditions TEXT,
  current_medications TEXT,
  attached_files TEXT,               -- JSON array of R2 file keys

  -- Doctor's response
  consultation_mode TEXT CHECK(consultation_mode IN ('online', 'offline')),
  consultation_fee INTEGER,          -- Agreed fee in INR
  payment_mode TEXT CHECK(payment_mode IN ('prepaid', 'postpaid')),
  doctor_notes TEXT,                 -- Internal notes from doctor
  prescription_url TEXT,             -- R2 key for prescription file

  -- Timestamps
  requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
  accepted_at INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX idx_doctor_profiles_specialization ON doctor_profiles(specialization);
CREATE INDEX idx_doctor_profiles_city ON doctor_profiles(city);
CREATE INDEX idx_doctor_profiles_state ON doctor_profiles(state);
CREATE INDEX idx_doctor_profiles_is_available ON doctor_profiles(is_available);
CREATE INDEX idx_doctor_profiles_slug ON doctor_profiles(slug);
CREATE INDEX idx_consultations_doctor_id ON consultations(doctor_id);
CREATE INDEX idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX idx_consultations_status ON consultations(status);
CREATE INDEX idx_users_phone ON users(phone);
```

---

## Durable Object: ChatRoom

Each consultation gets one Durable Object instance. The DO:

1. Accepts WebSocket connections from both doctor and patient (max 2 connections per room)
2. Authenticates connections via session token passed as URL query param
3. Stores messages in the DO's built-in SQLite storage
4. Broadcasts messages in real-time to the other party
5. Handles file upload notifications (file uploaded to R2 via API, then message sent through DO)
6. Uses WebSocket Hibernation to sleep when idle
7. Supports message types: `text`, `image`, `file`, `system`
8. Sends typing indicators as transient WebSocket messages (not persisted)
9. Tracks read receipts (last message read by each party)

### ChatRoom DO Implementation Pattern

```typescript
import { DurableObject } from "cloudflare:workers";

export class ChatRoom extends DurableObject {
  private sessions: Map<WebSocket, { userId: string; role: string }>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sessions = new Map();

    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          sender_id TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'text',
          content TEXT NOT NULL,
          file_url TEXT,
          file_name TEXT,
          file_type TEXT,
          file_size INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    // Handle WebSocket upgrade
    // Authenticate user from query params
    // Use Hibernation API: acceptWebSocket() + webSocketMessage/webSocketClose
    // On connect, send message history from SQLite
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // Parse incoming message
    // "typing" → broadcast to other party, don't persist
    // "read_receipt" → update read state, broadcast
    // "text" or "file" → store in SQLite, broadcast to other party
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    // Remove from sessions, broadcast "user_left" to other party
  }
}
```

### WebSocket Message Protocol

```typescript
// Client → Server
type ClientMessage =
  | { type: "text"; content: string }
  | { type: "file"; fileUrl: string; fileName: string; fileType: string; fileSize: number }
  | { type: "typing"; isTyping: boolean }
  | { type: "read_receipt"; lastReadMessageId: string }
  | { type: "load_history"; before?: string; limit?: number };

// Server → Client
type ServerMessage =
  | { type: "message"; message: ChatMessage }
  | { type: "history"; messages: ChatMessage[] }
  | { type: "typing"; userId: string; isTyping: boolean }
  | { type: "read_receipt"; userId: string; lastReadMessageId: string }
  | { type: "user_joined"; userId: string }
  | { type: "user_left"; userId: string }
  | { type: "error"; message: string };

type ChatMessage = {
  id: string;
  senderId: string;
  type: "text" | "image" | "file" | "system";
  content: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  createdAt: number;
};
```

---

## Hono API Structure

```typescript
// src/api/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";
import { doctorRoutes } from "./routes/doctors";
import { consultationRoutes } from "./routes/consultation";
import { uploadRoutes } from "./routes/upload";
import { authMiddleware } from "./middleware/auth";

type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
  SESSIONS: KVNamespace;
  CHAT_ROOMS: DurableObjectNamespace;
  MSG91_AUTH_KEY: string;
  MSG91_TEMPLATE_ID: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("/api/*", cors());

// Public routes
app.route("/api/auth", authRoutes);
app.route("/api/doctors", doctorRoutes);

// Protected routes
app.use("/api/consultation/*", authMiddleware);
app.use("/api/upload/*", authMiddleware);
app.use("/api/patients/*", authMiddleware);
app.route("/api/consultation", consultationRoutes);
app.route("/api/upload", uploadRoutes);

// WebSocket upgrade for chat
app.get("/api/chat/:consultationId", authMiddleware, async (c) => {
  const consultationId = c.req.param("consultationId");
  const id = c.env.CHAT_ROOMS.idFromName(consultationId);
  const stub = c.env.CHAT_ROOMS.get(id);
  return stub.fetch(c.req.raw);
});

export { app };
```

---

## Feature Specifications

### Phase 1 — MVP (Build This First)

1. **Auth: Phone OTP Login/Register**
   - Enter phone → receive OTP via MSG91 → verify → session created in KV
   - On first login, prompt for role selection (doctor/patient) and basic profile
   - Session token stored in httpOnly cookie
   - Astro pages check session server-side, redirect if needed

2. **Doctor Profile Setup**
   - Multi-step Astro form: personal info → qualifications → consultation settings → UPI/payment
   - Profile gets a unique slug (e.g., `/doctors/dr-sharma-cardiologist-mumbai`)
   - Toggle availability on/off from dashboard
   - All forms use Starwind UI components (input, select, textarea, button)

3. **Doctor Discovery (Public)**
   - SSR page with search by specialization, city, name
   - Filter by: available now, consultation mode, fee range
   - Doctor cards (Starwind card component): name, specialization, city, fee, availability badge
   - Individual doctor profile page (SSR for SEO)

4. **Consultation Request Flow**
   - Patient clicks "Request Consultation" on doctor profile
   - Fills Astro form: chief complaint, symptoms, duration, existing conditions, current meds
   - Can attach files (uploaded to R2 via /api/upload)
   - Request appears in doctor's dashboard

5. **Doctor Accepts/Rejects**
   - Doctor sees request with patient's info and complaint
   - Can accept (sets mode, fee, payment terms) or reject (with optional reason)
   - Patient sees updated status on their dashboard

6. **Consultation Chat**
   - Opens when doctor marks consultation as in_progress
   - **This is the only Preact island in the app**
   - Real-time WebSocket chat via Durable Objects
   - Send text messages, share files (images, PDFs, docs)
   - Image/PDF preview inline in chat
   - Message history persisted in DO's SQLite
   - Doctor can mark consultation as complete

7. **Dashboards**
   - **Doctor:** Incoming requests (accept/reject), active consultations, past history
   - **Patient:** Pending requests, active consultations, history
   - Astro pages with Starwind UI cards, badges, tabs

### Phase 2 — After MVP

- Doctor verification badge (manual review of registration number)
- Patient reviews and ratings
- Push notifications (web push via Workers)
- Video call (share Google Meet/Jitsi link in chat)
- Prescription builder → PDF
- Doctor availability calendar with time slots
- Email notifications
- Advanced search with more filters
- Hindi/regional language UI

---

## Starwind UI Components to Install

```bash
npx starwind init

# Core components for MVP
npx starwind add button
npx starwind add input
npx starwind add textarea
npx starwind add select
npx starwind add card
npx starwind add badge
npx starwind add avatar
npx starwind add dialog
npx starwind add alert
npx starwind add separator
npx starwind add skeleton
npx starwind add tabs
npx starwind add label
npx starwind add dropdown-menu
npx starwind add sheet
npx starwind add tooltip
```

Components are copied into `src/components/ui/` as `.astro` files. Customize freely.

---

## UI/UX Guidelines

- **Mobile-first** — design for 360px width first. Most Indian users on mobile.
- **Colors:** Calming medical palette — blues, whites, subtle greens. Define as CSS custom properties.
- **Typography:** System font stack for fast loading.
- **Loading states:** Starwind skeleton component, not spinners. Optimistic updates in chat.
- **Zero JS where possible:** Profiles, search, dashboards, forms = pure Astro + Starwind. No client JS.
- **Chat exception:** ChatWindow is the only Preact island (`client:only="preact"`).
- **File uploads:** Progress bar, drag-and-drop on desktop, camera capture on mobile. Compress images client-side.
- **Accessibility:** Starwind UI has built-in a11y. Maintain ARIA labels, keyboard nav, color contrast.
- **Forms:** Standard HTML forms with Astro actions or fetch to Hono API. Progressive enhancement with vanilla JS for validation — no framework needed.

---

## Environment / wrangler.toml

```toml
name = "medconnect"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]

[vars]
MSG91_TEMPLATE_ID = ""
APP_URL = "https://medconnect.in"

# Secrets (set via `wrangler secret put`):
# MSG91_AUTH_KEY, SESSION_SECRET

[[d1_databases]]
binding = "DB"
database_name = "medconnect-db"
database_id = "<generated>"

[[r2_buckets]]
binding = "FILES"
bucket_name = "medconnect-files"

[[kv_namespaces]]
binding = "SESSIONS"
id = "<generated>"

[durable_objects]
bindings = [
  { name = "CHAT_ROOMS", class_name = "ChatRoom" }
]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["ChatRoom"]

[assets]
directory = "./dist/client"
```

---

## Development Commands

```bash
npm install
npx starwind init
npx astro add preact
npx astro add cloudflare

npm run dev                    # Local dev with workerd runtime

wrangler d1 create medconnect-db
wrangler d1 execute medconnect-db --remote --file=./src/lib/db/migrations/0001_initial.sql
wrangler r2 bucket create medconnect-files
wrangler kv namespace create SESSIONS

npm run build
wrangler deploy
```

---

## Dependencies

```json
{
  "dependencies": {
    "astro": "^6",
    "@astrojs/cloudflare": "latest",
    "@astrojs/preact": "latest",
    "preact": "^10",
    "hono": "^4",
    "@hono/zod-validator": "latest",
    "drizzle-orm": "latest",
    "zod": "^3.22",
    "ulid": "^2.3.0"
  },
  "devDependencies": {
    "drizzle-kit": "latest",
    "wrangler": "^3",
    "typescript": "^5",
    "tailwindcss": "^4",
    "@tailwindcss/vite": "^4"
  }
}
```

---

## Important Constraints & Gotchas

1. **D1 is SQLite** — no `NOW()`, use `unixepoch()`. No `BOOLEAN`, use `INTEGER` 0/1. No `JSONB`, store JSON as `TEXT`. No arrays.
2. **Durable Objects are single-threaded** — one DO per chat room, never a global singleton.
3. **Workers CPU limits** — 10ms free, 30s paid. Keep handlers fast.
4. **R2 has no image transformation** — resize/compress client-side before upload.
5. **Astro SSR on Cloudflare** — access bindings via `Astro.locals.runtime.env`.
6. **Starwind UI = .astro files** — they work server-side. Cannot import them inside Preact components.
7. **Preact island isolation** — chat Preact components must be self-contained. Use Tailwind classes directly, no Starwind imports.
8. **Sessions** — httpOnly secure cookies + KV with TTL. No JWT in localStorage.
9. **File upload flow:** Client → POST /api/upload (streams to R2) → returns file URL → client sends message with file URL through WebSocket → other party sees file inline.
10. **Indian phone numbers:** Store with +91 prefix. Validate 10-digit mobile numbers.
11. **UPI ID format:** `username@bankhandle`. Regex: `/^[a-zA-Z0-9._-]+@[a-zA-Z]{2,}$/`
12. **Astro forms** — use standard HTML forms with fetch to Hono API + vanilla JS for validation. No client-side framework needed for forms.

---

## Build Order (for Claude Code)

1. **Project scaffold** — Astro + Cloudflare adapter + Tailwind v4 + Starwind UI init + Preact + Hono + wrangler.toml
2. **Database schema** — Drizzle schema + migration SQL + run on D1
3. **Auth system** — Hono OTP routes + KV sessions + auth middleware + login/register pages
4. **User registration** — Role selection + doctor profile form + patient profile form (Starwind UI)
5. **Doctor discovery** — Public search page (SSR) + doctor profile page (SSR) + filters
6. **Consultation request** — Request form + API + doctor dashboard incoming requests
7. **Accept/reject flow** — Doctor actions + patient status updates
8. **Chat Durable Object** — ChatRoom DO + WebSocket protocol + message persistence
9. **Chat UI (Preact island)** — ChatWindow + messages + file sharing via R2
10. **Dashboards polish** — History, tabs, status filters, final UI polish
