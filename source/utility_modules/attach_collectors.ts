import { CategoryChannel, Collection, Message, TextChannel } from "discord.js";
import { getClient } from "../client_provider.js";
import { OnReadyTaskBuilder } from "../Interfaces/helper_types.js";
import AutoVoiceSystemRepo from "../Repositories/autovoicesystem.js";
import { errorLogHandle } from "./error_logger.js";
import { attach_autovoice_manager_collector } from "../Systems/autovoice/autovoice_system.js";
import LfgSystemRepo from "../Repositories/lfgsystem.js";
import { interface_manager_collector } from "../Systems/lfg/lfg_interface_manager.js";
import TicketSystemRepo from "../Repositories/ticketsystem.js";
import { open_ticket_collector } from "../Systems/ticket_support/ticket_manager.js";
import { ticket_collector } from "../Systems/ticket_support/ticket_collector.js";
import ServerRolesRepo from "../Repositories/serverroles.js";
import AntiAltGuardRepo from "../Repositories/antialtguardsystem.js";
import { attach_aa_guard_status_collector, manual_review_collector } from "../Systems/antialt_guard/collectors.js";

function collectorErrorMessage(guildId: string) {
    return `Something went wrong while attaching the collector at guild id ${guildId}`
}

export const autoVoiceManagerCollectors: OnReadyTaskBuilder = {
    name: "Autovoice Manager",
    task: async () => {
        const client = getClient();
        const autovoiceSystems = await AutoVoiceSystemRepo.getAll();
        for (const row of autovoiceSystems) {
            try {
                const guild = await client.guilds.fetch(row.guild);
                const category = await guild.channels.fetch(row.category);
                if (!category) throw new Error("Category couldn't be fetched");
                const autovoice = await guild.channels.fetch(row.autovoice);
                if (!autovoice) throw new Error("Autovoice couldn't be fetched");
                const managerchannel = await guild.channels.fetch(row.managerchannel);
                if (!(managerchannel instanceof TextChannel)) throw new Error("Manager channel couldn't be fetched");
                const manager = await managerchannel.messages.fetch(row.message);
                await attach_autovoice_manager_collector(manager);
            } catch (error) {
                await errorLogHandle(error, collectorErrorMessage(row.guild));
                await AutoVoiceSystemRepo.deleteSystem(row.guild, row.message); // deleting the system as good measure
                continue;
            }
        }
    },
    runCondition: async () => true
}

export const lfgInterfaceManagerCollector: OnReadyTaskBuilder = {
    name: "LFG Interface",
    task: async () => {
        const client = getClient();
        const lfgGamesTable = await LfgSystemRepo.getGamesTable();
        for (const row of lfgGamesTable) {
            if (
                row.manager_message_id === null
                || row.category_channel_id === null
                || row.manager_channel_id === null
            ) { continue; } // skip unbuilt games 

            try {
                const guild = await client.guilds.fetch(row.guild_id);
                const category = await guild.channels.fetch(row.category_channel_id);
                if (!(category instanceof CategoryChannel)) throw new Error("Category couldn't be fetched");
                const channel = await guild.channels.fetch(row.manager_channel_id);
                if (!(channel instanceof TextChannel)) throw new Error("Channel couldn't be fetched");
                const message = await channel.messages.fetch(row.manager_message_id);
                if (!message) throw new Error("Couldn't fetch the LFG interface message.");
                await interface_manager_collector(message);
            } catch (error) {
                await errorLogHandle(error, collectorErrorMessage(row.guild_id));
                await LfgSystemRepo.deleteGame(row.id);
            }
        }
    },
    runCondition: async () => true
}

/* REMOVED SINCE DELETE AND BUMP BUTTONS WERE REMOVED SO THERE IS NOTHNG TO BE COLLECTED
export const LfgPostsCollector: OnReadyTaskBuilder = {
    name: "LFG Posts Collector",
    task: async () => {
        const client = getClient();
        const lfgPosts: LfgPostWithChannelTable[] = await LfgSystemRepo.getAllPostsWithChannel();
        for (const row of lfgPosts) {
            try {
                const guild = await client.guilds.fetch(row.guild_id);
                const channel = await guild.channels.fetch(row.discord_channel_id);
                if (!(channel instanceof TextChannel)) throw new Error("Post channel couldn't be fetched");
                const postMessage = await channel.messages.fetch(row.message_id);
                if (!postMessage) throw new Error("Couldn't fetch the post message object");
                await lfg_post_collector(postMessage, row);
            } catch (error) {
                await errorLogHandle(error, collectorErrorMessage(row.guild_id));
                await LfgSystemRepo.deletePostById(row.id);
            }
        }
    },
    runCondition: async () => true
}
*/

export const TicketSystemManagerCollector: OnReadyTaskBuilder = {
    name: "Ticket System Manager",
    task: async () => {
        const client = getClient();
        const ticketManagers = await TicketSystemRepo.fetchAllManagers();
        for (const row of ticketManagers) {
            try {
                const guild = await client.guilds.fetch(row.guild);
                const category = await guild.channels.fetch(row.category);
                if (!(category instanceof CategoryChannel)) throw new Error("Ticket Manager Category couldn't be fetched");
                const channel = await guild.channels.fetch(row.channel);
                if (!(channel instanceof TextChannel)) throw new Error("Ticket Manager Channel couldn't be fetched");
                const message = await channel.messages.fetch(row.message);
                if (!(message instanceof Message)) throw new Error("Ticket Manager Message couldn't be fetched.");

                await open_ticket_collector(client, guild, message);
            } catch (error) {
                await errorLogHandle(error, collectorErrorMessage(row.guild));
                await TicketSystemRepo.deleteGuildManager(row.guild);
            }
        }
    },
    runCondition: async () => true
}

export const OpenTicketCollector: OnReadyTaskBuilder = {
    name: "Open Ticket",
    task: async () => {
        const client = getClient();
        const openTickets = await TicketSystemRepo.fetchAllTickets();
        for (const row of openTickets) {
            try {
                const guild = await client.guilds.fetch(row.guild);
                const channel = await guild.channels.fetch(row.channel);
                if (!(channel instanceof TextChannel)) throw new Error("Open Ticket Channel couldn't be fetched");
                const message = await channel.messages.fetch(row.message);
                if (!(message instanceof Message)) throw new Error("Open Ticket Message couldn't be fetched.");
                const staffRoleId = await ServerRolesRepo.getGuildStaffRole(row.guild);
                if (staffRoleId === null) throw new Error("Failed to fetch the staff server role.")

                await ticket_collector(message, staffRoleId, row.subject);
            } catch (error) {
                await errorLogHandle(error, collectorErrorMessage(row.guild));
                await TicketSystemRepo.deleteTicketBySnowflake(row.message);
            }
        }
    },
    runCondition: async () => true
}

export const AntiAltGuardCollectors: OnReadyTaskBuilder = {
    name: "Antialt Guard Collectors",
    task: async () => {
        const client = getClient();
        const antiAltGuardSetups = await AntiAltGuardRepo.fetchAllSetups();
        //method 1
        for (const row of antiAltGuardSetups) {
            try {
                const guild = await client.guilds.fetch(row.guild);
                const verificationChannel = await guild.channels.fetch(row.verification_channel);
                if (!(verificationChannel instanceof TextChannel)) throw new Error("Verification channel couldn't be fetched.");
                const verificationMessageMenu = await verificationChannel
                    .messages
                    .fetch(row.verification_message_menu);
                if (!(verificationMessageMenu instanceof Message)) throw new Error("Verification menu couldn't be fetched as a message.");
                await attach_aa_guard_status_collector(verificationMessageMenu);
            } catch (error) {
                await errorLogHandle(error, collectorErrorMessage(row.guild));
                await AntiAltGuardRepo.deleteSetup(row.guild);
            }
        }

        // method 2
        // building an hierarchical collections of cached objects to optimize attaching collectors
        const pendingVerifications = await AntiAltGuardRepo.fetchPendingVerifications();
        const guildGroups = new Collection<
            string,
            Collection<string, typeof pendingVerifications>
        >();

        for (const row of pendingVerifications) {
            let channels = guildGroups.get(row.guild);
            if (!channels) {
                channels = new Collection();
                guildGroups.set(row.guild, channels);
            }

            let rows = channels.get(row.channel);
            if (!rows) {
                rows = [];
                channels.set(row.channel, rows);
            }

            rows.push(row);
        }

        // fetching and attaching the collectors
        for (const [guildId, channels] of guildGroups) {
            try {
                const guild = await client.guilds.fetch(guildId);
                const staffRoleId = await ServerRolesRepo.getGuildStaffRole(guild.id);
                if (!staffRoleId) continue;

                for (const [channelId, rows] of channels) {
                    const channel = await guild.channels.fetch(channelId);
                    if (!(channel instanceof TextChannel)) {
                        throw new Error(`Failed to fetch the assessment channel ${channelId}`);
                    }

                    for (const row of rows) {
                        try {
                            const message = await channel.messages.fetch(row.messageid);
                            if (!(message instanceof Message)) {
                                throw new Error(`Failed to fetch assessment message ${row.messageid}`)
                            }
                            await manual_review_collector(message, staffRoleId);
                        } catch (error) {
                            await AntiAltGuardRepo.deletePendingVerification(row.messageid);
                            await errorLogHandle(error, collectorErrorMessage(guildId));
                        }
                    }
                }
            } catch (error) {
                await errorLogHandle(error, collectorErrorMessage(guildId));
            }
        }
    },
    runCondition: async () => true
}