# Shell Components

Shared design system components for the Pinellas ERP frontend.
Import from `@/components/shell` (barrel export in index.ts).

## Rules

- These components enforce FRONTEND_CONVENTIONS.md. Read that file
  before modifying any component here.
- Do not duplicate shell components in page-level code. If a page
  has a custom heading, stat tile, or dialog wrapper, replace it
  with the shell component.
- Do not add new components here without adding a matching section
  to FRONTEND_CONVENTIONS.md in the same PR.
- Do not modify the visual output of these components without
  checking FRONTEND_CONVENTIONS.md first — the conventions file
  wins over implementation preferences.

## Component index

| Component | Purpose | Conventions section |
|---|---|---|
| PageHeader | Page title + subtitle + actions | FRONTEND_CONVENTIONS.md §6 |
| SectionHeader | H2 with 2px Navy left border | §7 |
| StatCard | KPI tile with 4px accent border | §9 |
| AppDialog | Dialog with standardized width scale | §11 |
| Alert | Left-accent inline alert (not shadcn Alert) | §15 |
| EmptyState | "No data" centered state | §16 |
| ErrorState | Error state with retry | §16 |
| TableSkeleton | Loading skeleton for tables | §16 |
| StatCardSkeleton | Loading skeleton for stat grids | §16 |
| FullPageState | 404, 403, crash states | §17 |
| AppErrorBoundary | React error boundary | §17 |
| ApprovalPillBar | Approval progress segments | §20.1 |
