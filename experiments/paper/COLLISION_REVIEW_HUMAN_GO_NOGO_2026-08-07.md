# Collision review: should this project add a human study?

**Review date:** 2026-08-07  
**Decision:** Conditional go for one narrow behavioral study. No-go for a
generic survey, interview study, or memory-control walkthrough.

## Bottom line

The project should not stop as a portfolio artifact. It also should not add
human participants merely to make the work look more like HCI. Most of the
obvious human-facing story is already occupied:

- candidate order changes LLM recommendations and agent purchases;
- short-term and long-term preference separation;
- task- or intent-scoped profiles;
- user control over recommendation data, data aging, and deletion;
- user expectations for agent memory, visibility, and control;
- dynamic agent--recommender feedback loops.

One narrower question survived this review:

> When an AI agent acts on a person's behalf under a temporary task, under
> what conditions should the platform treat the agent's action as evidence
> about the human principal, and can people understand and govern that
> admission boundary?

This is not yet an established novelty claim. It is the residual gap found by
a targeted search. The closest work separates intent profiles, governs memory,
or models agent--recommender loops, but the reviewed studies do not jointly
manipulate **actor provenance**, **task outcome**, and **platform writeback**.

The rational next step is therefore one falsifiable human behavioral study
centered on that interaction. If there is no ethics-review route, or if a pilot
finds no actor-provenance effect beyond ordinary task context, research
escalation should stop. The existing work can still be shipped as a strong
portfolio project and computational case study.

## What the current project actually establishes

The completed V7 and V8 studies establish a bounded mechanism inside the
research storefront:

`recommendation order -> agent choice -> recommender writeback -> later shelf -> later agent choice`

The current evidence includes two provider families at the first action,
SASRec and GRU4Rec, a full 460-task frame, negative controls, and a downstream
DeepSeek action study. The matched later-action change rate is 2.1% with a 95%
interval of [1.1%, 3.1%]. This is evidence of a one-step model-system path. It
does not establish a human preference effect, welfare effect, production
retailer effect, long-run amplification, or the value of an interface policy.

## Search scope

This was a targeted collision review, not a systematic literature review.
Searches covered ACM/CHI materials, ACL Anthology, arXiv, publisher pages, and
author-hosted full texts available by 2026-08-07. Query families included:

- `LLM recommendation position bias` and `AI agent purchasing layout order`;
- `agent recommender feedback loop`, `user-agent-platform recommendation`, and
  `LLM agent as recommender user`;
- `temporary interest recommendation`, `intent-based profile`, `session versus
  long-term preference`, and `profile contamination`;
- `agent memory user control`, `task-scoped memory`, `data aging`, and
  `recommender data diary`;
- `delegated AI agent action provenance`, `on behalf of user profile`, and
  `agent action attributed to user recommendation profile`.

Full text or the complete published paper page was inspected for the closest
collisions, including *What Is Your AI Agent Buying?*, *Rethinking User
Empowerment in AI Recommender System*, *Users' Expectations and Practices with
Agent Memory*, *AI Never Forgets*, *CALMRec*, the real-world intent-based music
study, *RecInter*, and *iAgent*. Several July 2026 papers are recent preprints;
they count as collision evidence but not as settled community consensus.

Limitations: terminology in this area is unstable; papers may describe the
same issue using delegation, identity, intent, memory, or personalization
rather than provenance. The search cannot support a claim that this project is
the first. Any submission would need a refreshed search before abstract
freeze.

## Collision matrix

| Closest work | What it already establishes | Collision | Residual difference |
| --- | --- | --- | --- |
| [What Is Your AI Agent Buying?](https://arxiv.org/abs/2508.02630) | In rendered e-commerce, layout and product order change purchasing behavior across multiple VLM agent families | Direct collision with an order-sensitivity or agent-shopping novelty claim | Does not trace an agent choice into a separately learned platform profile and later recommendation |
| [Evaluating Position Bias in Large Language Model Recommendations](https://arxiv.org/abs/2508.02020) | Candidate order affects LLM recommendation rankings | Removes novelty from V7 as a standalone result | Studies ranking bias, not delegated-action writeback |
| [Do Recommendation Algorithms Work When Users Are LLM Agents?](https://arxiv.org/abs/2606.29762) | Compares standard recommenders on a platform whose users are autonomous agents | Occupies the broad “AI is the user” or ACI framing | Treats agents as platform users rather than actions performed on behalf of a human principal |
| [RecInter](https://aclanthology.org/2025.emnlp-main.956/) | Agent actions dynamically reshape a simulated recommender ecosystem | Occupies broad agent--recommender co-adaptation | Does not isolate responsibility for admitting delegated task actions to a human profile |
| [Agentic Feedback Loop Modeling](https://hexiangnan.github.io/papers/sigir25-agent-rec.pdf) | Models recommendation, simulated-user response, and memory update as a loop | Occupies feedback-loop language | Optimizes simulation/recommendation rather than testing provenance-aware writeback governance |
| [iAgent](https://aclanthology.org/2025.findings-acl.928/) | Places an LLM agent between user and platform, with instruction-aware memory and feedback | Occupies the user--agent--platform paradigm and protective-agent framing | Does not compare whether the platform should attribute task actions to the principal |
| [CALMRec](https://arxiv.org/abs/2607.23647) | Separates transient intent, long-term memory, and exposure memory; addresses exposure being mistaken for preference | Strong collision with memory separation and feedback-contamination claims | Algorithmic memory design; no human study of delegated actor provenance and admission decisions |
| [Intent-based recommendation models in a real-world music service](https://doi.org/10.1007/s11042-025-21022-7) | 417 users created isolated intent-specific recommendation models over more than two years | Near-fatal collision with “temporary interests should not contaminate a general profile” | User-generated intent profiles, not an AI agent acting under delegation or outcome-gated writeback |
| [Rethinking User Empowerment in AI Recommender System](https://doi.org/10.1145/3772318.3791914) | A 19-participant CHI study evaluates data weighting, aging, diaries, and contextual modes | Direct collision with a generic control-interface walkthrough | Does not make actor identity and delegated outcome the experimental variables |
| [Users' Expectations and Practices with Agent Memory](https://brennanjones.com/media/documents/publications/chiea25-666.pdf) | Users want task/domain memory boundaries and access control, but have incomplete mental models | Direct collision with generic interviews about task-scoped agent memory | Concerns the agent's memory, not a platform learning from the agent's external actions |
| [AI Never Forgets](https://doi.org/10.1145/3772318.3791635) | Interviews with 20 ChatGPT users identify failures of memory visibility, transparency, and control | Direct collision with a generic AI-memory perception study | Does not study recommender writeback or delegated action provenance |
| [Controllable Memory Usage](https://aclanthology.org/2026.acl-long.670/) | Makes memory reliance a user-controllable dimension | Occupies broad memory-control contributions | Controls agent recall rather than platform attribution of agent actions |
| [The User Asks, Platforms Compete](https://arxiv.org/abs/2607.25253) | Models an agentic recommendation market in which prior outcomes affect later platform evaluation | Strong collision with broad outcome-feedback framing | Feedback informs the user agent's platform choice; it does not test platform-side attribution to the principal's recommender profile |
| [Big Help or Big Brother?](https://arxiv.org/abs/2503.16586) | Audits cross-context tracking and profiling by generative-AI browser assistants | Establishes that agent-mediated profiling is already a live governance problem | Audits assistants profiling users rather than recommenders interpreting delegated agent actions |

## Claims that are no longer available

The paper should not present any of the following as its main novelty:

1. LLM choices are sensitive to recommendation order.
2. AI agents can participate in recommender feedback loops.
3. Temporary interests should be separated from long-term preferences.
4. Users want visibility, deletion, contextual modes, or memory controls.
5. An interface can hold events temporarily and commit or discard them.
6. “ACI” simply means replacing the human user with an AI agent.

These can remain motivation, implementation context, or replication evidence.
They cannot carry the paper.

## The residual paper question

The defensible unit of analysis is not temporary interest. It is the
**admission of delegated evidence**:

- **Actor:** Was the action performed directly by the person or by an AI agent
  on the person's behalf?
- **Scope:** Was it part of a declared temporary task or ordinary browsing?
- **Outcome:** Is the task pending, successful, failed, or abandoned?
- **Destination:** Does the event remain task-local, enter the platform's
  principal profile, or disappear?
- **Consequence:** Can the person predict and correct the later recommendation
  effect?

A calibrated paper claim would be:

> We study how actor provenance and task outcome affect people's desired
> admission of shopping actions into a principal's recommendation profile, and
> whether outcome-gated writeback helps them predict and govern the resulting
> recommendation consequences.

That claim is only a proposal today. V7--V8 do not manipulate provenance and
contain no human evidence.

## The human study worth doing

Do not begin with a broad questionnaire. Use a preregistered behavioral study
in the existing research storefront, with short debrief interviews only as
secondary explanatory evidence.

### Core manipulation

Use matched shopping episodes and independently manipulate:

1. **Actor provenance:** the participant acted versus an AI agent acted on the
   participant's behalf.
2. **Task outcome:** pending, successful, or failed/abandoned.
3. **Writeback policy:** immediate admission followed by deletion versus
   outcome-gated hold followed by commit/discard.

The actor manipulation is indispensable. A study containing only task context,
temporary profiles, or data aging reproduces existing work.

### Primary outcomes

- **State-prediction accuracy:** can the participant correctly identify which
  action currently affects the task shelf and which affects the long-term
  profile?
- **Admission decision:** after seeing actor and outcome, does the participant
  choose to admit the event to the principal profile?
- **Correction performance:** success rate and time needed to restore the
  intended later recommendations after an unwanted writeback.
- **Current-task cost:** whether holding platform writeback changes task
  completion, decision time, or perceived usefulness during the active task.

Preference, trust, and qualitative explanations may be secondary outcomes.
They should not replace the behavioral endpoints.

### Why V8 matters to this study

The interface should expose real replayed V8 consequences from the research
storefront. Participants should see that the same agent choice can produce a
different later shelf and occasionally a different later action. This avoids a
purely speculative Figma walkthrough. The study then tests understanding and
governance of an observed mechanism rather than asking people whether they
like an abstract privacy feature.

## Go/no-go gates

### Gate 0: ethics and recruitment

Before recruitment, identify an applicable institutional or otherwise valid
ethics-review route, consent procedure, compensation plan, and data-retention
policy. If this cannot be secured, do not collect informal participants and do
not imply a human-subjects contribution.

### Gate 1: manipulation pretest

Participants must reliably distinguish “the agent acted for me” from “I acted”
without guessing the study hypothesis. They must also understand task-local
state versus platform-profile writeback. If not, repair the instrument before
powering the study.

### Gate 2: novelty kill test

The preregistered primary model must include the actor-provenance interaction.
If desired admission, state-prediction error, and correction behavior are
explained by task scope and outcome alone, with no practically meaningful
provenance contribution, stop the ACI paper claim. The result would reduce to
the already occupied intent-isolation literature.

### Gate 3: policy value

Outcome-gated writeback must improve at least one objective governance measure
such as state prediction or correction performance, while keeping the
prespecified current-task cost within a justified bound. If it only increases
subjective preference ratings, the result is too weak for the intended paper.

### Gate 4: scale

Use the pretest/pilot variance to choose sample size. Freeze primary outcomes,
exclusions, contrasts, and stopping rules before the confirmatory run. Do not
choose a convenient participant count first and construct the analysis around
it.

## Submission decision

| Route | Decision now | Reason |
| --- | --- | --- |
| Computational full paper based on V7--V8 alone | **No-go as the main bet** | The effect is careful but small, one-step, testbed-bound, and surrounded by direct work on order bias and agentic feedback |
| Generic survey/interviews about memory or recommendation control | **No-go** | CHI 2025--2026 and the real-world intent-profile study already cover the likely findings |
| Prototype walkthrough of hold/delete/data-aging controls | **No-go** | The closest CHI recommender-control paper already evaluates richer versions of these controls |
| Behavioral study of provenance x outcome x writeback | **Conditional go** | It targets the remaining unresolved attribution boundary and can be falsified with objective measures |
| Portfolio case study | **Go regardless** | The storefront, causal controls, learned recommenders, cross-LLM replication, and honest failed-pilot history already form a strong research-engineering narrative |

## Final recommendation

Proceed only to the narrow behavioral study above. Treat it as the project's
last paper-level bet, not as an automatic extension. First secure ethics
review, then run a manipulation pretest, then a powered confirmatory study if
the actor-provenance signal survives. Do not add a decorative questionnaire or
open-ended interview round.

If ethics access is unavailable, or the provenance kill test fails, stop the
research escalation immediately. Freeze V7--V8 as a bounded computational
case study, polish the website and reproducibility package, and present the
project as a portfolio piece rather than stretching it into an unsupported
human-centered claim.
