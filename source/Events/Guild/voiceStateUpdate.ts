import type { Event } from "../../Interfaces/event.js";
import { VoiceChannel, VoiceState } from "discord.js";
import { fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { embed_member_voice_channel_state, embed_member_voice_state } from "../../utility_modules/embed_builders.js";
import { create_autovoice_room, delete_autovoice_room } from "../../Systems/autovoice/autovoice_system.js";


export type voiceStatusUpdateHook = (oldState: VoiceState, newState: VoiceState) => Promise<void>;
const hooks: voiceStatusUpdateHook[] = [];
export function extend_voiceStateUpdate(hook: voiceStatusUpdateHook) {
    hooks.push(hook);
}

async function runHooks(oldState: VoiceState, newState: VoiceState) {
    for(const hook of hooks) {
        try {
            await hook(oldState, newState);
        } catch(error) {
            await errorLogHandle(error);
        }
    }
}

const voiceStateUpdate: Event = {
    name: "voiceStateUpdate",
    async execute(oldState: VoiceState, newState: VoiceState) {
        const guild = newState.guild;
        const member = newState.member;
        if(!member || member.user.bot) return;

        await runHooks(oldState, newState);

        const voiceLogs = await fetchLogsChannel(guild, "voice");
        if(voiceLogs) {
            // voice logging logic
            if(oldState.channelId !== newState.channelId) { // when member is interacting with voice channels
                await voiceLogs.send({
                    embeds: [ embed_member_voice_channel_state(member, oldState, newState) ]
                });
            } else if(
                newState.channel instanceof VoiceChannel &&
                (
                    oldState.serverMute !== newState.serverMute ||
                    oldState.serverDeaf !== newState.serverDeaf ||
                    oldState.selfVideo !== newState.selfVideo ||
                    oldState.streaming !== newState.streaming
                )
            ) { // when member is changing states while on voice chat
                await voiceLogs.send({
                    embeds: [
                        embed_member_voice_state(member, newState.channel, oldState, newState)
                    ]
                });
            }
        }

        // delete empty party rooms
        /*
        if(oldState.channel && oldState.channel.members.size === 0) {
            const channel: VoiceChannel = oldState.channel as VoiceChannel;
            const partyRoom: PartyRoom | null = await PartyRoomRepo.getPartyRoom(guild.id, channel.id);
            if(partyRoom) {
                // deleting the thread
                // TODO: As of writing this comment, it is uncertain if the LFG system will stay the same, in any case, check this line while building a new one or rebuilding the old one
                return;
            }
        }
        */

        // manage autovoice channels
        if(newState.channel instanceof VoiceChannel) {
            // if member moves or joins a channel, call create_autovoice which does the necessary checks
            try {
                await create_autovoice_room(newState.channel, member);
            } catch(error) {
                await errorLogHandle(error);
            }
        }
        if(oldState.channel instanceof VoiceChannel && oldState.channel.members.size === 0) {
            await delete_autovoice_room(oldState.channel);
        }
    }
}

export default voiceStateUpdate;