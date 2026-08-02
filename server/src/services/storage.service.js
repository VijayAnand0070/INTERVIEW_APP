import fs from "node:fs/promises";
import { supabaseAdmin } from "../config/supabase.js";

export async function uploadLocalFile({ bucket, filePath, destination, contentType }) {
  const buffer = await fs.readFile(filePath);
  return uploadBuffer({ bucket, buffer, destination, contentType });
}

export async function uploadBuffer({ bucket, buffer, destination, contentType }) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(destination, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw error;
  return data.path;
}

export async function createSignedUrl(bucket, filePath, expiresIn = 60 * 60) {
  if (!filePath) return null;

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

export async function removeLocalFile(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") console.warn(`Could not remove ${filePath}`, error);
  }
}

