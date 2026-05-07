// Blog utility — gray-matter kullanmıyor, saf tarayıcı uyumlu parser

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  tags: string[];
  image: string;
  author: string;
  readingTime: number;
  content: string;
}

// --- Minimal frontmatter parser (browser uyumlu) ---

function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  if (!raw.trimStart().startsWith("---")) {
    return { data: {}, content: raw };
  }

  const afterFirst = raw.trimStart().slice(3);
  const endIdx = afterFirst.indexOf("\n---");
  if (endIdx === -1) {
    return { data: {}, content: raw };
  }

  const yaml = afterFirst.slice(0, endIdx).trim();
  const body = afterFirst.slice(endIdx + 4).trim();

  const data: Record<string, unknown> = {};

  for (const line of yaml.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const rawVal = line.slice(colonIdx + 1).trim();

    if (!key) continue;

    // Array: [a, b, c] veya ["a", "b"]
    if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
      data[key] = rawVal
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      continue;
    }

    // String tırnak kaldır
    const unquoted = rawVal.replace(/^["']|["']$/g, "");

    // Sayı
    if (unquoted !== "" && !isNaN(Number(unquoted))) {
      data[key] = Number(unquoted);
      continue;
    }

    data[key] = unquoted;
  }

  return { data, content: body };
}

// --- import.meta.glob ile tüm .md'leri raw string olarak yükle ---

const modules = import.meta.glob("../blog/posts/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function parsePost(raw: string, slug: string): BlogPost {
  const { data, content } = parseFrontmatter(raw);

  const wordCount = content.split(/\s+/).length;

  return {
    slug,
    title:        (data.title as string)       ?? "Başlıksız",
    description:  (data.description as string) ?? "",
    date:         String(data.date              ?? ""),
    category:     (data.category as string)    ?? "Genel",
    tags:         (data.tags as string[])      ?? [],
    image:        (data.image as string)       ?? "/blog/default.jpg",
    author:       (data.author as string)      ?? "Turzz AI",
    readingTime:  (data.readingTime as number) ?? Math.ceil(wordCount / 200),
    content,
  };
}

export function getAllPosts(): BlogPost[] {
  const entries = Object.entries(modules);
  if (entries.length === 0) return [];

  return entries
    .map(([path, raw]) => {
      const slug = path.replace("../blog/posts/", "").replace(".md", "");
      try {
        return parsePost(raw, slug);
      } catch {
        return null;
      }
    })
    .filter((p): p is BlogPost => p !== null)
    .sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  const key = `../blog/posts/${slug}.md`;
  const raw = modules[key];
  if (!raw) return undefined;
  try {
    return parsePost(raw, slug);
  } catch {
    return undefined;
  }
}

export function getAllCategories(): string[] {
  return [...new Set(getAllPosts().map((p) => p.category))];
}
