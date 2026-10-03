# CareerForge / Roadmap & Daily Practice Engine — Design System (`DESIGN.md`)

This document defines the visual hierarchy, token palette, typographic discipline, and motion principles governing the CDN-first Roadmap Tree and Daily Practice Engine.

---

## 1. Architectural Theme & Palette

The visual foundation rejects generic slate-900 / navy templates in favor of a deep, warm charcoal hierarchy layered with hairline borders (`rgba(255, 255, 255, 0.09)`) rather than generic drop-shadows.

### Base Charcoal Palette
- **`charcoal-950` (`#0B0B0D`)**: Primary canvas background. Deep, warm near-black that eliminates eye strain.
- **`charcoal-900` (`#101114`)**: Surface Layer 1 (Roadmap canvas container, header bars).
- **`charcoal-850` (`#141416`)**: Surface Layer 2 (Node cards, quiz option blocks).
- **`charcoal-800` (`#18191E`)**: Elevated Surface (Flyout drawer, modal backdrops, popovers).
- **`charcoal-700` (`#22242B`)**: Interactive hover and active borders.
- **`charcoal-400` (`#7E8291`)**: Muted secondary text, metadata labels, icon accents.
- **`charcoal-200` (`#D2D5DF`)**: Primary readable body copy.
- **`charcoal-100` (`#F0F2F7`)**: High-contrast node titles, headers, and score values.

### Vivid Amber Accent (Used Sparingly)
Reserved exclusively for active nodes, tree progress indicators, correct quiz selections, and active filters.
- **`accent-500` (`#F59E0B`)**: Base focal accent.
- **`accent-400` (`#FBBF24`)**: Active focus borders and text glows.
- **`accent-600` (`#D97706`)**: Hover states on primary buttons.
- Glow: `box-shadow: 0 0 20px -3px rgba(245, 158, 11, 0.35)`.

### Desaturated Status Triad
Never using raw primary green or yellow. Harmonized for dark charcoal surfaces:
- **Completed**: `#34D399` text / `#0D281E` fill / `#1B4332` border. Accompanied by checkmark icon.
- **In-Progress**: `#FBBF24` text / `#2A1B07` fill / `#4B320B` border. Accompanied by circular progress pulse.
- **Planned**: `#94A3B8` text / `#14171F` fill / `#212735` border. Accompanied by dashed or lock indicator.

---

## 2. Typographic Scale

Two distinct typefaces:
1. **UI & Headings**: Humanist/Grotesk sans (`Geist Sans`, system stack).
2. **Metadata & Badges**: Monospace (`JetBrains Mono`, `Geist Mono`).

| Token | Size / Line-Height | Weight | Role |
| :--- | :--- | :--- | :--- |
| `text-xs` | `0.75rem / 1.00rem` (12/16px) | Regular (400) / SemiBold (600) | Badges, tags, depth labels, timestamps |
| `text-sm` | `0.875rem / 1.25rem` (14/20px) | Regular (400) / Medium (500) | Secondary descriptions, quiz options |
| `text-base` | `1.00rem / 1.50rem` (16/24px) | Regular (400) / Medium (500) | Primary body text, question prompts |
| `text-lg` | `1.125rem / 1.75rem` (18/28px) | Medium (500) | Node titles, section callouts |
| `text-xl` | `1.25rem / 1.75rem` (20/28px) | SemiBold (600) | Drawer title, sub-headers |
| `text-2xl` | `1.50rem / 2.00rem` (24/32px) | SemiBold (600) | Page titles on tablet, quiz modal title |
| `text-3xl` | `1.875rem / 2.25rem` (30/36px) | Bold (700) | View headers |
| `text-4xl` | `2.25rem / 2.75rem` (36/44px) | Bold (700) | Hero track title, final score percentage |

---

## 3. Structural Geometry & Corner Radii

Different UI roles receive distinct corner radii:
- **Tree Node Cards**: `rounded-node` (`0.875rem` / `14px`). Balanced, comfortable tap targets.
- **Side Drawer**: `rounded-drawer` (`1.5rem` / `24px`). Elevated desktop container.
- **Mobile Bottom Sheet**: `rounded-sheet` (`1.75rem` / `28px`). Soft top edges.
- **Badges & Tags**: `rounded-full` or `rounded-md` (`6px`).

---

## 4. Motion & Transition Rules

1. **Transform and Opacity Only**:
   - Strictly forbidden: animating `width`, `height`, `padding`, `margin`, `top`, `left`.
   - Node hover: `transform: scale(1.02);` with subtle hairline border glow.
2. **Selection Propagation**:
   - Selecting a node triggers an instant ancestor chain derivation. Direct connectors illuminate with amber stroke; ancestors illuminate with gold border; descendants remain visible; un-related nodes dim to `opacity: 0.38`.
3. **Accessibility**:
   - Every transition wraps under `@media (prefers-reduced-motion: reduce) { transition: none !important; animation: none !important; }`.
