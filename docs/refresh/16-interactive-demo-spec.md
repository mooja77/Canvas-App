# 16. InteractiveDemo data specification

← [Plan index](README.md)

The above-fold interactive coding micro-demo. Highest-leverage component on the site; deserves a real spec.

## Sample transcript (synthetic, public-domain, ~140 words)

> _Maya, 27, on returning to graduate school after caregiving._
>
> "Coming back to school felt like reaching for a self I'd put somewhere I couldn't quite find. The first week, I sat in seminar and listened to people use words I used to use, and I thought: I'm going to have to learn this language again. But it wasn't the language — the language was easy. It was that I'd been someone else for three years. Someone who got up at four in the morning to give my mother her medications. Someone who knew the difference between a hospice nurse who actually showed up and one who said she would. I don't know what to do with that knowing now. It doesn't fit on a CV. It doesn't fit in a methods section. I came back because I wanted my brain back. But my brain came back different."

## Suggested codes (six total — three shown on first highlight, three on exploration)

| Code                                  | Suggested when user highlights spans about… |
| ------------------------------------- | ------------------------------------------- |
| `identity-as-resistance`              | reclaiming a previous self                  |
| `caregiving`                          | caregiving work                             |
| `transition / return`                 | coming back from a break                    |
| `embodied knowledge`                  | knowing things from doing them              |
| `professional vs. personal knowledge` | the CV / methods-section line               |
| `interrupted self`                    | being someone else for three years          |

Each code has: a friendly label, a unique color (sampled from a 6-step palette derived from ochre + ink), a one-line description that appears on hover.

## Interaction sequence

1. Page loads. Transcript visible in `<blockquote>` with `aria-label="Sample interview transcript for interactive demo"`. Codebook on right is empty: `<aside aria-label="Demo codebook" aria-live="polite">`.
2. User mouses over span → span gets a light underline (visual affordance).
3. User clicks-and-drags or shift-arrows to select a span. Selection persists.
4. A floating widget appears below the selection, `role="dialog"` with focus trap:
   - 3 suggested code chips (most relevant first).
   - `+ Create a new code…` link.
   - Escape closes the widget.
5. User clicks (or Tab-Enters) a chip → chip slides into the codebook on the right. Span gets a colored highlight matching the code. Live region announces `Code applied: [code name]`.
6. Codebook now has 1 entry. User can click the entry to scroll back to its span.
7. Repeated selection adds more codes. Codes can be applied to multiple spans.
8. After 3+ codes, a discreet `See how this becomes a theme →` CTA appears below the demo, linking to `/methodology/thematic-analysis`.

## Persistence

State persists in IndexedDB key `qualcanvas-demo-state` via `idb-keyval` or native IDB. A small "Reset demo" link in the demo footer clears it. State expires automatically after 30 days. State migration is _not_ required across versions — if the schema changes, reset.

## Bundle constraints

- Demo + IDB code < 25KB uncompressed (lazy-loaded after main bundle).
- No animation library; native CSS only.
- Renders without JS as a static blockquote + screenshot (graceful degradation).

## Accessibility specifics

- Selection achievable by mouse, touch, _and_ keyboard. Keyboard selection: Tab to transcript, arrow keys move a virtual caret, Shift+arrow extends selection. (This is the hardest part of the spec; budget time.)
- Code chips are `<button>` elements with `aria-pressed` state when applied.
- Code application announced via `aria-live="polite"` region.
- Demo container has a visible-on-focus skip-link: `Skip interactive demo`.

## Mobile variant

See [06-pages/17-mobile-design.md](06-pages/17-mobile-design.md). Desktop drag-selection becomes native touch selection (`window.getSelection()` after `touchend`); the floating widget becomes a bottom sheet.
