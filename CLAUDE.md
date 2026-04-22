# Andrei Frontend

React 19 + TypeScript + Vite. Port 5173 (dev).
Deployed to Vercel. Auto-deploy on push to main.

## Design system

Visual and structural conventions for this frontend are defined in
`FRONTEND_CONVENTIONS.md` at the project root. Every page, component,
and style decision must follow that file. Specifically:

- Colors come from the named brand tokens (`navy`, `teal`, `success`,
  `warning`, `error`, `info`) and the shadcn semantic tokens
  (`primary`, `muted-foreground`, `border`, etc.). Never use arbitrary
  Tailwind defaults like `blue-600` or `gray-500`.
- Every list page uses the table-in-card pattern (section 10).
- Every page uses `<PageHeader>` (section 6) — never a custom heading.
- Every section H2 uses `<SectionHeader>` with the 2px Navy left border
  (section 7).
- Stat grids use `<StatCard>` with 4px accent left-border (section 9).
- Dialogs use `<AppDialog>` with a width from the documented scale
  (section 11).
- Alerts use the Option C left-accent pattern (section 15) via the
  custom `<Alert>` component. Toasts via Sonner, bottom-right, 4s.
- Full-page states (404, 403, session expired, app crash) use the
  shared `<FullPageState>` shell (section 17).
- Numeric cells always use `tabular-nums`.
- Inline `style={{}}` is allowed only for dynamic CSS values that
  cannot be expressed as Tailwind classes (e.g., `width: ${percent}%`
  on progress bars). All other inline styles are forbidden.

When in doubt, read `FRONTEND_CONVENTIONS.md`. If the conventions file
disagrees with existing code, the conventions file wins and the code
gets fixed. When adding a genuinely new pattern, add it to the
conventions file in the same PR.

## Structure

src/
├── components/ # Reusable components (AdjuntosPreview, Breadcrumbs, etc.)
├── components/ui/ # shadcn/ui components — do not modify directly
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
Installed: alert-dialog, alert, avatar, badge, button, card, checkbox,
dialog, dropdown-menu, form, input, label, popover, radio-group,
scroll-area, select, separator, sheet, skeleton, switch, table, textarea.

Always use AlertDialog (not window.confirm) for destructive action confirmations:

import { AlertDialog, AlertDialogAction, AlertDialogCancel,
AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

## Form pattern

import { useForm } from 'react-hook-form';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const form = useForm({ defaultValues: { nombre: '' } });

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField control={form.control} name="nombre" render={({ field }) => (
      <FormItem>
        <FormLabel>Nombre</FormLabel>
        <FormControl><Input {...field} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
    <Button type="submit">Guardar</Button>
  </form>
</Form>

## Auth

import { useAuth } from '@/context/AuthContext';
const { user, isAuthenticated, loading, debeCambiarPassword } = useAuth();

user.rol: 'admin' | 'co-admin' | 'usuario'
user.permissions: individual boolean permissions (for rol === 'usuario')

## Responsive pattern

Mobile-first. Use md: breakpoint for desktop layouts:

<div className="md:hidden space-y-3">
  <Card>...</Card>
</div>
<div className="hidden md:block">
  <Table>...</Table>
</div>

## Status badges

Most estado badges use config maps within each file — follow the existing pattern.
Hardcoded exceptions to keep consistent:

Roles:
admin → variant="destructive"
co-admin → className="bg-orange-500 text-white hover:bg-orange-600"
usuario → variant="secondary"

Reembolsos:
Pinellas paga → variant="outline" className="bg-yellow-50/50 text-amber-700 border-amber-300"
Reembolsado → variant="outline" className="bg-green-50 text-green-700 border-green-300"

Urgente (solicitudesPago):
→ variant="destructive" className="text-xs w-fit"

## Critical rules

- NEVER use fetch() — always use api from services/api.ts
- NEVER use window.confirm — always use AlertDialog
- NEVER add React Router
- NEVER create new CSS files — use Tailwind classes only
- NEVER use inline styles (style={{}})
- NEVER modify components in src/components/ui/ directly
- Path alias @ maps to src/ — use @/components, @/services, etc.
