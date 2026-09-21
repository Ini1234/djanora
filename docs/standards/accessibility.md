# Accessibility and responsive standard

Djanora targets **WCAG 2.2 Level A and AA** on every guest-facing and signed-in surface. This is the checklist for new UI. Event-site palettes still must pass NFR-7 (body text ≥ 4.5:1).

Responsive layout and accessibility are the same job: if a control or column only works on a wide desktop, it fails both.

## Breakpoints

Use Tailwind defaults. Do not invent one-off pixel cuts.

| Token   | Width   | Use for                                                                                       |
| ------- | ------- | --------------------------------------------------------------------------------------------- |
| default | < 640px | Single column. Nav is a bar + menu, not a side rail.                                          |
| `sm`    | 640px   | Slightly wider type and two-up cards when the content is simple.                              |
| `md`    | 768px   | App chrome: desktop sidebar / marketing nav. Horizontal section layouts may sit side by side. |
| `lg`    | 1024px  | Two-pane editors. Guest site **side** nav is allowed only from here up.                       |

Rules:

- Never reserve desktop-only space (fixed side padding, `min-w-[12rem]` rows) below the breakpoint that shows that chrome.
- Prefer `flex-wrap`, `min-w-0`, and `grid` over horizontal scroll. Scroll a tab strip or photo strip only when the items are a single row of chips or thumbnails.
- Page chrome uses `max-w-*` plus `px-4 sm:px-6`. Respect `env(safe-area-inset-*)` on fixed bars.
- Long titles wrap (`break-words`). Do not truncate the only heading on a page.

## Landmarks and focus

- Every route has exactly one `#main-content` (the skip target). The root skip link is first in the tab order.
- Use `header` / `nav` / `main`. Guest pages use visible `h1`; section titles may be visually hidden if the cover already names the page.
- `:focus-visible` is global. Do not set `outline: none` unless you replace it with an equivalent ring.
- Menus, drawers, and dialogs: `Escape` closes, `aria-expanded` / `aria-controls` on the toggle, focus is not trapped in invisible content (`aria-hidden` when closed).
- In-page links scroll to an element with `scroll-mt-*` so the sticky nav does not cover the heading.

## Targets, labels, and meaning

- Interactive hit area is **at least 44×44 CSS pixels** (WCAG 2.5.5 / 2.5.8). Icon-only controls get a visible label or `aria-label`.
- Every input has a **visible** `<label>` (or an associated `aria-label` when the label is the surrounding control, e.g. a labeled card). Placeholder is not a label.
- Errors use `role="alert"` (or `aria-live="polite"`) and are not color-only.
- Do not convey state with color alone. Selected RSVP / tabs need text, `aria-pressed`, or `aria-selected`.
- Images that inform have `alt`. Decorative images use `alt=""`.
- External `http(s)` links that open a new browsing context use `rel="noopener noreferrer"`.

## Motion, overflow, and contrast

- Honor `prefers-reduced-motion`: no smooth scroll, no required animation.
- `html` / `body` do not create a horizontal page scroll. Media is `max-width: 100%`.
- Body text vs background ≥ **4.5:1**. UI chrome and large type ≥ **3:1**. Guest-site presets that fail do not ship (`bodyContrastOk`).
- Custom event-site colors stay subject to the same contrast check as presets.

## Forms and guest flows

- Required fields are marked in the label, not only with a star in the placeholder.
- Disable a submit control only when the missing value is obvious; still announce the reason when submit fails.
- Token gates (invite email / code) and RSVP extras follow the same label and error rules as the rest of the app.

## When you change UI

1. Narrow viewport (~320–390px) and a desktop width.
2. Keyboard only: skip link, tab order, menu open/close, form submit.
3. Related routes that read the same state.

Do not treat a single desktop screenshot as verification.
