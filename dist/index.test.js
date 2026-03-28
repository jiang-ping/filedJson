"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
const fs_1 = require("fs");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const index_1 = require("./index");
function toStream(json) {
    return stream_1.Readable.from([JSON.stringify(json)]);
}
async function makeTmpDir() {
    return fs_1.promises.mkdtemp(path.join(os.tmpdir(), 'filedjson-test-'));
}
describe('filedJson', () => {
    let tmpDir;
    beforeEach(async () => {
        tmpDir = await makeTmpDir();
    });
    afterEach(async () => {
        await fs_1.promises.rm(tmpDir, { recursive: true, force: true });
    });
    test('returns primitives unchanged', async () => {
        const input = { num: 42, flag: true, nothing: null };
        const result = await (0, index_1.filedJson)(toStream(input), tmpDir, 10);
        expect(result).toEqual(input);
    });
    test('short strings are kept inline', async () => {
        const input = { greeting: 'hello' };
        const result = await (0, index_1.filedJson)(toStream(input), tmpDir, 10);
        expect(result).toEqual(input);
    });
    test('strings exceeding maxStringLength are replaced by TempFile', async () => {
        const longStr = 'a'.repeat(20);
        const input = { value: longStr };
        const result = await (0, index_1.filedJson)(toStream(input), tmpDir, 10);
        expect(typeof result.value).toBe('object');
        const tf = result.value;
        expect(typeof tf.path).toBe('string');
        expect(tf.path.startsWith(tmpDir)).toBe(true);
        expect(tf.size).toBe(20);
        // The original content must be in the file
        const stored = await fs_1.promises.readFile(tf.path, 'utf8');
        expect(stored).toBe(longStr);
    });
    test('strings exactly at maxStringLength are kept inline', async () => {
        const str = 'a'.repeat(10);
        const input = { value: str };
        const result = await (0, index_1.filedJson)(toStream(input), tmpDir, 10);
        expect(result).toEqual(input);
    });
    test('strings one character over limit are offloaded', async () => {
        const str = 'a'.repeat(11);
        const input = { value: str };
        const result = await (0, index_1.filedJson)(toStream(input), tmpDir, 10);
        expect(typeof result.value).toBe('object');
        expect(result.value.size).toBe(11);
    });
    test('nested objects are traversed recursively', async () => {
        const longStr = 'x'.repeat(50);
        const input = { outer: { inner: longStr, short: 'hi' } };
        const result = await (0, index_1.filedJson)(toStream(input), tmpDir, 10);
        expect(result.outer.short).toBe('hi');
        const tf = result.outer.inner;
        expect(typeof tf.path).toBe('string');
        const stored = await fs_1.promises.readFile(tf.path, 'utf8');
        expect(stored).toBe(longStr);
    });
    test('arrays are traversed and large strings offloaded', async () => {
        const longStr = 'y'.repeat(50);
        const input = ['short', longStr, 123];
        const result = await (0, index_1.filedJson)(toStream(input), tmpDir, 10);
        expect(result[0]).toBe('short');
        expect(result[2]).toBe(123);
        const tf = result[1];
        expect(typeof tf.path).toBe('string');
        const stored = await fs_1.promises.readFile(tf.path, 'utf8');
        expect(stored).toBe(longStr);
    });
    test('multiple large strings create separate temp files', async () => {
        const str1 = 'a'.repeat(20);
        const str2 = 'b'.repeat(30);
        const input = { a: str1, b: str2 };
        const result = await (0, index_1.filedJson)(toStream(input), tmpDir, 10);
        expect(result.a.path).not.toBe(result.b.path);
        expect(await fs_1.promises.readFile(result.a.path, 'utf8')).toBe(str1);
        expect(await fs_1.promises.readFile(result.b.path, 'utf8')).toBe(str2);
    });
    test('default tmpDir is created when it does not exist', async () => {
        const nonExistent = path.join(tmpDir, 'deep', 'nested');
        const longStr = 'z'.repeat(20);
        const input = { value: longStr };
        const result = await (0, index_1.filedJson)(toStream(input), nonExistent, 10);
        const tf = result.value;
        expect(tf.path.startsWith(nonExistent)).toBe(true);
        const stored = await fs_1.promises.readFile(tf.path, 'utf8');
        expect(stored).toBe(longStr);
        // cleanup
        await fs_1.promises.rm(nonExistent, { recursive: true, force: true });
    });
    test('top-level string is offloaded', async () => {
        const longStr = 'w'.repeat(100);
        const result = await (0, index_1.filedJson)(stream_1.Readable.from([JSON.stringify(longStr)]), tmpDir, 10);
        expect(typeof result.path).toBe('string');
        const stored = await fs_1.promises.readFile(result.path, 'utf8');
        expect(stored).toBe(longStr);
    });
    test('top-level array with only primitives unchanged', async () => {
        const input = [1, 2, 3, true, null];
        const result = await (0, index_1.filedJson)(toStream(input), tmpDir, 10);
        expect(result).toEqual(input);
    });
});
//# sourceMappingURL=index.test.js.map