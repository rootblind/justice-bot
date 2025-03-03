// this module is responsible for chat and text input filters to prevent members from being toxic

const axios = require('axios');
const fs = require('graceful-fs');
const {config} = require("dotenv");
config();

const readFile = async (filePath, encoding) => {
    try {
         const data = fs.readFileSync(filePath, encoding);
         return JSON.parse(data);
    } catch (error) {
        console.error(error);
    }
};

function curate_text(text, patterns = []) {
    /**
     * Filters the text input by converting it to lowercase, replacing diacritics,
     * and removing specified patterns.
     *
     * @param {string} text - The text to be filtered.
     * @param {Array<string>} patterns - The patterns to be removed (as regex patterns).
     * @returns {string} - The filtered text.
     */
    
    text = text.toLowerCase();
    text = text.replace(/\n|\r/g, ' ')
               .replace(/ă/g, 'a')
               .replace(/î/g, 'i')
               .replace(/ș/g, 's')
               .replace(/ț/g, 't')
               .replace(/â/g, 'a');

    if (patterns.length > 0) {
        patterns.forEach(pattern => {
            text = text.replace(new RegExp(pattern, 'g'), '');
        });
    }

    if (text.length < 3) {
        return false;
    }

    return text.trim();
}

function escapeRegex(word) {
    return word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function regexGen(word) {
    // Escape special characters in the word
    // const escapedWord = escapeRegex(word);
    const escapedWord = word
    // Create a regex pattern that allows up to `maxTypo` typos
    const pattern = `(${escapedWord})`;
    return pattern;
}

function triggerPatterns(triggerWords) {
    // Generate regex patterns for each word and join them with the `|` (OR) operator
    const patterns = triggerWords.map(word => regexGen(word));
    return patterns.join("|");
}

function regexClassifier(message, triggerWords) {
    const emojiPattern = /<:(\d+):>/g;
    const allowedPattern = /[^a-zA-Z -]/g;
    const urlPattern = /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;

    message = curate_text(message, [emojiPattern, urlPattern, allowedPattern]);

    const triggerPattern = triggerPatterns(triggerWords);
    const regex = new RegExp(triggerPattern, "gi");
    const matches = message.toLowerCase().match(regex);
    return matches ? [...new Set(matches)] : false;
}


async function text_classification(api, text) {
    const emojiPattern = /<:(\d+):>/g;
    const allowedPattern = /[^a-zA-Z -]/g;
    const urlPattern = /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;

    // preparing the text for the classification
    const filteredText = curate_text(text, [emojiPattern, urlPattern, allowedPattern]);

    if (filteredText)
    {
        let classifier = null;
        const url = api + 'classify';
        const data = {
            'text' : filteredText
        };

        try{
            await axios.post(url, data)
                .then(response => {
                    classifier = response.data['labels'];
                }) 
                .catch(err => { console.error(err); })
        } catch(err) {
            console.error(err);
        }
        return {labels: classifier, text: filteredText}; // returning the model's labels and the filtered text that was analyzed by the model
    }
    else return false;

}

async function classifier(text, modapi=process.env.MOD_API_URL) {
    const labelsObject = {
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

    // disclaimer, this file contains toxic and triggering words commonly associated with the toxic labels located in labelsObject
    // their purpose is to generate regex pattern in order to build tools to filter them out and keep chatrooms online free from this
    // kind of behavior
    const triggerDict = await readFile('./objects/trigger_words.json');
    const matchesDict = {};

    
    for(const key of Object.keys(triggerDict)) {
        if(triggerDict[key].length == 0)
            continue;

        matchesDict[key] = regexClassifier(text, triggerDict[key]);
        if(Boolean(matchesDict[key])) {
            labelsObject[key] = 1;
            message = message.replace(new RegExp(triggerPatterns(triggerDict[key]), "g"), ' $& ').trim();
        }
    }

    message = message.replace(/\s+/g, " ")
        .replace(/(.)\1{2,}/g, '$1$1');
    const mod_response = await text_classification(modapi, message);

    if(!mod_response.labels.includes("OK"))
    {
        for(const label of mod_response.labels) {
            labelsObject[label] = 1;
        }
    }
    
    const regexMatches = Object.values(matchesDict).flat().filter((x) => x); // get the array of matches filtering false values

    const max = (a, b) => { return a > b ? a : b};
    const toxic_score = max(Object.values(labelsObject).reduce((a, b) => a + b, 0), regexMatches.length);

    let return_labels = [];

    if(toxic_score == 0)
        return_labels = ["OK"];
    else
        return_labels = Object.keys(labelsObject).filter(key => labelsObject[key] != 0);

    return {
        text: message,
        matches: regexMatches,
        score: toxic_score,
        labels: return_labels
    }
}

async function main() { // debugging
    const result = await classifier("fututi mortii si rasa si tiganii si bozgorii childporn cacatule fututi dumnezeii mati nigger imputit meriti sa mori iati viata");
    console.log(result)
}

// main(); // use for debug


module.exports = {
    curate_text,
    regexClassifier,
    text_classification,
    classifier
}