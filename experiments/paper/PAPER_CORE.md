# When deletion is too late

## Working subtitle

Recommendation exposure and action path dependence in shopping agents

## The problem

A shopping agent may use a temporary task to browse products, compare options,
and ask for recommendations. Platforms can treat those actions as evidence for
later rankings before the task succeeds or fails. Deleting the task evidence
afterward can restore the stored recommendation state. It cannot undo a choice
the agent has already made because of what it saw.

This project studies that timing gap. The term action path dependence refers to
a paired replay in which immediate activation and delayed activation lead to
different resolved actions or different next-task rankings. It does not refer
to a change in human preference, permanent model damage, or a deployed retailer.

The useful distinction is simple. State can be reversible while action is not.

## Research questions

### RQ1. What changes when temporary task evidence reaches the platform recommender?

The first question separates event recording from recommendation activation.
It asks whether immediate activation changes the in-task shelf when histories,
tasks, candidate masks, and task-local retrieval are held constant.

### RQ2. When does a changed shelf alter the agent's resolved action?

The second question follows the effect past ranking displacement. It measures
whether immediate and held conditions end with different selected items or
abandon outcomes, after subtracting divergence observed in independent held
sham calls.

### RQ3. Can the system delay platform activation without weakening the current task?

Both timing conditions keep the same task-local recommendation channel. The
comparison therefore asks whether delayed platform activation preserves
decision accuracy and selected-item utility while the task is still active.

The interface is a design response to these questions. No participant has used
or evaluated it, so usability, trust, and perceived control are outside the
paper's empirical claims.

## Research design

The main argument uses three studies. Earlier probes and failed pilots remain
in the repository as an audit trail, but they do not carry the result.

| Study | Design | Role in the argument |
|---|---|---|
| Model and contract check | Four Amazon Reviews categories, 30,838 histories, 261,836 events, SASRec checkpoints, fixed candidate masks | Shows that temporary sequence evidence changes learned recommendation rankings across several commerce domains |
| Storefront experiment | 460 generated shopping tasks, four activation contracts, fixed and free-running agents, SASRec and GRU encoders | Separates logging from activation, then tests whether shelf changes propagate into agent trajectories |
| Deterministic LLM repair pilot | 32 frozen tasks, MiMo v2.5, DeepSeek V4 Flash, immediate and held arms, two held shams, temperature 0 | Tests resolved-action divergence under deterministic shelves and a frozen predecision predictor |

### Four activation contracts

The storefront experiment compares four conditions:

1. no task state;
2. an audit log excluded from ranking;
3. immediate platform activation followed by removal after the outcome;
4. task-local use with platform activation held until the outcome is known.

The first pair tests whether recording an event matters on its own. The second
pair tests activation timing. Fixed traces isolate the recommendation change.
Free-running traces allow the changed shelf to affect later actions.

### Primary behavioral event

A persistent resolved-action event requires both of the following:

1. immediate and held conditions resolve to different selected items or to a
   select-versus-abandon difference;
2. the realized paths leave different next-task rankings after outcome handling.

Two independently generated held calls estimate repeated-call variation. Whole
browsing-trace divergence is reported separately because a required product
view can change the trace without changing the decision.

### Frozen predecision dominance score

The first task-utility margin failed before the repaired pilot. It was defined
for only 13 of 32 DeepSeek tasks, and all 13 observed gaps were zero. We kept
that result as a failed measurement rather than changing its threshold.

The replacement score was specified before new provider calls. Each eligible
candidate receives equal weight on task utility, reciprocal platform rank,
reciprocal task-local rank, and novelty. The arm margin measures separation
between the leading candidates, with fixed rules for zero- and one-candidate
states. The task predictor is the smaller margin across immediate and held
conditions. Model responses and task outcomes are not inputs.

The score was finite for all 460 screened tasks. The original balanced 32-task
slice had 17 distinct values, but only one task changed its actionable candidate
opportunity. Calls stopped at that gate. An outcome-blind selection rule then
froze a category- and recommender-balanced 32-task set containing 15 opportunity
tasks. This sample tests a mechanism. It is not a prevalence sample.

## Results

### 1. Activation changed the shelf; logging did not

No-state and inert-log conditions produced the same rankings and traces. In the
fixed storefront replay, immediate activation versus holding produced mean
in-task Top-10 displacement of 0.765, with a 95% bootstrap interval from 0.745
to 0.785. After resolution and at the standardized next task, displacement was
0.000 in this replay.

The learned ranking effect also appeared across four Amazon categories. The
equal-category estimate for excess target-family slots was +0.321, with a 95%
interval from +0.273 to +0.369. Category estimates ranged from +0.119 to +0.612.
Holding exactly reproduced the paired baseline in each category. The direction
was stable under this protocol; the size was not.

This result assigns the shelf change to ranking activation rather than event
capture. It does not show that removal rewinds behavior.

### 2. A changed trace was not always a changed decision

When deterministic agents could react to the shelf, immediate and held traces
diverged in 36.7% of paired runs, with a 95% interval from 31.6% to 43.4%.
Agent policy mattered: the constraint-first rate was 12.7%, while the
exploration-first rate was 60.9%. The timing effect recurred with both SASRec
and GRU, although their trajectory-divergence rates differed.

A later controller probe exposed a measurement problem. Requiring MiMo to view
one recommended item changed 24 of 32 browsing traces but changed zero resolved
actions. DeepSeek changed 6 of 32 exposure decisions versus 1 of 32 sham
decisions. A browsing trace can therefore record a different path even when the
agent makes the same final choice.

The paper uses resolved action as its behavioral outcome for this reason.

### 3. Divergence occurred only when exposure created an actionable opportunity

The repaired 32-task pilot used deterministic SASRec or GRU shelves. DeepSeek
produced 7 resolved-action events in the exposure comparison and 1 in sham.
Its frozen dominance score reached AUC 0.780, with an exact one-sided
permutation p value of 0.0115. Five of the seven events fell in the lowest
predictor tertile.

MiMo produced 6 exposure events and no sham events. Its AUC was 0.734, with an
exact p value of 0.0391. Three of six events fell in the lowest tertile. MiMo
was not a second preregistered primary endpoint, so this is supporting evidence.

Across both providers, all 13 exposure events occurred among the 15 tasks where
exposure changed the actionable candidate opportunity. No event occurred among
the other 17 tasks. The actual sent-state audit matched the frozen predictor,
exposure decision, and sham decision for 32 of 32 tasks per provider.

The result supports a conditional account inside this research storefront.
Recommendation exposure changed some resolved actions when it changed what the
agent could reasonably choose, especially when the leading candidates were not
well separated. The enriched sample cannot tell us how often this happens in
ordinary shopping tasks.

### 4. Holding platform activation preserved current-task performance

Immediate and held conditions used the same task-local recommendation state.
In the 460-task storefront experiment, holding passed the frozen non-inferiority
checks for decision accuracy and selected-item utility. A diagnostic without
task-local recommendations lowered selected-item utility in three of four
categories.

The control is therefore about where temporary evidence is allowed to act. It
does not require the agent to work without task-specific help.

## What remains outside the main argument

Several earlier experiments helped shape the protocol but do not belong in the
main evidence chain.

- The signed-out Amazon probe observed page modules after temporary browsing.
  It had no access to an account profile or internal recommender state.
- The WebArena replay motivated the difference between holding and rollback.
  Released traces cannot establish the shopping-agent effect measured here.
- Synthetic profile simulations tested provenance labels, update mass, and
  decay. They are development checks over hand-authored profiles.
- The first MiMo and DeepSeek runs used recommendation models with dropout
  active at inference. Their provider and temperature comparisons are not used
  as same-shelf evidence.
- The failed utility margin and the recommender defect remain documented. The
  repaired pilot is prospective and does not repair those historical runs.

These materials remain useful for reproducibility and method review. Removing
them from the main story keeps weaker evidence from competing with the result.

## Contributions

The project makes four contributions.

1. It separates reversible recommendation state from action that has already
   occurred. The experiments show that restored rankings do not imply a restored
   decision path.
2. It identifies two conditions associated with resolved-action divergence in
   the repaired storefront: exposure changed the actionable opportunity, and
   predecision candidate separation was low.
3. It provides a four-arm method that controls recommendation state and repeated
   LLM variation independently. The method treats browsing and task resolution
   as different outcomes.
4. It implements an outcome-gated control in which task-local recommendations
   remain available while platform personalization waits for the task result.

The first three are empirical, conceptual, and methodological contributions.
The fourth is a design proposal. Its human use has not been evaluated.

## Design implications

### Keep task help separate from platform learning

An agent may need recommendations to complete a task without granting every
temporary action immediate influence over the principal's platform profile.
Systems can maintain a task-local channel and delay the platform update.

### Make activation a visible event

Logging, task-local retrieval, platform activation, and deletion are different
operations. A control should show which one has occurred and what will happen
when the task succeeds, fails, or is abandoned.

### Ask for the outcome before committing temporary evidence

Removal after failure acts too late if exposure has already changed the choice.
Outcome-gated activation avoids that sequence in the tested system. It should
still allow explicit commit when a task reveals a durable preference.

### Do not treat an undo receipt as proof that nothing happened

A receipt can confirm that stored evidence was removed. It cannot establish
that the agent would have taken the same action without the earlier exposure.
Interfaces should state that difference plainly.

## Limits

- There were no human participants. The project does not measure trust,
  comprehension, identity, authorship, perceived control, or cognitive load.
- Shopping tasks and agent outcomes were generated over public, pseudonymized
  Amazon Reviews histories. They are not records of delegated shopping.
- The LLM pilot deliberately enriched the number of tasks with a treatment
  opportunity. Its 18.75 percentage-point adjusted rate is not a population
  estimate.
- The deterministic storefront uses research-owned SASRec and GRU models. It
  does not reproduce a production retailer's recommender.
- The DeepSeek mechanism test was primary. MiMo supplied a same-direction check,
  not a second confirmatory endpoint.
- Four product categories are enough to show variation in this protocol, but
  not enough to estimate broad commerce-domain heterogeneity.
- The interface is an implemented prototype without a usability study.

## Paper figure set

| Figure | Content | Purpose |
|---|---|---|
| Fig. 1 | Immediate activation and outcome-gated hold across task time | Introduces the timing problem |
| Fig. 2 | Four activation contracts | Separates no state, inert logging, immediate activation, and holding |
| Fig. 3 | Fixed shelf displacement and free-running trajectory divergence | Shows the step from ranking change to behavior |
| Fig. 4 | Trace change versus resolved-action change | Explains the primary behavioral outcome |
| Fig. 5 | Exposure and sham events for MiMo and DeepSeek | Reports the repaired pilot |
| Fig. 6 | Dominance score and actionable-opportunity localization | Reports the conditional mechanism and sampling boundary |

## Scope language

The paper reports recommendation displacement, action path dependence, and
resolved-action divergence inside a research storefront. It does not use these
results as evidence of human preference manipulation, permanent contamination,
or Amazon account effects. The storefront probe is described as a page-level
observation. The learned experiments are described as counterfactual tasks over
real histories. The control interface is described as a prototype.

## Current paper story

A temporary shopping task can reach two different systems. The task-local
system helps the agent finish the job. The platform recommender changes what
the agent sees. Holding the second update until the outcome is known preserved
current-task performance in this testbed.

That timing matters only at certain tasks. A shelf may move without changing
the final decision. In the repaired LLM pilot, every resolved-action event
occurred where exposure changed the actionable opportunity, and events were
more common at lower predecision separation. Deleting temporary evidence can
restore stored state, but it cannot replay the choice that already happened.
