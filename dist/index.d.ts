import { Readable } from 'stream';
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
export type FiledJsonValue = string | number | boolean | null | TempFile | FiledJsonValue[] | {
    [key: string]: FiledJsonValue;
};
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
export declare function filedJson(input: Readable, tmpDir?: string, maxStringLength?: number): Promise<FiledJsonValue>;
//# sourceMappingURL=index.d.ts.map