import { defineCollection } from "astro:content";
import { file } from "astro/loaders";
import { z } from "astro/zod";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a #rrggbb color");

const palette = z
  .object({ bg: color, fg: color, accent: color, card: color })
  .strict();

const linkItem = z
  .object({
    type: z.literal("link"),
    label: z.string().min(1),
    url: z.url(),
    icon: z.string().optional(),
  })
  .strict();

const siteSchema = z
  .object({
    profile: z
      .object({
        name: z.string().min(1),
        bio: z.string().optional(),
        avatar: z.object({ src: z.string().min(1), alt: z.string() }).strict(),
      })
      .strict(),
    meta: z
      .object({
        title: z.string().min(1),
        description: z.string().min(1),
        ogImage: z.string().optional(),
      })
      .strict(),
    theme: z.object({ light: palette, dark: palette }).strict(),
    background: z.object({ enabled: z.boolean(), effect: z.string() }).strict(),
    sections: z.array(
      z
        .object({
          heading: z.string().optional(),
          items: z.array(z.discriminatedUnion("type", [linkItem])),
        })
        .strict(),
    ),
  })
  .strict();

// The file() loader treats an object's top-level keys as entry ids, so the whole document is wrapped as one entry.
const site = defineCollection({
  loader: file("src/data/site.json", {
    parser: (text) => ({ site: JSON.parse(text) }),
  }),
  schema: siteSchema,
});

export const collections = { site };
