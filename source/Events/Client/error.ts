import type { Event } from "../../Interfaces/event.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

export type errorEventHook = (error: Error) => Promise<void>;
const hooks: errorEventHook[] = [];
export function extend_errorEvent(hook: errorEventHook) {
    hooks.push(hook);
}

async function runHooks(error: Error) {
    for(const hook of hooks) {
        try {
            await hook(error);
        } catch(error) {
            await errorLogHandle(error);
        }
    }
}


const errorEvent: Event = {
    name: "error",
    async execute(error: Error) {
        errorLogHandle(error, undefined, undefined, false);
        await runHooks(error);
    }
}

export default errorEvent;