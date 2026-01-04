/**
* Filters the text input by converting it to lowercase, replacing diacritics,
* and removing specified patterns.
*
* @param {string} text The text to be filtered.
* @param {Array<string>} patterns The patterns to be removed (as regex patterns).
* @returns The filtered text or false if the text is too short (<3)
*/
export function curate_text(text: string, patterns: RegExp[] = []): string | false {
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

/**
 * @param word String 
 * @returns The word with escaped regex characters
 */
export function escapeRegex(word: string): string {
    return word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}