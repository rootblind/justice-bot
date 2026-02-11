import { CategoryChannel, TextChannel } from "discord.js";
import { getClient } from "../client_provider.js";
import { OnReadyTaskBuilder } from "../Interfaces/helper_types.js";
import AutoVoiceSystemRepo from "../Repositories/autovoicesystem.js";
import { errorLogHandle } from "./error_logger.js";
import { attach_autovoice_manager_collector } from "../Systems/autovoice/autovoice_system.js";
import LfgSystemRepo from "../Repositories/lfgsystem.js";
import { interface_manager_collector } from "../Systems/lfg/lfg_interface_manager.js";
import { LfgPostWithChannelTable } from "../Interfaces/lfg_system.js";
import { lfg_post_collector } from "../Systems/lfg/lfg_post.js";

function collectorErrorMessage(guildId: string) {
    return `Something went wrong while attaching the collector at guild id ${guildId}`
}

export const autoVoiceManagerCollectors: OnReadyTaskBuilder = {
    name: "Autovoice Manager Collectors",
    task: async() => {
        const client = getClient();
        const autovoiceSystems = await AutoVoiceSystemRepo.getAll();
        for(const row of autovoiceSystems) {
            try {
                const guild = await client.guilds.fetch(row.guild);
                const category = await guild.channels.fetch(row.category);
                if(!category) throw new Error("Category couldn't be fetched");
                const autovoice = await guild.channels.fetch(row.autovoice);
                if(!autovoice) throw new Error("Autovoice couldn't be fetched");
                const managerchannel = await guild.channels.fetch(row.managerchannel);
                if(!(managerchannel instanceof TextChannel)) throw new Error("Manager channel couldn't be fetched");
                const manager = await managerchannel.messages.fetch(row.message);
                await attach_autovoice_manager_collector(manager);
            } catch(error) {
                await errorLogHandle(error, collectorErrorMessage(row.guild));
                await AutoVoiceSystemRepo.deleteSystem(row.guild, row.message); // deleting the system as good measure
                continue;
            }
        }
    },
    runCondition: async() => true
}

export const lfgInterfaceManagerCollector: OnReadyTaskBuilder = {
    name: "LFG Interface Collectors",
    task: async () => {
        const client = getClient();
        const lfgGamesTable = await LfgSystemRepo.getGamesTable();
        for(const row of lfgGamesTable) {
            if(
                row.manager_message_id === null 
                || row.category_channel_id === null 
                || row.manager_channel_id === null
            ) { continue; } // skip unbuilt games 

            try {
                const guild = await client.guilds.fetch(row.guild_id);
                const category = await guild.channels.fetch(row.category_channel_id);
                if(!(category instanceof CategoryChannel)) throw new Error("Category couldn't be fetched");
                const channel = await guild.channels.fetch(row.manager_channel_id);
                if(!(channel instanceof TextChannel)) throw new Error("Channel couldn't be fetched");
                const message = await channel.messages.fetch(row.manager_message_id);
                if(!message) throw new Error("Couldn't fetch the LFG interface message.");
                await interface_manager_collector(message);
            } catch(error) {
                await errorLogHandle(error, collectorErrorMessage(row.guild_id));
                await LfgSystemRepo.deleteGame(row.id);
            }
        }
    },
    runCondition: async () => true
}

export const LfgPostsCollector: OnReadyTaskBuilder = {
    name: "LFG Posts Collector",
    task: async () => {
        const client = getClient();
        const lfgPosts: LfgPostWithChannelTable[] = await LfgSystemRepo.getAllPostsWithChannel();
        for(const row of lfgPosts) {
            try {
                const guild = await client.guilds.fetch(row.guild_id);
                const channel = await guild.channels.fetch(row.discord_channel_id);
                if(!(channel instanceof TextChannel)) throw new Error("Post channel couldn't be fetched");
                const postMessage = await channel.messages.fetch(row.message_id);
                if(!postMessage) throw new Error("Couldn't fetch the post message object");
                await lfg_post_collector(postMessage, row);
            } catch(error) {
                await errorLogHandle(error, collectorErrorMessage(row.guild_id));
                await LfgSystemRepo.deletePostById(row.id);
            }
        }
    },
    runCondition: async () => true
}