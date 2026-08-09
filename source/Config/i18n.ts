import i18next, { type TFunction, type TOptions } from "i18next";
import Backend from "i18next-fs-backend";
import path from "path";
import { fileURLToPath } from "url";
import { local_config } from "../objects/local_config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesPath = path.resolve(__dirname, "../../locales");

await i18next
    .use(Backend)
    .init({
        fallbackLng: "en",
        preload: ["en", "ro"],
        backend: {
            loadPath: path.join(localesPath, "{{lng}}/{{ns}}.json")
        },
        ns: ["translation"],
        load: "languageOnly",
        interpolation: {
            escapeValue: false
        }
    });

export default i18next;

/**
 * 
 * @param lang The locale language code ex: "ro" / "en-US"
 * @param key The JSON key inside the translation file
 * @param options TOptions for translation
 * @returns Locale representation of the string
 */
export function t(
    lang: string,
    key: string,
    options?: TOptions
): string {
    const fixedT: TFunction = i18next.getFixedT<string>(lang) as TFunction;

    return options
        ? fixedT(key, options as Record<string, unknown>)
        : fixedT(key);
}

/**
 * Gets the localized value for a translation key across all configured locales.
 *
 * The returned record maps each configured locale to its translated value,
 * and can be passed directly to Discord localization methods such as
 * `setDescriptionLocalizations()`.
 *
 * Locales for which the translation is missing or resolves to the key itself
 * are omitted from the result.
 *
 * @param key The JSON key inside the translation file.
 * @returns A record mapping locale codes to their localized translation values.
 */
export function getLocalizationRecord(key: string) {
    const result: Record<string, string> = {};
    for (const locale of local_config.locales) {
        const value = i18next.getFixedT(locale)(key);

        if (value && value !== key) {
            result[locale] = value;
        }
    }

    return result;
}