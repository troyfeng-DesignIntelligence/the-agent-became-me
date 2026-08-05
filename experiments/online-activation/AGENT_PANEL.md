# Independent agent panel: online follow-up

Three context-isolated `gpt-5.6-sol` agents reviewed the proposed online extension. The requested `5.6-luna` model was not available in this environment.

## Protocol agent

The protocol agent proposed a prefix-replay design with four timed snapshots, isolated browser contexts, matched null sessions, task-clustered bootstrap intervals, and explicit recovery equivalence margins. It required site-level policy admission, conservative request limits, and go/pivot/no-go gates.

## Methods and ethics agent

The methods reviewer identified a fatal flaw in a direct third-party causal claim: without platform cooperation, the study cannot manipulate a retailer's internal activation policy. It scored the unmodified proposal `2/5` with high acceptance risk. It judged `4/5` reachable if the manipulated agent and evidence gate are research-owned, the evidence firewall is mechanically verified, outcome is externally defined, and causal fixed-trace evidence is separated from live ecological robustness.

## Engineering agent

The engineering audit recommended a parallel online runner rather than modifying the historical Amazon field probe. It identified reusable context isolation, challenge detection, trace hashing, evidence manifests, and evaluator gates. It rejected reuse of cart actions, arbitrary locators, effect-dependent pass criteria, and blur-based public evidence.

Recommended safety architecture:

- expose only `openHome`, `search`, `viewProduct`, and `captureSnapshot` capabilities;
- allow only preregistered GET routes and abort non-idempotent requests;
- use ephemeral contexts with no supplied storage state;
- stop globally on access control, authentication, throttling, prohibited routes, popups, downloads, or cleanup failure;
- publish structured pseudonymous traces and generated evidence diagrams, not raw page content;
- treat a correctly recorded null or safe stop as a valid experiment artifact.

## Synthesis

The online extension should not begin by repeating Amazon browsing at larger scale. Its next executable milestone is a deployed research storefront plus a browser-agent runner with an auditable eligibility gate. A third-party page probe is a later, separately claimed robustness layer.
