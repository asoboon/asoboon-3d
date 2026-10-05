# BOON BLOCK — JUNGLE QUEST / IP & Provenance

## Purpose

This file records the current provenance policy for the 5×5 child-friendly BOON BLOCK build.

It is a development and release-audit record, not legal advice and not a guarantee of non-infringement.

## Current puzzle structure

- Board: 5×5
- Total cells: 25
- Movable CORE / GEM: 1 cell
- Five mixed-size blocks:
  - A: 4 cells
  - B: 4 cells
  - C: 5 cells
  - D: 5 cells
  - E: 6 cells
- Total: 1 + 4 + 4 + 5 + 5 + 6 = 25
- Rotation and reflection are allowed
- GEM starts at the exact center cell but may be moved

This is intentionally **not** the classic twelve-pentomino set and is not a complete tetromino, pentomino, or hexomino family.

## Piece-set provenance

The production piece set is the project-selected mixed-size coordinate set written directly in:

`boon-block-next/generate_solutions.cpp`

The game does not import or reproduce a commercial product's complete piece family, answer sheet, classification, package art, UI, or solution database.

Individual polyomino shapes and tiling concepts are mathematical/geometric building blocks. BOON BLOCK's release identity should rely on its own **selection and arrangement of pieces, interaction design, presentation, artwork, wording, animation, sound, branding, and hint experience**, rather than claiming exclusivity over abstract geometric shapes.

## Independent solution generation

`boon-block-next/solutions.js` is generated locally in CI from only:

- the 5×5 board dimensions
- the six project coordinate definitions
- legal rotation/reflection transforms
- exact non-overlapping coverage of all 25 cells

No third-party answer table, commercial puzzle PDF, screenshot set, published solution database, or external solver output is used as runtime source data.

The CI build verifies:

- 192 complete playable solutions
- 40 solutions with GEM left in its starting center cell
- generated JavaScript syntax
- a SHA-256 fingerprint of the generated solution database

## Difficulty intent

This version is deliberately easier for children than the earlier 8×8 prototype:

- 5×5 instead of 8×8
- 6 total pieces instead of 11 or 13
- only five main blocks to reason about
- GEM occupies the exact center at start
- 40 valid routes work without moving the starting GEM
- 192 total routes are available when GEM is moved
- staged hints are computed from the complete generated solution database

## Original world / presentation direction

The release presentation is an original **tropical jungle adventure + ancient playful ruins + toy-like treasure hunt** world.

It may use broad genre ideas such as:

- bright tropical vegetation
- warm stone ruins
- treasure / gem motifs
- slapstick adventure energy
- chunky toy-like shapes
- saturated child-friendly colors

It must not copy protected expression from another game franchise.

Do not reproduce or closely imitate third-party:

- characters or character silhouettes
- masks, crates, barrels, fruit, vehicles, enemies, or collectibles that are distinctive to a named franchise
- logos or title treatments
- level layouts
- package/key art
- UI screens
- proprietary symbols
- dialogue/copy
- music, sound effects, voice clips
- screenshots
- distinctive combinations of trade dress

The current CSS-based leaves, stone-board framing, BOON gem, colors, block names, hint language, and treasure-clear treatment are project-authored for BOON BLOCK.

## Hint language

Current hint semantics:

- cyan: a placed block can remain where it is in at least one complete solution
- yellow: recommended next block / current focus
- red-orange: a placed block should be reconsidered
- translucent cells: a concrete candidate placement

Hints are computed against BOON BLOCK's independently generated 192-solution database.

## Release checklist

Before commercial release:

1. Regenerate `solutions.js` from `generate_solutions.cpp`.
2. Verify 192 total solutions and 40 center-GEM solutions.
3. Verify the SHA-256 record.
4. Confirm no third-party answer data is bundled.
5. Confirm no third-party franchise art, characters, logos, text, music, SFX, screenshots, or distinctive props are bundled.
6. Review BOON BLOCK / ブーンブロック and any subtitle/logo separately for trademark availability.
7. Review fonts, audio, icons, purchased assets, and libraries for their own license terms.
8. Preserve this provenance record with the release source.
