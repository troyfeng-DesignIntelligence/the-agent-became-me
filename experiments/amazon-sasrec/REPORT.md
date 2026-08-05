# Learned SASRec on Real Commerce Sequences

## Outcome

The frozen evaluator passed with score `1.000`. The experiment replaces the
remaining MovieLens-domain and hand-authored sequential-model risks with a
trained SASRec on real Amazon product-interaction chronologies.

The data are real; the temporary delegated task is counterfactual. This is not
an experiment on Amazon's production recommender or observed AI-agent use.

## Data

- Amazon Reviews 2018, `Luxury_Beauty_5`, UCSD McAuley Lab.
- 34,278 source reviews; 34,246 events retained after the minimum-length check.
- 3,811 chronological user histories and 1,581 products.
- Per-user leave-two-out split: last event test, penultimate validation,
  preceding events training.
- Every published review is treated as an implicit interaction, matching the
  original SASRec protocol. Rating values and review text are excluded.
- Raw reviews, metadata, source IDs, and checkpoints remain in ignored
  `artifacts/`; public rows use one-way case hashes.

## Model validation

One-block SASRec uses causal multi-head self-attention, learned item and
position embeddings, residual connections, layer normalization, dropout, and
sampled binary cross-entropy. All runs use 32 hidden dimensions, two heads,
maximum length 50, and independent seeds.

| Seed | Loss, first → final epoch | SASRec HR@10 | SASRec NDCG@10 | Popularity NDCG@10 | 1st-order NDCG@10 | Reversed history changed top-10 |
|---:|---:|---:|---:|---:|---:|---:|
| 7 | 1.326 → 0.528 | 0.636 | 0.468 | 0.187 | 0.427 | 97.2% |
| 17 | 1.322 → 0.536 | 0.632 | 0.469 | 0.184 | 0.427 | 97.1% |
| 29 | 1.328 → 0.538 | 0.620 | 0.456 | 0.185 | 0.425 | 97.3% |

The model therefore learned non-trivial next-product structure, beat both
frozen controls on NDCG@10, and was observably order-sensitive.

## Task-boundary result

For 600 deterministically selected histories, low-, medium-, and high-
similarity temporary tasks were constructed from metadata-derived product-
family tokens. Each history-family pair was evaluated under every lifecycle
and every trained seed, yielding 5,400 paired rows per lifecycle.

| Lifecycle | Excess target-family slots @10 | Cases with positive spillover | Top-10 displacement | Next-item hit delta |
|---|---:|---:|---:|---:|
| Persist all four task items | +0.410 | 29.9% | 75.3% | -0.1411 |
| Commit final selected item | +0.333 | 28.6% | 70.1% | -0.1302 |
| Pre-activation quarantine | 0 | 0% | 0% | 0 |

Persist-all exposure was positive under every model seed. Outcome commit
attenuated but did not remove the effect. Quarantine exactly reproduced each
paired original ranking.

## Metadata caveat

The released Luxury Beauty metadata has empty category and brand fields for
nearly every 5-core item. Product families therefore use a frozen title-token
rule: alphabetic tokens, generic stop words removed, 25–250 catalog items, and
at least 100 interactions. Titles and tokens are never model inputs. This rule
supports an auditable exposure outcome, but it is not an official Amazon
taxonomy.

## Reproduce

```bash
pnpm amazon:sasrec:data
python -m pip install -r scripts/requirements-amazon-sasrec.txt
pnpm amazon:sasrec:run
pnpm amazon:sasrec:evaluate
```

The fetch step records source URLs, byte counts, and SHA-256 hashes. Public
results are under `public/results/amazon-sasrec/v1/`.

