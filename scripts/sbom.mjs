// Software bill of materials (CycloneDX 1.5 JSON) for the widget release: node scripts/sbom.mjs
// Lists what is really bundled (measured on the module graph, like check-licenses.mjs) plus the Mendix-provided
// externals, and writes dist/<version>/sbom.cdx.json. The SHA-256 of the release .mpk is added when it exists.
// No dependencies beyond esbuild (already used by the build tooling).
import { build } from "esbuild";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const EXTERNAL = ["react", "react-dom", "react/jsx-runtime", "mendix", "mendix/*", "big.js"];

function packageRoot(file) {
    const parts = file.split(/[\\/]/);
    const index = parts.lastIndexOf("node_modules");
    if (index < 0) {
        return undefined;
    }
    const depth = parts[index + 1].startsWith("@") ? 3 : 2;
    return parts.slice(0, index + depth).join(sep);
}

function licenceOf(manifest) {
    const value = manifest.license ?? manifest.licenses;
    if (typeof value === "string") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(entry => entry.type ?? entry).join(" OR ");
    }
    return value?.type ?? "UNKNOWN";
}

function purl(name, version) {
    const encoded = name.startsWith("@") ? `%40${name.slice(1)}` : name;
    return `pkg:npm/${encoded}@${version}`;
}

function component(manifest, scope = "required") {
    const licence = licenceOf(manifest);
    return {
        type: "library",
        "bom-ref": purl(manifest.name, manifest.version),
        name: manifest.name,
        version: manifest.version,
        scope,
        purl: purl(manifest.name, manifest.version),
        licenses: [/\s(OR|AND)\s/.test(licence) ? { expression: licence } : { license: { id: licence } }],
        ...(manifest.homepage ? { externalReferences: [{ type: "website", url: manifest.homepage }] } : {})
    };
}

const result = await build({
    entryPoints: [join(root, "src", `${pkg.widgetName}.tsx`)],
    bundle: true,
    write: false,
    metafile: true,
    format: "esm",
    jsx: "automatic",
    external: EXTERNAL,
    loader: { ".css": "empty", ".png": "empty" },
    logLevel: "silent"
});
const bundled = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
    const dir = packageRoot(join(root, input));
    if (!dir) {
        continue;
    }
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    bundled.set(`${manifest.name}@${manifest.version}`, manifest);
}
const externals = ["react", "react-dom", "big.js"]
    .map(name => join(root, "node_modules", name, "package.json"))
    .filter(existsSync)
    .map(file => JSON.parse(readFileSync(file, "utf8")));

const version = pkg.version;
const outDir = join(root, "dist", version);
mkdirSync(outDir, { recursive: true });
const mpk = join(outDir, pkg.mxpackage.mpkName);
const hashes = existsSync(mpk)
    ? [{ alg: "SHA-256", content: createHash("sha256").update(readFileSync(mpk)).digest("hex") }]
    : undefined;

const bom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
        timestamp: new Date().toISOString(),
        tools: { components: [{ type: "application", name: "scripts/sbom.mjs", version }] },
        component: {
            type: "library",
            "bom-ref": `pkg:mendix/${pkg.packagePath}/${pkg.widgetName}@${version}`,
            name: pkg.widgetName,
            version,
            description: pkg.description,
            licenses: [{ license: { id: pkg.license } }],
            ...(hashes ? { hashes } : {}),
            externalReferences: pkg.repository?.url ? [{ type: "vcs", url: pkg.repository.url }] : undefined
        }
    },
    components: [
        ...[...bundled.values()].sort((a, b) => a.name.localeCompare(b.name)).map(manifest => component(manifest)),
        // Supplied by the Mendix client at runtime, not bundled.
        ...externals.map(manifest => component(manifest, "excluded"))
    ],
    dependencies: [
        {
            ref: `pkg:mendix/${pkg.packagePath}/${pkg.widgetName}@${version}`,
            dependsOn: [...bundled.values()].map(manifest => purl(manifest.name, manifest.version))
        }
    ]
};
const file = join(outDir, "sbom.cdx.json");
writeFileSync(file, JSON.stringify(bom, null, 2));
console.log(`SBOM written: ${file} (${bundled.size} bundled components${hashes ? ", mpk hashed" : ""})`);
