import type { Event } from "../../Interfaces/event.js";
import type { Guild } from "discord.js";
import GuildModulesRepo from "../../Repositories/guildmodules.js";
import GuildPlanRepo from "../../Repositories/guildplan.js";
import LfgSystemRepo from "../../Repositories/lfgsystem.js";

const guildCreate: Event = {
    name: "guildCreate",
    async execute(guild: Guild) {
        await GuildModulesRepo.default(guild.id); // set default disabled modules to none (empty array)
        await GuildPlanRepo.default(guild.id); // set default plan to free
        await LfgSystemRepo.initSystemConfig(guild.id);
    }
}

export default guildCreate;