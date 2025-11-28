import express from "express";
import { getMember } from "../controllers/memberController.js";

import type { Client } from "discord.js";
import type { Request, Response } from "express";

export default function memberRoutes(client: Client) {
    const router = express.Router();

    router.get("/info", (req: Request, res: Response) => getMember(req, res, client));

    return router;
}