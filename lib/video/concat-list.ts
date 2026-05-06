import fs from "node:fs";
import path from "node:path";

/**
 * Writes a concat-demuxer manifest file at `manifestPath` referencing each
 * input in order. The ffmpeg concat demuxer is picky about quoting:
 *
 *   - Each entry is `file '<absolute path>'`.
 *   - Single quotes inside the path must be escaped using the demuxer's
 *     `'\''` recipe (close quote, escape, reopen).
 *
 * Only absolute paths are accepted — passing relative paths through the
 * demuxer is a foot-gun (it resolves them against the manifest's directory,
 * not the cwd) so we reject them up front.
 */
export async function writeConcatList(
  manifestPath: string,
  inputs: string[],
): Promise<void> {
  if (inputs.length === 0) {
    throw new Error("writeConcatList: no inputs supplied.");
  }
  const lines: string[] = [];
  for (const input of inputs) {
    if (!path.isAbsolute(input)) {
      throw new Error(
        `writeConcatList: input path must be absolute, got "${input}".`,
      );
    }
    const escaped = input.replace(/'/gu, "'\\''");
    lines.push(`file '${escaped}'`);
  }
  await fs.promises.writeFile(manifestPath, `${lines.join("\n")}\n`, "utf8");
}
