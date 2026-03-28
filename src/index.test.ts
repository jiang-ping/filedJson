import { Readable } from 'stream';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { filedJson, TempFile } from './index';

function toStream(json: unknown): Readable {
  return Readable.from([JSON.stringify(json)]);
}

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'filedjson-test-'));
}

describe('filedJson', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('returns primitives unchanged', async () => {
    const input = { num: 42, flag: true, nothing: null };
    const result = await filedJson(toStream(input), tmpDir, 10);
    expect(result).toEqual(input);
  });

  test('short strings are kept inline', async () => {
    const input = { greeting: 'hello' };
    const result = await filedJson(toStream(input), tmpDir, 10);
    expect(result).toEqual(input);
  });

  test('strings exceeding maxStringLength are replaced by TempFile', async () => {
    const longStr = 'a'.repeat(20);
    const input = { value: longStr };
    const result = await filedJson(toStream(input), tmpDir, 10) as { value: TempFile };

    expect(typeof result.value).toBe('object');
    const tf = result.value as TempFile;
    expect(typeof tf.path).toBe('string');
    expect(tf.path.startsWith(tmpDir)).toBe(true);
    expect(tf.size).toBe(20);

    // The original content must be in the file
    const stored = await fs.readFile(tf.path, 'utf8');
    expect(stored).toBe(longStr);
  });

  test('strings exactly at maxStringLength are kept inline', async () => {
    const str = 'a'.repeat(10);
    const input = { value: str };
    const result = await filedJson(toStream(input), tmpDir, 10);
    expect(result).toEqual(input);
  });

  test('strings one character over limit are offloaded', async () => {
    const str = 'a'.repeat(11);
    const input = { value: str };
    const result = await filedJson(toStream(input), tmpDir, 10) as { value: TempFile };
    expect(typeof result.value).toBe('object');
    expect((result.value as TempFile).size).toBe(11);
  });

  test('nested objects are traversed recursively', async () => {
    const longStr = 'x'.repeat(50);
    const input = { outer: { inner: longStr, short: 'hi' } };
    const result = await filedJson(toStream(input), tmpDir, 10) as {
      outer: { inner: TempFile; short: string };
    };

    expect(result.outer.short).toBe('hi');
    const tf = result.outer.inner as TempFile;
    expect(typeof tf.path).toBe('string');
    const stored = await fs.readFile(tf.path, 'utf8');
    expect(stored).toBe(longStr);
  });

  test('arrays are traversed and large strings offloaded', async () => {
    const longStr = 'y'.repeat(50);
    const input = ['short', longStr, 123];
    const result = await filedJson(toStream(input), tmpDir, 10) as [string, TempFile, number];

    expect(result[0]).toBe('short');
    expect(result[2]).toBe(123);
    const tf = result[1] as TempFile;
    expect(typeof tf.path).toBe('string');
    const stored = await fs.readFile(tf.path, 'utf8');
    expect(stored).toBe(longStr);
  });

  test('multiple large strings create separate temp files', async () => {
    const str1 = 'a'.repeat(20);
    const str2 = 'b'.repeat(30);
    const input = { a: str1, b: str2 };
    const result = await filedJson(toStream(input), tmpDir, 10) as {
      a: TempFile;
      b: TempFile;
    };

    expect(result.a.path).not.toBe(result.b.path);
    expect(await fs.readFile(result.a.path, 'utf8')).toBe(str1);
    expect(await fs.readFile(result.b.path, 'utf8')).toBe(str2);
  });

  test('default tmpDir is created when it does not exist', async () => {
    const nonExistent = path.join(tmpDir, 'deep', 'nested');
    const longStr = 'z'.repeat(20);
    const input = { value: longStr };
    const result = await filedJson(toStream(input), nonExistent, 10) as { value: TempFile };

    const tf = result.value as TempFile;
    expect(tf.path.startsWith(nonExistent)).toBe(true);
    const stored = await fs.readFile(tf.path, 'utf8');
    expect(stored).toBe(longStr);

    // cleanup
    await fs.rm(nonExistent, { recursive: true, force: true });
  });

  test('top-level string is offloaded', async () => {
    const longStr = 'w'.repeat(100);
    const result = await filedJson(Readable.from([JSON.stringify(longStr)]), tmpDir, 10) as TempFile;
    expect(typeof result.path).toBe('string');
    const stored = await fs.readFile(result.path, 'utf8');
    expect(stored).toBe(longStr);
  });

  test('top-level array with only primitives unchanged', async () => {
    const input = [1, 2, 3, true, null];
    const result = await filedJson(toStream(input), tmpDir, 10);
    expect(result).toEqual(input);
  });
});
