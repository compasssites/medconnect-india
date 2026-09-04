# UI Profile

<!-- Created by Compass. Fill every Unknown on the first UI task; the compass-ui skill explains each field. -->

## Personality
Class: Unknown (institutional | product | expressive)
Who uses it and the mood it should hold: Unknown (e.g. "Lab staff entering results under time pressure; calm, dense, trustworthy")

## Foundation
Framework: Astro
Component library: Unknown (React Aria Components | shadcn/ui | Starwind | custom)
Styling: Tailwind v4; tokens live in src/styles/global.css (no semantic tokens defined yet — add them here first)
Icon set: Unknown

## Tokens (light)
| token | value | used for |
|---|---|---|
| background | hsl(30 15% 97.5%) product, hsl(210 15% 98%) institutional | canvas; tint the greys below the same direction |
| surface | hsl(0 0% 100%) | cards, panels, active pill |
| foreground | hsl(30 8% 12%) | text |
| muted | hsl(40 12% 94%) | fills, hover, tab container |
| muted-foreground | hsl(30 6% 45%) | secondary text |
| border | hsl(40 10% 90%) | hairlines |
| border-strong | hsl(40 8% 82%) | inputs, emphasis |
| accent | Unknown | the one hue: primary action, focus, active, status dot |
| accent-foreground | Unknown | text on accent |
| ring | same as accent | focus |
| success / warning / danger | Unknown | desaturated one step toward the neutrals |

Dark mode: not supported

## Type
Family: var(--font-sans) (UI); mono Unknown
Body size: Unknown (14 dense product | 16 content). Heading tracking: -0.015em. Numbers: tabular-nums.

## Shape and elevation
Radius: control 6px, card 8px, dialog and menu 12px, pill full.
Shadow: floating layers only; recipe in the compass-ui taste reference.

## Navigation
Tabs: Unknown (pill | underline already established). Main nav: Unknown (sidebar | top bar). Menus with 5+ items: structured panel.

## Density
Table row: Unknown (40 | 44px). Control height: 44px. Content max width: Unknown px.

## Do not
- Unknown (product-specific rules, e.g. "No modals on the sell screen; cashiers work keyboard-only.")

## Reference screens
- Unknown (routes or files that already look right, so agents copy them instead of inventing)
