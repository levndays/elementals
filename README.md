## Game Design Document: ELEMENTALS

**Version:** 1.0 (Pre-Alpha)
**Primary Author:** LEVNDAYS
**Date:** 30.06.2025

### 1. Vision & High-Level Concept

**ELEMENTALS** is a fast-paced, single-player and team-based multiplayer First-Person Shooter (FPS) that redefines hero shooters by separating abilities from characters. Players are not heroes; they are agile warriors who craft their own unique combat styles by equipping powerful "Ability Cards" based on the four core elements: Fire, Water, Air, and Earth.

The gameplay loop is built on three pillars:
1.  **High-Skill Movement:** Mastering parkour-like mechanics such as dashing, double-jumping, and ground-slamming to navigate vertical, arena-style levels.
2.  **Strategic Build-Crafting:** Experimenting with the deep Ability Card system to create powerful mono-element "Masters" or synergistic dual-element "Adepts".
3.  **Tactical Combat:** Using your custom build to exploit enemy weaknesses and, in multiplayer, combining elemental abilities with teammates to create devastating "Resonance" effects or counter enemy attacks through "Discord".

### 2. Core Gameplay Loop

1.  **Equip (Menu):** The player customizes their 4-slot ability loadout in the main menu using their collection of Ability Cards.
2.  **Engage (Combat):** The player enters a level and utilizes their high-mobility controls and chosen abilities to combat AI enemies or other players.
3.  **Adapt (Tactics):** The player analyzes the challenges presented by the level and enemy types, learning which builds and strategies are most effective. In multiplayer, they adapt to the enemy team's composition in real-time.
4.  **Overcome (Victory):** The player defeats all enemies or achieves the match objective.
5.  **Refine (Progression):** The player earns new Ability Cards or resources to upgrade existing ones, returning to the Equip phase with new tactical possibilities.

### 3. Key Features

*   **Ability Card System:** A deep, flexible loadout system allowing for thousands of potential builds.
*   **Elemental Synergy System:** Unique passive bonuses are granted based on the combination of elemental abilities equipped, rewarding thoughtful build-crafting.
*   **High-Mobility Physics-Based Controller:** A responsive and fluid player controller with double-jumping, multi-directional dashing, and a ground slam.
*   **Reactive & Challenging AI:** Enemies that can traverse complex environments, dodge attacks, and use their own abilities to challenge the player.
*   **Elemental Interaction Engine (Multiplayer):**
    *   **Resonance (Co-op):** Allied abilities can be combined to create powerful, emergent secondary effects (e.g., Fire + Tornado = Firenado).
    *   **Discord (Competitive):** Abilities can directly and skillfully interact with and counter opposing elemental abilities (e.g., Water wave extinguishes Fireball).
*   **Integrated Level Editor:** A robust in-game tool for rapid prototyping and community content creation.

### 4. Player & Controls

The player is a highly agile combatant. The controls are designed to be responsive and intuitive, allowing for fluid movement and combat simultaneously.

*   **Movement:** WASD
*   **Look:** Mouse
*   **Jump / Double Jump:** Spacebar
*   **Dash:** Double-tap a movement key.
*   **Ground Slam:** Hold Left Shift in mid-air.
*   **Primary Weapon Attack:** Left Mouse Button.
*   **Cast Selected Ability:** Right Mouse Button.
*   **Select Ability (1-4):** 1, 2, 3, 4 Keys.
*   **Pause / Menu:** Escape.

*(See `src/game/entities/Player.js` for implementation details of speed, jump height, cooldowns, etc.)*

### 5. Core Mechanic: The Ability Card System

This system is the game's unique selling proposition. It is governed by a clear set of rules to promote strategic depth.

#### 5.1. Ability Cards

*   Abilities are represented as collectible "Cards" in the player's inventory.
*   Cards have defined properties: **Element** (Fire, Water, Air, Earth, or Utility), **Energy Cost**, **Cooldown**, and **Tier**.

#### 5.2. Build Rules & Synergy Bonuses

The player has 4 ability slots. The combination of cards in these slots determines the player's "Synergy."

1.  **Mono-Element (4 of a kind) - "The Master":**
    *   **Rule:** All 4 slots filled with cards of the same element.
    *   **Synergy Bonus:** **Elemental Mastery.** Energy costs for all abilities of that element are halved (50% reduction).

2.  **Dual-Element (2 + 2) - "The Adept":**
    *   **Rule:** 2 slots from one element, 2 from another.
    *   **Synergy Bonus:** **Elemental Fusion.** Unlocks a unique, subtle passive bonus based on the specific elemental combination, encouraging experimentation.

3.  **Tri-Element (3 + 1) - "The Specialist":**
    *   **Rule:** 3 slots from one main element, 1 "Utility" (non-elemental) card.
    *   **Synergy Bonus:** **Focused Power.** The 3 main elemental abilities have their cooldowns reduced by 15%.

4.  **Utility Builds:**
    *   **Rule:** Combinations involving 2 or 4 Utility cards.
    *   **Synergy Bonus:** Determined by the Utility cards themselves (e.g., having multiple "Clone" cards may enhance the ability's effect).

**Invalid Builds:** To enforce build identity, loadouts of `1+1+1+1` or `2+1+1` are not permitted. If an elemental card is equipped, at least one other card of the same element must also be equipped (unless it's part of a 3+1 Specialist build).

### 6. Combat Design

#### 6.1. Design Philosophy: The Ability Triad

Every ability in **ELEMENTALS** must be designed around three core principles to ensure balance, readability, and tactical depth.

1.  **Utility:** The ability's primary function and tactical purpose (e.g., damage, control, mobility, defense). What problem does it solve for the player?
2.  **Visual & Audio Cue (The "Tell"):** The ability must have a clear, unmistakable visual and audio signature. This is non-negotiable for ensuring counter-play is possible and the battlefield is readable.
3.  **Weakness & Counter-play:** Every ability must have an inherent trade-off or a clear method of being countered by a skillful opponent. This can be a long cast time, high energy cost, self-damage risk, positional vulnerability, or a direct elemental counter.

#### 6.2. Implemented Abilities (Examples)

*   **`Katana` (Primary Weapon):**
    *   **Utility:** Reliable, no-cost close-range damage.
    *   **Visual/Audio Cue:** A fluid top-down slash animation and "swoosh" sound.
    *   **Weakness:** Requires the player to be within melee range, exposing them to danger.
*   **`Fireball` (Fire Ability):**
    *   **Utility:** Ranged AoE damage and area denial via a lingering damage field.
    *   **Visual/Audio Cue:** A bright, glowing projectile that creates a large, fiery explosion on impact.
    *   **Weakness:** Relatively slow travel time, allowing it to be dodged. The player can be damaged by their own explosion field.
*   **`Fireflies` (Fire Ability):**
    *   **Utility:** Homing projectiles for dealing with mobile or distant targets.
    *   **Visual/Audio Cue:** A swarm of small, bright projectiles that leave trails as they seek their target.
    *   **Weakness:** High energy cost and long cooldown. Requires a locked-on target. Projectiles can be blocked by cover.
*   **`Underworld Strike` (Earth Ability):**
    *   **Utility:** A long-range gap-closer and high burst damage initiator, bypassing frontal defenses.
    *   **Visual/Audio Cue:** Target ground cracks and glows, followed by an explosive eruption of rock and the player model.
    *   **Weakness:** The "tell" on the ground provides a window for the target to evade. The caster is locked into the animation and ends up at high-risk close range.

### 7. Multiplayer Interaction Engine

For multiplayer modes, the core combat is enhanced by a system of elemental interactions.

#### 7.1. Guiding Principles
*   **Clarity:** Team-based effects must be clearly colored (e.g., Blue for friendly, Red for hostile).
*   **Interaction over Invalidation:** Counters should be active and skillful, not passive negations.
*   **States over Stats:** Interactions are based on visible, in-world states (e.g., **Burning**, **Drenched**, **Airborne**) rather than invisible stat modifiers.

#### 7.2. Resonance (Cooperative Combos)
When allied abilities interact, they create new, more powerful effects. This is achieved by applying a primary elemental **State** to a target, which a secondary ability can then consume to trigger the Resonance.
*   *Example:* A `Tornado` (Air) + `Fireball` (Fire) = `Firenado`.
*   *Example:* A **Drenched** target (Water) + `Flame Lash` (Fire) = `Steam Cloud`.

#### 7.3. Discord (Competitive Counters)
Hostile abilities can directly clash and cancel each other out, rewarding situational awareness and skillful timing.
*   *Example:* A `Tidal Wave` (Water) will extinguish a `Fireball` (Fire).
*   *Example:* A `Stone Wall` (Earth) will block and dissipate a `Tornado` (Air).
*   *Example:* A well-timed `Gale Burst` (Air) can deflect incoming projectiles.

### 8. Art Style & Visual Direction

The visual style should be clean, readable, and vibrant to support the fast-paced gameplay. While level geometry can be realistic or stylized, ability effects must be bold, clear, and heavily color-coded for immediate identification.

*   **Environments:** Architecturally complex, with an emphasis on verticality. Textures should be clean to not visually clutter the space where bright ability effects will be dominant.
*   **Character/Player:** The player model is minimal, serving as a clean first-person camera rig. In multiplayer, enemy models will be clearly silhouetted and team-colored.
*   **VFX:** The star of the show. Effects should feel powerful and impactful, using emissive materials, particles, and shaders to communicate their function and danger level.

### 9. Future Development & Roadmap

1.  **UI Implementation:** Build the "Ability Card" inventory and loadout screens.
2.  **System Solidification:** Finalize the in-game logic for the Synergy, Resonance, and Discord systems.
3.  **Content Expansion:**
    *   Create a base set of Tier 1 abilities for all four elements.
    *   Design and build levels that test and reward different elemental synergies and counters.
    *   Develop new enemy archetypes designed to counter specific player strategies.
4.  **Multiplayer Prototyping:** Implement a basic Team Deathmatch mode to begin testing and balancing the Resonance and Discord systems.