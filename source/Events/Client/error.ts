import type { Event } from "../../Interfaces/event.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

const errorEvent: Event = {
    name: "error",
    async execute(error: Error) {
        await errorLogHandle(error);
    }
}

export default errorEvent;