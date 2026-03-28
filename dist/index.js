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
exports.filedJson = filedJson;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
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
async function filedJson(input, tmpDir = '/app/data/tmp', maxStringLength = 1024) {
    const raw = await readStream(input);
    const parsed = JSON.parse(raw);
    await fs_1.promises.mkdir(tmpDir, { recursive: true });
    return transformValue(parsed, tmpDir, maxStringLength);
}
/** Collect all chunks from a Readable into a single UTF-8 string. */
async function readStream(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => {
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
async function transformValue(value, tmpDir, maxStringLength) {
    if (value === null)
        return null;
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
        const results = [];
        for (const item of value) {
            results.push(await transformValue(item, tmpDir, maxStringLength));
        }
        return results;
    }
    if (typeof value === 'object') {
        const result = {};
        for (const [key, val] of Object.entries(value)) {
            result[key] = await transformValue(val, tmpDir, maxStringLength);
        }
        return result;
    }
    // Fallback: should not happen for valid JSON
    return null;
}
/** Write a large string to a uniquely-named temp file and return a TempFile. */
async function writeTempFile(content, tmpDir) {
    const filename = crypto.randomUUID();
    const filePath = path.join(tmpDir, filename);
    await fs_1.promises.writeFile(filePath, content, 'utf8');
    return { path: filePath, size: Buffer.byteLength(content, 'utf8') };
}
//# sourceMappingURL=index.js.map