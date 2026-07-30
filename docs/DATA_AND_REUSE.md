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

Purpose, processing, duration, and consent-related fields are informed by the W3C
Data Privacy Vocabulary:
<https://www.w3.org/community/dpvcg/wiki/Main_Page>.

This is a compact application profile, not a claim of complete PROV-O or DPV
conformance.

## Research simulators consulted

- RecSim — configurable sequential recommender simulation, Apache-2.0:
  <https://github.com/google-research/recsim>
- T-RECS — sociotechnical recommender simulation:
  <https://elucherini.github.io/t-recs/>

The browser testbed does not embed either Python framework. It reuses their
separation between environment, user/agent response, recommendation policy, and
metrics while remaining small enough to inspect in a portfolio review.

## Interface and analysis libraries

- React — component and state composition.
- D3 — scales, shapes, and interpolation for custom SVG figures.
- Zod — one runtime schema as the source for TypeScript types and validation.
- IBM Plex and Newsreader — locally bundled open fonts.

## Deliberately local code

The following are short, project-specific mechanisms whose inspectability is part
of the artifact:

- named deterministic random streams;
- the provenance-aware profile-update contracts;
- trace replay and rollback;
- the three registered metrics;
- the synthetic delegation-scenario generator.

None of these should be interpreted as a production recommender implementation.
