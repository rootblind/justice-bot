import { curate_text } from "./curate_data.js";

/**
 * Generate a regex pattern for the word
 * @param word string
 */
export function regexGen(word: string) {
    return `(${word})`;
}

/**
 * Generate regex patterns for each word and join them with the `|` (OR) operator
 * @param triggerWords List of strings that will trigger the regex classifier
 */
export function triggerPatterns(triggerWords: string[]) {
    const patterns = triggerWords.map(word => regexGen(word));
    return patterns.join("|");
}

/**
 * Based on the trigger words given, classifies the message if it matches the trigger words or not
 * @param message The message to be evaluated
 * @param triggerWords The triggerwords that activate the classifier
 * @returns The matches in the message or false if it doesn't fit
 */
export function regexClassifier(message: string, triggerWords: string[]): string[] | false {
    const emojiPattern = /<:(\d+):>/g;
    const urlPattern = /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;

    const allowedPattern = /[^a-zA-Z -]/g;

    const curated_message = curate_text(message, [emojiPattern, urlPattern, allowedPattern]);
    if(curated_message === false || typeof curated_message !== "string") return false;

    const triggerPattern = triggerPatterns(triggerWords);
    const regex = new RegExp(triggerPattern, "gi");
    const matches = curated_message.toLowerCase().match(regex);
    return matches ? [...new Set(matches)] : false;
}