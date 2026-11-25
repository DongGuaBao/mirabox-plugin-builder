import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/sync-template.mjs <template directory> [--check]");
const source = resolve(input);
const target = fileURLToPath(new URL("../assets/plugin-template/", import.meta.url));
const check = process.argv.includes("--check");
const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
const dependency = manifest.dependencies["mirabox-plugin-sdk"];
if (!/^file:vendor\/mirabox-plugin-sdk-[\w.-]+\.tgz$/.test(dependency)) {
    throw new Error("Expected a versioned SDK tarball in vendor/");
}

function listFiles(directory, relative) {
    return readdirSync(join(directory, relative), { withFileTypes: true }).flatMap(entry => {
        const name = join(relative, entry.name);
        if (entry.isDirectory()) return listFiles(directory, name);
        return [name];
    });
}

const files = [
    ".env.example", ".gitignore", "manifest.json", "package.json", "package-lock.json",
    "tsconfig.json", "tsconfig.ncc.json", "tsconfig.node.json", "tsconfig.web.json", "vite.config.ts",
    dependency.slice(5),
    ...["language", "public", "script", "src"].flatMap(dir => listFiles(source, dir)),
];
if (files.some(file => pathHasLocalEnv(file))) throw new Error("Local .env file inside template source directories");
function pathHasLocalEnv(file) {
    return file.split(/[\\/]/).some(name => name === ".env" || (name.startsWith(".env.") && name !== ".env.example"));
}
const previousPackage = join(target, "package.json");
const previousSdk = existsSync(previousPackage)
    ? JSON.parse(readFileSync(previousPackage, "utf8")).dependencies?.["mirabox-plugin-sdk"]
    : undefined;
const oldArchive = /^file:vendor\/mirabox-plugin-sdk-[\w.-]+\.tgz$/.test(previousSdk) && previousSdk !== dependency
    ? resolve(target, previousSdk.slice(5))
    : undefined;
const allowed = new Set(files.map(file => resolve(target, file)));
for (const file of listFiles(target, "")) {
    if (!check && resolve(target, file) === oldArchive) continue;
    if (!allowed.has(resolve(target, file))) throw new Error("Unexpected template asset: " + file);
}
for (const file of files) {
    const src = join(source, file);
    const dest = join(target, file);
    if (existsSync(dest) && readFileSync(dest).equals(readFileSync(src))) continue;
    if (check) throw new Error("Template differs: " + file);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
}
if (!check && oldArchive && existsSync(oldArchive)) unlinkSync(oldArchive);
console.log(`${files.length} template files ${check ? "verified" : "synchronized"}.`);
