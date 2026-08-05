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

## Real interaction histories used without redistribution

The external-validity experiment downloads MovieLens 100K from GroupLens into
ignored `artifacts/`. The official dataset contains 100,000 ratings from 943
users and prohibits redistribution without separate permission.

- Source: <https://grouplens.org/datasets/movielens/100k/>
- Input files: official `u.data`, `u.item`, and `README`
- Required citation: Harper and Konstan (2015),
  <https://doi.org/10.1145/2827872>

The repository commits source hashes, one-way case identifiers, experiment
metrics, and aggregates. It does not commit ratings, original user IDs, movie
titles, or the IDs of injected movies. The temporary delegated task is
counterfactual and is not a MovieLens annotation.

## Real e-commerce sequences used without redistribution

The learned-sequence experiment downloads Amazon Reviews 2018
`Luxury_Beauty_5` and matching metadata from the UCSD McAuley Lab into ignored
`artifacts/`. It treats each published review as an implicit interaction and
uses the original SASRec leave-two-out chronology.

- Source: <https://cseweb.ucsd.edu/~jmcauley/datasets/amazon_v2/>
- Review file SHA-256: `57d93915786b57f9a000f5818c6035bec6110be2b2b72b383a26744c5314df3e`
- Metadata SHA-256: `8890dd1fc3e5b476612662f10881d1dfdbe2a43ac726e5cd115ba05a486a34d5`
- Dataset citation: Ni, Li, and McAuley, EMNLP-IJCNLP 2019.
- Model citation: Kang and McAuley, SASRec, ICDM 2018,
  <https://doi.org/10.1109/ICDM.2018.00035>.

The repository commits aggregate metrics and one-way case hashes, not reviews,
review text, product metadata, titles, original reviewer or item IDs, or model
checkpoints. Title tokens define an evaluation family only; they are not SASRec
inputs.

The cross-category replication adds `Software_5`,
`Industrial_and_Scientific_5`, and `Prime_Pantry_5` plus their matching
metadata. All raw files and checkpoints remain ignored. The committed
`public/results/amazon-cross-category/v1/` artifacts contain aggregates,
domain-separated hashes, and derived user-level metrics for reproducing the
hierarchical bootstrap.

| Category | Review SHA-256 | Metadata SHA-256 |
|---|---|---|
| Luxury Beauty | `57d93915786b57f9a000f5818c6035bec6110be2b2b72b383a26744c5314df3e` | `8890dd1fc3e5b476612662f10881d1dfdbe2a43ac726e5cd115ba05a486a34d5` |
| Software | `1495184a2d3a166516b1fbc5be57c5dbcc9fd44eb6be3df72a67aeb5546cd9ed` | `5855d757635170c7e456da56efecb9aea2210ca399ab8cbe0d50d98f98a954d0` |
| Industrial and Scientific | `b7caf0901c77f172be833a7bf94fe52834d6da8ad429a2aeeecb922b89c5026a` | `2d0fde57bfa563108c78076d5975515124ab6175d6a1380cc990cddd7f6f20b8` |
| Prime Pantry | `2761286f45bad08ed77627a35efede9fbf0f5a00b79201829fd7b2f4fafd5594` | `12361fa10162fa47fe549ab0c55997c0e4f46a24831a78a52947a0cac5a62225` |

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
- trace replay, receipts, and hold-before-activation handling;
- the three declared outcome calculations;
- the synthetic delegation-scenario generator.

None of these should be interpreted as a production recommender implementation,
a shared-account user-identification method, a shopping-intent model, or a new
provenance standard.
