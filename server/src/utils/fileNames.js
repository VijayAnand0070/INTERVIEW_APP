import path from "node:path";

export function safeFileName(fileName) {
  const parsed = path.parse(fileName);
  const base = parsed.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${base || "file"}${parsed.ext.toLowerCase()}`;
}

export function storagePath(userId, fileName, prefix = "") {
  const suffix = `${Date.now()}-${safeFileName(fileName)}`;
  return [userId, prefix, suffix].filter(Boolean).join("/");
}

