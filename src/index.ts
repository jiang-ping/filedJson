import { Readable } from 'stream';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Represents a large string that has been written to a temporary file on disk.
 */
export interface TempFile {
  /** Absolute path to the temporary file containing the original string value. */
  path: string;
  /** The original byte length of the string. */
  size: number;
}

/**
 * A JSON-compatible value where strings exceeding maxStringLength are replaced
 * by TempFile objects.
 */
export type FiledJsonValue =
  | string
  | number
  | boolean
  | null
  | TempFile
  | FiledJsonValue[]
  | { [key: string]: FiledJsonValue };

/**
 * Reads a JSON document from a Readable stream and returns a JavaScript object
 * mirroring the parsed structure, except that any string whose length exceeds
 * maxStringLength is written to a file in tmpDir and replaced by a TempFile
 * object.
 *
 * @param input          - Readable stream containing a UTF-8 encoded JSON document.
 * @param tmpDir         - Directory where large-string temp files are written.
 * @param maxStringLength - Strings with length > this value are offloaded to disk.
 * @returns              The transformed JSON value.
 */
export async function filedJson(
  input: Readable,
  tmpDir: string = '/app/data/tmp',
  maxStringLength = 1024,
): Promise<FiledJsonValue> {
  const raw = await readStream(input);
  const parsed: unknown = JSON.parse(raw);
  await fs.mkdir(tmpDir, { recursive: true });
  return transformValue(parsed, tmpDir, maxStringLength);
}

/** Collect all chunks from a Readable into a single UTF-8 string. */
async function readStream(stream: Readable): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

/**
 * Recursively walk a parsed JSON value and replace strings longer than
 * maxStringLength with TempFile objects.
 */
async function transformValue(
  value: unknown,
  tmpDir: string,
  maxStringLength: number,
): Promise<FiledJsonValue> {
  if (value === null) return null;

  if (typeof value === 'string') {
    if (value.length > maxStringLength) {
      return writeTempFile(value, tmpDir);
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    const results: FiledJsonValue[] = [];
    for (const item of value) {
      results.push(await transformValue(item, tmpDir, maxStringLength));
    }
    return results;
  }

  if (typeof value === 'object') {
    const result: { [key: string]: FiledJsonValue } = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = await transformValue(val, tmpDir, maxStringLength);
    }
    return result;
  }

  // Fallback: should not happen for valid JSON
  return null;
}

/** Write a large string to a uniquely-named temp file and return a TempFile. */
async function writeTempFile(content: string, tmpDir: string): Promise<TempFile> {
  const filename = crypto.randomUUID();
  const filePath = path.join(tmpDir, filename);
  await fs.writeFile(filePath, content, 'utf8');
  return { path: filePath, size: Buffer.byteLength(content, 'utf8') };
}
