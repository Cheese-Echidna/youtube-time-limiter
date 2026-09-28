import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];

if (process.argv.length !== 3 || !/^\d+(?:\.\d+){0,3}$/.test(version)) {
    console.error("Usage: pnpm set-version <version> (for example, pnpm set-version 3.5.1)");
    process.exitCode = 1;
} else {
    const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const paths = [path.join(projectRoot, "package.json"), path.join(projectRoot, "src", "manifest.json")];
    const files = await Promise.all(paths.map((file) => readFile(file, "utf8")));
    const updated = files.map((contents) => {
        const data = JSON.parse(contents);
        const versionField = /^(\s*"version"\s*:\s*)"(?:[^"\\]|\\.)*"/m;
        if (typeof data.version !== "string" || !versionField.test(contents)) {
            throw new Error("Missing version field in package or manifest");
        }
        return contents.replace(versionField, (_, prefix) => `${prefix}${JSON.stringify(version)}`);
    });

    await Promise.all(paths.map((file, index) => writeFile(file, updated[index])));
    console.log(`Set package and extension version to ${version}`);
}
