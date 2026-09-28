import axios from "axios";
import { config } from "dotenv";
import { get_env_var } from "../utility_modules/utility_methods.js";
config();

const WEB_BACK_PORT = Number(get_env_var("WEB_BACK_PORT"));
const BASE_URL = `http://localhost:${WEB_BACK_PORT}/api`;

const webapi = axios.create({
    baseURL: BASE_URL,
    headers: {
        "lolro-api-key": get_env_var("CLIENT_SECRET")
    }
});

export default webapi;