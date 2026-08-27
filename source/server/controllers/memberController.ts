import type { Request, Response } from "express";
import type { Client } from "discord.js";

import { fetchGuild, fetchGuildMember } from "../../utility_modules/discord_helpers.js";
import type { MemberInfo } from "../../Interfaces/server_types.js";

export const getMember = async (req: Request, res: Response, client: Client) => {
    const { guild_id, member_id } = req.query;

    const guild = await fetchGuild(client, String(guild_id));

    if (!guild) {
        return res.status(400).json({ success: false, member: null, error: "Invalid guild_id" });
    }

    const member = await fetchGuildMember(guild, String(member_id));

    if (!member) {
        return res.status(400).json({
            success: false,
            member: null,
            error: "Invalid user ID or the user is not a member of the guild."
        });
    }

    const joinedTimestamp = member.joinedTimestamp;
    const createdTimestamp = member.user.createdTimestamp;
    const memberObject: MemberInfo = {
        avatar: member.displayAvatarURL(), // add {extension: "png"} if a format is needed
        joined_guild_at: joinedTimestamp ? Math.floor(joinedTimestamp / 1000) : null,
        account_created_at: Math.floor(createdTimestamp / 1000)
    }

    return res.status(200).json({
        success: true,
        member: memberObject
    });

}
