# BOON BLOCK NEXT — Design & IP Provenance

## Goal

BOON BLOCK NEXT keeps the project's interaction system while replacing the previous classic 12-pentomino piece set with a new project-selected puzzle set designed to be easier to read and easier to solve.

This document is a provenance record for development and release review. It is not legal advice and does not guarantee non-infringement.

## Puzzle structure

- Board: 8×8
- Movable CORE: 2×2, 4 cells
- Main blocks: 10 connected six-cell pieces
- Total occupied cells: 4 + (10 × 6) = 64
- Rotation and reflection are allowed
- CORE starts in the center but may be moved
- Every full-board solution is generated directly from the coordinate definitions in `generate_solutions.cpp`

## Why this is different from the earlier prototype

The earlier prototype used the familiar 12 free pentominoes.

BOON BLOCK NEXT does not use that 12-piece set. It uses ten six-cell silhouettes selected specifically for this project and a separate 2×2 CORE.

The project does not claim ownership of the abstract mathematical idea of polyominoes, six-cell polyomino shapes, exact-cover search, rotations, reflections, or tiling a rectangle.

The project claims only its own implementation, selection/arrangement, UI, presentation, hint system, artwork, wording, animation, and other original product expression to the extent protected by applicable law.

## Independent solution generation

`solutions.js` is generated from:

`boon-block-next/generate_solutions.cpp`

The generator starts only from:

- the 8×8 board dimensions
- the ten project-defined six-cell coordinate sets
- the 2×2 CORE coordinate set
- the rule that pieces may rotate and reflect
- the rule that all 64 cells must be covered exactly once

It does not import or parse a published solution table, commercial answer sheet, third-party PDF, screenshot, puzzle diagram collection, or third-party solver output.

The build currently verifies:

- total complete solutions: 1,832
- solutions with CORE at the starting center position: 192
- generated JavaScript syntax
- generated database SHA-256

## Difficulty intent

The set was selected to reduce friction compared with the earlier prototype:

- 11 total pieces instead of 13
- large six-cell silhouettes
- fewer tiny visual distinctions
- 192 valid completions already exist with CORE left at its starting center position
- 1,832 valid completions exist when CORE is allowed to move
- the hint engine works from the complete generated solution database

The exact counts are implementation verification values for this particular BOON BLOCK NEXT set.

## Presentation rules

Do not reproduce third-party:

- product names or logos
- package artwork
- answer-sheet layouts
- proprietary classifications
- explanatory copy
- screenshots or promotional art
- distinctive commercial color layouts
- source code without a separate license review

BOON BLOCK NEXT should continue to use its own:

- color system
- movable CORE presentation
- touch interactions
- WAIT behavior
- staged hint system
- animations
- typography and labels
- sounds and visual effects

## Hint language

Current BOON BLOCK NEXT hint semantics:

- cyan: this placed block can remain where it is in at least one complete solution
- yellow: recommended next block / current focus
- red-orange: a placed block that must be reconsidered to recover a solution route
- translucent cells: a concrete candidate placement

The hint system derives these states from BOON BLOCK NEXT's independently generated 1,832-solution database.

## Release checklist

Before promoting BOON BLOCK NEXT over the existing prototype:

1. Regenerate `solutions.js` from `generate_solutions.cpp`.
2. Verify 1,832 total solutions and 192 center-CORE solutions.
3. Verify the SHA-256 record.
4. Confirm no third-party answer data is bundled.
5. Confirm no third-party brand artwork/copy is bundled.
6. Review game name/logo availability separately for trademark risk.
7. Review fonts, audio, icons, purchased assets, and external libraries for their own licenses.
8. Preserve this provenance record with the release source.
