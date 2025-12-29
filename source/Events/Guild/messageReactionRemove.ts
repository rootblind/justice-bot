import type { Event } from "../../Interfaces/event.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { fetchGuildMember, fetchGuildRole } from "../../utility_modules/discord_helpers.js";
import ReactionRolesRepo from "../../Repositories/reactionroles.js";
import { Message, MessageReaction, User } from "discord.js";

export type messageReactionRemoveHook = (reaction: MessageReaction, user: User) => Promise<void>;
const hooks: messageReactionRemoveHook[] = [];

export function extend_messageReactionRemove(hook: messageReactionRemoveHook) {
    hooks.push(hook);
}

async function runHooks(reaction: MessageReaction, user: User) {
    for (const hook of hooks) {
        try {
            await hook(reaction, user);
        } catch (error) {
            await errorLogHandle(error);
        }
    }
}

const messageReactionRemove: Event = {
    name: "messageReactionRemove",
    async execute(reaction: MessageReaction, user: User) {
        if(user.bot) return;

        const message = reaction.message;
        const guild = reaction.message.guild;

        if(!(message instanceof Message) || !guild) return; // ignore non guild reactions

        const channel = message.channel;
        const member = await fetchGuildMember(guild, user.id);
        if(!member) return;

        await runHooks(reaction, user);
        const emojiName = 
        reaction.emoji?.id ? 
            `<:${reaction.emoji.name}:${reaction.emoji.id}>` : 
            (reaction.emoji?.name ?? "❓");

        const reactionRole = await ReactionRolesRepo.getReaction(guild.id, channel.id, message.id, emojiName);
        if(!reactionRole) return;
        const role = await fetchGuildRole(guild, String(reactionRole.roleid));

        if(!role) { // if the role failed to fetch, then the data is faulty
            await ReactionRolesRepo.deleteReaction(guild.id, channel.id, message.id, emojiName);
            await reaction.remove();
            return;
        }

        if(member.roles.cache.has(role.id)) {
            try {
                member.roles.remove(role);
            } catch {/* do nothing */}
        }
    }
}

export default messageReactionRemove;