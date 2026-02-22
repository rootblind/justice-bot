import fs from 'fs';
import path from 'path';

let sourceLng = "en";
let targetLng = "ro";
const defaultDir = "./locales/";
const translationFile = "translation.json";

function syncKeys(src, target) {
    for (const k in src) {
        if (typeof src[k] === "object") {
            target[k] = syncKeys(src[k] || {}, target[k] || {});
        } else {
            target[k] = target[k] || ""; // values are set to empty waiting for dev completion
        }
    }

    return target;
}

export function syncLocale(source, target) {
    if (!fs.existsSync(source)) {
        throw new Error(`${source} is not a valid path for the source locale!`);
    }

    const targetDir = path.dirname(target);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    try {
        let sourceJson = fs.existsSync(source) ? JSON.parse(fs.readFileSync(source, "utf-8")) : {};
        let targetJson = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, "utf-8")) : {};
        const synced = syncKeys(sourceJson, targetJson);
        fs.writeFileSync(target, JSON.stringify(synced, null, 2));
        console.log(`${target} was synced with ${source}`)
    } catch (error) {
        console.error(error);
    }
}

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
        sourceLng = args[i + 1];
        i++;
    } else if (args[i] === "--target" && args[i + 1]) {
        targetLng = args[i + 1];
        i++;
    }
}

const sourcePath = path.join(defaultDir, sourceLng, translationFile);
const targetPath = path.join(defaultDir, targetLng, translationFile);

syncLocale(sourcePath, targetPath);