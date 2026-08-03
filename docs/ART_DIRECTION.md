# Art Direction and Image Provenance

## Direction

The interface is art-directed as an evidence exhibition: a temporary delegated
action enters an archive, crosses a persistence gate, and is misfiled as a
durable property of the principal. The visual language combines museum
registration systems, forensic light tables, physical paper traces, editorial
typography, and explicit data graphics.

The core palette is deliberately narrow:

- carbon black for the exhibition space;
- bone white for evidence documents;
- cobalt blue for delegated evidence;
- vermilion red for the principal record and contested persistence;
- small aged-brass accents inside the generated specimens.

The type system separates exhibition headlines, editorial interpretation, and
machine-readable evidence: IBM Plex Sans, Newsreader, and IBM Plex Mono.

## Method-level references

Two Awwwards projects informed the design method:

- [Tracing Art by Getty / Resn](https://www.awwwards.com/sites/tracing-art):
  provenance is made spatial and navigable through archival material, data
  visualization, hover, and scroll behavior.
- [The ADHD Experience by Wix Studio](https://www.awwwards.com/sites/the-adhd-experience):
  interaction, typography, and a constrained high-contrast palette express the
  subject rather than decorating a conventional product layout.

No layout, asset, typography file, animation, copy, or source code was copied.
The transferable principles were: make data physical, make interaction carry
the argument, and use a compact palette with strong editorial hierarchy.

## Generated assets

Both committed artworks were generated with OpenAI's built-in image-generation
tool, converted from the original PNG output to WebP, and integrated as
decorative concept art. They are not study data. The interface also states this
boundary next to the hero artwork.

### Evidence reliquary

Committed path: `public/assets/evidence-reliquary.webp`

Final prompt:

```text
Use case: stylized-concept
Asset type: portfolio research website hero artwork
Primary request: Create an original museum-grade editorial photograph of a physical evidence reliquary that represents an AI agent's temporary actions being misfiled as a person's enduring identity.
Scene/backdrop: cavernous matte charcoal studio, almost black, with a narrow cold overhead spotlight and a faint bone-colored floor plane.
Subject: one tall black anodized-metal specimen frame standing vertically. Inside it, layered translucent vellum, thermal-receipt paper, punched paper strips, fine cobalt-blue threads and vermilion-red threads pass through small brass pins and a central mechanical gate. On the left, the evidence remains separated; on the right, several strands collapse into one dense dark fingerprint-like mass. Include tiny blank specimen tabs and registration marks, but absolutely no readable text or numbers.
Style/medium: large-format analog editorial still-life photography, 1970s conceptual art and museum conservation lab sensibility, tactile paper fibers, subtle dust, imperfect real materials, restrained film grain. Sophisticated art-direction, not a tech product render.
Composition/framing: portrait 4:5 composition, full object visible, slight low angle, asymmetric placement with useful dark negative space around the object, dramatic but calm.
Lighting/mood: cold museum spotlight, deep shadows, high contrast, serious, archival, forensic, uncanny.
Color palette: carbon black, bone white, electric cobalt blue, vermilion red, tiny brass accents only.
Constraints: no people, no faces, no robots, no human brain, no computer screen, no legible typography, no logos, no watermark.
Avoid: generic AI gradients, purple-blue glow, glassmorphism, glossy floating orb, holograms, cyberpunk, neon circuits, chrome, vaporwave, plastic 3D illustration, stock-photo polish.
```

### Trace field

Committed path: `public/assets/trace-field.webp`

Final prompt:

```text
Use case: stylized-concept
Asset type: full-width chapter transition image for an experimental research portfolio website
Primary request: Create an original panoramic editorial photograph of a physical trace field showing evidence crossing a boundary and changing meaning.
Scene/backdrop: top-down view of a cold museum light table surrounded by deep charcoal darkness.
Subject: dozens of long translucent paper ribbons, perforated receipt strips, cobalt-blue threads, vermilion threads, and tiny brass registration pins travel horizontally across the frame. At the center is one severe black metal aperture or gate. Before the gate, the blue and red strands remain separate and orderly; after the gate, they are misregistered, braided, stamped, and layered into a dense archival record. Include a few blank cream specimen tags and crop marks, but no readable text.
Style/medium: large-format analog editorial photography, physical paper installation, museum archive and forensic lab, subtle film grain, tactile dust and fibers, visually precise rather than futuristic.
Composition/framing: very wide panoramic composition, strong left-to-right movement, central gate, generous dark negative space at top and bottom for responsive cropping.
Lighting/mood: cold light-table glow against black, crisp material shadows, investigative and cinematic.
Color palette: carbon black, bone white, cobalt blue, vermilion red, tiny aged-brass accents.
Constraints: no people, no faces, no robots, no screens, no legible typography, no logos, no watermark.
Avoid: generic AI imagery, gradients, glassmorphism, glossy orb, hologram, cyberpunk circuits, neon glow, chrome, plastic 3D render, stock photography.
```

## Interface boundary

The imagery explains the metaphor; the charts, tables, receipts, and metrics
remain generated directly from committed deterministic artifacts. Image files
are not imported by the simulator, evaluator, experiment runner, or artifact
verification scripts. Removing them changes presentation only, not results.

Motion is progressive enhancement. The site disables nonessential entrance and
hover motion when `prefers-reduced-motion: reduce` is active. Exact-value tables
remain available behind every analytical figure.
