# PlaySpace Phase 3 — Game Rules & Server Mechanics Reference

This document provides complete documentation of the gameplay rules, state transitions, scoring logic, and validation constraints implemented across all 11 games.

---

## Game Allowlist & Mode Matrix

| # | Game ID | Game Name | Modes | Players | Max Capacity |
|---|---|---|---|---|---|
| 1 | `truth-or-dare` | Truth or Dare | Couple | Exactly 2 | 2 |
| 2 | `would-you-rather` | Would You Rather | Couple | Exactly 2 | 2 |
| 3 | `blind-ranking` | Blind Ranking | Couple & Friend | 2–4 | 4 |
| 4 | `original-card-game` | Original Card Game | Couple & Friend | 2–4 | 4 |
| 5 | `tic-tac-toe` | Tic Tac Toe | Couple & Friend | 2–4 (2 active) | 4 |
| 6 | `pen-fight` | Pen Fight | Couple & Friend | 2–4 | 4 |
| 7 | `kabza` | Kabza | Couple & Friend | 2–4 | 4 |
| 8 | `basketball-rivalry` | Basketball Rivalry | Couple & Friend | 2–4 | 4 |
| 9 | `snatch-the-fries` | Snatch the Fries | Couple & Friend | 2–4 | 4 |
| 10 | `aloo-golf` | Aloo Golf | Couple & Friend | 2–4 | 4 |
| 11 | `between-us` | BETWEEN US | Couple | Exactly 2 | 2 |

---

## 1. Truth or Dare (`truth-or-dare`)
- **Mode**: Couple Mode only (2 players).
- **Core Loop**:
  1. Active player selects Category (`romantic`, `playful`, `deep`, `spicy`) and Type (`TRUTH` or `DARE`).
  2. Server draws a prompt from canonical question bank matching criteria.
  3. Active player either completes the prompt or skips.
  4. Skip limit: Maximum 2 skips per player per match. Exceeding limit blocks skip action.
  5. Completion awards +10 points. Turn alternates to partner.

---

## 2. Would You Rather (`would-you-rather`)
- **Mode**: Couple Mode only (2 players).
- **Core Loop**:
  1. Server delivers a dilemma with Option A and Option B.
  2. Simultaneous Private Submission: Each partner selects their choice (`SUBMIT_CHOICE`).
  3. Ephemeral Buffer: Selections are held in private state (`privateStates[userId].pendingChoice`) and masked from the public state until both players have submitted.
  4. Simultaneous Reveal: Once both choices arrive, server transitions to `REVEAL` phase.
  5. Match Bonus: Matching choices award +10 agreement points. Match concludes after 10 rounds.

---

## 3. Blind Ranking (`blind-ranking`)
- **Mode**: Couple Mode & Friend Mode (2–4 players).
- **Core Loop**:
  1. 5 items from a category are presented sequentially one-by-one.
  2. Player must place current item into an empty ranking slot (1 to 5).
  3. Irreversible Lock: Placed slots cannot be changed or swapped.
  4. Scoring:
     - Couple Mode: Alignment bonus based on absolute index difference (|rankA - rankB|). Exact match = +10, adjacent difference of 1 = +5, perfect board = +50.
     - Friend Mode: Consensus alignment comparing player ranking against group median rank.

---

## 4. Original Card Game (`original-card-game`)
- **Mode**: Couple Mode & Friend Mode (2–4 players).
- **Deck Composition (60 cards)**:
  - 4 colors: `red`, `blue`, `green`, `yellow`.
  - Number cards (0–9) for each color.
  - Action cards: `skip`, `reverse`, `draw2` (2 of each color).
  - Wild cards: `wild` (4 cards), `draw4` (4 cards).
- **Mechanics**:
  - Initial deal: 7 cards per player, kept in strictly isolated private state.
  - Matching rules: Play card matching current color, number, or action symbol. Wild cards can be played on any card.
  - Reverse rule: In 2-player Couple Mode, Reverse acts identically to Skip. In 3–4 player Friend Mode, Reverse reverses turn order.
  - Draw cards: `draw2` forces next player to draw 2 and forfeit turn; `draw4` forces next player to draw 4 and forfeit turn.
  - Win condition: First player to empty their hand (hand.length === 0) wins.

---

## 5. Tic Tac Toe (`tic-tac-toe`)
- **Mode**: Couple Mode & Friend Mode (2–4 players).
- **Mechanics**:
  - 3x3 board (9 cells: 0 to 8).
  - Turn alternation: 'X' moves first, then 'O'.
  - Occupied cell rejection: Moves on non-empty cells are rejected.
  - Win detection: 8 winning combinations (3 rows, 3 columns, 2 diagonals).
  - Match formats: Best-of-1, Best-of-3, or Best-of-5.
  - Friend Mode Queue: When room has 3 or 4 players, 2 active duelists play while remaining players spectate in a FIFO waiting queue. Loser rotates out.

---

## 6. Pen Fight (`pen-fight`)
- **Mode**: Couple Mode & Friend Mode (2–4 players).
- **Physics Simulation Engine**:
  - Notebook Desk Arena: 800x500 rectangular desk with 20px padding boundary.
  - Turn-based launch: Active player specifies aim angle and flick impulse power (max impulse 35.0).
  - Friction: Exponential velocity decay with 0.96 drag factor per tick until rest threshold (<0.15).
  - Desk Fall Elimination: If a pen's center exceeds desk boundaries, the pen is eliminated for the round (`isAlive = false`).
  - Elastic Collisions: Mass and momentum conservation between pens upon collision.
  - Round Win: Last remaining pen on desk wins round. Match played to 3 round wins.

---

## 7. Kabza (`kabza`)
- **Mode**: Couple Mode & Friend Mode (2–4 players).
- **Mechanics**:
  - 6x6 grid board (36 cells).
  - Turn-based claim: Active player claims an unoccupied cell.
  - Orthogonal Enclosure Capture: When a newly claimed cell causes an adjacent opponent's cell to be surrounded by 2 or more friendly cells orthogonally (North, South, East, West), the opponent's cell is captured and flips ownership.
  - Recapture: Captured cells can be recaptured in subsequent turns.
  - End of game: When all 36 cells are claimed, player with highest cell count wins.

---

## 8. Basketball Rivalry (`basketball-rivalry`)
- **Mode**: Couple Mode & Friend Mode (2–4 players).
- **Trajectory & Scoring Engine**:
  - Hoop coordinate: X = 710, Y = 210.
  - Parabolic trajectory simulation with gravity 0.42.
  - Swish (+3 points): Ball passes cleanly through basket opening (horizontal delta < 8px, vertical delta < 18px).
  - Bank Shot (+2 points): Ball deflects off backboard/rim into hoop.
  - Miss (0 points): Ball strikes floor or airballs out of bounds.
  - On-Fire Streak: 2 consecutive made shots trigger +1 bonus point on all subsequent makes until a miss.
  - 5 shot attempts per player. Highest total points wins.

---

## 9. Snatch the Fries (`snatch-the-fries`)
- **Mode**: Couple Mode & Friend Mode (2–4 players).
- **Reaction Engine**:
  - 5 drop rounds.
  - Fry distribution: Regular (48%, +100 pts), Spicy (20%, +150 pts), Golden (18%, +250 pts), Soggy Trap (14%, -100 pts).
  - False Start Detection: Tapping during `WAITING` phase (before fry drops) incurs a 50-point penalty.
  - Atomic First-Tap Snatch: Server registers the earliest timestamped snatch, awards points, records reaction time (ms), and locks out subsequent taps.
  - Highest score after 5 drops wins.

---

## 10. Aloo Golf (`aloo-golf`)
- **Mode**: Couple Mode & Friend Mode (2–4 players).
- **Mechanics**:
  - 3 unique course holes with obstacles (ponds, butter slicks, sand traps).
  - Surface friction: Fairway (0.965), Sand Trap (0.88), Butter Slick (0.99).
  - Launch velocity: Calculated from aim vector angle and power.
  - Obstacle bounce: Deterministic deflection off stone obstacles.
  - Cup Sink: Ball falls into cup when distance to cup < 16px and velocity < 3.5.
  - Low score wins: Player with lowest total strokes across all 3 holes wins.

---

## 11. BETWEEN US (`between-us`)
- **Mode**: Couple Mode only (2 players).
- **Core Loop**:
  - 5 intimacy levels (Level 1: Icebreakers to Level 5: After Dark 18+).
  - Dual Mutual Adult Consent: Level 5 is strictly locked until both partners independently submit mutual adult consent (`SUBMIT_CONSENT`).
  - Private text answering: Answers are typed into client and held in volatile server RAM buffer.
  - Reveal: Both players reveal answers simultaneously.
  - Memory Wipe: Ephemeral text buffers are wiped immediately upon reveal. Zero database persistence.

