### `docs/sprint-0-README.md`

```markdown
# Sprint 0 — Foundation, Auth & RBAC

## Goal
Running application with all 4 roles able to log in and see role-appropriate UI.

## What Gets Built

### Backend
- Project structure setup (Controllers, Routes, Middleware, MongoDB, Utils)
- MongoDB schemas: User, Lead, Vendor, Quotation, Deal, Note, AuditLog, ServicePrefix
- Auth: register, login, logout, getCurrentUser
- JWT + HttpOnly cookies (same pattern as BMS-APP)
- VerifyJWT middleware
- requireRole() middleware — blocks access by role
- SuperAdmin: create users, assign roles
- Health check endpoint: GET /api/v1/health

### Frontend
- Vite + React 19 setup with Tailwind v4
- Shared Axios instance with 401 interceptor
- AuthContext — user, loading, login(), logout()
- ProtectedRoute — redirects to /login if unauthenticated
- RoleRoute — redirects if role doesn't match
- Login page (navy/teal branding)
- Sidebar navigation (links vary by role)

## API Endpoints
| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | /api/v1/auth/register | No | SuperAdmin setup only |
| POST | /api/v1/auth/login | No | All |
| POST | /api/v1/auth/logout | Yes | All |
| GET | /api/v1/auth/me | Yes | All |
| POST | /api/v1/users | Yes | SuperAdmin |
| GET | /api/v1/users | Yes | SuperAdmin |

## MongoDB Schemas
- User: username, email, password, role (superadmin/sales/purchase/manager), isActive
- AuditLog: userId, action, entity, entityId, oldValue, newValue, timestamp

## Demo
All 4 roles log in → see different sidebars → non-matching routes redirect.

## Acceptance Criteria
- [ ] SuperAdmin can create a sales user
- [ ] Sales user logs in and cannot access /purchase
- [ ] Purchase user logs in and cannot access /leads
- [ ] Manager sees all navigation items
- [ ] Logout clears session
