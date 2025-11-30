import fs from "graceful-fs";
import path from "path";
import { fileURLToPath } from "url";
import "colors";
import AsciiTable from "ascii-table";
import { errorLogHandle } from "../utility_modules/error_logger.js";
import BotConfigRepo from "../Repositories/botconfig.js";

/**
 * Goes through ./Models and calls their promise or function to initialize tables if they do not exist.
 * 
 * Must be placed within the same directory as the database sources.
*/
export default async function modelsInit() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const modelsDir = __dirname;
    const files = fs.readdirSync(modelsDir)
        .filter((file: string) => file.endsWith(".js") && file !== "modelsInit.js"); // ignore this source

    const table = new AsciiTable().setHeading("Tables", "Status");
    
    for(const file of files) {
        const modelPath = path.join(modelsDir, file);
        
        // removing .js extension to call the model
        const modelName = path.basename(file, ".js");

        try{
            const imported = await import(modelPath);
            const initializer = imported.default ?? imported;

            if(!initializer) {
                console.warn(`${modelName} has no default export so it was skipped!`);
                continue;
            }

            try{
                if(typeof initializer === "function") {
                    const result = initializer();
                    if(result instanceof Promise) {
                        await result;
                    }
                } else if( initializer instanceof Promise) {
                    await initializer;
                } else {
                    console.warn(`${modelName} default export is not a function or a Promise so it was skipped!`);
                    continue;
                }
            } catch(error) {
                await errorLogHandle(error);
            }

            table.addRow(modelName, "Ready");
        } catch(error) {
            await errorLogHandle(error);
            continue;
        }
    }

    try {
        const botConfigData = await BotConfigRepo.getConfig();
        if(!botConfigData) {
            await BotConfigRepo.setDefault();
        }
    } catch(error) {
        await errorLogHandle(error);
    }
    
    console.log(table.toString(), "\nDatabase tables");
}