# Andrei Frontend

React 19 + TypeScript + Vite. Port 5173 (dev).
Deployed to Vercel. Auto-deploy on push to main.

## Design system

**Before modifying any page or component, read `FRONTEND_CONVENTIONS.md`
in this folder.** It is the authoritative source for all visual and
structural decisions. If the conventions file disagrees with existing
code, the conventions file wins and the code gets fixed.

Key rules (always in effect — read the full file for details):

- Colors: named brand tokens (`navy`, `teal`, `success`, `warning`,
  `error`, `info`) and shadcn tokens (`primary`, `muted-foreground`,
  `border`). Never `blue-600`, `gray-500`, or raw hex.
- Pages: `<PageHeader>` (§6), `<SectionHeader>` with 2px Navy left
  border (§7). Never custom headings.
- Lists: table-in-card pattern (§10). No exceptions.
- Stats: `<StatCard>` with 4px accent left-border (§9).
- Dialogs: `<AppDialog>` with width from the scale (§11).
- Alerts: Option C left-accent via custom `<Alert>` (§15).
- States: `<EmptyState>`, `<ErrorState>`, `<TableSkeleton>` (§16).
  `<FullPageState>` for 404/403/crash (§17).
- Numeric cells: always `tabular-nums`.
- Inline `style={{}}` only for dynamic CSS values that cannot be
  expressed as Tailwind classes. All other inline styles forbidden.
- When adding a genuinely new pattern, add it to the conventions file
  in the same PR.

### PR checklist (verify before every page change)

- [ ] Uses `<PageHeader>` — not a custom heading
- [ ] Page title is `text-2xl` — not `text-3xl` or `text-xl`
- [ ] No bottom-border under PageHeader
- [ ] Sections separated by `space-y-6` (24px)
- [ ] Every H2 uses `<SectionHeader>` with 2px Navy left border
- [ ] List pages use table-in-card with toolbar and footer
- [ ] Stat grids use `<StatCard>` with `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`
- [ ] Dialogs use `<AppDialog>` with a `size` from the scale
- [ ] Numeric table cells have `tabular-nums`
- [ ] No arbitrary Tailwind defaults (`blue-600`, `gray-500`, `red-500`)
- [ ] Badges use `bg-[name]/10 text-[name] border-[name]/30` pattern
- [ ] Alerts use Option C left-accent via `<Alert>`
- [ ] Empty/loading/error use `<EmptyState>`, `<TableSkeleton>`, `<ErrorState>`
- [ ] Mobile: `md:hidden` cards + `hidden md:block` table
- [ ] Toasts only for transient confirmations

## Structure

src/
├── components/shell/ # Design system components — see @src/components/shell/CLAUDE.md
├── components/ui/ # shadcn/ui components — do not modify directly
├── components/ # Other reusable components (AdjuntosPreview, Breadcrumbs, etc.)
├── pages/ # Full page components (11 files)
├── pages/project/ # Project sub-views (9 files)
├── context/ # AuthContext (useAuth hook)
├── services/ # api.ts — single axios instance
├── types/ # api.ts, index.ts
├── utils/ # dateUtils and helpers
└── lib/ # utils.ts (shadcn cn helper)

## Commands

npm run dev # Vite dev server
npm run build # tsc + vite build
npm run lint # eslint
npm run dev -- --host # expose to local network (mobile testing)

## Routing

No React Router. Routing is handled manually:

- App.tsx checks window.location.pathname for public routes (/verificar/)
- DashboardNew.tsx handles all internal navigation via state
- Never add React Router — it is not installed and not the pattern

## API calls

Always use the configured axios instance from src/services/api.ts:

import api from '@/services/api';

const response = await api.get('/endpoint');
const response = await api.post('/endpoint', { data });

Never use fetch() directly. Token is injected automatically via interceptor.
Auth functions are grouped in authAPI export from the same file.

## Tailwind 4 (critical — syntax differs from v3)

Correct:
@import "tailwindcss";
@theme {
--color-primary: oklch(31% 0.025 235);
}

Never use:
@tailwind base;
@tailwind components;
@tailwind utilities;

All theme variables are in src/index.css. Never add @theme blocks elsewhere.
Use --color-primary, --color-muted, --color-border etc. as defined there.

## shadcn/ui components

Use existing components from src/components/ui/ — do not reinstall or overwrite.
Always use AlertDialog (not window.confirm) for destructive action confirmations.
Forms use react-hook-form + shadcn Form components — see existing pages for pattern.

## Auth

import { useAuth } from '@/context/AuthContext';
const { user, isAuthenticated, loading, debeCambiarPassword } = useAuth();

user.rol: 'admin' | 'co-admin' | 'usuario'
user.permissions: individual boolean permissions (for rol === 'usuario')

## Critical rules

- NEVER use fetch() — always use api from services/api.ts
- NEVER use window.confirm — always use AlertDialog
- NEVER add React Router
- NEVER create new CSS files — use Tailwind classes only
- NEVER use inline styles (style={{}})
- NEVER modify components in src/components/ui/ directly
- Path alias @ maps to src/ — use @/components, @/services, etc.
