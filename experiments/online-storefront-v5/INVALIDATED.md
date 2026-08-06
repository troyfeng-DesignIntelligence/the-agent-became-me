# Invalidated after provider execution

The v5 protocol changed candidate order between replicates A and B. Its
within-arm disagreement therefore combined provider variation with a candidate
order effect. DeepSeek completed under this protocol and MiMo was stopped after
the issue was detected. Neither output is used for the paper's action estimate.

The v6 replacement keeps candidate order identical across all four calls in a
task-model unit. A/B now differ only by independent provider calls, while the
Latin square still counterbalances condition call order.
