# Data License and Attribution

The project code and documentation are licensed under the [MIT License](https://opensource.org/license/mit). Data artifacts have a separate license:

| Material | Paths | License |
| --- | --- | --- |
| Open Food Facts metadata snapshot | `public/data/open-food-facts.snapshot.json` and built copies | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Experiment results derived from that snapshot | `public/results/v1/*.json` and built copies | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| GroupLens MovieLens 100K input | Downloaded only to ignored `artifacts/datasets/movielens-100k/`; not redistributed | GroupLens research-use terms in the official `README` |
| External-validation outputs | `public/results/external-validity/v1/*.json`; case hashes and experiment metrics only | Project-generated analysis; source MovieLens terms still govern the required input |
| Amazon Reviews 2018 inputs | Four categories downloaded only to ignored `artifacts/datasets/amazon-*-2018/`; not redistributed | UCSD McAuley Lab research dataset; cite Ni, Li, and McAuley (EMNLP 2019) |
| Learned SASRec outputs | `public/results/amazon-sasrec/v1/*.json` and `public/results/amazon-cross-category/v1/*.json`; one-way case hashes and derived metrics only | Project-generated analysis; source dataset terms still govern the required input |
| Shopping-agent activation outputs | `public/results/delegated-activation/v1/*.json` and `public/evidence/delegated-activation/v1/*`; one-way task/item hashes, derived metrics, and redacted evidence images only | Project-generated analysis; source Amazon Reviews 2018 terms still govern the required input |
| Online research-store outputs | `public/results/online-storefront-pilot/v1/*.json` and `public/evidence/online-storefront-pilot/v1/*`; pseudonymous product IDs, derived metrics, and screenshots of the research-owned interface | Project-generated analysis; the bundled Open Food Facts snapshot remains governed by ODbL 1.0 |
| Online storefront v2 outputs | `public/results/online-storefront-v2/v1/*.json`; pseudonymous task/item IDs, paired metrics, aggregate uncertainty, integrity hashes, and representative frozen SASRec slates only | Project-generated analysis; source Amazon Reviews 2018 terms still govern the required input |
| Online storefront model-robustness outputs | `public/results/online-storefront-model-robustness/v1/*.json`; pseudonymous task IDs, derived SASRec/GRU metrics, paired contrasts, uncertainty, and integrity hashes only | Project-generated analysis; source Amazon Reviews 2018 terms still govern the required input |

Attribution: Contains information from [Open Food Facts](https://world.openfoodfacts.org/), made available under the Open Database License. Open Food Facts provides its reuse terms at [world.openfoodfacts.org/terms-of-use](https://world.openfoodfacts.org/terms-of-use).

The MIT license for project code and documentation does not replace the ODbL terms for the snapshot or database-derived outputs.

The MovieLens fetch script downloads `u.data`, `u.item`, and the official
`README` from GroupLens. The raw files, original user IDs, movie titles, and
injected movie IDs are not committed. Publications must acknowledge MovieLens
as requested in its README, including Harper and Konstan (2015),
<https://doi.org/10.1145/2827872>. GroupLens does not permit public
redistribution of the raw dataset without separate permission.

The Amazon fetch scripts download the official `Luxury_Beauty_5`, `Software_5`,
`Industrial_and_Scientific_5`, and `Prime_Pantry_5` review files and matching
metadata from the UCSD McAuley Lab. Raw reviews, product metadata,
original reviewer and item IDs, titles, and model checkpoints remain ignored.
Public rows include domain-separated case hashes and metrics only. Publications
using the data should cite Jianmo Ni, Jiacheng Li, and Julian McAuley,
“Justifying Recommendations using Distantly-Labeled Reviews and Fine-Grained
Aspects,” EMNLP-IJCNLP 2019.

The delegated-activation artifacts add generated task and agent traces over the
same frozen Amazon-derived research environment. They do not redistribute raw
reviews, titles, original IDs, or model checkpoints. Public task and item IDs
are one-way hashes, and the timeline images contain only redacted identifiers.

The online-storefront-v2 artifacts use the same ignored Amazon-derived inputs
and checkpoints. The public browser replay contains pseudonymous model outputs,
not the raw histories, source identifiers, product titles, metadata, or model
weights required to reconstruct the original records.
