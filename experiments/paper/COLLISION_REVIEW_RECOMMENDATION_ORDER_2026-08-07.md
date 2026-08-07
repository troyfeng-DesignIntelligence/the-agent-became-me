# Collision review: recommendation order, LLM choice, and feedback loops

## Verdict

The standalone claim that candidate order changes an LLM's recommendation is
already occupied. V7 should use **recommendation-order-induced agent choice
divergence** as the name of the observed phenomenon, not as a novelty claim.

The defensible residual direction is narrower: temporary task evidence changes
a learned platform ranking; that ranking becomes the order shown to an acting
LLM; the order changes which item the agent selects; the selected action may
then become new recommender evidence. The current study establishes the middle
link. It has not yet established a consequential or longitudinal feedback loop.

Current novelty score: **2/5** for an order-sensitivity paper; **3/5 reachable**
for a paper about activation timing and consequential agent-recommender feedback.

## Search scope

Search date: 7 August 2026. Sources: ACL Anthology, ACM-indexed and OpenReview
pages surfaced through web search, and arXiv for recent work not yet in
proceedings. Queries separated: `LLM position bias candidate order`, `LLM
recommendation position bias`, `listwise ranking order sensitivity`, `LLM agent
recommender feedback loop`, `user-agent-platform recommendation`, and `LLM user
simulator exposure effect`. This is a targeted collision review, not a systematic
review of all recommender feedback-loop literature.

## Closest collisions

| Work | What it establishes | Collision with V7 | Remaining difference |
|---|---|---|---|
| [Evaluating Position Bias in Large Language Model Recommendations](https://arxiv.org/abs/2508.02020) | Reversing candidate order changes LLM recommendation rankings; proposes RISE mitigation | Direct collision with order sensitivity in recommendation | It studies LLM recommenders as rankers, not an acting agent receiving order from a separately learned platform recommender |
| [Found in the Middle](https://aclanthology.org/2024.naacl-long.129/) | Permutation self-consistency reduces positional bias in listwise LLM ranking | Occupies the general order-sensitivity mechanism and mitigation pattern | It does not manipulate temporary platform evidence or trace action into recommender state |
| [Ranked by Position](https://arxiv.org/abs/2607.24869) | Candidate permutation is an exploitable attack surface in listwise recommenders | Strong, recent collision with claims that order-only choice change is new or security-relevant by itself | It targets promotion attacks and top-k ranking, not activation timing or agent action feedback |
| [Beyond Utility: Evaluating LLM as Recommender](https://openreview.net/pdf?id=YiIdHqqoCd) | Treats candidate-position bias as an evaluation dimension for LLM recommenders | Further removes novelty from a basic position-bias finding | It evaluates recommendation accuracy rather than a platform-to-agent causal chain |
| [RecInter](https://aclanthology.org/2025.emnlp-main.956/) | LLM-agent actions dynamically reshape a simulated recommender ecosystem | Occupies dynamic agent-system interaction and emergent feedback as a broad idea | It does not isolate order as the mediator or outcome-gated activation as the intervention |
| [iAgent](https://aclanthology.org/2025.findings-acl.928/) | Places an LLM agent between user and recommender and uses dynamic memory and feedback | Occupies the user-agent-platform paradigm and protective-agent framing | It optimizes ranking outcomes; it does not test when temporary task evidence should enter platform ranking |
| [ConvApparel](https://aclanthology.org/2026.eacl-long.244/) | Finds a realism gap in LLM user simulators using counterfactual validation | Direct warning against treating model actions as human outcomes | V7 explicitly limits inference to provider outputs, but a future human claim would require validation |

## What V7 adds—and what it does not

Observed: in a 460-task frame crossed with SASRec and GRU4Rec, order-only
exposure produced DeepSeek distance 0.193 [0.155, 0.233] against a masked
control of 0.004 [-0.003, 0.013]. MiMo reproduced the direction. This removes
explicit rank and inspection metadata as necessary explanations.

Not new: LLMs are sensitive to candidate order; permutation can change rankings
or selections; repeated permutations can diagnose or mitigate the bias.

Potentially new if completed: an outcome-gated intervention that prevents
temporary task evidence from changing platform order before the task resolves,
with evidence that this interrupts a consequential feedback path without
reducing current-task quality.

## Claim policy

Allowed now:

> We observe recommendation-order-induced agent choice divergence in a research
> storefront: learned ranking changes altered categorical choices even when
> candidate identities and attributes were held fixed.

Do not claim:

- discovery of LLM position bias;
- a new order-sensitivity metric;
- human preference manipulation;
- irreversible harm or a production-retailer feedback loop;
- superiority of outcome gating before measuring consequential outcomes.

## Next discriminating study

Compare immediate activation, post-failure deletion, and outcome-gated activation
while retaining task-local support in every arm. Freeze task success, constraint
violations, regret, and next-task recommendation value before provider calls.
The direction remains viable only if outcome gating changes the downstream
feedback path and does not materially reduce current-task performance relative
to immediate activation. A null consequential result should reframe the paper
as a measurement and systems-audit contribution rather than a control-policy paper.
