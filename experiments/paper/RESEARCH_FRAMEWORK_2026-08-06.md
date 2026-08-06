# Research framework after the evidence review

## One claim

Temporary shopping activity can affect two systems at once. A task-local system
helps the agent finish the current job. A platform recommender changes what the
agent sees. If platform activation changes the resolved action, deleting the
temporary evidence afterward cannot recreate the decision that would have been
made under delayed activation.

The project is about activation timing and action path dependence. It is not a
general paper about profile pollution.

## Three-step evidence chain

| Step | Question | Evidence kept in the main paper |
|---|---|---|
| 1. Shelf | Does activation, rather than logging, change recommendations? | Four-contract fixed replay, four Amazon categories, SASRec and GRU |
| 2. Action | Does the shelf change alter what the agent does? | Free-running 460-task storefront, separate trace and resolved-action outcomes |
| 3. Condition | Which tasks allow that action change? | Deterministic 32-task LLM pilot, held shams, frozen dominance score |

The control prototype follows from the same sequence. It keeps task-local help
available and waits for the task outcome before platform activation.

## What stays in the main paper and website

The main evidence includes the four-category learned recommender result, the
four-contract storefront experiment, the repaired MiMo and DeepSeek pilot, the
trace-versus-decision measurement check, and the control prototype.

These pieces answer different parts of one question. The cross-category study
shows that the shelf effect is not tied to one product domain. The storefront
experiment separates logging from activation and lets the changed shelf affect
later behavior. The repaired LLM pilot measures a resolved decision rather than
surface-level trace movement.

## What moves to the development archive

The signed-out Amazon probe, WebArena replay, synthetic profile studies,
MovieLens transfer, temperature sweep, historical provider comparison, and
failed utility margin remain available at `?archive=1` or in the repository.
They document how the study was developed and repaired. They do not support the
main mechanism claim.

The first LLM runner is especially important as an audit. Dropout was active
during recommendation inference, so those shelves were not comparable across
runs. The repaired pilot was frozen and executed separately. The paper does not
use the repair to reinterpret the old data.

## Current findings

1. Recording an event did not change rankings. Activating it did.
2. A changed browsing trace did not guarantee a different selected item or
   abandon decision.
3. In the repaired pilot, all 13 exposure events occurred where activation
   changed the actionable candidate opportunity.
4. Delaying platform activation preserved current-task decision accuracy and
   selected-item utility because task-local recommendations remained available.

## Contribution structure

The empirical contribution is the observed separation between shelf movement,
browsing movement, and resolved-action movement.

The conceptual contribution is the distinction between reversible stored state
and action that has already occurred.

The methodological contribution is a four-arm protocol that controls the shelf
and repeated LLM variation independently, plus an outcome-blind way to select a
mechanism stress test.

The design contribution is an outcome-gated activation model with separate
task-local and platform channels. The prototype has not been evaluated with
people.

## Writing audit

The previous draft read like a chronological research log. Thirteen findings
had similar weight, so failed pilots and weak probes competed with the repaired
result. Several headings relied on paired slogans, and many paragraphs ended
with a generic claim about what the result established. The draft also spent
too much time narrating how the work changed from one version to the next.

The revised draft puts the phenomenon before the implementation. It uses one
claim, three evidence steps, four findings, and six paper figures. Historical
problems appear once in the audit section. Sentences name the measured object,
sample, and boundary directly. The main prose avoids decorative significance,
stock transitions, vague claims, and dramatic punctuation.

## Work deferred

A third provider family is not part of the current plan. The next useful study
would sample tasks without opportunity enrichment and report two quantities:
the frequency with which activation changes the actionable opportunity, and
the resolved-action effect conditional on that opportunity. A later participant
study could test whether the interface makes the timing distinction clear.
