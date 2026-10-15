# Anonymous HAI 2026 poster source

Compile `main.tex` with a current LaTeX distribution and BibTeX. The packaged
`acmart.cls` and `ACM-Reference-Format.bst` are generated from the ACM/CTAN
`acmart` 2.19 release dated 2026-06-27.

Example:

```sh
latexmk -pdf main.tex
```

The submitted manuscript uses
`\documentclass[sigconf,review,anonymous]{acmart}`. Do not add author names,
affiliations, acknowledgements, identifying repository URLs, or non-anonymous
supplement links to the review PDF.
