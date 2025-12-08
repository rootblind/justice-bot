/**
 * This event source file can also be seen as a handler for the commands and other
 * user-to-discord-api interactions that are executed.
 * Every time an interaction is executed, the bot runs interactionCreate that in its turn runs the execute() method.
 * 
 * While other types of interactions other than ChatInputInteraction (SlashCommands) trigger this event
 * the bot handles buttons, select menus, modals, etc through Discord Collectors.
 */

import { 
    ChatInputCommandInteraction, 
    Client, 
    Collection, 
    GuildMember, 
    MessageFlags 
} from "discord.js";

import type { Event } from "../../Interfaces/event.js";
import { fetch_bot_member, permission_names } from "../../utility_modules/discord_helpers.js";
import  { get_env_var, has_cooldown, set_cooldown } from "../../utility_modules/utility_methods.js";
import BotConfigRepo from "../../Repositories/botconfig.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { embed_error } from "../../utility_modules/embed_builders.js";

const interactonCreate: Event = {
    name: "interactionCreate",
    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        if(interaction.isChatInputCommand() && interaction.member instanceof GuildMember) {
            const botMember = await fetch_bot_member(interaction.guild);

            if(!botMember) return; // do nothing if the member object of the client couldn't be fetched

            const command = client.commands.get(interaction.commandName);
            if(!command) return;

            if(command.ownerOnly === true && interaction.user.id !== get_env_var("OWNER")) {
                return await interaction.reply({
                    embeds: [ embed_error("This command requires Owner privileges!") ],
                    flags: MessageFlags.Ephemeral
                });
            }

            if(command.userPermissions.length) {
                for(const permission of command.userPermissions) {
                    if(interaction.member?.permissions.has(permission)) {
                        continue;
                    }

                    return await interaction.reply({
                        embeds: [ embed_error(
                            `You have lack permission \`${permission_names(permission)[0]}\` to use /${command.data.name}`
                        ) ],
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            if(command.botPermissions.length) {
                for(const permission of command.botPermissions) {
                    if(botMember.permissions.has(permission)) {
                        continue;
                    }

                    if(permission_names(permission)[0] !== "SendMessages") {
                        return await interaction.reply({
                            embeds: [
                                embed_error(`I lack the permission \`${permission_names(permission)[0]}\` to do that!`)
                            ],
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }
            }

            try{
                const botAppData = await BotConfigRepo.getConfig();
                if(botAppData) {
                    if(botAppData.application_scope === "test" && interaction.user.id !== get_env_var("OWNER")) {
                        return await interaction.reply({
                            embeds: [ embed_error("Application scope is set to testing, maintenance might be undergoing.") ],
                            flags: MessageFlags.Ephemeral
                        });
                    }
                } else {
                    throw new Error("Missing bot configuration from database!");
                }
                
            } catch(error) {
                await errorLogHandle(error);

                return;
            }

            if(command.testOnly && interaction.guild?.id !== get_env_var("HOME_SERVER_ID")) {
                return await interaction.reply({
                    embeds: [embed_error("This command cannot be ran outside the Test Server!")],
                    flags: MessageFlags.Ephemeral
                });
            }

            // user based cooldown implementation https://discordjs.guide/additional-features/cooldowns
            const { cooldowns } = interaction.client; // all cooldowns

            if(!cooldowns.has(command.data.name)) {
                cooldowns.set(command.data.name, new Collection());
            }

            const timestamps = cooldowns.get(command.data.name); // the cooldowns of the specific command
            if(!timestamps) return;

            // check if the user is in cooldown for the specific command
            if(timestamps.has(interaction.user.id)) {
                const expires = has_cooldown(interaction.user.id, timestamps, command.cooldown)
                if(expires) {
                    return await interaction.reply({
                        content: `Please wait, you are on cooldown for \`${command.data.name}\`.
                        You can use it again <t:${expires}:R>`,
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            if(command.cooldown) set_cooldown(interaction.user.id, timestamps, command.cooldown); // set a cooldown only if the command has one

            if(!command) {
                return await interaction.reply({
                    embeds: [ embed_error("This is not an operable command", "Invalid command") ]
                });
            }
            
            command.execute(interaction, client);
        }

        return;
    }
}

export default interactonCreate;