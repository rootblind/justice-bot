import { TextChannel } from "discord.js";
import { getClient } from "../client_provider.js";
import { OnReadyTaskBuilder } from "../Interfaces/helper_types.js";
import AutoVoiceSystemRepo from "../Repositories/autovoicesystem.js";
import { errorLogHandle } from "./error_logger.js";
import { attach_autovoice_manager_collector } from "../Systems/autovoice/autovoice_system.js";

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
                await errorLogHandle(error, `Something went wrong at guild id ${row.guild}`);
                await AutoVoiceSystemRepo.deleteSystem(row.guild, row.message); // deleting the system as good measure
                continue;
            }
        }
    },
    runCondition: async() => true
}