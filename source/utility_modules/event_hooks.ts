/*
import { Client, Guild, Snowflake } from "discord.js";
import type { OnReadyTaskBuilder } from "../Interfaces/helper_types.js";
import { extend_remove_premium_from_member, removePremiumFromMemberHook } from "../Systems/premium/premium_system.js";


export const sample: OnReadyTaskBuilder = {
    name: "Remove premium from member",
    task: async () => {
        const hook: removePremiumFromMemberHook = async (client: Client, memberId: Snowflake, guild: Guild) => {
            await PartyDraftRepo.deleteGuildMemberPremiumDrafts(guild.id, memberId);
            await PartyDraftRepo.removeFreeSlotsColors(guild.id, memberId);
        }
        extend_remove_premium_from_member(hook);
    },
    runCondition: async () => true
}*/