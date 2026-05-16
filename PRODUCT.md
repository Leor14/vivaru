# PRODUCT.md — Vivaru

> Context file for design work. Keep updated when product strategy, users, or brand voice changes.

---

## Product Purpose

Vivaru is a multi-tenant SaaS platform for residential property management in Latin America (Colombia and Mexico). It digitizes the operational relationship between **building administrators** and **residents** — billing, visitors, amenity reservations, package tracking, support tickets (PQRS), community communications, surveys, and regulation compliance.

The product has two distinct portals sharing one backend:

- **Admin portal** (`/admin`): Used by property managers and building administrators. Dense, data-driven, operational. The admin's job is to run the building efficiently — they need clarity, speed, and trust in the numbers.
- **Resident portal** (`/resident`): Used by unit residents and tenants. Mobile-first, low-friction, reassuring. Residents interact occasionally (not daily) — onboarding them to digital tools is part of the product's job.

---

## Users

### Admin (Property Manager / Administrador de Edificio)
- **Who**: Building manager, property administrator, or condominium association staff in Colombia or Mexico.
- **Context**: Desktop-first. Works during business hours in an office or on-site. Manages 50–500 units. Juggles billing, incidents, visitor control, and resident communications simultaneously.
- **Goal**: See everything that needs attention at a glance. Act fast. Trust the data. Avoid phone calls from residents.
- **Pain points**: Information scattered across WhatsApp, spreadsheets, and physical logs. Residents who don't pay on time. No audit trail.
- **Tech comfort**: Medium. Comfortable with spreadsheets. Not necessarily comfortable with SaaS dashboards.

### Resident (Residente / Propietario)
- **Who**: Unit owner or tenant in a residential building or gated community.
- **Context**: Mobile-first. Accesses the portal occasionally — to check billing, authorize a visitor, pick up a package notification, or file a complaint. Often accessing from a phone while doing something else.
- **Goal**: Know the status of their unit in under 30 seconds. Avoid bureaucratic friction. Trust that the building is managed professionally.
- **Pain points**: Not knowing if a payment was received. Waiting for manual approval of visitors. Uncertainty about rules and procedures.
- **Tech comfort**: Low to medium. Must feel as simple as a WhatsApp interaction.

---

## Brand

### Identity
Vivaru is professional without being cold. It signals competence and reliability to property managers, and simplicity and respect to residents. It is not a startup trying to look "cool" — it is software that earns trust by working predictably.

### Tone of voice
- **Clear over clever.** No jargon, no puns. Say what the thing is.
- **Helpful, not paternalistic.** Give context when it matters. Don't over-explain.
- **Calm under pressure.** Error states are honest and actionable, not alarming.
- **Formal but warm.** Uses usted/tú consistently per country setting. Never robotic.
- **Spanish first.** All UI copy is es-CO or es-MX. No mixed-language labels.

### Visual register
`product` — Design serves the product. The interface is a tool, not a statement. Craft shows in details, not in decoration.

---

## Color strategy

**Restrained.** Deep navy (`--brand-700: #0b3c5d`) as the primary action color, used at ≤15% of any surface. All other surfaces are light blue-gray neutrals. Semantic color (green/amber/red) reserved strictly for status communication. No color used decoratively.

The palette reads: trustworthy, institutional, Latin American professional context. Not fintech-cold, not startup-bright.

---

## Typography strategy

**Dual personality.** Manrope (geometric sans) for all UI — labels, body, data. Fraunces (optical serif) exclusively for display moments — page titles, hero numbers, emotional anchors. The contrast between these two creates a character that is both precise (Manrope) and warm (Fraunces).

Admin shell suppresses Fraunces entirely — the admin experience is all-Manrope, keeping density and scannability maximum.

---

## Strategic design principles

1. **Status at a glance.** Every page should answer "what needs attention right now?" within the first visual scan. The most important piece of information is always the largest.
2. **Progressive disclosure.** Show summaries first. Expand on demand. Never show a full form when a summary card will do.
3. **Resident trust signals.** Every interaction a resident takes should be confirmed visually. Upload a receipt → see "en revisión". Authorize a visitor → see the green badge. The portal earns trust by reflecting reality in real time.
4. **Admin density without chaos.** Admin pages can be dense but must have a clear primary action per section. No page should leave the admin wondering "what do I do here?"
5. **Mobile-first for residents, desktop-first for admins.** Both must work on both — but the primary design decision is made for the dominant device per role.
6. **Sparse modals.** Drawers (slide-over panels) are preferred over centered modals for admin workflows. Modals reserved for confirmations and single-action flows.

---

## Anti-references

These products or aesthetics are explicitly wrong for Vivaru:

- **Notion / Linear / Vercel** — too developer-focused, too sparse, wrong emotional register for LATAM property management
- **Airbnb** — too lifestyle-brand, too photography-dependent
- **Fintech neon-on-dark** — alarming for residents, wrong trust register
- **Classic ERP / SAP** — too bureaucratic, no personality, violates the warm tone
- **WhatsApp-green** — residents already associate green with informal channels; Vivaru needs to feel like a step up

---

## Absolute bans (from impeccable shared laws)

- No side-stripe borders as card accents
- No gradient text
- No glassmorphism as default decoration
- No identical icon+heading+text card grids
- No modals as first-thought for complex workflows (use Drawer instead)
- No em dashes in copy
- No `transition: all` in CSS

---

## Modules

| Module | Admin surface | Resident surface |
|---|---|---|
| Billing | Create statements, bulk generation, receipt review, cartera histórica | Estado de cuenta, hero card, period cards, upload receipt |
| PQRS | Ticket queue, assignment, status management | Create ticket, track status |
| Reservations | Amenity management, calendar view | Reserve amenity, view upcoming |
| Visitors | Authorization management, pass registry | Authorize visitor, view active passes |
| Packages | Package intake, pickup confirmation | Notification, pickup status |
| Communications | Create/publish announcements | Read communications, acknowledge |
| Surveys | Create, publish, view responses | Take survey |
| Regulations | Manage documents, track signatures | Read, sign |
| Documents | Upload/manage building documents | Download |
| Settings | Units, users, branding, amenities | Profile, change password |
