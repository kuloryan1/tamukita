# Taman Abadi envelope: reference motion preview

The opening retains the cover and video linked by
[The Sacred Garden](https://webgencyinvitations.com/thesacredgarden).
A tracked wax-face layer now replaces the visible monogram with NR in the demo.
The previous independent paper masks and flap transforms no longer drive the intro.

## Media and timing

- Cover: `public/templates/taman-abadi-envelope-cover.png`, 941 × 1672.
- Video: `public/templates/taman-abadi-envelope-opening.mp4`, 720 × 1280, 4.8 seconds.
- The cover fades for 1.4 seconds; the playing video fades in for 0.8 seconds.
- The invitation reveal starts at `duration - 0.8`, with a 1.4-second exit transition.
- Playback starts from the opening button. The cover stays visible until playback begins.
- The source files still contain their original R&Z. The rendered cover and playback
  cover those letters with cleaned wax and a configurable vector monogram.
- The demo draft explicitly sets `sealMonogram` to NR. Other invitations use the
  saved dashboard setting, or derive initials from host names when that setting is empty.

The unchanged source media, repository assets, and active preview copies have matching SHA-256 hashes:

| Media | Source URL | SHA-256 |
| --- | --- | --- |
| Cover | https://assets.webgencyinvitations.com/ChatGPT_Image_Jun_23_2026_04_40_29_PM_4_piptqn%20(2).png | `553d36f2b469e47719a757195e69656606daaa0f7fe8987220efab57c28a75de` |
| Video | https://assets.webgencyinvitations.com/1782224012851_1_m6ww6v.mp4 | `fe93b14e7ca51110e6803f81c6017d1c01fab5084c3bf0e3ba75253f0513a72b` |

## Local verification

- Browser: desktop and 390 × 844 viewport; real mobile hardware was not tested.
- Before tapping: video paused, duration 4.8, ready state 4.
- Full opening: video plays, cover fades, invitation appears, heading receives focus,
  and document scrolling unlocks. Phone document width equals scroll width.
- `Buka langsung` and `Lewati animasi` during playback both reach the invitation.
- Intentionally blocked MP4: clicking open still reaches the invitation, with no inert
  elements or leftover scroll lock. Network overrides were removed afterward.
- No console errors during normal playback/skip checks; the blocked-media request
  intentionally produced a network failure in the separate fallback test.
- Typecheck, targeted Biome lint, template registry test, and diff whitespace checks pass.

Evidence: `output/playwright/taman-abadi-reference-video-*-2026-10-28.jpg`.
The active local preview is `http://127.0.0.1:3001/templates/taman-abadi/demo`.
This verification does not establish deployment or production readiness.

## Dashboard monogram setting

- In Taman Abadi's editor, open **Acara → Huruf pada segel amplop** after the host
  names. The input accepts 1–3 A–Z letters, automatically capitalizes, and shows a
  live seal badge. Empty input follows the host-name initials.
- `sealMonogram` is an optional app-owned JSON draft field, like the existing
  appearance options. Old snapshots default to an empty string. API parsing,
  autosave, published snapshots, and the public renderer preserve the setting.
  No database migration or template manifest/version change is required; existing
  licenses remain attached to template version 1.1.0.
- Already-published drafts show **Terbitkan perubahan**, with a clarification that
  an active license is not charged again for content edits. Unlicensed template
  changes still follow the existing server billing decision.
- Local customer QA created a separate invitation:
  `9378ef3f-d0a9-4b05-8fa3-2bea204562cf`, slug
  `qa-monogram-dashboard-9378ef3f`. Existing invitations were not edited.
- Browser checks passed: lowercase `ab` becomes AB; AB survives reload; empty input
  shows ND for Nara/Dimas; restoring NR saves successfully and survives reload.
- Publication checks passed through the normal editor flow with a narrowly scoped
  local QA license (Rp0). AB appeared in both public envelope layers. Saving NR
  left the published AB snapshot unchanged until republishing; then both public
  layers showed NR. Read-only DB proof confirmed draft NR, published NR, one local
  QA license, and zero orders. No payment provider or email was used.
- Desktop and 390 × 844 browser viewport checks passed. The phone field and badge
  fit without horizontal document overflow. Real phone hardware remains untested.
- Typecheck, targeted Biome lint, and 19 tests across invitation-server, validation,
  template SDK, and template registry passed.

Evidence: [desktop dashboard](images/2026-10-28-dashboard-monogram-desktop.jpg)
and [phone viewport](images/2026-10-28-dashboard-monogram-mobile.jpg).
Additional local captures: `output/playwright/taman-abadi-dashboard-*-2026-10-28.jpg`.
Local editor: `http://127.0.0.1:3001/dashboard/invitations/9378ef3f-d0a9-4b05-8fa3-2bea204562cf/edit`.
These checks were performed locally; deployment is verified separately.

The complete UI release also passed repository-wide Biome lint (263 files),
typecheck, all 112 tests across 26 files, and an optimized Next.js production build
with webpack before being prepared for staging on 28 October 2026. This includes
the admin/dashboard refresh, five additional theme styles and their demos, and the
Taman Abadi intro. No database migrations were added.

## NR monogram rendering

- `src/components/garden-envelope-monogram.tsx` renders a cleaned wax face and native
  Great Vibes glyph outlines, then follows video presentation time through
  `requestVideoFrameCallback`, with an animation-frame fallback.
- `src/lib/garden-envelope-motion.json` contains transforms and lighting samples for
  all 144 frames. The affine fit to tracked source features has RMS below 1 pixel at
  the source 720 × 1280 resolution. This is a surface approximation, not a new video.
- `src/lib/garden-monogram-glyphs.json` derives A–Z outlines from the existing bundled
  `public/fonts/great-vibes-latin.woff2`. The existing font license remains in place.
- The consumed image is `public/templates/taman-abadi-seal-blank.webp` (224 × 220,
  16,842 bytes). It is a project-optimized crop of the built-in ImageGen edit saved
  as `output/imagegen/taman-abadi-blank-seal.png`.
- Source-analysis helper: `output/reference/track-envelope-seal.py`; calibration
  measurements: `output/reference/envelope-tracking-metrics.json`.

NR checks: resting cover, middle/late opening, desktop and 390 × 844 viewport,
full reveal, direct open, and skip during playback passed. No browser console errors
were recorded in these checks. After finishing/skipping, both monogram layers unmount
and document scrolling unlocks. Image evidence is in
`output/playwright/taman-abadi-nr-*-2026-10-28.jpg`.

ImageGen mode: built-in edit; opaque background. Input:
`public/templates/taman-abadi-envelope-cover.png`.

Final prompt:

```text
Use case: precise-object-edit. Edit target: the attached existing ivory floral wedding envelope photo. Primary request: REMOVE ONLY the complete gold R & Z monogram from the CENTER FACE of the burgundy wax seal, and reconstruct clean continuous dark burgundy wax where those letters were. This is an intermediate blank wax surface for a configurable NR monogram to be rendered by the website. Do not put any replacement letters or symbols in the image. Preserve the exact original seal position, scale, outer irregular wax contour, all circular raised rims, original burgundy color and subtle wax grain, concave center lighting and shadows. Preserve every part of the envelope, the paper grain, embossed botanical flowers, folded paper edges, framing and camera. Keep the portrait canvas and original composition. Only inpaint the gold letter strokes and their tiny shadows inside the innermost wax disk; nothing outside that central disk should change. No text anywhere on the seal, no initials, no ampersand.
```
