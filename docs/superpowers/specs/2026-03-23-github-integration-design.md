# GitHub Integration Design

## Overview

One-way export from Solomon to GitHub. Solomon is the source of truth. Each user connects their own GitHub account via OAuth. On first export, a GitHub repository is created for the project. Subsequently, any save to a PRD, Epic, or User Story automatically syncs the change to GitHub.

**Mapping:**
- Solomon Project → GitHub Repository
- PRD → `docs/PRD.md` (file committed to repo)
- Epic → GitHub Milestone
- User Story → GitHub Issue assigned to its Epic's Milestone

---

## Data Model

### `profiles` — add GitHub connection fields

| Column | Type | Notes |
|---|---|---|
| `github_access_token` | text | Encrypted at rest; null when disconnected |
| `github_username` | text | Display name, e.g. `octocat` |
| `github_connected_at` | timestamptz | When OAuth was completed |

### `projects` — add export tracking

| Column | Type | Notes |
|---|---|---|
| `github_repo_url` | text | e.g. `https://github.com/user/my-project`; null until exported |
| `github_exported_at` | timestamptz | null until first export |
| `github_sync_error` | text | Last sync error message; null on success |

### `epics` — add GitHub reference

| Column | Type | Notes |
|---|---|---|
| `github_milestone_number` | integer | GitHub milestone number; null until exported |

### `user_stories` — add GitHub reference

| Column | Type | Notes |
|---|---|---|
| `github_issue_number` | integer | GitHub issue number; null until exported |

---

## GitHub OAuth

- Register a **GitHub OAuth App** with callback URL `/api/auth/github/callback`
- Scope: `repo` (create repos, push files, create milestones + issues)
- Env vars: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (server-only)

### Flow
1. User clicks "Connect GitHub" in Profile → `GET /api/auth/github` → redirect to GitHub authorization page
2. GitHub redirects back to `/api/auth/github/callback?code=...`
3. Server exchanges code for access token, saves `github_access_token` + `github_username` to `profiles`
4. Redirect to `/profile`

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/github` | GET | Initiate OAuth — redirect to GitHub |
| `/api/auth/github/callback` | GET | Exchange code for token, save to profile |
| `/api/auth/github` | DELETE | Disconnect — clear token + username |
| `/api/projects/[id]/github/init` | POST | Create repo, push PRD, create all milestones + issues |
| `/api/projects/[id]/github/sync` | POST | Full re-sync — update PRD, all milestones, all issues |
| `/api/projects/[id]/github/prd` | PATCH | Push updated PRD file |
| `/api/projects/[id]/github/epics/[epicId]` | PATCH | Update milestone |
| `/api/projects/[id]/github/stories/[storyId]` | PATCH | Update issue |

### Init route behavior
1. Create GitHub repo (name + visibility from user input, slugified project name as default)
2. Push `docs/PRD.md` with PRD content
3. For each Epic: create milestone, save `github_milestone_number` to DB
4. For each User Story: create issue assigned to Epic's milestone, save `github_issue_number` to DB
5. Save `github_repo_url` + `github_exported_at` to project

If any step fails: return error, show to user. Project is not marked as exported unless init fully succeeds.

### Sync route behavior (idempotent)
- Update `docs/PRD.md` via GitHub contents API (requires current file SHA)
- For each Epic: update existing milestone if `github_milestone_number` set, create if not
- For each Story: update existing issue if `github_issue_number` set, create if not
- On success: clear `github_sync_error`, update `github_exported_at`
- On failure: save error message to `github_sync_error`

---

## Auto-Sync

Auto-sync fires on save of PRD, Epic, or User Story **only if**:
- `projects.github_repo_url` is set (project has been exported)
- The current user has `github_access_token` set in their profile

The client awaits the sync result and shows a toast:
- ✅ "Synced to GitHub"
- ❌ "GitHub sync failed: [error]" with a Retry button

If the user has no GitHub token: sync is skipped silently.

---

## UI

### Profile page — GitHub section
- **Disconnected:** "Connect GitHub" button
- **Connected:** "Connected as @username" + "Disconnect" button

### Project Settings — GitHub tab (new, alongside Members / Prompts)
- **Not exported:** "Create GitHub Repository" button (disabled + tooltip if user has no GitHub token)
- **Exported:** Repo URL as link, "Sync now" button, "Last synced: [timestamp]", error banner if `github_sync_error` is set

### Create GitHub Repository modal
- Repo name input (pre-filled: project name slugified)
- Visibility selector: Public / Private
- Confirm button with spinner during creation

### Error banner (project page + settings)
Shown when `github_sync_error` is set:
> ⚠️ GitHub sync failed: [error]. [Retry]

Cleared on next successful sync.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| GitHub returns 401 (token revoked) | Clear token in profiles, show "GitHub connection lost — reconnect in Profile" |
| GitHub returns 404 (repo deleted) | Show "GitHub repo not found. Recreate from Project Settings." |
| User has no token on save | Skip sync silently; GitHub tab shows reconnect prompt |
| Partial init failure | Show error, do not mark project as exported; user can retry |
| Another user (no token) edits a story | Sync skipped for that save; project owner can manually sync |

---

## Out of Scope

- Sync from GitHub back to Solomon (one-way only)
- GitHub Projects boards (kanban)
- PR creation or branch management
- Webhook-based inbound sync
