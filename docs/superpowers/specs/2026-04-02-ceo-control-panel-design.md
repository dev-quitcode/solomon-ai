# CEO Management Cycle Control Panel — Design Spec

## Overview

A standalone internal tool for a CEO and one assistant to manage strategic goal hierarchies, track check-ins, log corrections, and record notes across a full management cycle.

---

## Architecture

- **Framework:** Next.js 15 App Router
- **Database:** Supabase (Postgres + Row Level Security + Auth)
- **Auth:** Email/password — two accounts (`ceo@` and `assistant@`), roles stored in a `profiles` table (`role: 'ceo' | 'assistant'`)
- **Deployment:** Standalone app, separate from Solomon
- **RLS:** Supabase Row Level Security enforces role restrictions at the database level — not just the UI. All tables have RLS enabled. Read policies allow both roles; write policies (INSERT/UPDATE/DELETE) are restricted to the `assistant` role, except `notes` which allows both roles to insert.

### Roles

| Action | CEO | Assistant |
|--------|-----|-----------|
| View all nodes | ✓ | ✓ |
| Create / edit nodes | ✗ | ✓ |
| Submit check-ins | ✗ | ✓ |
| Add / resolve corrections | ✗ | ✓ |
| Add notes | ✓ | ✓ |
| Edit hierarchy config | ✗ | ✓ |

---

## Data Model

### `goals` — all hierarchy nodes at every level

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `readable_id` | text | e.g. `G-001`, `I-004`, `T-012`, `C-023` — auto-assigned, never reused |
| `level` | int | 1–4 (1 = top-level goal) |
| `title` | text | |
| `owner` | text | Free text name |
| `metric_target` | text | e.g. "$5M ARR" |
| `metric_current` | text | e.g. "$2.1M ARR" |
| `status` | enum | `green \| yellow \| red \| gray` |
| `next_review_at` | date | |
| `parent_id` | uuid | → `goals.id`, null for level-1 nodes |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `check_ins`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `goal_id` | uuid | → `goals.id` |
| `status` | enum | `green \| yellow \| red \| gray` |
| `metric_current` | text | Snapshot of current metric value |
| `note` | text | Free text update |
| `next_review_at` | date | |
| `created_by` | uuid | → `auth.users.id` |
| `created_at` | timestamptz | |

On save: the API route (application layer, not a DB trigger) updates the parent `goals` row — setting `status`, `metric_current`, `next_review_at`, and `updated_at` to match the check-in values.

### `corrections`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `goal_id` | uuid | → `goals.id` |
| `type` | text | `scope \| timeline \| resource \| other` |
| `description` | text | |
| `due_date` | date | |
| `responsible` | text | |
| `status` | enum | `open \| resolved` |
| `created_by` | uuid | |
| `created_at` | timestamptz | |

### `notes`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `goal_id` | uuid | → `goals.id` |
| `body` | text | Freeform — learnings, observations |
| `created_by` | uuid | |
| `created_at` | timestamptz | |

### `hierarchy_config`

| Column | Type | Notes |
|--------|------|-------|
| `level` | int | 1–4 |
| `label` | text | e.g. "Company Goal", "Initiative", "Team Priority", "Commitment" |

### `profiles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | → `auth.users.id` |
| `role` | enum | `ceo \| assistant` |
| `display_name` | text | |

---

## Readable ID Generation

- Each node gets an ID prefixed by level: `G-` (level 1), `I-` (level 2), `T-` (level 3), `C-` (level 4)
- Counter per level, auto-incremented, zero-padded to 3 digits
- IDs are permanent — never reassigned if a node is deleted
- Displayed on every card and in the detail panel for easy verbal reference ("fix T-007")
- Implementation: a `readable_id_sequences` table with one row per level (`level int, next_val int`). On node creation, the API increments `next_val` and formats the ID (e.g., `G-` + zero-pad). This runs inside the same transaction as the `goals` insert.

---

## Canvas UI

### Main Canvas

- Single horizontally-scrollable page
- All level-1 goals rendered as separate downward-branching trees, side by side
- SVG lines connect each parent node to its children
- "+ Add goal" button at the end of the goals row (assistant only)

### Node Cards

Each card shows:
- Readable ID badge (e.g. `G-001`) — small, muted
- Title (bold)
- Owner
- Status dot + left border color (green / yellow / red / gray)
- Metric: current / target (e.g. `$2.1M / $5M ARR`)
- Next review date (red if overdue)
- Alert badges: `⚠ correction open`, `stale Nd` (if no check-in for >7 days)

Level 1 cards are largest; each subsequent level is slightly smaller.

### Adding Child Nodes

- "+" button below any node (assistant only) adds a child at the next level
- Simple modal: title, owner, metric target, status, next review date

### Detail Panel

Fixed 280px panel on the right. Hidden by default, slides in on node click. Contains:

1. **Node header** — readable ID, level label, title, status
2. **Attributes** — owner, metric (current / target), next review date
3. **Check-in history** — newest first; each entry shows date, author, status change, metric snapshot, note
4. **Corrections** — open corrections listed with type, description, due date, responsible; resolved corrections in a collapsed "Resolved" section
5. **Notes** — chronological list; text input at bottom to add a note (both roles)
6. **Actions** (assistant only) — "New check-in" button, "Add correction" button

---

## Interaction Flows

### New Check-in (assistant)

1. Click node → detail panel opens
2. "New check-in" → modal with: Status, Metric current value, Update note, Next review date
3. Save → node card updates immediately; new entry appears at top of check-in history

### Add Correction (assistant)

1. "Add correction" in detail panel → modal with: Type, Description, Due date, Responsible
2. Save → `⚠ correction open` badge appears on node card; correction listed in detail panel
3. "Mark resolved" → badge disappears; correction moves to "Resolved" section

### Add Note (CEO or assistant)

1. Type in note input at bottom of detail panel → save
2. Appears in notes list with timestamp and author name

---

## Status & Staleness Logic

- **Status** is always set explicitly via check-in (not auto-calculated)
- **Stale:** node shows `stale Nd` badge if `updated_at` is more than 7 days ago and status is not `gray`
- **Overdue:** next review date shown in red if past today

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Main canvas — all goals as trees |
| `/settings` | Hierarchy config (level labels) + read-only display of the two user accounts (no in-app password changes) |
| `/login` | Email/password auth |

No other pages needed. The canvas is the entire app.

---

## Out of Scope

- Team member accounts (only CEO + assistant)
- Email notifications or reminders
- Export / reporting
- Mobile-optimized layout
- Real-time collaboration (single user at a time is fine)
