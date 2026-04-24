# FRONTEND_CONVENTIONS.md — Pinellas ERP Design System

> **What this file is.** The authoritative visual and structural convention guide for the Pinellas ERP frontend (`andrei-frontend`). If this file disagrees with code, this file wins and the code gets fixed.
>
> **Stack.** React · shadcn/ui (New York style) · Tailwind CSS v4 · Light-mode primary, dark-mode supported.
>
> **Feel.** Digital equivalent of a well-bound engineering proposal. Not startup-trendy. Not enterprise-gray-boring.

---

## The three golden rules

1. **The number is the hero, the chrome is the servant.** Every pixel of decoration (icons, borders, shadows, tints) must serve a data value, a status, or an action. If it decorates without signaling, delete it.
2. **Anchor with color on one edge, breathe with space on all the others.** Left-accent borders for SectionHeaders (2px), StatCards (4px), and Alerts (3px). Never bottom rules under page or section headers. Never outlined boxes-within-boxes. Section separation is spatial (24px gap), not graphic.
3. **One pattern applied everywhere beats five patterns applied thoughtfully.** Every list page is a table-in-card. Every stat grid uses StatCard. Every dialog width is on the official scale. Every alert is Option C left-accent. Consistency is the feature.

---

## Table of contents

1. [Typography](#1-typography)
2. [Color system (Tailwind 4 `@theme` block)](#2-color-system)
3. [Spacing system](#3-spacing-system)
4. [Layout shell](#4-layout-shell)
5. [Sidebar](#5-sidebar)
6. [PageHeader](#6-pageheader)
7. [SectionHeader](#7-sectionheader)
8. [Cards](#8-cards)
9. [StatCard](#9-statcard)
10. [Tables (table-in-card)](#10-tables)
11. [Dialogs](#11-dialogs)
12. [Forms](#12-forms)
13. [Buttons](#13-buttons)
14. [Status badges](#14-status-badges)
15. [Alerts and toasts](#15-alerts-and-toasts)
16. [Empty / loading / error states (in-section)](#16-empty-loading-error-states)
17. [Full-page states (404, 403, session expired, app crash)](#17-full-page-states)
18. [PR checklist for new or refactored pages](#18-pr-checklist)
19. [What this file does NOT cover](#19-not-covered)
20. [Feature-specific badge and row patterns](#20-feature-specific-patterns)

---

**Shell components.** All shared design system components live in `src/components/shell/` and are imported from the barrel export:

```tsx
import { PageHeader, SectionHeader, StatCard, AppDialog, Alert } from "@/components/shell";
import { EmptyState, ErrorState, TableSkeleton, StatCardSkeleton } from "@/components/shell";
import { FullPageState } from "@/components/shell";
import { AppErrorBoundary } from "@/components/shell";
```

---

## 1. Typography

### Fonts

Add to the very top of `src/index.css`, before `@import 'tailwindcss'`:

```css
@import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap');
@import 'tailwindcss';
```

Then add the font variables inside the existing `@theme` block (see section 2 for the full block):

```css
@theme {
  --font-heading: 'Source Serif 4', Georgia, 'Times New Roman', serif;
  --font-body:    'Source Sans 3', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono:    ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  /* ...rest of theme */
}
```

And the base application in `@layer base`:

```css
@layer base {
  body { font-family: var(--font-body); }
  h1, h2 { font-family: var(--font-heading); }
  .tabular-nums, td.num, .stat-value { font-variant-numeric: tabular-nums; }
}
```

**Always apply `tabular-nums` to numeric table cells and stat values.** Use the `tabular-nums` Tailwind utility in JSX or add `className="num"` on `<td>` elements. Non-negotiable — this is what makes the ERP feel engineered.

### Type scale

| Role | Size | Weight | Family | Tailwind classes |
|---|---|---|---|---|
| H1 — page title | 24px | 600 | heading (Serif) | `text-2xl font-semibold tracking-tight` |
| H2 — section title | 16px | 600 | heading (Serif) | `text-base font-semibold` |
| H3 — card title | 14px | 600 | body (Sans) | `text-sm font-semibold` |
| Body | 14px | 400 | body | `text-sm` |
| Small / metadata | 12px | 400 | body | `text-xs` |
| Overline label | 12px | 500 | body | `text-xs font-medium uppercase tracking-wide` |
| Stat value | 24px | 600 | body (tabular) | `text-2xl font-semibold tabular-nums` |
| Table header | 12px | 600 | body | `text-xs font-semibold uppercase tracking-wide` |

**H1 and H2 are serif. Everything else is sans.** This is deliberate — the serif on titles echoes the print brand and the "engineering proposal" voice. H3 (card title) is sans so it doesn't compete with the page's H1/H2 hierarchy.

Page H1 is always `text-2xl`. Never `text-3xl`. Never `text-xl`.

---

## 2. Color system

### The `@theme` block (Tailwind 4, OKLCH, light mode)

Replace the entire `@theme` block in `src/index.css` with this. OKLCH values use H / C / L notation; tokens map to shadcn conventions so existing shadcn components keep working unchanged.

```css
@theme {
  --radius: 0.5rem;

  /* Fonts */
  --font-heading: 'Source Serif 4', Georgia, 'Times New Roman', serif;
  --font-body:    'Source Sans 3', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono:    ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  /* Brand — named tokens (use these in JSX) */
  --color-navy:    oklch(33.4% 0.062 254);   /* #1F375F — Pinellas Navy */
  --color-teal:    oklch(49.1% 0.091 183);   /* #0F766E — Engineering Teal */
  --color-ink:     oklch(21.3% 0.034 265);   /* #0F172A */

  /* Slate scale */
  --color-slate-700: oklch(37.2% 0.031 259); /* #334155 */
  --color-slate-500: oklch(55.1% 0.031 254); /* #64748B */
  --color-slate-300: oklch(86.9% 0.019 247); /* #CBD5E1 */
  --color-slate-100: oklch(95.4% 0.009 247); /* #F1F5F9 */
  --color-slate-50:  oklch(97.6% 0.006 247); /* #F8FAFC */

  /* Semantic — named tokens */
  --color-success: oklch(47.8% 0.130 150);   /* #0F7B3A */
  --color-warning: oklch(50.1% 0.134 56);    /* #B45309 */
  --color-error:   oklch(48.5% 0.204 27);    /* #B91C1C */
  --color-info:    oklch(47.4% 0.132 240);   /* #0369A1 */

  /* shadcn surface tokens — all mapped to the brand palette */
  --color-background:       oklch(97.6% 0.006 247);   /* canvas = Slate 50 */
  --color-foreground:       oklch(21.3% 0.034 265);   /* Ink */
  --color-card:             oklch(100% 0 0);          /* cards = white */
  --color-card-foreground:  oklch(21.3% 0.034 265);
  --color-popover:          oklch(100% 0 0);
  --color-popover-foreground: oklch(21.3% 0.034 265);

  --color-primary:          oklch(33.4% 0.062 254);   /* Navy */
  --color-primary-foreground: oklch(100% 0 0);
  --color-secondary:        oklch(97.6% 0.006 247);   /* Slate 50 */
  --color-secondary-foreground: oklch(37.2% 0.031 259);
  --color-muted:            oklch(97.6% 0.006 247);
  --color-muted-foreground: oklch(55.1% 0.031 254);   /* Slate 500 */
  --color-accent:           oklch(49.1% 0.091 183);   /* Teal */
  --color-accent-foreground: oklch(100% 0 0);

  --color-destructive:        oklch(48.5% 0.204 27);  /* Error */
  --color-destructive-foreground: oklch(100% 0 0);

  --color-border:  oklch(86.9% 0.019 247);            /* Slate 300 */
  --color-input:   oklch(86.9% 0.019 247);
  --color-ring:    oklch(33.4% 0.062 254);            /* Navy focus ring */
}
```

### Dark mode override

Add after the `@theme` block and `@custom-variant dark (&:is(.dark *));` line:

```css
.dark {
  /* Dark canvas: deep blue-black, not pure gray */
  --color-background:       oklch(16.2% 0.024 258);
  --color-foreground:       oklch(95.4% 0.009 247);
  --color-card:             oklch(20.1% 0.026 258);
  --color-card-foreground:  oklch(95.4% 0.009 247);
  --color-popover:          oklch(20.1% 0.026 258);
  --color-popover-foreground: oklch(95.4% 0.009 247);

  /* Brand lifts for legibility on dark */
  --color-primary:          oklch(64.5% 0.084 254);
  --color-primary-foreground: oklch(16.2% 0.024 258);
  --color-secondary:        oklch(26.1% 0.028 258);
  --color-secondary-foreground: oklch(90.0% 0.015 247);
  --color-muted:            oklch(26.1% 0.028 258);
  --color-muted-foreground: oklch(68.5% 0.025 254);
  --color-accent:           oklch(60.2% 0.104 183);
  --color-accent-foreground: oklch(100% 0 0);
  --color-destructive:      oklch(58.0% 0.180 27);
  --color-destructive-foreground: oklch(100% 0 0);

  --color-border: oklch(30.5% 0.026 258);
  --color-input:  oklch(30.5% 0.026 258);
  --color-ring:   oklch(64.5% 0.084 254);

  /* Semantic lifts — used with /10 tints for badge backgrounds */
  --color-success: oklch(68.0% 0.150 150);
  --color-warning: oklch(72.0% 0.140 56);
  --color-error:   oklch(65.0% 0.210 27);
  --color-info:    oklch(68.0% 0.130 240);
}
```

### Base layer

Update `@layer base` to apply tokens as the defaults:

```css
@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground font-body; }
  h1, h2 { @apply font-heading; }
  .tabular-nums, td.num, .stat-value { font-variant-numeric: tabular-nums; }

  .scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
}
```

### Sidebar theme

Keep the existing `:root` sidebar variables block and `@theme inline` bridging, but update the values to the dark Ink sidebar direction:

```css
:root {
  --sidebar: oklch(21.3% 0.034 265);                     /* Ink */
  --sidebar-foreground: oklch(86.9% 0.019 247);          /* Slate 300 */
  --sidebar-primary: oklch(33.4% 0.062 254);             /* Navy */
  --sidebar-primary-foreground: oklch(100% 0 0);
  --sidebar-accent: oklch(25.0% 0.030 265);              /* subtle white overlay */
  --sidebar-accent-foreground: oklch(100% 0 0);
  --sidebar-border: oklch(25.0% 0.030 265);
  --sidebar-ring: oklch(33.4% 0.062 254);
}

.dark {
  --sidebar: oklch(16.2% 0.024 258);
  --sidebar-foreground: oklch(86.9% 0.019 247);
  --sidebar-primary: oklch(64.5% 0.084 254);
  --sidebar-primary-foreground: oklch(16.2% 0.024 258);
  --sidebar-accent: oklch(26.1% 0.028 258);
  --sidebar-accent-foreground: oklch(90.0% 0.015 247);
  --sidebar-border: oklch(30.5% 0.026 258);
  --sidebar-ring: oklch(64.5% 0.084 254);
}
```

### Using brand colors in components

**Prefer named tokens.** With the `@theme` block above, these are all valid Tailwind utilities:

```jsx
// ✅ Use named tokens from @theme
<Button className="bg-navy text-white">Guardar</Button>
<div className="border-l-4 border-l-teal">...</div>
<Badge className="bg-success/10 text-success border-success/30">Aprobado</Badge>
<Alert className="border-l-[3px] border-l-warning">...</Alert>

// ✅ Or use shadcn semantic tokens (equivalent result)
<Button className="bg-primary text-primary-foreground">Guardar</Button>

// ❌ NEVER use arbitrary Tailwind defaults
<Button className="bg-blue-600">...</Button>          // NO
<p className="text-gray-500">...</p>                  // NO — use text-muted-foreground or text-slate-500
<Badge className="bg-[#0F7B3A]/10">...</Badge>        // NO — use bg-success/10
```

Rule of thumb: **named brand tokens (`navy`, `teal`, `success`, etc.) for semantic meaning. shadcn tokens (`primary`, `muted-foreground`, `border`, etc.) for chrome. Never raw hex, never `blue-600` / `gray-500`.**

---

## 3. Spacing system

8-point scale with 4-point allowances for form-internal spacing. Tailwind tokens map cleanly: `2 = 8px`, `3 = 12px`, `4 = 16px`, `6 = 24px`, `8 = 32px`.

| Use | Tailwind | px |
|---|---|---|
| Label → input | `mt-1` | 4 |
| Inline button gap | `gap-2` | 8 |
| Table toolbar padding Y | `py-3` | 12 |
| Table cell padding (header) | `px-4 py-2.5` | 16 / 10 |
| Table cell padding (body standard) | `px-4 py-3` | 16 / 12 |
| Table cell padding (body dense) | `px-4 py-2` | 16 / 8 |
| Form field gap · subsection gap | `space-y-4` / `gap-4` | 16 |
| Stat tile padding | `p-5` | 20 |
| Section → section gap | `space-y-6` | 24 |
| Card default padding | `p-6` | 24 |
| Dialog content padding | `p-6` (shadcn default) | 24 |
| Page top padding | `pt-6` | 24 |
| PageHeader → first section | `pb-6` on header | 24 |
| Page horizontal padding | `px-8` | 32 |
| Table-in-card | `p-0` (padding lives on toolbar + cells) | 0 |

### Max-width constraints

- Tables, dashboards, list pages: **no max-width** — fill available content area.
- Forms and reading-centric content: `max-w-3xl` (≈768px).
- Dialogs: self-cap per section 11.
- Minimum supported screen: **1024px**. Mobile card list fallback below `md` (768px) — already in place.
- **No horizontal scrolling — ever.** Tables must fit within the available content area. If columns don't fit, hide non-essential columns at narrower breakpoints or truncate long text with `truncate`. Never use `overflow-x-auto` on table containers.

---

## 4. Layout shell

```
┌─────────────────────────────────────────────────────────────┐
│ h-16 top bar (white, border-b border-border)                │
│  [Project switcher]     [Page title]         [Avatar ▾]     │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│ Sidebar  │  Content area (bg-background = Slate 50)         │
│ w-64     │  px-8 pt-6                                       │
│ (Ink)    │                                                  │
│          │  <PageHeader /> (pb-6)                           │
│ active:  │  <section> space-y-6 </section>                  │
│ Navy bg  │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

**Canvas vs card.** The page background is Slate 50 (`bg-background`). Cards are white (`bg-card`). This 2% lightness contrast is what makes the ERP stop looking "too white and black." It's doing real work — keep it.

**Dialogs are always white (`bg-card`).** The `DialogContent` component uses `bg-card`, not `bg-background`. This ensures dialogs visually lift off the page canvas. Already applied in the shadcn Dialog component — do not override with `bg-background`.

### What sits on the canvas vs what goes in a Card

**Always on the canvas (no card wrapper):**
- `PageHeader` — title, subtitle, action buttons
- `SectionHeader` components — typographic anchors, no background
- Stat card grids — each `StatCard` IS a card; the grid is bare
- Dashboard action-card rows — same pattern
- Tabs containers

**On the canvas in specific cases:**
- Table-in-card pages where the table IS the page — the Card IS the only container

**Always in a Card:**
- Stat/KPI tiles
- Data tables (via table-in-card pattern)
- Standalone form field groups on a page
- Detail page information blocks
- Anything with a `CardHeader` / `CardTitle`

**Never card-in-card.** Inside a Card, use a `border-t border-border pt-4` divider to separate blocks.

**Quick test:** Is the block a *labeled, bounded thing* (a project, an invoice, a group of fields with a title)? → Card. Is it *orchestration* (a header, a grid, tabs, a filter row)? → Canvas.

---

## 5. Sidebar

**Dark Ink sidebar, light canvas.** The dark spine + light "paper" is the engineering-proposal metaphor made literal.

| Element | Token | Notes |
|---|---|---|
| Sidebar bg | `bg-sidebar` (Ink) | Dark |
| Sidebar text (default) | `text-sidebar-foreground` (Slate 300) | Muted, legible on dark |
| Sidebar text (hover) | `text-white` | |
| Active item bg | `bg-sidebar-primary` (Navy) | Strong brand hit |
| Active item text | `text-white` | |
| Hover bg (non-active) | `bg-white/5` | Subtle |
| Sidebar border | `border-sidebar-border` | Hairline dark |

Width: 16rem (256px) desktop, 18rem (288px) mobile drawer. Toggle with Ctrl+B / Cmd+B and hamburger on mobile.

Badges inside nav items (e.g., pending solicitudes count) use `bg-error text-white` with small tabular-nums text.

---

## 6. PageHeader

**Plain flex layout, no separator.** Title + subtitle + right-aligned actions. The canvas-vs-card contrast does the visual work; no bottom border is needed.

**Source:** `src/components/shell/PageHeader.tsx`

### Usage

```jsx
<PageHeader
  title="Requisiciones"
  subtitle="42 activas · 8 en revisión · 3 vencen esta semana"
>
  <Button variant="outline" size="sm">
    <Download className="mr-2 h-4 w-4" /> Exportar
  </Button>
  <Button size="sm">
    <Plus className="mr-2 h-4 w-4" /> Nueva requisición
  </Button>
</PageHeader>
```

### Rules

- **Never** add a bottom border to the PageHeader.
- **Never** use `text-3xl` or `text-xl` for the page title. Always `text-2xl`.
- Actions right-aligned on desktop, wrap below on mobile (automatic).
- Breadcrumbs belong in the global top bar, not in the PageHeader.
- Subtitle optional but consistent when used — summary of counts, not decoration.

---

## 7. SectionHeader

**2px Navy left-border + 12px indent.** This anchors H2s without making them compete with H1 via font size. Echoes the colored tab on an engineering binder spine.

**Source:** `src/components/shell/SectionHeader.tsx`

### Usage

```jsx
<SectionHeader
  title="Órdenes de compra pendientes"
  count={12}
  action={<Button variant="ghost" size="sm">Ver todas</Button>}
/>

<SectionHeader
  overline="Proyecto · Torre Harborview"
  title="RFIs abiertas"
  count={7}
/>
```

### Rules

- Always the 2px Navy left border (never 3px, never 4px — those are reserved for Alert and StatCard).
- Always `text-base` (16px). Never bigger, never smaller.
- SectionHeader must never be visually competitive with PageHeader.
- Overline (Teal uppercase) only for category/project context, never as the primary label.

---

## 8. Cards

### When to use Card

| Use Card | Don't use Card |
|---|---|
| Two or more distinct blocks share a page | Single table that IS the page (use table-in-card pattern instead; its Card is the only container) |
| Block represents a discrete entity (project, contact, invoice) | Inside another Card (use `border-t border-border pt-4` divider) |
| Stat/summary tiles (always) | PageHeader |
| Float a filter panel visually | Form field groups within a dialog |

### Three variants only

| Variant | Classes | Use |
|---|---|---|
| Default | `rounded-lg border border-border bg-card` | 95% of cases |
| Elevated (clickable) | + `shadow-sm hover:shadow-md hover:border-slate-300 transition-all` | Cards that navigate |
| Accent | + `border-l-4 border-l-navy` (or teal / semantic) | Stat tiles, callouts |

### Usage

```jsx
<Card>
  <CardHeader>
    <CardTitle>Información del proyecto</CardTitle>
    <CardDescription>Contrato 2024-087 · Activo</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>

// When content is simple and doesn't need Card* subcomponents:
<Card className="p-6">
  <h3 className="mb-3 text-sm font-semibold text-foreground">Miembros</h3>
  <div className="space-y-2">...</div>
</Card>
```

---

## 9. StatCard

**Left-accent 4px colored border, icon demoted top-right in slate-300, number is the hero.** The tile exists to be *read*, not admired.

**Source:** `src/components/shell/StatCard.tsx`

Props: `label`, `value`, `icon`, `trend` (`{ value, direction: "up"|"down"|"flat", context? }`), `accent` (default `"navy"`), `href`.

### Usage

```jsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
  <StatCard
    label="Proyectos activos" value="42" icon={Briefcase}
    trend={{ value: "+3", direction: "up", context: "vs mes anterior" }}
    accent="navy" href="/proyectos"
  />
  <StatCard
    label="Backlog" value="$18.4M" icon={DollarSign}
    trend={{ value: "+12%", direction: "up", context: "vs mes anterior" }}
    accent="teal" href="/backlog"
  />
  <StatCard
    label="RFIs vencidas" value="7" icon={AlertTriangle}
    trend={{ value: "+2", direction: "up", context: "vs semana anterior" }}
    accent="warning" href="/rfis?estado=vencida"
  />
  <StatCard
    label="Facturas >60d" value="$342K" icon={Clock}
    trend={{ value: "-8%", direction: "down", context: "vs mes anterior" }}
    accent="error" href="/facturas?aging=60"
  />
</div>
```

### Critical

**`trend.direction` is independent from `accent`.** For risk/error tiles (like "RFIs vencidas"), direction `up` can mean "things got worse" — the semantic `accent` already told that story, the trend color reinforces meaning, not numeric direction. Example: on a warning-accent tile, `up` renders red (bad) even though it's an up-arrow.

---

## 10. Tables

**Canonical list page pattern: table-in-card with integrated toolbar and footer.** This is THE pattern for every index page. No exceptions without a documented reason.

### Component pattern

```jsx
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, SlidersHorizontal, Plus } from "lucide-react";

export function ProjectsTable({ data }) {
  return (
    <Card className="overflow-hidden p-0">
      {/* Top toolbar */}
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Buscar proyectos…" className="h-9 pl-8" />
          </div>
          <Select>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="pausa">En pausa</SelectItem>
              <SelectItem value="cerrado">Cerrado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9">
            <SlidersHorizontal className="mr-2 h-4 w-4" /> Vista
          </Button>
          <Button size="sm" className="h-9">
            <Plus className="mr-2 h-4 w-4" /> Nuevo proyecto
          </Button>
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
            <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Proyecto
            </TableHead>
            <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cliente
            </TableHead>
            <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fase
            </TableHead>
            <TableHead className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Presupuesto
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={row.id}
              className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60"
            >
              <TableCell className="px-4 py-3 text-sm font-medium text-foreground">
                {row.name}
              </TableCell>
              <TableCell className="px-4 py-3 text-sm text-slate-700">
                {row.client}
              </TableCell>
              <TableCell className="px-4 py-3">
                <Badge variant="outline" className="border-slate-200 text-slate-600">
                  {row.phase}
                </Badge>
              </TableCell>
              <TableCell className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                ${row.budget.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
        <span>Mostrando 1–25 de 142</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8">Anterior</Button>
          <Button variant="outline" size="sm" className="h-8">Siguiente</Button>
        </div>
      </div>
    </Card>
  );
}
```

### Rules

- **No zebra stripes.** Rows separated only by `border-b border-slate-100` (hairline).
- Row hover: `hover:bg-slate-50/60`.
- Header row: `bg-slate-50`, 12px uppercase tracking-wide in muted slate.
- Cell padding: `px-4 py-3` standard, `px-4 py-2` dense (audit logs only).
- Numeric cells: always `tabular-nums`, right-aligned.
- **Mobile fallback** unchanged from current ERP: `md:hidden` cards, `hidden md:block` table.

---

## 11. Dialogs

**Source:** `src/components/shell/AppDialog.tsx`

Props: `open`, `onOpenChange`, `size` (default `"simple"`), `title`, `description`, `children`, `footer`.

### Width decisions

| Dialog type | `size` | Width class |
|---|---|---|
| Confirmation / destructive | `confirm` | `sm:max-w-md` |
| Simple form (1–5 fields) | `simple` | `sm:max-w-lg` |
| Standard form (5–15 fields) | `standard` | `sm:max-w-2xl` |
| Complex / multi-column | `complex` | `sm:max-w-4xl` |
| Read-mostly detail view | `detail` | `sm:max-w-4xl` |

**All sizes except `confirm` get header/footer dividers.** The `confirm` size is the only one without dividers — it's a short yes/no decision, not a form.

### Footer

Outline "Cancel" on the **left**, primary action on the **right**. `sm:justify-between`. Destructive uses `variant="destructive"`. Cancel always uses `variant="outline"` — never `variant="ghost"` (ghost looks like floating text, not a button). No shadows on any button variant — `shadow-sm` has been removed from outline and secondary variants.

### Usage

```jsx
<AppDialog
  open={open}
  onOpenChange={setOpen}
  size="standard"
  title="Nueva solicitud de pago"
  description="Torre Harborview — Fase 2 · Contrato 2024-087"
  footer={
    <>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
      <Button disabled={saving} onClick={submit}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enviar solicitud
      </Button>
    </>
  }
>
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {/* fields */}
  </div>
</AppDialog>
```

---

## 12. Forms

- **Input backgrounds are always white (`bg-card`).** Already applied in the shadcn Input, Select, and Textarea base components — do not override with `bg-transparent`.
- **All form controls use `h-9`, no shadow.** Inputs, selects, and textareas all share the same height (`h-9`) and have no `shadow-sm`. Consistency across field types is non-negotiable.
- **Never use native `<select>` elements.** Always use the shadcn `Select` / `SelectTrigger` / `SelectContent` / `SelectItem` components. They match input styling automatically and have a properly positioned chevron.
- Labels always above inputs: `text-sm font-medium text-slate-700`, `mt-0` on label, `mt-1` on input.
- Required fields: assume required by default (ERP default). Mark **optional** fields as `(opcional)` in muted text. Only use `*` after labels when most fields are optional.
- Validation errors: below the input in `text-xs text-error mt-1`. Input border becomes `border-error`, focus ring switches to `ring-error/40`.
- Group related fields inside `<fieldset>` with a `SectionHeader` above.
- Multi-column layout: `grid grid-cols-1 gap-4 sm:grid-cols-2`. Full-width fields use `sm:col-span-2`.
- Submit state: disable the button and show `<Loader2 className="mr-2 h-4 w-4 animate-spin" />`. **Never** optimistically close a dialog on submit.

---

## 13. Buttons

| Variant | When | shadcn variant |
|---|---|---|
| Primary | The main action on the page or dialog | `<Button>` (default — `bg-primary`) |
| Outline | Secondary actions on a page | `variant="outline"` |
| Ghost | Icon-only table actions, tertiary actions | `variant="ghost"` |
| Destructive | Delete, reject, cancel irreversible | `variant="destructive"` |
| Link | Inline actions inside prose | `variant="link"` |

**One primary button per page or per section.** More than one signals that the UX hasn't decided what the user should do next.

**Icon-only action buttons in tables** (gear, edit, delete, etc.) use `variant="ghost" size="icon"` with `hover:bg-transparent hover:text-foreground`. No background change on hover — the icon just stays dark. These are utility controls, not primary actions.

---

## 14. Status badges

**Universal pattern:** `bg-[name]/10 text-[name] border-[name]/30 border`. All tinted — no solid fills with white text anywhere in the ERP. Icons at `w-3 h-3` inside the badge when needed to disambiguate within a color group. Use Lucide icons only — no emojis.

**No hover effects on badges.** Badges are static status indicators, not interactive elements. The shadcn Badge component has been modified to remove all `hover:` styles. Never add hover effects to badges.

### Generic semantic map (use when no feature-specific map applies)

| Meaning | Variant | Classes |
|---|---|---|
| Completed, paid, active, done | success | `bg-success/10 text-success border-success/30 border` |
| Needs action, pending, draft | warning | `bg-warning/10 text-warning border-warning/30 border` |
| Rejected, cancelled, overdue | error | `bg-error/10 text-error border-error/30 border` |
| In progress, submitted, processing | info | `bg-info/10 text-info border-info/30 border` |
| Closed, archived, neutral | neutral | `bg-slate-100 text-slate-600 border-slate-200 border` |

```jsx
<Badge className="bg-success/10 text-success border-success/30 border">Aprobado</Badge>
```

**Feature-specific badge maps** (where the generic map doesn't apply) live in section 20. Always check section 20 before applying the generic map to a feature that has its own page.

---

## 15. Alerts and toasts

**Option C — left-accent.** White bg, slate-300 border, 3px colored left-border, colored icon. Same visual language as SectionHeader (2px Navy) and StatCard (4px accent).

**Source:** `src/components/shell/Alert.tsx` (custom — do NOT use shadcn Alert as-is)

Props: `variant` (`"info"|"success"|"warning"|"error"`), `title`, `description`, `actions`, `dismissible`, `onDismiss`.

### Placement decisions

| Situation | Pattern | Where |
|---|---|---|
| Page-level context (affects whole page) | Inline Alert | Below PageHeader, above first section. Full content width. |
| Section-level context (affects one section) | Inline Alert | Inside the Card, above its content. Respects card padding. |
| Form-level error ("couldn't save") | Inline Alert | Inside the dialog/form, above the field groups. |
| Single field validation | Field error | Below the input, `text-xs text-error`. |
| Transient confirmation ("saved") | Toast | Bottom-right, auto-dismiss 4s. |
| Undo opportunity ("deleted") | Toast with action | Bottom-right, auto-dismiss 6s. |
| Destructive confirm ("are you sure?") | AlertDialog | Modal. shadcn AlertDialog. |
| Backend unreachable (network) | Inline Alert (warning) | Top of affected page. NOT a full-page state. |
| Entire page failed (404, 403, crash) | Full-page state | See section 17. |

### Dismissibility rules

| Severity | Dismissible? | Why |
|---|---|---|
| Info | Yes | User acknowledges and moves on. |
| Success (persistent) | Rare — prefer toast | Nothing for the user to do. |
| Warning (actionable, deferrable) | Yes | User can defer: "I'll deal with it later." |
| Warning (not yet acted on) | No | E.g., "3 RFIs vencidas" — don't hide the problem. |
| Error (operation failed) | No | Persists until resolved or retried. |
| Error (permanent state) | No | Persists as long as the state is true. |

### Toast

**Sonner, bottom-right, 4-second auto-dismiss.** Already the shadcn standard.

Setup in `App.tsx` or root layout:

```jsx
import { Toaster } from "@/components/ui/sonner";

<Toaster
  position="bottom-right"
  toastOptions={{
    duration: 4000,
    classNames: {
      toast: "group toast bg-card text-foreground border-border border border-l-[3px]",
      description: "text-slate-700",
      actionButton: "bg-navy text-white",
      cancelButton: "bg-slate-100 text-slate-700",
    },
  }}
/>
```

Use:

```jsx
import { toast } from "sonner";

toast.success("Solicitud guardada", {
  description: "SP-2026-0427 · Torre Harborview",
  action: { label: "Ver", onClick: () => navigate(`/solicitudes/${id}`) },
});
toast.error("No se pudo guardar", {
  description: "Reintenta en unos momentos.",
});
```

### Never use toast for

- Anything the user MUST see (use an Alert)
- Errors that require action (use an Alert)
- Warnings about data loss (use a confirmation dialog)
- Form validation errors (use inline field errors)

---

## 16. Empty / loading / error states (in-section)

**Source:** `src/components/shell/states.tsx`

Exports: `EmptyState`, `ErrorState`, `TableSkeleton`, `StatCardSkeleton`. Use inside a Card, or inside a full-colspan TableCell when the shell is a table.

### Inside a table

```jsx
{data.length === 0 && (
  <TableRow>
    <TableCell colSpan={4} className="p-0">
      <EmptyState
        icon={FolderOpen}
        title="Aún no hay proyectos"
        description="Crea el primer proyecto para empezar a rastrear presupuestos, RFIs y submittals."
        action={<Button size="sm"><Plus className="mr-2 h-4 w-4" /> Nuevo proyecto</Button>}
      />
    </TableCell>
  </TableRow>
)}
```

---

## 17. Full-page states

### One centered shell, four states

**Source:** `src/components/shell/FullPageState.tsx`

All four full-page states use the same layout: icon-or-code, title (serif), description (slate-600), primary + secondary actions. Only the hero element changes.

Props: `code`, `icon`, `iconVariant` (`"neutral"|"warning"|"error"|"info"`), `title`, `description`, `actions`, `meta`, `footer`.

### 404 — Página no encontrada

With sidebar. Big Navy "404." Primary: Ir al inicio. Secondary: Volver.

```jsx
<FullPageState
  code="404"
  title="Página no encontrada"
  description="La ruta que intentas abrir no existe o fue movida. Verifica el enlace o regresa al inicio."
  actions={
    <>
      <Button variant="outline" onClick={() => history.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver
      </Button>
      <Button onClick={() => navigate("/")}>Ir al inicio</Button>
    </>
  }
  meta={window.location.pathname}
/>
```

### 403 — Sin permisos

With sidebar. Lock icon in warning circle. No big "403" code (meaningless to non-technical users). Primary: Ir al inicio. Secondary: Contactar administrador.

```jsx
<FullPageState
  icon={<Lock className="h-6 w-6" />}
  iconVariant="warning"
  title="No tienes acceso a esta sección"
  description={<>Tu cuenta no tiene permisos para ver <strong>{sectionName}</strong>. Contacta al administrador del sistema si necesitas acceso.</>}
  actions={
    <>
      <Button variant="outline" onClick={contactAdmin}>Contactar administrador</Button>
      <Button onClick={() => navigate("/")}>Ir al inicio</Button>
    </>
  }
/>
```

### Session expiring — warning modal (two-stage pattern)

Trigger approximately 2 minutes before expiry. Modal blocks the page and counts down. Primary extends session. Secondary signs out cleanly.

```jsx
<AppDialog
  open={sessionExpiring}
  onOpenChange={() => {}}
  size="confirm"
  title="Tu sesión expirará pronto"
  description="Por seguridad, te cerraremos sesión automáticamente por inactividad."
  footer={
    <>
      <Button variant="outline" onClick={logout}>Cerrar sesión</Button>
      <Button onClick={extendSession}>Continuar trabajando</Button>
    </>
  }
>
  <div className="flex items-center gap-3 py-2">
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-warning/10 text-warning">
      <Clock className="h-4 w-4" />
    </div>
    <div className="font-heading text-xl font-semibold tabular-nums text-warning">
      {countdown} <span className="text-xs font-normal font-body text-slate-500">restantes</span>
    </div>
  </div>
</AppDialog>
```

### Session expired — login page with inline alert

After expiry, redirect to login page with info-tone Option C alert. No sidebar (logged out).

```jsx
// Inside LoginN.jsx, read ?reason=session_expired
{reason === "session_expired" && (
  <Alert
    variant="info"
    title="Tu sesión expiró por inactividad"
    description="Vuelve a iniciar sesión para continuar. Tu trabajo no guardado puede haberse perdido."
  />
)}
```

### App crash — React error boundary

**Source:** `src/components/shell/AppErrorBoundary.tsx`

Keeps sidebar for page-level boundaries. Fullscreen only for root boundary. Technical details visible only in development. Place the boundary at page-level routes (keeps sidebar) and a root-level boundary around the app shell (fullscreen fallback if the shell itself breaks).

### Layout decision table

| Situation | Layout | Why |
|---|---|---|
| 404 (URL doesn't match) | With sidebar | User is authenticated; they need to navigate elsewhere. |
| 403 (no permission) | With sidebar | User is authenticated; they likely landed here from the sidebar. |
| Session-expiring warning | Modal over current page | User still authenticated; don't destroy context until they decide. |
| Session expired (after redirect) | Fullscreen (login page) | User is logged out; sidebar would mislead. |
| App crash — page-level boundary | With sidebar | Only the page crashed; sidebar is the escape. |
| App crash — root boundary | Fullscreen | Even the sidebar might be broken; render the minimum. |
| Backend unreachable (network) | Inline Alert (NOT full-page) | App still works; only data fetch failed. |

### Copy conventions

- **Spanish, declarative, non-apologetic.** No "Oops," no "Lo sentimos mucho."
- **Never blame the user.** "Página no encontrada," not "¿Estás seguro de que escribiste la URL correctamente?"
- **HTTP codes only when recognizable.** 404 yes. 403, 500, 503 no — use human language.
- **Always give the user somewhere to go.** Every state has at least one action button.
- **Description is one or two sentences max.** Tell them what happened and what to do. Not a user manual.

Examples:

| ✅ Do | ❌ Don't |
|---|---|
| Página no encontrada | ¡Ups! 😕 Parece que te perdiste |
| No tienes acceso a esta sección | 403 Forbidden: Access Denied |
| Algo salió mal | Error fatal del sistema |
| Tu sesión expiró por inactividad | Sesión caducada por exceder el tiempo máximo permitido |

---

## 18. PR checklist

Before opening a PR for a new or refactored page, verify:

- [ ] Uses `<PageHeader>` at the top, not a custom heading.
- [ ] Page title is `text-2xl`, not `text-3xl` or `text-xl`.
- [ ] No bottom-border rule under the PageHeader.
- [ ] Sections separated by `space-y-6` (24px).
- [ ] Every section H2 uses `<SectionHeader>` with the 2px Navy left border.
- [ ] List pages use the table-in-card pattern with integrated toolbar and footer.
- [ ] Stat grids use `<StatCard>` with `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`.
- [ ] Dialogs use `<AppDialog>` with a documented `size` value from the scale.
- [ ] Every numeric table cell has `tabular-nums` (or `className="num"` with the base CSS applied).
- [ ] No arbitrary Tailwind defaults (`blue-600`, `gray-500`, `red-500`). Only named brand tokens (`navy`, `teal`, `success`, etc.) and shadcn tokens (`primary`, `muted-foreground`, etc.) and `slate-*`.
- [ ] Status badges use the `bg-[name]/10 text-[name] border-[name]/30` pattern from section 14.
- [ ] Alerts use Option C left-accent via the custom `<Alert>` component.
- [ ] Empty / loading / error states use `<EmptyState>`, `<TableSkeleton>`, `<ErrorState>` — never bespoke copies.
- [ ] Mobile pattern in place: `md:hidden` cards, `hidden md:block` table.
- [ ] Toasts only for transient confirmations, not for things the user must see.

---

## 19. What this file does NOT cover

Intentionally out of scope so this file stays focused on visual conventions:

- **Data fetching patterns** — covered by `CLAUDE.md` and the codebase itself.
- **State management** — ditto.
- **Form validation logic** (as distinct from visual treatment) — ditto.
- **Authentication flows** — architectural, lives outside this doc.
- **Error boundary placement strategy** — architectural; this doc only covers the visual fallback.
- **Animations and transitions** — TBD, separate decision later.
- **Accessibility (keyboard nav, ARIA, focus order, screen reader testing)** — TBD, separate decision later.
- **Migration order / page-by-page refactor plan** — one-time, belongs in a separate issue or `MIGRATION.md`.
- **Routing strategy** — being investigated separately.

---

---

## 20. Feature-specific badge and row patterns

Some features have badge systems that are more specific than the generic semantic map in section 14. These live here. Always check this section before applying section 14 to any of the features listed below.

---

### 20.1 Solicitudes de pago

#### Estado badge map

All badges use the universal tinted pattern. Icons at `w-3 h-3` from `lucide-react`. The `aprobada` backend value is a label-only rename — the database enum stays `aprobada`, but the UI always renders "Por pagar."

| Backend value | Label shown | Variant | Lucide icon |
|---|---|---|---|
| `pendiente` | *(replaced by approval pill bar — no badge)* | — | — |
| `aprobada` | Por pagar | warning | none |
| `pagada` | Pagada | success | `Check` |
| `facturada` | Facturada | info | `FileCheck` |
| `reembolsada` | Reembolsada | info | `CreditCard` |
| `transferida` | Verificada | info | `ShieldCheck` |
| `rechazada` | Rechazada | error | `X` |
| `devolucion` | Devolución | neutral | `Undo2` |
| `borrador` | *(never created in solicitudes — neutral fallback if it ever appears)* | neutral | none |

```jsx
// Examples
<Badge className="bg-warning/10 text-warning border-warning/30 border">Por pagar</Badge>
<Badge className="bg-success/10 text-success border-success/30 border">
  <Check className="w-3 h-3" /> Pagada
</Badge>
<Badge className="bg-info/10 text-info border-info/30 border">
  <FileCheck className="w-3 h-3" /> Facturada
</Badge>
<Badge className="bg-error/10 text-error border-error/30 border">
  <X className="w-3 h-3" /> Rechazada
</Badge>
<Badge className="bg-slate-100 text-slate-600 border-slate-200 border">
  <Undo2 className="w-3 h-3" /> Devolución
</Badge>
```

#### Approval pill bar (replaces the Estado badge when `estado === 'pendiente'`)

When a solicitud is pending approval, the Estado column renders an approval progress pill bar instead of a badge. Segments are ordered left-to-right matching the approval sequence.

```jsx
// src/components/solicitudes/ApprovalPillBar.jsx
// Rendered in the Estado cell when estado === 'pendiente' && aprobadores_estado?.length

<div className="inline-flex h-[22px] overflow-hidden rounded-md border border-border">
  {aprobadores.map((a) => (
    <div
      key={a.nombre}
      className={cn(
        "inline-flex items-center justify-center border-r border-white/50 px-2.5 text-[10.5px] font-semibold last:border-r-0",
        a.estado === "aprobado"  && "bg-success text-white",
        a.estado === "pendiente" && "bg-navy/10 text-navy",
        a.estado === "rechazado" && "bg-error text-white"
      )}
      title={`${a.nombre}: ${a.estado}`}
    >
      {getInitials(a.nombre)}
    </div>
  ))}
</div>
```

- `rounded-md` — matches badge corner radius, not `rounded-full`
- Approved segments: filled `bg-success text-white`
- Pending segments: tinted `bg-navy/10 text-navy`
- Rejected segments: filled `bg-error text-white` (rare — solicitud would flip to `rechazada` state)
- White hairline `border-r border-white/50` separates segments

#### Urgente row treatment

When `solicitud.urgente === true`, the table row gets a 3px error left border on the first cell and a very subtle red tint. No separate column, no badge in the Estado cell.

```jsx
<TableRow
  className={cn(
    "border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60",
    solicitud.urgente && "bg-error/[0.025] hover:bg-error/[0.04]"
  )}
>
  <TableCell
    className={cn(
      "px-4 py-3 text-sm font-medium text-foreground",
      solicitud.urgente && "border-l-[3px] border-l-error pl-[13px]"
    )}
  >
    {solicitud.numero}
  </TableCell>
  {/* rest of cells */}
</TableRow>
```

In the **detail dialog**, `urgente` renders as a small error-tinted badge in the dialog header area:

```jsx
{solicitud.urgente && (
  <Badge className="bg-error/10 text-error border-error/30 border text-[10px] uppercase tracking-wide">
    <AlertTriangle className="w-3 h-3" />
    Urgente
  </Badge>
)}
```

#### Reembolso (consorcio solicitudes only)

Only shown when `pinellas_paga === true`. Never appears as a badge in table rows.

**In the toolbar:** a filter chip that activates a focused view of pending reimbursements.

```jsx
<button
  onClick={toggleReembolsoFilter}
  className={cn(
    "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors",
    reembolsoFilter
      ? "border-warning/35 bg-warning/8 text-warning"
      : "border-border bg-card text-slate-700 hover:bg-slate-50"
  )}
>
  {reembolsoFilter && <span className="h-1.5 w-1.5 rounded-full bg-warning" />}
  <DollarSign className="h-3.5 w-3.5" />
  Reembolso pendiente
</button>
```

When active, a confirmation banner renders below the toolbar:

```jsx
<div className="flex items-center gap-2 border-b border-warning/15 bg-warning/6 px-4 py-2 text-xs text-warning">
  <SlidersHorizontal className="h-3.5 w-3.5 flex-shrink-0" />
  Mostrando solicitudes de consorcio con <strong className="mx-1 text-foreground">reembolso pendiente</strong>
  <button onClick={clearFilter} className="ml-auto text-slate-500 underline underline-offset-2 hover:text-foreground">
    Limpiar filtro
  </button>
</div>
```

**In the detail dialog:** a dedicated metadata row, rendered only when `pinellas_paga === true`.

```jsx
{solicitud.pinellas_paga && (
  <div className="mt-1 grid grid-cols-[140px_1fr] items-center gap-2 border-t border-border pt-3">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-navy">
      Reembolso
    </span>
    <div className="flex items-center gap-2">
      {solicitud.reembolso_registrado ? (
        <>
          <Badge className="bg-success/10 text-success border-success/30 border">
            <Check className="w-3 h-3" /> Registrado
          </Badge>
          <span className="text-xs text-muted-foreground">{solicitud.fecha_reembolso}</span>
        </>
      ) : (
        <>
          <Badge className="bg-warning/10 text-warning border-warning/30 border">
            Pendiente
          </Badge>
          <span className="text-xs text-muted-foreground">
            {solicitud.consorcio} aún no ha reembolsado
          </span>
        </>
      )}
    </div>
  </div>
)}
```

---

#### Revisada indicator (batch review session)

When a solicitud has been marked as reviewed during a batch review session, a `CheckCircle2` icon appears inline in the title cell next to the solicitud number. This is a **temporary, session-only state** — it resets on page refresh and is not a workflow status.

- Icon: `CheckCircle2` from `lucide-react` at `h-3.5 w-3.5`
- Color: `text-success` (named token — not `text-green-600`)
- Position: inline in the title cell, after the solicitud number
- Never competes with the urgente treatment — urgente lives on the row's left edge, revisada lives inside the cell

```jsx
<TableCell className={cn(
  "px-4 py-3 text-sm font-medium text-foreground",
  solicitud.urgente && "border-l-[3px] border-l-error pl-[13px]"
)}>
  <span className="inline-flex items-center gap-1.5">
    {solicitud.numero}
    {solicitud.revisada && (
      <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-label="Revisada" />
    )}
  </span>
</TableCell>
```

Urgent + reviewed on the same row is valid — the red left border signals urgency at the row level, the green check signals personal review status inside the cell. They use different visual lanes and do not conflict.

---

*End of FRONTEND_CONVENTIONS.md. Questions or edge cases not covered here should be resolved by picking the closest existing pattern and extending it — not by inventing new patterns. Consistency is the feature.*
