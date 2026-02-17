# Phase 1–5 Item Rules

This directory holds **Phase 1–5 item-level rules and guidance**, including:

- **evidencePriority**: Prefer evidence in order, e.g. receipt: bank_statement → levy_register → agent_receipt
- **whitelistDocTypes**: Only these document types are valid evidence for the item
- **requiredEvidenceTypes**: Evidence types that must all be present
- **guidance**: Human-readable guidance injected into the system prompt

## Directory and Files

- **`types.ts`**: Rule type definitions (`PhaseItemRule`, `PhaseRulesMap`, etc.)
- **`phase_1_rules.ts`**: Phase 1 item rules (e.g. receipt, agm_minutes)
- **`phase_2_rules.ts`** … **`phase_5_rules.ts`**: Add as needed, same structure as Phase 1
- **`index.ts`**: Exports all `PHASE_X_RULES_PROMPT` for injection in `audit_engine/index.ts`

## Adding Rules

1. **Add item to an existing phase**: Edit the corresponding `phase_X_rules.ts`, add an entry to `PHASE_X_ITEM_RULES`:
   ```ts
   new_item: {
     evidencePriority: { doc_a: 1, doc_b: 2 },
     whitelistDocTypes: ["Doc A", "Doc B"],
     guidance: "…",
   },
   ```
2. **Add Phase 2–5 rules**: Copy `phase_1_rules.ts` to `phase_2_rules.ts` (or 3/4/5), fill in Phase 2 item rules, export `PHASE_2_RULES_PROMPT` in `rules/index.ts`, and append `PHASE_2_RULES_PROMPT` after `PHASE_2_REVENUE_PROMPT` in `audit_engine/index.ts` `buildSystemPrompt()` (same for Phases 3/4/5).

## Injection

Each `PHASE_X_RULES_PROMPT` is appended in **buildSystemPrompt()** immediately after the corresponding `PHASE_X_VERIFY_PROMPT` / `PHASE_2_REVENUE_PROMPT`, etc. The Kernel executes Phase objectives plus that Phase’s item rules.
