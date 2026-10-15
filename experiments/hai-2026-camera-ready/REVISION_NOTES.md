# Camera-ready revision working notes

Status: author-review draft, not cleared for final upload. Updated 2026-09-04.

## eRights confirmation received

The author supplied the ACM release confirmation and exact LaTeX block. These are now in source/rights.tex, loaded as required input rather than an optional placeholder:

- License: CC BY 4.0 (setcopyright cc; setcctype by).
- DOI: 10.1145/3841580.3845761.
- ISBN: 979-8-4007-2575-3/2026/11 (use the exact confirmation format).
- Author-confirmed eRights email: 2354251@tongji.edu.cn; updated in the manuscript and generated PCS field sheet.
- Author-confirmed name: Kaiqi Feng; normalized from the earlier PCS capitalization in the local manuscript and field sheet.
- Author-supplied ORCID: 0009-0006-1970-9572; inserted with the acmart orcid command. Local checksum passes; no claim of independent account-ownership verification.

The private eRights form URL was not accessed or copied into project files. After insertion, local checks confirm the license text, DOI, ISBN and school email on page 1; the old QQ address is absent from the manuscript PDF. The three PDF pages were visually inspected again. The original accepted submission remains untouched. Completion of eRights does not mean the publication files have been uploaded or TAPS-approved.

## Writing direction

Explain the research decisions and what each comparison adds. The paper is not a rebuttal letter. Reviewer comments guide this internal checklist; they are not reproduced in the manuscript. Scientific boundaries remain explicit where they affect interpretation.

Latest abstract revision: 134 words, organized around the platform shaping a choice and then using that choice to shape later recommendations. Provider-specific intervals/counts remain in the unchanged Results section instead of the abstract. “Small, measurable” and the one-step/unresolved-amplification scope are retained. See ABSTRACT_REVISION.md for sentence roles, claim-evidence mapping and local reviewer-perspective checks. The local PCS abstract field is synchronized; the live PCS record has not been edited. The newest preview is HAI2026_1206_NARRATIVE_DRAFT.pdf.

The main thread is: temporary task evidence changes the shelf; a changed order can change the agent's choice; selected-item writeback can carry that difference into a later shelf and choice. The first intervention holds identities and attributes fixed. The later comparison follows a mediated path and may contain different selected identities. Task-local assistance versus account-history admission is a design implication to evaluate, not an intervention proven effective here.

## Review-to-revision mapping (internal only)

| Concern | Revision | Location / evidence |
| --- | --- | --- |
| Make the experimental chain visible | Restored the accepted five-stage visual as the main figure; added only order-only and mediated-writeback group labels, a concise caption, and full alternative text | Figure 1; accessible LaTeX Description |
| Distinguish agent/recommender evidence from human outcomes | Explain the two design decisions first, then one consolidated limits paragraph | Section 4; no human-utility claim |
| Explain the two-provider choice | Describe primary analysis and second-provider replication across available API systems | Section 2 and S1 section 2; frozen protocol |
| Supply actual prompts, output constraints, and fixed components | Export real cached request examples for both providers and both repeats/arms; explain parser versus JSON-object mode | S1 sections 3–6; eight request payloads in two JSON files |
| Verify order-only invariance | Offline audit of successful served-order and masked requests: 7,360 per provider, 14,720 total; no non-order mismatch | prompt-invariance-audit.json; not a new experiment |
| More providers if feasible | No new experiments in this revision; identify coverage as two evaluated systems | Scope kept within accepted study |

## Evidence preservation

- Accepted title, Results section, bibliography and generative-AI disclosure are preserved.
- The original submitted PDF, source ZIP and artifact ZIP remain unchanged; the existing release validator passes.
- No new provider calls or payments. Historical prompts, output-contract quirks and experiment dates are not rewritten.
- 920 task-model units per provider remain in Study 2 served-order analysis, including 20 with unchanged ordering. No post hoc exclusion.
- Final counterbalanced endpoints remain DeepSeek 0.035 [0.017, 0.054] and MiMo 0.017 [0.005, 0.032]; matched counts remain 34/1,840 and 24/1,840.
- Figure means are not change probabilities; the caption names the categorical-energy statistic. Matched event rates are reported separately.
- The earlier simplified three-panel PDF remains in the source tree as an unreferenced backup. The manuscript now uses the restored five-stage figure; no numeric values were changed.
- The one-random-realization continuation remains inconclusive about amplification/equivalence. The later fixed-policy steps are not called LLM rollouts.

## Local preflight

The manuscript is a two-content-page plus one references-only-page draft using sigconf, with confirmed author name, email and ORCID, CCS concepts, keywords and ACM reference format. The restored five-stage figure includes a detailed alternative description and two minimal link labels. The manuscript references a vector PDF exported from the editable SVG source; a PDF object audit found no embedded image objects. Main and S1 PDFs are rendered for visual inspection; S1 has four pages. The manuscript log has a small overfull-vbox warning (approximately 1.54 pt); no overfull horizontal boxes or undefined references were found. Layout was rechecked after rights and author metadata insertion.

Local checks are not ACM TAPS validation. The present source uses acmart v2.19 (2026-06-27), above the v2.16 minimum named in the author's confirmation. The supplied eRights block, DOI, ISBN and ORCID are incorporated. The accepted-package webpage returned an access-denied response, so current package-list verification remains pending, not failed. Font embedding and two-page content checks pass locally.

## Finalization dependencies

1. DONE: ACM eRights confirmation received; exact rights/DOI/ISBN LaTeX block inserted in source/rights.tex. No private form token stored.
2. DONE locally: author confirmed Kaiqi Feng, 2354251@tongji.edu.cn and ORCID 0009-0006-1970-9572. Source and generated field sheet are synchronized. Affiliation remains College of Design and Innovation, Tongji University, Shanghai, China. No author additions or reordering. Live PCS/eRights records have not been accessed or edited by this workflow.
3. Confirm any required funding/acknowledgment disclosures; do not invent negative attestations.
4. DONE locally: recompiled after rights and email insertion; two-page content limit plus references-only page verified; fonts embedded and the first-page rights block checked. Publisher TAPS validation and proof approval remain pending.
5. Get the unique Sheridan upload link and exact paper-ID filename prefix. The local draft ZIP demonstrates the source/ and pdf/ structure; it is not a final upload authorization.
6. Upload final source/reference PDF to Sheridan and separately complete PCS camera-ready metadata/PDF. Review any subsequent TAPS proof and requested corrections.
7. Complete author registration and arrange in-person poster presentation.

Latest supplied chair email: September 9, 2026, 23:59 AoE = September 10, 2026, 19:59 Beijing/Singapore time. Do not use the earlier September 1 notice. Both Sheridan and PCS submissions are required.

Preparation sources checked: https://www.scomminc.com/pp/acmsig/hai2026.htm and https://www.scomminc.com/pp/acmsig/hai.htm, plus the chair email supplied by the author. The linked Google template note still carries older dates/full-paper details; the latest poster-specific email and Sheridan instructions govern this draft.

## Review of this revision

This is a local self-review, not an independent reviewer verdict or formal TAPS approval.

| Dimension | Assessment |
| --- | --- |
| Research narrative | Separates the question, intervention, mediated consequence and design implication |
| Claim support | Main numerical results retained; no human-harm, long-run amplification or proven-policy-benefit claim added |
| Methods transparency | Real request examples and an offline invariance audit supplied; provider differences documented |
| Figure/text alignment | Panel roles and numerical means match reported results; estimator definition and alt text included |
| Publication readiness | eRights and confirmed author metadata incorporated; remaining supplemental licensing/provenance checks and publisher-side validation/upload |
