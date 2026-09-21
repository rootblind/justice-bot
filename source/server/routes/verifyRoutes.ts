import { Client } from "discord.js";
import express from "express";

import type { Request, Response } from "express";
import { verificationAssessment } from "../controllers/verifyController.js";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function verifyRoutes(client: Client) {
    const router = express.Router();
    router.post("/assessment", (req: Request, res: Response) => verificationAssessment(req, res, client));

    return router;
}