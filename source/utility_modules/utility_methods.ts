/**
 * General purpose methods as a toolkit
 */

import { type Client, type Collection, type Snowflake } from "discord.js";
import fs from "graceful-fs";
import { errorLogHandle } from "./error_logger.js";;
import crypto from "crypto";
import PremiumKeyRepo from "../Repositories/premiumkey.js";
import { LabelsClassification, TimeStringUnit } from "../Interfaces/helper_types.js";
import csvWriter from "csv-write-stream";
import csvParse from "csv-parser";
import path from "path";
import GuildModulesRepo from "../Repositories/guildmodules.js";
import { ChatCommandGroup } from "../Interfaces/command.js";

/**
 * 
 * @param name The name of the environment variable as a string
 * @returns The value of the variable as a string of undefined if the variable doesn't exist in .env
 */
export function get_env_var(name: string) {
    const value = process.env[name];

    if (!value) throw new Error(`Missing environment variable: ${name}`);
    return value;
}

/**
 * Cooldowns must be set in seconds in the Collection.
 * 
 * @param userId The Snowflake of the user to be queried for
 * @param cd in seconds
 * @returns False if the user is not on cooldown, returns the cooldown in seconds otherwise
 */
export function has_cooldown(
    userId: Snowflake,
    cooldowns: Collection<Snowflake, number>,
    cd: number
): number | boolean {
    // returns true if the user has a cooldown, false otherwise
    const now = Math.floor(Date.now() / 1000);
    const last = cooldowns.get(userId);
    if (last) {
        const expires = last + cd;
        if (now < expires)
            return expires
    }
    return false;
}

/**
 * If the user is already on cooldown, does nothing. 
 * @param cd in seconds
 */
export function set_cooldown(
    userId: Snowflake,
    cooldowns: Collection<Snowflake, number>,
    cd: number
) {
    if (!has_cooldown(userId, cooldowns, cd)) {
        const now = Math.floor(Date.now() / 1000)
        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), cd * 1000) // timeout uses time in milliseconds
    }
}

/**
* This function takes a hexadecimal number and converts it to a string to the corresponding format
* Might be bad practice, but it's used to translate color hexcodes between embeds and database
* since colore codes in database are declared as strings (varchar) and in this code as numbers.
*/
export function hexToString(num: number) {
    const str = '0x' + num.toString(16).padStart(6, '0');
    return str;
}

/**
 * 
 * @param date Date type
 * @returns Formatted string of dd/mm/yyyy
 */
export function formatDate(date: Date) {
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

/**
 * 
 * @param date Date type
 * @returns Formatted string of hh:mm:ss
 */
export function formatTime(date: Date) {
    return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
}

/**
 * 
 * @param dirPath The path to the desired directory to check or create
 */
export function directoryCheck(dirPath: string) {
    let itExists = true;
    fs.access(dirPath, fs.constants.F_OK, (error: Error) => {
        if (error) { // throwing an error here means the directory doesn't exist
            fs.mkdir(dirPath, { recursive: true }, (error: Error) => {
                if (error) {
                    console.error(error);
                    itExists = false;
                }
            });
        }
    });

    return itExists;
}

/**
 * 
 * @param dirArray String array of directory names
 * @param root The root level of the directories. Default at the project root
 * 
 * Throws error if one of the directories does not exist and couldn't be created
 */
export function directory_array_check(dirArray: string[], root: string = "./") {
    for (const dir of dirArray) {
        const dirPath = root + dir;
        const dirExists = directoryCheck(dirPath);
        if (!dirExists) {
            throw new Error(`${dirPath} failed to get checked`);
        }
    }
}

/**
 * 
 * @param filePath string path to the json file
 * @param encoding string encoding to be used, defaults to utf-8
 * @returns The JSON object parsed
 * @throws Error if the file is not a json file or a valid JSON object
 */
export function read_json_async(filePath: string, encoding: string = "utf-8") {
    if (!filePath.endsWith(".json")) throw new Error("read_json_async reads only JSON files.");
    const data = fs.readFileSync(filePath, encoding);
    return JSON.parse(data);
}

/**
 * Pseudo random number from minimum (default 0) to maximum
 * 
 * Swaps maximum and minimum if minimum > maximum so order doesn't matter
 * @param maximum The highest possible random number to be generated
 * @param minimum The minimum possible random number to be generated, defaults to 0
 * @returns number
 */
export function random_number(maximum: number, minimum: number = 0) {
    // swap if minimum > maximum
    const min = minimum < maximum ? minimum : maximum;
    const max = maximum > minimum ? maximum : minimum;
    const factor = max - min;

    return Math.floor(Math.random() * factor) + min;
}

/**
 * Parses package.json as an object and reads the version field if it exists
 * 
 * @returns The version of the project as a string or null as a fallback
 */
export async function get_current_version() {
    try {
        const packageObject = await read_json_async("package.json");
        if (typeof packageObject === "object" && "version" in packageObject) {
            return packageObject.version;
        }
    } catch (error) {
        await errorLogHandle(error);
    }

    return null;
}

/**
 * @param filePath String to the file location
 * 
 * @returns boolean
 * 
 * The method tries to access the file, if the file is not readable or does not exists,
 * fs.promises.access will throw an error, meaning the file is not ok. It will return true otherwise.
 */
export async function isFileOk(filePath: string): Promise<boolean> {
    try {
        await fs.promises.access(filePath, fs.constants.R_OK);
    } catch (error) {
        if (error) return false;
    }

    return true;
}

/**
 * @param minLength Minimum length of the string
 * @param maxLength Maximum length of the string
 * @returns Random string of random length using characters from "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*_+-?"
 */
export function random_code_generation(minLength: number, maxLength: number) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*_+-?";
    const length = random_number(maxLength, minLength);

    let randomString = "";

    while (randomString.length < length) {
        const idx = random_number(characters.length - 1);
        randomString += characters[idx];
    }

    return randomString;
}

const key = Buffer.from(get_env_var("ENCRYPT_KEY"), 'hex'); // encryption key
const iv = Buffer.from(get_env_var("IV"), 'hex'); // initializator vector
const algorithm = get_env_var("ALGORITHM"); // the algorithm used to encrypt

/**
 * Encrypts a UTF-8 string using the configured symmetric encryption
 * algorithm, key, and IV, returning the encrypted value as a hex string.
 *
 * @param data The plaintext string to encrypt.
 * @returns The encrypted data encoded as a hex string.
 */
export function encryptor(data: string): string {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

/**
 * Decrypts a hex-encoded encrypted string using the configured symmetric
 * encryption algorithm, key, and IV, returning the original UTF-8 plaintext.
 *
 * @param data The encrypted data encoded as a hex string.
 * @returns The decrypted plaintext string.
 */
export function decryptor(data: string): string {
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

/**
 * Generates a unique encrypted code for a specific guild. The function creates
 * a random plaintext code of length `min` to `max`, encrypts it, and checks
 * against existing encrypted codes for the guild to ensure uniqueness.
 * Repeats generation until a unique encrypted code is produced.
 *
 * @param guildId The ID of the guild for which the code is being generated.
 * @param min The minimum length of the plaintext code before encryption (default: 5).
 * @param max The maximum length of the plaintext code before encryption (default: 10).
 * @returns A unique encrypted code as a hex string.
 */
export async function generate_unique_code(
    guildId: Snowflake,
    min: number = 5,
    max: number = 10
): Promise<string> {
    let code = encryptor(random_code_generation(min, max)); // generate a code between 5-10 characters
    const codes = await PremiumKeyRepo.getAllGuildCodes(guildId);

    // while the code already exists in the database for this guild, continue generating
    while (codes.includes(code)) code = encryptor(random_code_generation(min, max));

    return code;
}

/**
 * Reads csv file (unknown)
 */
export async function csv_read(path: string) {
    const data: unknown[] = [];
    await fs.createReadStream(path)
        .pipe(csvParse({ separator: "," }))
        .on("data", (row: unknown) => {
            data.push(row);
        })
        .on("error", (error: Error) => {
            console.error(error);
        });
    return data;
}

/**
 * Appends to csv without headers (as default behavior)
 * @param data The message column of the csv dataset
 * @param flags The labels of the message
 * @param path The path to flag_data.csv
 */
export function csv_append(data: string, flags: LabelsClassification, path: string, send_headers: boolean = false) {
    const writer = csvWriter({ sendHeaders: send_headers });
    const stream = fs.createWriteStream(path, { flags: "a" });
    writer.pipe(stream);
    writer.write({
        Message: data,
        OK: flags["OK"],
        Aggro: flags["Aggro"],
        Violence: flags["Violence"],
        Sexual: flags["Sexual"],
        Hateful: flags["Hateful"]
    });

    writer.end();
}

/**
 * Recursively finds all .js files in the directory
 * @param dir path to directory to look for sources
 */
export function getFilesRecursive(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursive(fullPath));
        } else if (file.endsWith(".js")) {
            results.push(fullPath);
        }
    }

    return results;
}

/**
 * Return all command groups that are not disabled by the guild
 * @param guildId Guild Snowflake
 * @param client Client object
 * @returns 
 */
export async function getGuildCommandGroups(guildId: Snowflake, client: Client): Promise<ChatCommandGroup[]> {
    const disabled_groups = await GuildModulesRepo.getGuildDisabled(guildId);
    // get all unique groups from all commands
    const groups = Array.from(
        new Set(client.commands.map(
            (value) => value.metadata.group ?? "global")
        )
    ).filter(group => !disabled_groups.includes(group)); // keep groups that are not excluded from the guild

    return groups;
}

export function isSnowflake(value: Snowflake): value is string {
    return (
        typeof value === "string" &&
        /^[0-9]{17,20}$/.test(value)
    );
}


/**
 * Regex to match duration inputs such as 1m (one minute); 2h (two hours); 99y (ninety nine years)
 */
export const durationRegex = /^(\d+)([mhdwy])$/;

const secondsMap: Record<TimeStringUnit, number> = {
    "m": 60,
    "h": 3600,
    "d": 86400,
    "w": 604800,
    "y": 31556926
} as const;

/**
 * Converts seconds into the closest duration string (ex 119 -> "2m")
 */
export function seconds_to_duration(seconds: number): string | null {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return null;
    }

    let bestUnit: TimeStringUnit = "m";
    let bestValue = 1;
    let smallestError = Infinity;

    for (const unit of Object.keys(secondsMap) as TimeStringUnit[]) {
        const unitSeconds = secondsMap[unit];
        const value = Math.round(seconds / unitSeconds);

        if (value <= 0) continue;

        const error = Math.abs(seconds - value * unitSeconds);

        if (error < smallestError) {
            smallestError = error;
            bestUnit = unit;
            bestValue = value;
        }
    }

    return `${bestValue}${bestUnit}`;
}

/**
 * Returns the value in seconds of the time unit
 * @param unit Time unit character
 */
export function time_unit_conversion(unit: TimeStringUnit) {
    return secondsMap[unit];
}

/**
 * 
 * @param durationString durationRegex compatible string ex: "3h"
 * @returns Timestamp in seconds of the duration (current time + duration) or null if the string given is invalid.
 */
export function duration_timestamp(durationString: string): number | null {
    const match = durationString.match(durationRegex);
    if (match && match[1] && match[2]) {
        const value = Number(match[1]);
        const unit = match[2].toLowerCase() as TimeStringUnit;
        return Math.floor(Date.now() / 1000) + value * time_unit_conversion(unit);
    }

    return null;
}

/**
 * Calculates the size in bytes of the number given and returns a string of the value and unit
 */
export function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}${sizes[i]}`;
}

/**
 * 
 * @param id The id registered by the cooldowns collection
 * @param cooldowns Collection of cooldowns
 * @param cd The cooldown in milliseconds
 * @returns true if the user has a cooldown, false otherwise
 */
export function hasCooldown(id: Snowflake, cooldowns: Collection<string, number>, cd: number) {
    const now = Date.now();
    if (cooldowns.has(id)) {
        const expires = cooldowns.get(id)! + cd;
        if (now < expires) return expires;
    }
    return false;
}

/**
 * @returns Current time as unix timestamp in seconds 
 */
export function timestampNow(): number {
    return Math.floor(Date.now() / 1000);
}