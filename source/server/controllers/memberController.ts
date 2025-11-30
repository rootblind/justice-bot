import type { Request, Response } from "express"; 
import type { Client } from "discord.js";

import { fetchGuild, fetchGuildMember } from "../../utility_modules/discord_helpers.js";
import PremiumMembersRepo from "../../Repositories/premiummembers.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import type { MemberInfo } from "../../Interfaces/server_types.js";

export const getMember = async (req: Request, res: Response, client: Client) => {
    const {guild_id, member_id} = req.query;

    const guild = await fetchGuild(client, String(guild_id));

    if(!guild) {
        return res.status(400).json({success: false, member: null, error: "Invalid guild_id"});
    }

    const member = await fetchGuildMember(guild, String(member_id));

    if(!member) {
        return res.status(400).json({
            success: false,
            member: null,
            error: "Invalid user ID or the user is not a member of the guild."
        });
    }

    try{
        const isPremium = await PremiumMembersRepo.checkUserMembership(guild.id, member.id);

        const memberObject: MemberInfo = {
            avatar: member.displayAvatarURL(), // add {extension: "png"} if a format is needed
            joined_guild_at: member.joinedTimestamp,
            premium: isPremium
        }

        return res.status(200).json({
            success: true,
            member: memberObject
        });

    } catch(error) {
        await errorLogHandle(error);
        
        return res.status(500).json({
            success: false,
            member: null,
            error: "Failed fatching from database premiummembers"
        })
    }
}
