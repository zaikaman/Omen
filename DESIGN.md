---
name: Omen
description: Autonomous market-intelligence swarm with inspectable AXL routing and 0G proof evidence.
colors:
  carbon-black: "#0A0A0A"
  console-black: "#030712"
  panel-ink: "#111827"
  panel-deep: "#0f172a"
  border-quiet: "#1f2937"
  border-strong: "#374151"
  text-primary: "#f9fafb"
  text-secondary: "#d1d5db"
  text-muted: "#9ca3af"
  text-faint: "#6b7280"
  evidence-cyan: "#00D4FF"
  evidence-cyan-deep: "#00A8CC"
  route-purple: "#c084fc"
  proof-green: "#22c55e"
  warning-amber: "#f59e0b"
  risk-red: "#ef4444"
  telegram-blue: "#2AABEE"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 5rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.05em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.625rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.evidence-cyan}"
    textColor: "{colors.carbon-black}"
    rounded: "{rounded.lg}"
    padding: "8px 20px"
    height: "40px"
  button-ghost:
    backgroundColor: "{colors.console-black}"
    textColor: "{colors.evidence-cyan}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "40px"
  card-operational:
    backgroundColor: "{colors.panel-ink}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.lg}"
    padding: "20px"
  badge-proof:
    backgroundColor: "{colors.console-black}"
    textColor: "{colors.evidence-cyan}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
---

# Design System: Omen

## 1. Overview

**Creative North Star: "The Evidence Cockpit"**

Omen is a dense operational product surface for proving that an autonomous market-intelligence swarm is real. The atmosphere is carbon-black, cyan-lit, and inspectable: every screen should feel like it is exposing live machinery, peer routing, proof references, and agent decisions rather than dressing up claims.

The design is technical but not militarized. It should make judges feel that they are auditing a working system, not watching a theatrical crypto demo. The product rejects the generic crypto terminal, flashy AI SaaS, military command center, toy demo, trading-bot scam, and any visual treatment that substitutes spectacle for evidence.

**Key Characteristics:**
- Carbon-black operational surfaces with cyan used as the primary evidence and action accent.
- Compact information density with structured layers: summary first, proof and trace detail one interaction away.
- Mono typography for peer IDs, hashes, routes, timestamps, scores, and telemetry.
- Status color always paired with words, icons, or numeric context.
- Motion is a state signal, never decoration.

## 2. Colors

The palette is forensic cyan over carbon-black operational surfaces, supported by measured semantic colors for proof, risk, warning, and route identity.

### Primary
- **Evidence Cyan**: The main proof/action accent. Use for active navigation, primary CTAs, proof links, route affordances, focus rings, and the few places that must draw immediate judge attention.
- **Evidence Cyan Deep**: The hover and scrollbar accent. Use when cyan needs to darken under interaction while staying recognizably part of the same evidence system.

### Secondary
- **Route Purple**: AXL route and service identity. Use for AXL-routed badges, peer-service metadata, and network trace emphasis.
- **Proof Green**: Completed proof, online status, successful compute, and positive signal state.
- **Telegram Blue**: External Telegram affordances only. Do not let it become a general action color.

### Tertiary
- **Warning Amber**: Queued, degraded, partial, or pending states.
- **Risk Red**: Failed, offline, stop-loss, destructive, or invalid states.

### Neutral
- **Carbon Black**: The global app base and scrollbar track.
- **Console Black**: The deepest nested surface, used for inner evidence panels and data wells.
- **Panel Ink**: Standard card and sidebar surface.
- **Panel Deep**: Chart tooltip and high-density data surface.
- **Quiet Border**: Default structural border for cards, tables, sidebars, and dividers.
- **Strong Border**: Hover or selected border when a surface needs firmer separation.
- **Primary Text**: Page titles, important values, token symbols, and active labels.
- **Secondary Text**: Normal body copy and supporting data.
- **Muted Text**: Labels, captions, timestamps, and helper text.
- **Faint Text**: De-emphasized version strings and empty-state metadata.

### Named Rules

**The Cyan Scarcity Rule.** Evidence Cyan is precious. Use it for proof-bearing action and active structure; never flood whole panels with it.

**The Status Pairing Rule.** Green, red, amber, purple, and pink never stand alone. Pair every status color with text, iconography, or a numeric value.

## 3. Typography

**Display Font:** Inter, ui-sans-serif, system-ui, sans-serif
**Body Font:** Inter, ui-sans-serif, system-ui, sans-serif
**Label/Mono Font:** ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace

**Character:** The type system is utilitarian and audit-focused. Sans-serif text handles comprehension; monospace text marks machine output, evidence references, and values that should feel copyable or inspectable.

### Hierarchy
- **Display** (700, clamp(2.5rem, 6vw, 5rem), 1): Landing-page hero statements and major brand moments only.
- **Headline** (700, 1.5rem, 1.2): Dashboard page headings, card feature titles, and signal/intel titles.
- **Title** (700, 0.875rem, 1.25, uppercase when operational): Panel headings, proof modules, table headers, and console section names.
- **Body** (400, 0.875rem, 1.625): Explanatory copy, signal analysis summaries, intel excerpts, and empty states. Keep paragraphs readable, not theatrical.
- **Label** (700, 0.625rem, 0.05em, uppercase): Peer IDs, telemetry labels, badges, timestamps, route snippets, compact metric labels.

### Named Rules

**The Machine-Text Rule.** Use monospace only when the content is machine-generated, inspectable, or evidentiary: hashes, IDs, routes, timestamps, scores, and logs.

**The No-Hype Heading Rule.** Headings name the operational state. They do not make marketing claims that the live data cannot prove.

## 4. Elevation

Omen uses tonal layering first, glow/shadow only for state or emphasis. Depth is created through dark surface steps, one-pixel borders, inner data wells, and compact spacing. Shadows are allowed for hover lift and cyan emphasis, but a resting dashboard should not look glossy or atmospheric.

### Shadow Vocabulary
- **Low Hover Glow** (`0 10px 15px -3px rgba(8, 145, 178, 0.10), 0 4px 6px -4px rgba(8, 145, 178, 0.10)`): Intel cards and proof links that become active under pointer interaction.
- **CTA Cyan Glow** (`0 0 15px rgba(0, 212, 255, 0.20)`): Primary landing CTA only; increase to `0 0 25px rgba(0, 212, 255, 0.40)` on hover.
- **Modal Scrim** (`rgba(0, 0, 0, 0.80)` with backdrop blur): Blocking run detail and dialog overlays.

### Named Rules

**The Flat Evidence Rule.** Proof surfaces are flat at rest. Add depth only when interaction, modal focus, or active proof state needs to be visible.

## 5. Components

### Buttons
- **Shape:** Gently squared operational controls (8px radius for app actions, 6px for primitive defaults).
- **Primary:** Evidence Cyan background with Carbon Black text, medium-bold label, icon when the action maps to a familiar command.
- **Hover / Focus:** Darken to Evidence Cyan Deep or add a cyan-tinted background well. Focus must use a visible ring or border shift, not color alone.
- **Secondary / Ghost / Tertiary:** Ghost buttons live on Console Black or transparent surfaces with cyan text and a quiet cyan border when the action opens proof, analysis, or route detail.

### Chips
- **Style:** Compact bordered badges with tinted backgrounds at 10-20 percent opacity, mono uppercase labels, and small icons where proof type or status matters.
- **State:** Active, pending, failed, routed, manifest, compute, and post-proof chips must include readable labels. Color alone is prohibited.

### Cards / Containers
- **Corner Style:** 8px radius for operational panels, 12px for larger media or modal containers.
- **Background:** Panel Ink at 50-95 percent opacity over Carbon Black; Console Black for nested evidence wells.
- **Shadow Strategy:** Flat by default. Use Low Hover Glow only for clickable cards.
- **Border:** Quiet Border at rest; Strong Border or cyan-tinted border for active and hover states.
- **Internal Padding:** 20px for cards, 12-16px for dense metric cells, 24px for top-level panel headers.

### Inputs / Fields
- **Style:** 40px height, 6px radius, Quiet Border, dark background, 12px horizontal padding.
- **Focus:** Visible ring or border change using Evidence Cyan. Preserve the current field height and do not introduce layout shift.
- **Error / Disabled:** Error uses Risk Red with explanatory text. Disabled states reduce opacity and pointer affordance.

### Navigation

Sidebar navigation uses a fixed 256px rail on desktop, dark bordered panels, icon plus label rows, and cyan-tinted active states. Mobile navigation slides in over a black scrim. Header metadata uses mono uppercase labels so the current system state reads as telemetry.

### Signature Component: Proof Badge Row

Proof badges are the credibility layer. Use small bordered chips for 0G Manifest, Compute Hash, AXL Routed, and Post Proof. Each chip must link to real evidence when available, include an icon, use mono uppercase text, and remain compact enough to sit inside signal and intel cards without crowding the primary content.

### Signature Component: AXL Peer Graph

AXL topology panels use compact metric cells, peer rows, service chips, status badges, and timestamps. The layout must expose peer count, online count, role, latency, services, and last-seen data without becoming a decorative network illustration.

## 6. Do's and Don'ts

### Do:
- **Do** use Carbon Black, Panel Ink, Console Black, Quiet Border, and Evidence Cyan as the core app vocabulary.
- **Do** show peer IDs, route receipts, artifacts, timestamps, hashes, and run evidence close to the claims they support.
- **Do** keep proof badges compact, linked, labeled, and icon-supported.
- **Do** use monospace for inspectable machine values and normal sans-serif for explanation.
- **Do** pair every color-coded status with text or an icon.
- **Do** preserve dense dashboard spacing while keeping content scannable on laptop screens.

### Don't:
- **Don't** make Omen feel like a generic crypto terminal.
- **Don't** make Omen feel like flashy AI SaaS.
- **Don't** make Omen feel like a military command center.
- **Don't** make Omen feel like a toy demo.
- **Don't** make Omen feel like a trading-bot scam.
- **Don't** use decorative cyberpunk excess, fake-looking dashboards, or empty alpha claims.
- **Don't** use colored side-stripe borders as a default card accent; if a legacy signal treatment uses one, keep it local and do not spread the pattern.
- **Don't** use gradient text, decorative glassmorphism, or hero-metric template sections.
- **Don't** invent mock, fallback, or placeholder evidence in the UI. Empty states must say what is missing.
