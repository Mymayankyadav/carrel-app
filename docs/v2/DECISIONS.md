# Carrel v2 engineering decisions
2026-10-28 · F1 · Legacy Stats routes resolve to Insights, Settings stays a non-tab root · Preserve bookmarks and keyboard navigation.
2026-10-28 · F1 · Pre-register one-line stubs in the frozen manifest · Lanes can implement without blocking on ORC.
2026-10-28 · F1 · Labs registry starts empty · Do not expose incomplete features.
2026-10-28 · L3 · Smart scheduler requires explicit preview/Accept, uses 10% capacity buffer and 25-minute minimum blocks · Prevents unexpected plan edits and unusable study fragments.
2026-10-28 · ORC · Quick Capture replaces the Plan FAB, while the previous Plan block editor remains accessible in the header · Preserve existing v1 capabilities per B3.
2026-10-28 · L1 · Keep two compact upcoming Plan links after the ribbon · A ribbon summarizes the day but does not directly focus an individual plan block; existing one-tap Plan focus remains useful.
2026-10-28 · L5 · Flowtime and session recall default on; energy check defaults off under Labs · Gentle break prompts and skippable recall are low-risk; extra check-in remains opt-in.
2026-10-28 · L2 · Morning scheduling has an explicit preview and Accept before any planned blocks are written · Avoids surprise plan mutations; shutdown replaces the Plan menu's Wrap up while retaining the legacy writer as fallback.
2026-10-28 · L10 · Preserve the v3 meta/guide via an additive doc_merge of v2 fields instead of replacing it · Protect pre-existing sync instructions while publishing Claude read/write rules.
2026-10-28 · L6 · Keep Android Usage Access detection opt-in and PR #44 in draft for device privacy checks · Aggregate foreground app use can be approximate and requires explicit user acknowledgement before reclassifying study time.
2026-10-29 · QA/ORC · Merge overlapping free windows before auto-planning; reject non-finite and invalid exam-plan inputs and cap day capacity to 24h · Prevent double-booking, inflated availability, and unbounded loops without touching user data.
2026-10-29 · QA/ORC · Scope offline pending writes to the authenticated UID and clear cached state on account switch; quarantine legacy unowned queue rather than replay it · Prevent cross-account writes and display leakage without silently deleting old unsent edits.
