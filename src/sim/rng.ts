export interface RandomStream {
  next(): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(values: readonly T[]): T;
  fork(label: string): RandomStream;
}

function xmur3(value: string): () => number {
  let hash = 1779033703 ^ value.length;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export class NamedRandomStream implements RandomStream {
  readonly key: string;
  private readonly generator: () => number;

  constructor(seed: string | number, label = "root") {
    this.key = `${seed}:${label}`;
    const seedFactory = xmur3(this.key);
    this.generator = mulberry32(seedFactory());
  }

  next(): number {
    return this.generator();
  }

  int(min: number, maxInclusive: number): number {
    if (maxInclusive < min) {
      throw new Error("maxInclusive must be greater than or equal to min");
    }
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) {
      throw new Error("Cannot pick from an empty array");
    }
    return values[this.int(0, values.length - 1)];
  }

  fork(label: string): RandomStream {
    return new NamedRandomStream(this.key, label);
  }
}
