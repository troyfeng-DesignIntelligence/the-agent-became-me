# Data and Reuse Register

This document records what the project reuses, what it deliberately reimplements,
and which license or claim boundary applies.

## Open product data

The committed catalog snapshot is derived from the Open Food Facts API. Open Food
Facts publishes its database under the Open Database License (ODbL); attribution
and share-alike obligations apply to the data snapshot and derived database.

- Source: <https://world.openfoodfacts.org/>
- API documentation:
  <https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/>
- License: <https://opendatacommons.org/licenses/odbl/1-0/>

The project does not redistribute product images, reviews, accounts, or any
user-level records. Product metadata is used only to create a more realistic
choice environment. All principals, delegation briefs, actions, and outcomes are
synthetic.

## Standards reused

The trace model borrows the stable primitives `Entity`, `Activity`, `Agent`,
`wasGeneratedBy`, `wasAssociatedWith`, and `wasAttributedTo` from W3C PROV-O:
<https://www.w3.org/TR/prov-o/>.

PROV-O also defines software agents, `actedOnBehalfOf`, and qualified delegation.
Those established terms bound the project's claims: this is a domain-specific
trace and profile-update contract, not a new delegation or provenance vocabulary.

This is a compact application profile, not a claim of complete PROV-O
conformance.

## Research simulators consulted

- RecSim — configurable sequential recommender simulation, Apache-2.0:
  <https://github.com/google-research/recsim>
- T-RECS — sociotechnical recommender simulation:
  <https://elucherini.github.io/t-recs/>

The browser testbed does not embed either Python framework. It reuses their
separation between environment, user/agent response, recommendation policy, and
metrics while remaining small enough to inspect in a portfolio review.

## Literature used only as collision or method context

- [Top-N Recommendation for Shared Accounts](https://doi.org/10.1145/2792838.2800170)
  and [Identifying Users behind Shared Accounts in Online Streaming Services](https://doi.org/10.1145/3209978.3210054)
  establish shared-account recommendation and latent session-to-user
  identification. This project does not implement their algorithms, graph or
  embedding methods, datasets, code, or inferred-user task. Its actor is known.
- [Learning to Personalize Recommendation based on Customers' Shopping Intents](https://arxiv.org/abs/2305.05279)
  is collision context for inferring high-level shopping goals and using them in
  ranking. Its arXiv record is withdrawn and supplies no accessible PDF or reuse
  license. The project copies no model, training data, ranking logic, text, or
  evaluation claim from it; its task vectors and policies are independently
  specified, transparent, and synthetic.

These publications are cited to delimit the contribution, not as software or
data dependencies.

## Interface and analysis libraries

- React — component and state composition.
- D3 — scales, shapes, and interpolation for custom SVG figures.
- Zod — one runtime schema as the source for TypeScript types and validation.
- IBM Plex and Newsreader — locally bundled open fonts.

## Deliberately local code

The following are short, project-specific mechanisms whose inspectability is part
of the artifact:

- named deterministic random streams;
- the six profile-update contracts and matched-weight calculation;
- trace replay, receipts, and pre-persistence quarantine;
- the three declared outcome calculations;
- the synthetic delegation-scenario generator.

None of these should be interpreted as a production recommender implementation,
a shared-account user-identification method, a shopping-intent model, or a new
provenance standard.
