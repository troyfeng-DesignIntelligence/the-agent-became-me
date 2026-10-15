# Supplementary Material S1: prompt record

Companion to **From Shelf Order to Later Agent Choice: A Link-by-Link Audit of Recommendation Writeback**.

Read HAI2026_S1_Prompt_Record.pdf first. The two *-served-order-requests.json files contain the full successful request payloads for one Study 2 unit, with both arms and both repeats for each provider. Examples were chosen by stored row order and changed candidate order, independently of model outputs. They are archival records, not revised prompts.

prompt-invariance-audit.json records an offline comparison of 14,720 successful cached request payloads across the served-order and masked modes. This is a subset of the 29,440 Study 2 calls across all four modes. It checks that the within-provider served comparison changes only candidate-array order, and that masked payloads are identical within unit. It does not audit unsuccessful transport attempts or provider internals.

The two *-summary-original.json files preserve the published Study 2 run summaries. The included original HAI2026_Anonymous_Artifact.zip preserves the submitted protocols, analysis code and result tables unchanged. It remains anonymous as an archival artifact; the camera-ready manuscript restores authorship separately.

The request examples omit HTTP headers, credentials, raw responses, original Amazon identifiers and raw customer histories. Historical instruction/parser differences are described in S1. Neither the publication text nor the raw prompt records should be edited to erase those differences.

No new experiment or paid model call was made to produce this supplement. The offline preparation script is included for audit provenance. It requires the locally retained response cache, which is not distributed here; this bundle is therefore not a complete rerunnable copy of the cache audit. The S1 PDF contains embedded font subsets. Figure 1 is supplied as a publication PDF and as an editable SVG source.

This is the camera-ready supplementary package for HAI 2026 poster submission pp1206. ACM eRights metadata and author details are maintained in the manuscript source; this supplement contains no credentials, raw customer histories, original Amazon identifiers, or HTTP headers. The editable SVG source for Figure 1 is included alongside the archival prompt record and computational artifact.
