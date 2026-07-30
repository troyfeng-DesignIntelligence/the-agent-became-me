import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "public/data/open-food-facts.snapshot.json");
const USER_AGENT =
  "TheAgentBecameMe/0.1 (portfolio research; contact: troyfeng.design@gmail.com)";

const categories = [
  "breakfast-cereals",
  "snacks",
  "plant-based-beverages",
  "energy-bars",
  "yogurts"
];

const gradeScore = {
  "a-plus": 1,
  a: 0.92,
  "a-minus": 0.86,
  b: 0.74,
  c: 0.56,
  d: 0.36,
  e: 0.16,
  f: 0.08
};

const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));

function firstEnglishName(product) {
  return (
    product.product_name_en?.trim() ||
    product.product_name?.trim() ||
    product.generic_name_en?.trim() ||
    ""
  );
}

function hasTag(product, values) {
  const tags = [...(product.labels_tags ?? []), ...(product.categories_tags ?? [])];
  return values.some((value) => tags.includes(value));
}

function mapProduct(product, category, popularityMax) {
  const nutrition = gradeScore[product.nutriscore_grade] ?? 0.5;
  const sustainability = gradeScore[product.ecoscore_grade] ?? 0.5;
  const nova = Number(product.nova_group);
  const lowProcessing = Number.isFinite(nova)
    ? clamp((4 - nova) / 3)
    : 0.5;
  const plantBased = hasTag(product, ["en:vegan"])
    ? 1
    : hasTag(product, ["en:vegetarian", "en:plant-based-foods"])
      ? 0.8
      : 0.25;
  const indulgence = clamp(
    0.58 * (1 - nutrition) + 0.42 * (1 - lowProcessing)
  );
  const popularityRaw = Math.max(0, Number(product.unique_scans_n ?? 0));
  const popularity =
    popularityMax > 0
      ? clamp(Math.log1p(popularityRaw) / Math.log1p(popularityMax))
      : 0.5;

  return {
    id: `off-${product.code}`,
    sourceCode: String(product.code),
    name: firstEnglishName(product),
    category,
    sourceCategoryTags: product.categories_tags ?? [],
    attributes: {
      nutrition: Number(nutrition.toFixed(4)),
      sustainability: Number(sustainability.toFixed(4)),
      plantBased: Number(plantBased.toFixed(4)),
      lowProcessing: Number(lowProcessing.toFixed(4)),
      indulgence: Number(indulgence.toFixed(4))
    },
    popularity: Number(popularity.toFixed(4)),
    allergens: (product.allergens_tags ?? []).filter((tag) =>
      String(tag).startsWith("en:")
    ),
    labels: (product.labels_tags ?? []).filter((tag) =>
      String(tag).startsWith("en:")
    ),
    evidence: {
      nutriScore: product.nutriscore_grade ?? null,
      ecoScore: product.ecoscore_grade ?? null,
      novaGroup: Number.isFinite(nova) ? nova : null,
      uniqueScans: popularityRaw
    },
    sourceUrl: `https://world.openfoodfacts.org/product/${product.code}`
  };
}

async function fetchCategory(category) {
  const fields = [
    "code",
    "product_name",
    "product_name_en",
    "generic_name_en",
    "categories_tags",
    "nutriscore_grade",
    "ecoscore_grade",
    "nova_group",
    "allergens_tags",
    "labels_tags",
    "unique_scans_n"
  ].join(",");
  const url = new URL("https://world.openfoodfacts.org/api/v2/search");
  url.searchParams.set("categories_tags", `en:${category}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("sort_by", "unique_scans_n");
  url.searchParams.set("page_size", "30");
  url.searchParams.set("page", "1");

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT
      }
    });

    if (response.ok) {
      const payload = await response.json();
      return (payload.products ?? []).filter(
        (product) => product.code && firstEnglishName(product)
      );
    }

    if (![429, 502, 503, 504].includes(response.status) || attempt === 4) {
      throw new Error(`${category}: Open Food Facts returned ${response.status}`);
    }

    await new Promise((resolveDelay) =>
      setTimeout(resolveDelay, 700 * attempt)
    );
  }
  return [];
}

async function main() {
  const grouped = [];
  for (const category of categories) {
    grouped.push({
      category,
      products: await fetchCategory(category)
    });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }

  const popularityMax = Math.max(
    1,
    ...grouped.flatMap(({ products }) =>
      products.map((product) => Number(product.unique_scans_n ?? 0))
    )
  );

  const seen = new Set();
  const products = [];
  for (const { category, products: rows } of grouped) {
    for (const row of rows) {
      if (seen.has(row.code)) continue;
      if (products.filter((product) => product.category === category).length >= 18) {
        break;
      }
      seen.add(row.code);
      products.push(mapProduct(row, category, popularityMax));
    }
  }

  products.sort((a, b) => a.id.localeCompare(b.id));

  if (products.length < 40) {
    throw new Error(
      `Catalog snapshot is too small (${products.length}); expected at least 40 products.`
    );
  }

  const output = {
    schemaVersion: "catalog.v1",
    generatedAt: new Date().toISOString(),
    source: {
      name: "Open Food Facts",
      api: "https://world.openfoodfacts.org/api/v2/search",
      documentation:
        "https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/",
      license: "Open Database License (ODbL) 1.0",
      licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
      attribution:
        "Contains information from Open Food Facts, made available under the Open Database License."
    },
    transformations: [
      "Product images and review or user-level records are excluded.",
      "Five normalized profile axes are derived from Nutri-Score, Eco-Score, NOVA group, and explicit dietary labels.",
      "Missing public fields are mapped to a neutral 0.5 value and remain inspectable in evidence."
    ],
    categories,
    productCount: products.length,
    products
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote ${products.length} products to ${OUTPUT}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
