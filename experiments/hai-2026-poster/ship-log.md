# HAI 2026 poster ship log

Artifact: research paper and anonymous computational artifact  
Target: HAI 2026 Posters via Precision Conference System  
Started: 2026-08-08T12:36:30+08:00

## Phase 1: completeness

Status: PASS for the anonymous submission files; author metadata remains a PCS
form task.

- The title, abstract, manuscript, source bundle, and anonymous artifact exist.
- The abstract agrees with the manuscript results and calibrated claim boundary.
- The PDF contains two content pages plus one references-only page.
- The manuscript uses `sigconf,review,anonymous` and shows Anonymous Author(s).
- The manuscript contains an anonymized generative AI disclosure.
- No TODO, FIXME, PLACEHOLDER, or TBD marker appears in the submission files.
- Author names, affiliations, emails, ORCIDs, conflicts, and final order must be
  entered and verified by the author in PCS.

## Phase 2: verification

Status: PASS.

- `scripts/validate-hai-poster-release.py`: passed.
- PDF: 3 pages, no author metadata, no content spill to the references-only
  page.
- Source archive: 6 expected files; packaged `main.tex` matches the reviewed
  source.
- Anonymous artifact: 80 files; both counterbalanced provider endpoint gates
  and condition-order balance gates pass.

## Phase 3: security and anonymity

Status: PASS.

- No `.env` file appears in either release archive.
- No long API token, AWS-style access key, or provider key pattern was found.
- No author name, repository identity, GitHub URL, or local path was found. One
  match for the digits `13088` was inspected and occurs inside a response hash.
- Provider payloads and raw responses are excluded.

## Phase 4: documentation

Status: PASS.

- `PCS_FIELDS.md` contains the final title, abstract, keywords, topic choices,
  contribution statement, declarations, and manual fields.
- `SUBMISSION_PLAN.md` records the deadline, policy constraints, release files,
  and current hashes.
- `FINAL_HUMANIZED_REVIEW_2026-08-08.md` records the final claim-to-evidence
  audit and remaining scope limitations.
- Figure 1 has a stand-alone caption; limitations and related work are present.

## Phase 5: version

Status: not applicable. HAI PCS uses a submission record rather than a semantic
software version. The current hashes identify the frozen files.

## Phase 6: build and package

Status: PASS.

- Tectonic compiled the anonymous ACM paper successfully.
- All three PDF pages were rendered and inspected at full resolution.
- Final PDF SHA-256:
  `7A0DB00EB1176821E2EBF9605DC9F2FF6CC8324B62D30ECD01727E7EF8DF5E80`.
- Source ZIP SHA-256:
  `06C1DB833D0B510C6AFFCB057D674ED1D1AA06CFD998E24A193B361D8BC73F16`.
- Artifact ZIP SHA-256:
  `37EA21301B6FB77AE8BBAAC323847C2A46568A8EA5ABD5C0AB67FE60677461B4`.

## Phase 7: confirmation

Status: COMPLETED BY AUTHOR.

- The author entered the PCS metadata and affiliation, selected subject areas,
  uploaded the anonymous PDF, certified anonymization, and recorded the
  submission.
- The final PCS action was performed directly by the author rather than by the
  agent.

## Phase 8: submission

Status: COMPLETE.

- Target: HAI 2026 Poster Papers in Precision Conference System.
- Submission ID: 1206.
- Title: From Shelf Order to Later Agent Choice: A Link-by-Link Audit of
  Recommendation Writeback.
- PCS confirmation email received at 2026-08-08T12:59:00+08:00.
- Confirmation text: `The submission is complete.`
