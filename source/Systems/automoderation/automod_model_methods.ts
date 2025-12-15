import axios from "axios";
import { curate_text } from "./curate_data.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { AutomodResponse } from "../../Interfaces/server_types.js";

/**
 * 
 * @param api string to the api
 * @returns boolean
 * 
 * Used mainly to check on moderation model api's status.
 */
export async function check_api_status(api: string): Promise<boolean> {
    try {
        const response = await axios.get(api);

        if (response.status === 200) {
            return true;
        } else {
            console.log(`Unexpected status code from ${api} : ${response.status}`);
            return false;
        }
    } catch (error) {
        if (error) return false;
    }

    return false;
}

/**
 * The given text is curated and then sent to the automod model api to receive its label classification
 * @param api The api route to automod model
 * @param text The text to be classified
 * @returns AutomodResponse the resulting labels and the filtered text {labels: string[], text: string}
 */
export async function text_classification(api: string, text: string): Promise<AutomodResponse | false> {
    const emojiPattern = /<:(\d+):>/g;
    const allowedPattern = /[^a-zA-Z -]/g;
    const urlPattern = /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;
    const patterns = [emojiPattern, allowedPattern, urlPattern];

    const filteredText = curate_text(text, patterns);

    if(filteredText && typeof filteredText === "string") {
        const url = api + "classify";
        const data = {
            "text": filteredText
        }

        try {
            const response = await axios.post(url, data);
            const labels = response.data["labels"];

            const api_response: AutomodResponse = {labels: labels, text: filteredText};
            return api_response;
        } catch(error) {
            await errorLogHandle(error);
        }
    }

    return false;

}