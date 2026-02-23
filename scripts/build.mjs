import { build, context } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(projectRoot, "src");
const extensionSourceDir = path.join(projectRoot, ".extension-build");
const watchMode = process.argv.includes("--watch");

const staticFiles = [
    { relativePath: "manifest.json" },
    { relativePath: "icon.png" },
    { relativePath: "popup/index.html" },
    { relativePath: "popup/styles.css" },
    { relativePath: ".amo-upload-uuid", optional: true },
];

const sharedBuildOptions = {
    entryPoints: {
        content: path.join(sourceDir, "content.ts"),
        "popup/main": path.join(sourceDir, "popup", "main.ts"),
    },
    bundle: true,
    format: "iife",
    target: ["firefox120"],
    platform: "browser",
    outdir: extensionSourceDir,
    sourcemap: watchMode ? "inline" : false,
    logLevel: "info",
    plugins: [
        {
            name: "copy-static-files",
            setup(buildInstance) {
                buildInstance.onStart(async () => {
                    await copyStaticFiles();
                });
            },
        },
    ],
};

async function prepareOutputDirectory() {
    await rm(extensionSourceDir, { recursive: true, force: true });
    await mkdir(extensionSourceDir, { recursive: true });
}

async function copyStaticFiles() {
    for (const file of staticFiles) {
        const from = path.join(sourceDir, file.relativePath);
        const to = path.join(extensionSourceDir, file.relativePath);
        await mkdir(path.dirname(to), { recursive: true });

        try {
            await cp(from, to, { force: true });
        } catch (error) {
            if (file.optional && isMissingFileError(error)) {
                continue;
            }

            throw error;
        }
    }
}

function isMissingFileError(error) {
    return Boolean(error) && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

async function runWatchMode() {
    const buildContext = await context(sharedBuildOptions);
    await buildContext.watch();
    process.stdout.write("Watching for TypeScript and static file changes...\n");

    const shutdown = async () => {
        await buildContext.dispose();
        process.exit(0);
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
}

async function runBuild() {
    await build(sharedBuildOptions);
}

async function main() {
    if (watchMode) {
        await mkdir(extensionSourceDir, { recursive: true });
        await runWatchMode();
        return;
    }

    await prepareOutputDirectory();
    await runBuild();
}

await main();
