# Ship Log

Artifact: Research paper — HAI 2026 Poster pp1206 camera-ready package
Deploy target: Sheridan Communications and PCS
Started: 2026-09-07 (Asia/Singapore)

## Phase 1 — Verify Completeness

- [x] ACM sigconf source, bibliography, rights block, and Figure 1 are present.
- [x] Abstract, claims, related work, limitations, author metadata, and S1 reference pass the camera-ready validator.
- [x] Figure 1 has a standalone caption, detailed LaTeX Description, vector publication PDF, and editable SVG source.
- [x] No TODO, FIXME, PLACEHOLDER, or TBD markers were found in the camera-ready source or supplement.
- [x] The accepted Results text, title, bibliography, and AI disclosure remain unchanged.

## Phase 2 — Test Suite

- PASS: final packaging script compiles with Python.
- PASS: camera-ready validator reports localChecksPassed=true, 3 pages, 134 abstract words, embedded fonts, no horizontal overflow, and no undefined references.
- PASS: original accepted PDF/source/artifact release validator passes and recorded hashes are unchanged.
- PASS: the final ZIP was unpacked into a clean temporary directory and compiled using only packaged files; output has 3 pages, DOI and current email, with no body content on page 3.
- PASS: all 17 bibliography entries were re-audited; corrected SIGIR and ACL page ranges, the journal issue, the CALMRec arXiv DOI, and the stable ABxLab URL are present in the packaged source.

## Phase 3 — Security Scan

- PASS: explicit ZIP allowlist; no .env files or hidden environment files.
- PASS: no literal API key, token, password, or secret assignments found in the archival Python code. Variable-name references load credentials from the environment only.
- PASS: prompt records exclude credentials, HTTP headers, raw responses, original Amazon identifiers, and raw customer histories.

## Phase 4 — Documentation

- [x] Supplement README explains scope, omissions, provenance, and reproducibility limits.
- [x] PCS/Sheridan copy-paste fields and upload mapping are documented.
- [x] The final validation report records hashes, archive entries, page count, and upload status.

## Phase 5 — Version

Conference submission ID pp1206; semantic versioning is not applicable.

## Phase 6 — Build

- PASS: HAI2026_pp1206_Reference.pdf — 145,444 bytes.
- PASS: HAI2026_pp1206_Source.zip — 4,843,138 bytes, with source/, pdf/, and supplements/ roots.
- PASS: HAI2026_pp1206_Supplement.zip — 4,606,568 bytes for a separate PCS supplement field if requested.
- PASS: packaged pdf/main.pdf is byte-identical to the reference PDF.
- PASS: source package contains exactly one acmart documentclass and includes the editable Figure 1 SVG under supplements/figure-source/.

## Phase 7 — Confirm

READY FOR AUTHOR UPLOAD. The user approved the content and requested usable files. External submission remains a separate irreversible action and has not been authorized with SHIP IT.

## Phase 8 — Deploy

Not started. External submission is intentionally not performed by packaging.
