import type { Collection, Snowflake } from "discord.js";
import fs from "graceful-fs";
import { errorLogHandle } from "./error_logger.js";
import axios from "axios";

/**
 * 
 * @param name The name of the environment variable as a string
 * @returns The value of the variable as a string of undefined if the variable doesn't exist in .env
 */
export function get_env_var(name: string){
    const value = process.env[name];

    if(!value) throw new Error(`Missing environment variable: ${name}`);
    return value;
}

/**
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
    if(last) {
        const expires = last + cd;
        if(now < expires)
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
    if(!has_cooldown(userId, cooldowns, cd)) {
        const now = Math.floor(Date.now() / 1000)
        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), cd)
    }
}

/**
* This function takes a hexadecimal number and converts it to a string to the corresponding format
* Might be bad practice, but it's used to translate color hexcodes between embeds and database
* since colore codes in database are declared as strings (varchar) and in this code as numbers.
*/
export function hexToString(num: number){
    const str = '0x' + num.toString(16).padStart(6,'0');
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
        if(error) { // throwing an error here means the directory doesn't exist
            fs.mkdir(dirPath, {recursive: true}, (error: Error) => {
                if(error) {
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
    for(const dir of dirArray) {
        const dirPath = root + dir;
        const dirExists = directoryCheck(dirPath);
        if(!dirExists) {
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
    if(!filePath.endsWith(".json")) throw new Error("read_json_async reads only JSON files.");
    const data = fs.readFileSync(filePath, encoding);
    return JSON.parse(data);
}

/**
 * 
 * @param maximum The highest possible random number to be generated (-1)
 * @param minimum The minimum possible random number to be generated, defaults to 0
 * @returns number
 */
export function random_number(maximum: number, minimum: number = 0) {
    return Math.floor(Math.random() * maximum) + minimum;
}

/**
 * Parses package.json as an object and reads the version field if it exists
 * 
 * @returns The version of the project as a string or null as a fallback
 */
export async function get_current_version() {
    try {
        const packageObject = await read_json_async("package.json");
        if(typeof packageObject === "object" && "version" in packageObject) {
            return packageObject.version;
        }
    } catch(error) {
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
    } catch(error) {
        if(error) return false; 
    }

    return true;
}

/**
 * 
 * @param api string to the api
 * @returns boolean
 * 
 * Used mainly to check on moderation model api's status.
 */
export async function check_api_status(api: string) {
    try {
        const response = await axios.get(api);

        if(response.status === 200) {
            return true;
        } else {
            console.log(`Unexpected status code from ${api} : ${response.status}`);
            return false;
        }
    } catch(error) {
        if(error) return false;
    }
}