import { getBan } from "../controllers/banController.js";
import express from "express";

import type { Client } from "discord.js"; 
import type { Request, Response, Router } from "express";

export default function banRoutes(client: Client): Router {
    const router = express.Router();

    router.get("/info", (req: Request, res: Response) => 
        getBan(req, res, client)
    );

    return router;
}