import { fetchGuildBan, fetchGuild, fetchGuildMember } from "../../utility_modules/discord_helpers";
import BanListRepo from "../../Repositories/banlist";

import type { Client } from "discord.js";
import type { Request, Response } from "express";
import { BanInfo } from "../../Interfaces/server_types";
import PunishLogsRepo from "../../Repositories/punishlogs";
import { errorLogHandle } from "../../utility_modules/error_logger";

export const getBan = async (req: Request, res: Response, client: Client) => {
    const {guild_id, ban_id} = req.query;

    const guild = await fetchGuild(client, String(guild_id));

    if(!guild) {
        return res.status(400).json({success: false, banned: null, message: "Invalid guild_id"});
    }

    const ban = await fetchGuildBan(guild, String(ban_id));

    if(!ban) {
        return res.status(200).json({success: true, banned: false, message: "User not banned or invalid id"});
    }

    // the user is banned and found
    
    
    // initializing the object
    const banInfo: BanInfo = {
        banned: true,
        moderator: null,
        expires: "Indefinite",
        reason: "None",
        timestamp: null
    };

    try{
        const banData = await BanListRepo.getGuildBan(guild.id, ban.user.id);

        if(banData) {
            const moderator = await fetchGuildMember(guild, String(banData.moderator));

            if(moderator) { // fetch the moderator that banned the user and set as either username or id depending if fetching succeeded
                banInfo.moderator = moderator.user.username;
            } else {
                banInfo.moderator = banData.moderator;
            }

            if(banData.expires == 0) {
                banInfo.expires = "Restricted"
            } else {
                banInfo.expires = banData.expires;
            }

            try{
                const punishLogsData = await PunishLogsRepo.getUserLogsOrder("DESC", guild.id, ban.user.id);
                if(punishLogsData.length) {
                    if(punishLogsData[0]) banInfo.timestamp = punishLogsData[0].timestamp;
                }
            } catch(error) {
                await errorLogHandle(error);
            }

            banInfo.reason = banData.reason;
        } else {
            // if the ban is indefinited or just not registered in the database
            banInfo.moderator = null;
            banInfo.expires = "Indefinite";
            if(ban.reason) banInfo.reason = ban.reason;  
            banInfo.timestamp = null;
        }
    } catch(error) {
        await errorLogHandle(error);
    }

    

    return res.status(200).json({
        success: true,
        banned: true,
        ban: banInfo
    });
}