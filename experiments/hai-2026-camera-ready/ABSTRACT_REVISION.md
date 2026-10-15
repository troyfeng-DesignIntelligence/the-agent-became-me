# Abstract narrative revision

Scope: readability edit to the author-review camera-ready draft. The accepted title, author list, experiments, statistical Results and bibliography are unchanged. No new experiment or paid API call. The live PCS abstract has not been edited; the generated local PCS field sheet is synchronized to the revised source.

## Diagnosis and mini-outline

The previous abstract interleaved a useful research question with provider-specific estimates, intervals and comparison counts before explaining why the path matters. This is a phenomenon-led study with a design implication, not a claim that a new intervention outperforms a baseline.

- Opening: a choice can shape future recommendations, but the choice itself is influenced by presentation.
- Question and method: track whether that influence remains after writeback, in the defined research storefront.
- Evidence: distinguish the immediate order effect from small later shelf/choice differences; mention the ordinary-language extension.
- Implication and limit: study admission to account history; the measured LLM path is one step, with amplification unresolved.

The rewrite uses an explanatory sequence rather than an invented anecdote or a human participant's experience. Abstract statistics move out of the opening narrative, not out of the paper. The full frozen Results section retains all original counts, intervals, controls, subgroup qualifications, and the random-baseline limitation.

## Paragraph roles and evidence map

| Sentences / role | Claim | Evidence and status |
| --- | --- | --- |
| 1–2 / opening | Selection may shape later recommendations, while presentation may shape selection | Motivating relationship bounded by the research storefront; order manipulation and standardized selected-item writeback support the observed instance |
| 3 / question | Does the influence remain after an item enters account history? | Accepted study question; not an additional hypothesis or outcome |
| 4 / method | 460 constructed tasks, two recommenders, two providers; link-by-link tracking | Section 2, frozen protocols; supported |
| 5 / immediate evidence | Reordering identical candidate records changes choices | Study 2 served-order results, within-provider input audit and masked controls; supported |
| 6 / mediated evidence | Small, measurable later shelf and choice differences for both providers | Counterbalanced endpoints: DeepSeek .035 [.017, .054], MiMo .017 [.005, .032]; matched change rates 1.8% and 1.3%; shelf contrasts also positive. Provider-level claim, not a positive effect in every recommender subgroup |
| 7 / extension | Order sensitivity appears with ordinary-language shopping tasks | Product-language extension: .309 [.180, .453] and .289 [.180, .414]; supported, not a human-utility claim |
| 8 / design implication | Separate task-local assistance from decisions about history admission | Interpretation and future design question, not evidence that a holding policy improves outcomes |
| 9 / limitation | One measured feedback step; repeated amplification unresolved | One later LLM decision; the longer continuation is fixed-policy and uses one matched random realization; no amplification inference |

## Contribution formulation

- Empirical: trace an order-induced selection difference through standardized writeback into a later recommendation and choice.
- Methodological: separate the order-only intervention from its mediated consequence with selected identities allowed to differ later.
- Design: motivate examining which task-local actions become account history. No validated interface benefit is claimed.
- No new theoretical or first-ever novelty claim is introduced.

## Three review perspectives (local self-review, not external reviews)

Contribution perspective: a general order-bias result alone would underspecify the paper. The revised paragraph explicitly follows the choice into later recommendation and choice.

Evidence perspective: removing numerical estimates could exaggerate practical importance. The paragraph retains “small, measurable,” the controlled setting, and the one-step horizon; full counts and uncertainty remain in Results. No unsupported new link is needed for this rewrite.

HCI/design perspective: this is not a human study. The text names AI agents and a research storefront throughout; history admission is framed as a design decision to investigate, not proven protection for people.

## Five-dimension self-review

| Dimension | Question and assessment |
| --- | --- |
| Contribution | Does the reader see what is learned beyond initial order sensitivity? Yes: the later writeback-mediated path is explicit |
| Writing clarity | Does each sentence advance the same question? Yes: motivation, question, setting, immediate finding, mediated finding, extension, implication, limit |
| Experimental strength | Is the small endpoint made to sound like a large practical benefit? No: small effects and no claimed task benefit |
| Evaluation completeness | Are missing longer LLM rollouts or human outcomes disguised? No: one-step scope is retained and no human claims added |
| Method soundness | Is the later comparison incorrectly called order-only? No: it explicitly occurs after writing the selected item into history |

Local consistency checks must pass before delivering the PDF: abstract at most 150 whitespace-delimited words, original Results/title/disclosure/bibliography unchanged, exact author/eRights metadata, two content pages plus a references-only page, embedded fonts, and visual inspection. These checks do not replace publisher approval or the remaining supplemental license review.
