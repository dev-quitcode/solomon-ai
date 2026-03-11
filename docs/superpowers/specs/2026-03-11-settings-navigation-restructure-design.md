# Design: Settings Navigation Restructure

**Date:** 2026-03-11
**Status:** Approved

---

## Overview

Split the current single `/settings` page into three separate pages, each with a dedicated URL. Add a persistent "Settings" group to the sidebar that is always visible regardless of whether the user is in a project context. Admin-only pages are hidden from non-admin users in the sidebar and redirect non-admins at the page level.

---

## Pages

| Route | Page Title | Accessible To | Content |
|-------|-----------|---------------|---------|
| `/profile` | Profile Settings | All users | Full name, email address change, password change |
| `/settings` | System Settings | Admins only | AI provider API keys, model selector, system prompts |
| `/user-management` | User Management | Admins only | User list and role management (current `/admin` content) |

Non-admins who navigate directly to `/settings` or `/user-management` are redirected to `/profile`.

---

## Sidebar

A new "Settings" group is pinned at the bottom of the sidebar, rendered in all contexts (dashboard level and project level alike). The group appears below the project nav items when inside a project.

```
[Project nav items when in project context]

─── Settings ───────────────────────────
  Profile                    (always shown)
  System Settings            (admin only)
  User Management            (admin only)
```

- Non-admins see only "Profile" in the group.
- Admin-only items are hidden (not disabled) for non-admins.
- The existing top-level "System Settings" dashboard nav link is removed; the Settings group replaces it.

---

## Content Split

**`/profile` (new page):**
- Display Name form (full name via `profiles` table)
- Email Address form (current email shown, new email input, confirmation flow)
- Password form (current password, new password, confirm)
- Extracted from the current Profile tab in `/settings`

**`/settings` (updated — admin only):**
- AI Providers card (Anthropic, OpenAI, Gemini, Voyage API keys with show/hide)
- Active model dropdown (live-fetched, grouped by provider)
- System Prompts section (5 stages, admin edit)
- Extracted from the current AI Settings tab in `/settings`
- Add server-side admin guard: redirect to `/profile` if not admin

**`/user-management` (renamed from `/admin`):**
- Existing admin page content unchanged
- Add server-side admin guard (same pattern as `/admin` already has)

---

## Admin Access Control

The dashboard `layout.tsx` already fetches `profiles.role` and passes it to Sidebar as a prop. No new data fetching is needed.

- **Sidebar:** renders Settings group items conditionally based on `role` prop (already available).
- **Page-level guard:** `/settings/page.tsx` and `/user-management/page.tsx` check role and `redirect('/profile')` if not admin. Use the same server-side Supabase client pattern already used in `layout.tsx`.
- **`/admin` redirect:** add a `src/app/(dashboard)/admin/page.tsx` that redirects to `/user-management` to preserve old bookmarks.

---

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| New | `src/app/(dashboard)/profile/page.tsx` | Profile Settings page (name, email, password) |
| Modify | `src/app/(dashboard)/settings/page.tsx` | System Settings — remove Profile tab, add admin guard |
| New | `src/app/(dashboard)/user-management/page.tsx` | User Management — copy of current admin page |
| New | `src/app/(dashboard)/admin/page.tsx` | Redirect `/admin` → `/user-management` |
| Modify | `src/components/layout/Sidebar.tsx` | Add persistent Settings group at bottom |
| Modify | `src/app/(dashboard)/layout.tsx` | Remove old "System Settings" top-level nav link |

---

## Error Handling

- Non-admin accessing `/settings` or `/user-management` → server-side `redirect('/profile')`
- `/admin` → `redirect('/user-management')` (permanent, no flash)
- Profile page accessible to all authenticated users (layout already handles unauthenticated redirect)
