"use server";

import { readFile, readdir } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/require-permission";

async function requireAdmin() {
  const session = await requireAuth();
  if (session.user?.role !== "ADMIN") {
    throw new Error("Admin access required");
  }
  return session;
}

export type ParsedModel = {
  name: string;
  fields: Array<{ name: string; type: string; attributes: string }>;
  indexes: string[];
};

export type ParsedEnum = {
  name: string;
  values: string[];
};

export type ParsedSchema = {
  models: ParsedModel[];
  enums: ParsedEnum[];
};

/**
 * Reads prisma/schema.prisma and parses it into a display-friendly structure.
 * Not a full Prisma parser — handles the subset of syntax used in this project.
 */
export async function getParsedSchema(): Promise<ParsedSchema> {
  await requireAdmin();

  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
  const raw = await readFile(schemaPath, "utf-8");

  const models: ParsedModel[] = [];
  const enums: ParsedEnum[] = [];

  // Strip comments and split into top-level blocks
  const lines = raw.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    const modelMatch = line.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) {
      const name = modelMatch[1];
      const fields: ParsedModel["fields"] = [];
      const indexes: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("}")) {
        const fline = lines[i].trim();
        if (fline === "" || fline.startsWith("//")) {
          i++;
          continue;
        }
        if (fline.startsWith("@@index") || fline.startsWith("@@unique") || fline.startsWith("@@map")) {
          indexes.push(fline);
          i++;
          continue;
        }
        // field line: name type attributes...
        const parts = fline.split(/\s+/);
        if (parts.length >= 2) {
          const fname = parts[0];
          const ftype = parts[1];
          const attrs = parts.slice(2).join(" ");
          fields.push({ name: fname, type: ftype, attributes: attrs });
        }
        i++;
      }
      models.push({ name, fields, indexes });
      i++;
      continue;
    }

    const enumMatch = line.match(/^enum\s+(\w+)\s*\{/);
    if (enumMatch) {
      const name = enumMatch[1];
      const values: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("}")) {
        const vline = lines[i].trim();
        if (vline && !vline.startsWith("//")) values.push(vline);
        i++;
      }
      enums.push({ name, values });
      i++;
      continue;
    }

    i++;
  }

  return { models, enums };
}

export type ServerActionEntry = {
  file: string;
  exports: string[];
};

/**
 * Scans src/actions/*.ts for exported functions. Simple regex-based listing.
 * Does NOT attempt to parse signatures or permissions.
 */
export async function listServerActions(): Promise<ServerActionEntry[]> {
  await requireAdmin();

  const actionsDir = path.join(process.cwd(), "src", "actions");
  const files = await readdir(actionsDir);
  const entries: ServerActionEntry[] = [];

  for (const file of files) {
    if (!file.endsWith(".ts")) continue;
    const content = await readFile(path.join(actionsDir, file), "utf-8");
    const exports: string[] = [];
    const exportRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    if (exports.length > 0) {
      entries.push({ file, exports: exports.sort() });
    }
  }

  return entries.sort((a, b) => a.file.localeCompare(b.file));
}
