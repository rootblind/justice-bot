import type { Event } from "../../Interfaces/event.js";
import type { Guild } from "discord.js";
import GuildModulesRepo from "../../Repositories/guildmodules.js";
import GuildPlanRepo from "../../Repositories/guildplan.js";

const guildCreate: Event = {
    name: "guildCreate",
    async execute(guild: Guild) {
        await GuildModulesRepo.default(guild.id); // set default disabled modules to none (empty array)
        await GuildPlanRepo.default(guild.id); // set default plan to free
    }
}

export default guildCreate;