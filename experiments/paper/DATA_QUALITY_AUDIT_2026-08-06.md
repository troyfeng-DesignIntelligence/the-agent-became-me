# Data-quality audit: historical storefront recommendation states

Status: **critical method defect found; new confirmatory API calls paused**.

## Technical summary

The historical online-storefront runner loaded SASRec and GRU4Rec checkpoints
without switching the models to evaluation mode. Dropout therefore remained
active inside ranking inference. A `ModelScorer` cache made repeated identical
contexts stable within one run, but separate provider, temperature, and offline
reconstruction runs could receive different recommender realizations.

This defect weakens any claim that provider or temperature comparisons used the
same learned-recommender shelves. It also means an immediate-versus-held pair
can combine the intended context change with independent dropout variation
between distinct contexts. The historical sham arms calibrate LLM variation;
they do not calibrate this recommender variation.

No new LLM calls should be made from the historical runner. The runner now calls
`model.eval()` before constructing the scorer, but that repair applies only to
future runs.

A deterministic preflight now passes for the repaired runner: all 32 frozen
tasks reported `training=false`, all 32 produced byte-identical scores across
three uncached calls, and two fresh processes produced the same canonical
Top-10 shelf-state hash. This repairs the future measurement instrument; it
does not reverse the candidate-margin no-go or validate the historical causal
contrast.

## Dataset and grain

- Intended analytical grain: one frozen shopping task with four paired arms.
- Historical forced-inspection data: 32 tasks per provider.
- Raw ignored cache: 128 MiMo and 174 DeepSeek request/response records.
- Public outcome source: 32 resolved-action contrasts per provider.
- Candidate-margin output: 64 provider-task rows containing derived features
  and event flags only.

## Checks performed

1. Inspected recommender model lifecycle and confirmed the storefront runner
   omitted `model.eval()` while the model-robustness runner explicitly used it.
2. Reconstructed shelves repeatedly and observed the forced-item difference
   rate change across identical executions, confirming inference-time dropout.
3. Replaced reconstruction with the pseudonymous candidate features actually
   sent to each provider.
4. Clustered cached calls into 32 task components per provider using overlapping
   pseudonymous candidate IDs and mapped them back to the 32 frozen public task
   hashes.
5. Validated raw final decisions against public contrasts: 32/32 exposure and
   32/32 sham matches for each provider.
6. Repeated the actual-state analysis and obtained an identical `rows.json`
   SHA-256 hash.
7. Scanned the public output design to ensure it excludes original item IDs,
   titles, reviews, prompts, and model responses.
8. Ran the repaired recommender preflight in two fresh processes. Evaluation
   mode and within-process repeatability passed 32/32, and the aggregate shelf
   hash matched across processes.

## Findings

### Critical — learned-recommender inference was not deterministic

**Evidence.** The runner did not call `eval()` before SASRec/GRU4Rec scoring,
although both models contain dropout layers. Identical offline reconstruction
runs changed derived forced-item and best-candidate rates.

**Risk.** Cross-provider and cross-temperature comparisons can mix LLM behavior
with different recommender dropout realizations. Exposure-versus-held contrasts
can also include dropout variation between distinct scorer contexts. Strong
causal wording about recommendation exposure is unsafe for these historical
runs.

**Likely cause.** The online runner reused `ModelScorer` but omitted the explicit
evaluation-mode call present in the model-robustness pipeline.

**Remediation.** Keep the added `model.eval()` call and require the new automated
preflight before any API request. The same context now scores identically three
times in one process, and the frozen shelf-state hash matches across two fresh
processes for 32/32 tasks.

### High — the preregistered task-utility margin cannot measure near ties here

**Evidence.** Only 13/32 DeepSeek tasks had at least two eligible candidates in
both exposure arms, versus the frozen 90% requirement. All 13 analyzable tasks
had a top-two task-utility gap of zero. DeepSeek's margin AUC was 0.50 and its
one-sided 100,000-permutation p-value was 1.00. Four of six resolved-action
events were analyzable; two occurred where the margin was undefined.

**Risk.** The result cannot distinguish near-tie sensitivity from ordinary
choice-set variation. The frozen mechanism gate is a no-go and cannot justify a
third provider or a larger confirmatory run.

**Likely cause.** The candidate utility representation is coarse and the hard
constraint often leaves zero or one eligible candidate. Among multi-candidate
states, eligible items frequently share the same task-utility value.

**Remediation.** Do not loosen the frozen gate after seeing the result. Design a
new, independently frozen margin instrument with sufficient support before a
new pilot—for example, a lexicographic dominance score based on task utility,
platform rank, task-local rank, and novelty, validated for non-degenerate
variation before any LLM call.

### Medium — actual sent states preserve a reproducible negative diagnostic

**Evidence.** The actual-state parser recovered 32 components for each provider
and matched all 128 public resolved/sham decisions. Repeated output rows were
byte-identical.

**Use.** The negative margin finding and the data-quality failure are safe to
report as diagnostics. Historical provider-effect magnitudes remain observed
controller outcomes, but their causal attribution is downgraded.

## What remains safe to cite

- The historical calls and their resolved outcomes occurred as recorded.
- MiMo's forced-inspection run changed browsing traces without changing its
  recorded final decision, illustrating that trace and resolved-action metrics
  are not interchangeable inside this implementation.
- The frozen task-utility margin diagnostic failed its support and discrimination
  gates.
- The historical runs do not support same-shelf cross-provider recurrence or a
  clean causal estimate of recommendation exposure.

## Recommended next steps

1. Keep third-provider and confirmatory API calls paused.
2. Keep the now-passing deterministic recommender preflight as a mandatory
   API-call gate; do not interpret it as a mechanism result.
3. Design and validate a non-degenerate decision-margin instrument entirely
   offline.
4. Freeze a new 32-task deterministic repair pilot before spending on LLM calls.
5. Only after that pilot passes mechanism, reliability, sham, and privacy gates,
   freeze the third family and scale to the planned temperature-zero study.

## Open questions

- Can a pre-decision dominance score vary without encoding the model's observed
  choice or another post-outcome field?
- Does a deterministic repair pilot retain any DeepSeek resolved-action excess?
- Is forced inspection a useful intervention, or should the confirmatory design
  use naturally initiated inspection with an instrumental manipulation?
