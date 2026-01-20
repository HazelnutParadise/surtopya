import fs from "fs";
import path from "path";
import crypto from "crypto";

const MESSAGES_DIR = path.join(process.cwd(), "messages");
const CACHE_FILE = path.join(MESSAGES_DIR, ".translation-cache.json");
const SOURCE_LOCALE = "zh-TW";
const TARGET_LOCALES = ["en", "ja"];

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

interface Cache {
    [hash: string]: {
        [locale: string]: string;
    };
}

function getHash(text: string): string {
    return crypto.createHash("md5").update(text).digest("hex");
}

async function translateText(text: string, targetLocale: string): Promise<string | null> {
    console.log(`Translating to ${targetLocale}: "${text.substring(0, 30)}..."`);

    const prompt = `Translate the following English text to ${targetLocale === 'zh-TW' ? 'Traditional Chinese' : 'Japanese'}. 
Output only the translated text, no further explanation.

Text: ${text}`;

    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: "POST",
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: prompt,
                stream: false,
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.response.trim();
    } catch (error) {
        console.error(`Failed to translate to ${targetLocale}:`, error);
        return null;
    }
}

async function checkOllama() {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
        return response.ok;
    } catch (e) {
        return false;
    }
}

async function run() {
    if (!fs.existsSync(MESSAGES_DIR)) {
        fs.mkdirSync(MESSAGES_DIR, { recursive: true });
    }

    const sourceFile = path.join(MESSAGES_DIR, `${SOURCE_LOCALE}.json`);
    if (!fs.existsSync(sourceFile)) {
        console.error(`Source file ${sourceFile} not found.`);
        return;
    }

    const sourceMessages = JSON.parse(fs.readFileSync(sourceFile, "utf-8"));
    let cache: Cache = {};
    if (fs.existsSync(CACHE_FILE)) {
        cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    }

    const ollamaAlive = await checkOllama();
    if (!ollamaAlive) {
        console.warn("Ollama is not reachable. Skipping new translations, will only use cache.");
    }

    for (const locale of TARGET_LOCALES) {
        const targetFile = path.join(MESSAGES_DIR, `${locale}.json`);
        let targetMessages = fs.existsSync(targetFile) ? JSON.parse(fs.readFileSync(targetFile, "utf-8")) : {};

        const translateObject = async (obj: any, target: any) => {
            const keys = Object.keys(obj);
            for (const key of keys) {
                const val = obj[key];
                if (typeof val === "string") {
                    const hash = getHash(val);
                    if (cache[hash] && cache[hash][locale]) {
                        target[key] = cache[hash][locale];
                    } else if (ollamaAlive) {
                        const translated = await translateText(val, locale);
                        if (translated) {
                            target[key] = translated;
                            if (!cache[hash]) cache[hash] = {};
                            cache[hash][locale] = translated;
                        } else {
                            target[key] = target[key] || val; // Fallback to existing or source
                        }
                    } else {
                        target[key] = target[key] || val; // Fallback to existing or source
                    }
                } else if (typeof val === "object" && val !== null) {
                    target[key] = target[key] || {};
                    await translateObject(val, target[key]);
                }
            }
        };

        await translateObject(sourceMessages, targetMessages);
        fs.writeFileSync(targetFile, JSON.stringify(targetMessages, null, 2), "utf-8");
    }

    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
    console.log("Translation complete.");
}

run();
