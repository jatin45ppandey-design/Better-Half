# PlaySpace — Phase 2 Prototype Rule Decisions & Gameplay Assumptions

This document establishes the provisional frontend prototype rules, gameplay mechanics, and unresolved design decisions for PlaySpace Phase 2. As specified in the architecture guidelines, these rules are implemented locally in frontend state and isolated from the user interface so they can be refined or replaced during Phase 3 with backend authority.

---

## 1. Original UNO-style Card Game

### Provisional Prototype Mechanics
1. **Deck Generation**:
   - Standard 4 colors (Lavender/Violet, Rose/Pink, Cyan, Amber).
   - Number cards `0` to `9` for each color.
   - Action cards: `Skip` (next player loses their turn), `Reverse` (reverses play direction or acts as Skip in 2-player Couple Mode), and `Draw Two` (+2 cards added to target hand).
   - Special Wilds: `Wild Card` (player picks next active color) and `Wild Draw Four` (+4 cards to target player and color choice).
2. **Initial Distribution**:
   - Each player is dealt **7 cards** at the start of the match.
   - Initial discard card is flipped from the deck. If the first card is an action card, its effect is ignored for round start.
3. **Turn Actions**:
   - A card is legal to play if its **color** or **value/symbol** matches the top discard card, or if it is a **Wild card**.
   - If a player has no legal moves, they can click the Draw Pile to draw **1 card**.
   - If the drawn card is playable, the prototype allows the player to play it immediately or hold it.
4. **Win Condition**:
   - The first player to reduce their hand to **0 cards** wins the round.
   - When a player holds exactly **1 card**, an animated "Last Card!" warning indicator is displayed.

### Unresolved Design Decisions Requiring Future Decision
- **Draw Card Stacking**: Can a player counter a `+2` with another `+2` to pass cumulative draw penalties (`+4`, `+6`) to the next player, or must penalties be resolved immediately? (Current default: Immediate resolution).
- **Wild Draw Four Legality / Challenge**: Can a player play a `Wild Draw Four` if they possess a matching color card in hand, and should a challenge bluffing mechanic be implemented? (Current default: Freely playable).
- **Exhausted Draw Pile Behavior**: When the draw pile runs out, should the discard pile (excluding the top card) be reshuffled immediately, or should the match end in a draw? (Current default: Automatic discard reshuffle).

---

## 2. Pen Fight

### Provisional Prototype Mechanics
1. **Physics Model**:
   - 2D canvas simulation running on `requestAnimationFrame`.
   - Linear drag/friction factor (`FRICTION = 0.96`), with minimum resting velocity threshold (`0.15 px/frame`).
   - Pen geometry: Elliptical/pill bounding box with position `(x, y)`, angle `θ`, and velocity vector `(vx, vy)`.
2. **Launch & Aim Controls**:
   - Slingshot pull-back drag or manual power/rotation sliders.
   - Maximum flick velocity capped to prevent glitch tunneling.
3. **Collision & Ring-Out**:
   - Elastic collision response between pens exchanging linear momentum along collision normals (restitution coefficient = 0.9).
   - Table arena boundaries: if a pen's center coordinates cross outside the arena boundary padding, the pen falls off the table (`isAlive = false`).
4. **Round & Match Scoring**:
   - Last surviving pen on the table wins the round.
   - First player to win **3 rounds** takes the match.

### Unresolved Design Decisions Requiring Future Decision
- **Spin / Angular Momentum**: Should pen rotation introduce gyroscopic stabilization or curved trajectories? (Current default: Pure linear velocity with velocity-aligned rendering).
- **Pen Customization Stats**: Should different pen styles have varying mass, grip friction, or nib sharpness? (Current default: Uniform mass and friction for fair competitive play).
- **Turn Timers**: Strict shot clock vs relaxed party pacing. (Current default: Relaxed turn-based).

---

## 3. Kabza: Territory Conquest

### Provisional Prototype Mechanics
1. **Board Geometry**:
   - 6×6 grid containing **36 territory sectors**.
2. **Claiming**:
   - Active player selects any unclaimed cell to establish an outpost.
3. **Enclosure / Flanking Capture Rule**:
   - When an outpost is placed, adjacent orthogonal enemy cells are evaluated.
   - If an enemy sector is surrounded on **2 or more orthogonal sides** by the active player's territory, it gets captured ("KABZA!") and flips ownership.
4. **Victory Condition**:
   - When all 36 sectors are claimed, the player controlling the highest percentage of the board wins.

### Unresolved Design Decisions Requiring Future Decision
- **Grid Layout Variations**: Should Diamond or Hexagonal grid maps be introduced alongside the rectangular 6×6 grid? (Current default: Standard 6×6).
- **Diagonal Flanking**: Should diagonal connections count toward enclosure, or strictly orthogonal cardinal directions? (Current default: Strictly orthogonal).
- **Fortified Bastions**: Should double-captured cells become permanently locked against counter-captures? (Current default: Cells remain re-capturable).

---

## 4. Basketball Rivalry

### Provisional Prototype Mechanics
1. **Shooting Arc Calculation**:
   - Trajectory calculated using projectile equations:
     $$x(t) = x_0 + v_x \cdot t$$
     $$y(t) = y_0 + v_y \cdot t + \frac{1}{2} g \cdot t^2$$
   - Angle range: $35^\circ$ to $75^\circ$. Power range: $40\%$ to $95\%$. Gravity constant: $g = 0.42$.
2. **Scoring Breakdown**:
   - **Swish (+3 pts)**: Ball enters hoop rim center within sweet spot tolerance ($\pm 18\text{px}$) while moving downward ($v_y > 0$).
   - **Bank Shot (+2 pts)**: Ball deflects off backboard/rim into the net.
   - **Missed Shot (0 pts)**: Ball misses rim or bounces away.
   - **Fire Streak Bonus (+1 pt)**: Making 2 or more consecutive baskets activates "On Fire" streak multiplier.
3. **Format**:
   - Each player takes **5 shots** rotated per turn. Highest total score wins.

### Unresolved Design Decisions Requiring Future Decision
- **Wind / Defense Modifiers**: Should outdoor wind gusts or moving shot blockers be added in higher difficulties? (Current default: Clean indoor arcade physics).
- **Tie-Breaker Shootout**: Sudden death one-shot showdown vs shared victory. (Current default: Highest score wins).

---

## 5. Snatch The Fries

### Provisional Prototype Mechanics
1. **Drop Loop & Timing**:
   - Random delay between drops: $1.4\text{s}$ to $4.0\text{s}$.
   - 4 Fry varieties:
     - **Crispy Golden Fry**: $+100\text{ pts}$ (Common).
     - **Legendary 24K Fry**: $+250\text{ pts}$ (Rare, 18% spawn).
     - **Spicy Peri-Peri Fry**: $+150\text{ pts}$ (Uncommon, 20% spawn).
     - **Soggy Mystery Fry (Trap!)**: $-120\text{ pts}$ if snatched! (14% spawn).
2. **Input & Reaction Detection**:
   - Dedicated on-screen snatch buttons and keyboard hotkeys (`Q`, `P`, `Z`, `M`).
   - Reaction timestamp recorded down to the millisecond (`Date.now() - dropTimestamp`).
3. **False Start Penalties**:
   - Tapping or pressing snatch before a fry drops inflicts a **$-50\text{ pts}$ penalty** and resets the drop schedule.
4. **Single-Collection Invariant**:
   - Once a fry is snatched by the fastest player, its state immediately transitions to `SNATCHED`, preventing double-scoring.

### Unresolved Design Decisions Requiring Future Decision
- **Latency Compensation in Real Multiplayer**: When transitioning to WebSockets in Phase 3, server-authoritative timestamps with client ping offsets must be evaluated to ensure network fairness. (Current default: Local browser event loop).
- **Combo Multipliers**: Consecutive snatches granting increasing multipliers. (Current default: Fixed point values).

---

## 6. Aloo Golf

### Provisional Prototype Mechanics
1. **Course Progression**:
   - 3 distinct 2D mini-golf holes:
     - *Hole 1*: "The Spud Meadow" (Par 3).
     - *Hole 2*: "Butter Slip Bunker" (Par 3, features friction-free butter slicks and sand hazards).
     - *Hole 3*: "Peri-Peri Volcano" (Par 4, features spicy bumper obstacles).
2. **Potato Physics & Wobble**:
   - Eccentric potato shape with rolling rotation based on velocity.
   - Hazards dynamically alter surface friction:
     - Fairway: $\mu = 0.965$
     - Sand Trap: $\mu = 0.88$ (heavy deceleration)
     - Butter Patch: $\mu = 0.99$ (hyper-slick acceleration)
3. **Scoring**:
   - Traditional golf scoring: lowest aggregate stroke count across all 3 holes wins the match.

### Unresolved Design Decisions Requiring Future Decision
- **Maximum Stroke Limit**: Should a hole automatically concede at Double Par (e.g. 6 strokes on Par 3) to prevent stalling? (Current default: Unlimited strokes until sunk).
- **Elevation / Slope Gradients**: 2D slope contour vectors vs flat obstacle courses. (Current default: Flat course with hazards and solid bumpers).

---

## 7. Blind Ranking Scoring

### Provisional Prototype Mechanics
1. **Position Locking**:
   - 5 ranking slots from `#1 (Best)` to `#5 (Worst)`.
   - Items revealed sequentially. Once a player locks an item into a slot, that slot is permanently consumed for the remainder of the round.
2. **Comparison & Scoring Model**:
   - Players compare final ranking boards at round completion.
   - Alignment Score: $+10\text{ pts}$ for each slot where both players matched identical items, $+5\text{ pts}$ for adjacent slots ($\pm 1$), and $0\text{ pts}$ for large disagreements.
   - Perfect Alignment Bonus: $+50\text{ bonus pts}$ for 100% synchronized taste.

### Unresolved Design Decisions Requiring Future Decision
- **Global Consensus Benchmark**: Should rankings score against the other player's board, or against a global crowdsourced community consensus? (Current default: Inter-player alignment in Couple Mode; round consensus in Friend Mode).
- **Rerolls / Swap Cards**: Should players receive one emergency "Swap" power-up per game? (Current default: Strict sequential blind lock).

---

## 8. Summary of Mode Constraints Followed

- **Couple Mode (Strictly 2 Players)**:
  - Exclusive access to: *Truth or Dare*, *Would You Rather*, and *BETWEEN US*.
  - Shared access to: *Blind Ranking*, *Original UNO-style Card Game*, *Tic Tac Toe*, *Pen Fight*, *Kabza*, *Basketball Rivalry*, *Snatch the Fries*, and *Aloo Golf*.
- **Friend Mode (Up to 4 Players)**:
  - *Truth or Dare*, *Would You Rather*, and *BETWEEN US* are strictly hidden and blocked from selection.
  - Tic Tac Toe enforces 2 active duelists on the 3×3 board, placing remaining participants in a spectator/queue rotation.
- **Privacy & Safety Invariants**:
  - *BETWEEN US* Level 5 (After Dark 18+) requires explicit dual adult consent.
  - Sensitive pass-and-play questions and private answers reside purely in temporary in-memory React state; nothing sensitive is saved to persistent browser storage.
