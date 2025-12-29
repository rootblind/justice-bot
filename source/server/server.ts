import express from "express";
import cors from "cors";
//import session from "express-session";
import { config } from "dotenv";
import { authenticate } from "./middleware/auth.js";
import banRoutes from "./routes/banRoutes.js";
import memberRoutes from "./routes/memberRoutes.js";
config();

import type { Client } from "discord.js";
import { get_env_var } from "../utility_modules/utility_methods.js";



const startServer = async (client: Client) => {
    const serverApp = express();

    const HOST = get_env_var("SERVER_HOST");
    const PORT = Number(get_env_var("SERVER_PORT"));

    const BACK_PORT = Number(get_env_var("WEB_BACK_PORT"));
    //const FRONT_PORT = Number(get_env_var("WEB_FRONT_PORT"));

    const allowedOrigins = `${HOST}:${BACK_PORT}`;

    serverApp.use(
        cors({
            origin: allowedOrigins,
            credentials: true
            
        })
    );

    serverApp.use(express.json());
    serverApp.use(authenticate);

    // routes
    serverApp.use("/bot/ban/", banRoutes(client));
    serverApp.use("/bot/member", memberRoutes(client));

    serverApp.listen(PORT);

    console.log("API SERVER STARTED ON PORT: " + PORT);
}


export default startServer;
