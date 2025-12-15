import type { Event } from "../../Interfaces/event.js";
import { Guild, Invite } from "discord.js";
import { fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { embed_invite_create } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

const inviteCreate: Event = {
    name: "inviteCreate",
    async execute(invite: Invite) {
        const guild = invite.guild as Guild;
        if(!guild) return;
        if(!invite.inviter) return;

        const logChannel = await fetchLogsChannel(guild, "server-activity");
        if(!logChannel) return;

        try {
            await logChannel.send({
                embeds: [
                    embed_invite_create(invite.inviter, invite)
                ]
            });
        } catch(error) {
            await errorLogHandle(error);
        }

    }
}

export default inviteCreate;