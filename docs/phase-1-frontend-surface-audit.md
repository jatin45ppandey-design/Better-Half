# Wave 1 — Frontend customer-surface audit

**Baseline:** `main` at `899f314ebbb7f917e192d24d5cbdde0896012cc9`  
**Implementation branch:** `wave-1/b1-s1-f1-foundation`

## Active customer surfaces

- Landing route continues to use `ProductHeroSection`, `ProductModeSection` and `CompactGameDiscovery`.
- Dashboard continues to use the real create/join room modals, the 11-game library, real recent match API and current Couple/Friend mode flow.
- Social, profile, invitation, settings, match-history, rivalry and room screens now use their Express APIs with explicit loading/error/empty states where updated.
- Game rules/instruction content and the canonical 11-game registry/question data were not removed or rewritten.

## Removed unreferenced prototype/demo code

The following modules had no active imports in the current app tree and were removed to prevent accidental reintroduction of local/demo customer data:

- `src/components/dashboard/Phase2PreviewModal.tsx`
- `src/components/dashboard/WelcomeBanner.tsx`
- `src/components/landing/FinalCtaSection.tsx`
- `src/components/landing/GamesPreviewSection.tsx`
- `src/components/landing/HeroSection.tsx`
- `src/components/landing/HowItWorksSection.tsx`
- `src/components/landing/ModePreviewSection.tsx`
- `src/services/mockSocialAdapter.ts`

The unused `setDevUser` mock-mode entry point was removed from `AuthContext` after verifying the only remaining component consumer was the removed, unreferenced `ModePreviewSection`. Supabase session restoration, Google OAuth/PKCE, login, logout and profile hydration code were not rewritten.

The active game-instructions modal no longer displays the “Phase 2 Prototype Rule Assumptions” banner. This removes prototype wording only; it does not change game instructions, rules or question content.

## UI wording and behavior alignment

- The dashboard header no longer shows a mock-session badge, fake local email fallback, static online indicator or universal Admin Preview link. Admin Console appears only after the moderator-protected overview API confirms access.
- Dashboard room actions no longer advertise “Phase 2 Live” or use a fabricated sample room code.
- Mode and game-library actions now read “Create Room” and “View Rules”, matching their actual actions.
- The live game header no longer labels a match “Local Match”.
- Landing create/join CTAs route unauthenticated visitors to sign-in rather than invoking auth-protected APIs as guests.

## Verification limitation

This is a source-tree/import audit. It does not replace frontend typecheck/build, route walkthrough, screenshot review or Google OAuth end-to-end validation. Those commands have not been executed in this environment; do not treat F1 as complete until they pass.
