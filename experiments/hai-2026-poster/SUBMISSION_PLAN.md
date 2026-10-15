# HAI 2026 poster submission plan

## Frozen story

**Title:** From Shelf Order to Later Agent Choice: A Link-by-Link Audit of Recommendation Writeback

The two-page paper does not recount the internal version history. It presents
three linked studies and one product-language extension:

1. **Activation:** recording an event is separated from activating it in the
   learned recommender. Immediate activation changes the current shelf; inert
   logging does not.
2. **Action:** with candidate IDs and attributes fixed, changing served order
   changes the categorical choice distribution of DeepSeek and MiMo.
3. **Writeback:** writing those selections as standardized positive sequence
   events changes a later shelf and a later choice distribution for both
   DeepSeek and MiMo.
4. **Product-language extension:** ordinary shopping requests reproduce order
   sensitivity, while task-quality contrasts remain inconclusive. Against one
   deterministic random realization matched on write count and paired-write
   equality, selected-writeback point estimates are not consistently larger;
   this is not an equivalence or no-amplification result.

The control interface is an unevaluated design response. It is not evidence
about comprehension, trust, preference, or human utility.

## HAI fit

HAI 2026 is themed "From Interaction to Agency" and explicitly solicits work
on delegation, control, autonomous agents, business applications, experimental
methods, and technological advances. The paper therefore leads with the
interaction boundary created when a shopping agent both consumes a platform's
recommendations and produces new evidence for that platform.

## Claim boundary

Allowed:

- a controlled, link-by-link audit of a staged one-step model-system path;
- recurrence across two first-stage LLM providers and two learned recommender
  families;
- outcome-gated writeback as an unevaluated interface hypothesis.

Not allowed:

- discovery of LLM position bias;
- human preference change, harm, trust, comprehension, or policy superiority;
- production Amazon effects;
- long-run amplification or irreversible state;
- a causal claim about actor provenance.

## Submission requirements

- Track: HAI 2026 Posters
- Deadline: 2026-08-07 23:59 AoE (2026-08-08 19:59 China Standard Time)
- Length: two ACM double-column content pages; references excluded
- Template: `\documentclass[sigconf,review,anonymous]{acmart}`
- Review: double blind
- Presentation: in-person poster at HAI 2026 in Osaka

## Remaining checklist

- [x] Compile the anonymous PDF with `acmart` 2.19 and the required class options.
- [x] Confirm that all content fits within two pages.
- [x] Inspect every rendered page at full resolution.
- [x] Humanize the manuscript and re-audit every claim against the frozen
  evidence.
- [x] Replace the overlapping full-width strip with a standard two-column
  figure float.
- [x] Check that all figures remain readable at paper size.
- [x] Remove identifying URLs, repository names, and author metadata.
- [ ] Enter authors only in PCS, not in the manuscript.
- [x] Add the required anonymized GenAI disclosure.
- [x] Correct the V7 task-cluster bootstrap and regenerate reported intervals.
- [x] Position the residual against Agent4Rec, AFL, and RecLoop.
- [x] Package prompt-construction code, response schemas, protocols, provider
  metadata, and public result primitives in an anonymous artifact.
- [x] Include the 460-task Study 1 protocol, rows, contrasts, metadata, summary,
  manifest, and evaluator; label the 320-task study as the sizing pilot.
- [x] Remove the unsupported no-amplification wording and report `34/1,840`,
  `24/1,840`, `60/128`, counterbalanced final arm order, and
  single-random-baseline scope.
- [x] Validate the final release bundle with
  `python scripts/validate-hai-poster-release.py`.
- [ ] Confirm that an author can attend and present in Osaka.
- [ ] Submit before the AoE deadline and save the PCS confirmation.

## Release hashes

- `HAI2026_Poster_Anonymous.pdf`: `7A0DB00EB1176821E2EBF9605DC9F2FF6CC8324B62D30ECD01727E7EF8DF5E80`
- `HAI2026_Poster_Source.zip`: `06C1DB833D0B510C6AFFCB057D674ED1D1AA06CFD998E24A193B361D8BC73F16`
- `HAI2026_Anonymous_Artifact.zip`: `37EA21301B6FB77AE8BBAAC323847C2A46568A8EA5ABD5C0AB67FE60677461B4`
