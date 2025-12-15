import { TriggerWordsObject, LabelsClassification, ClassifierResponse } from "../../Interfaces/helper_types.js";
import { AutomodResponse } from "../../Interfaces/server_types.js";
import { get_env_var, read_json_async } from "../../utility_modules/utility_methods.js";
import { text_classification } from "./automod_model_methods.js";
import { curate_text } from "./curate_data.js";
import { regexClassifier, triggerPatterns } from "./regex_classifier.js";

/**
 * classifier method combines regexClassifier and automod model to calculate the toxicity score, flagged matches
 * and the toxic labels.
 * @param text The text to be classified
 * @param modapi The mod api to be called
 * @returns ClassifiedResponse object or false if modapi failed
 */
export async function classifier(
    text: string, 
    modapi: string = get_env_var("MOD_API_URL")
): Promise<false | ClassifierResponse> {
    const labelsObject: LabelsClassification = {
        "Aggro": 0,
        "Violence": 0,
        "Sexual": 0,
        "Hateful": 0
    }

    const emojiPattern = /<:(\d+):>/g;
    const allowedPattern = /[^a-zA-Z -]/g;
    const urlPattern = /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;

    let message = curate_text(text, [emojiPattern, urlPattern, allowedPattern]);
    if(!message) return false;

    const triggerDict = await read_json_async("./objects/trigger_words_v2.json");
    const matchesDict: TriggerWordsObject = {};

    for(const key of Object.keys(triggerDict)) {
        if(triggerDict[key].length === 0 ) continue;

        const regResponse = regexClassifier(message, triggerDict[key]);
        if(regResponse) {
            matchesDict[key] = regResponse;
            labelsObject[key] = 1;
            // find trigger words as substrings and surround them with spaces
            message = message.replace(new RegExp(triggerPatterns(triggerDict[key]), "g"), ' $& ').trim();
        }
    }

    message = message.replace(/\s+/g, " ") // normalize sequence of white spaces to a single space
        .replace(/(.)\1{2,}/g, '$1$1'); // remove sequence of repeated characters longer than 2 fooool -> fool

    const mod_response: AutomodResponse | false = await text_classification(modapi, message);

    if(mod_response) {
        if(!mod_response.labels.includes("OK")) {
            // if the response does not have OK label, the message is toxic. update labelsObject
            for(const label of mod_response.labels) {
                labelsObject[label] = 1;
            }
        }
    } else {
        return false;
    }

    const regexMatches = Object.values(matchesDict).flat().filter((x) => x) // get the array of matches filtering false values
    const max = (a: number, b: number): number => { return a > b ? a : b };
    // toxic score is represented by the number of labels matched by either regex classifier or the automod model
    // which one is higher
    const toxic_score = max(Object.values(labelsObject).reduce((a, b) => a + b, 0), regexMatches.length);

    let return_labels: string[] = [];
    if(toxic_score === 0) {
        return_labels = ["OK"];
    } else {
        // return labels that have a non zero value (1)
        return_labels = Object.keys(labelsObject).filter(key => labelsObject[key] !== 0);
    }

    const response: ClassifierResponse = {
        text: message,
        matches: regexMatches,
        score: toxic_score,
        labels: return_labels
    }

    return response;
}