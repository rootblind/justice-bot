import {
    ActionRowBuilder,
    ComponentType, 
    EmbedBuilder, 
    Guild, 
    MessageFlags, 
    PermissionFlagsBits,
    SlashCommandBuilder, 
    StringSelectMenuBuilder, 
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { embed_error, embed_manual_command_pages, embed_message } from "../../utility_modules/embed_builders.js";
import { getGuildCommandGroups } from "../../utility_modules/utility_methods.js";
import { message_collector } from "../../utility_modules/discord_helpers.js";

const man: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("man")
        .setDescription("Open the manual for chat commands. Provide a command name for details about usage.")
        .addStringOption(option =>
            option.setName("command")
                .setDescription("Open the manual page for the specified command.")
        )
        .toJSON(),

    async execute(interaction, client) {
        const guild = interaction.guild as Guild;
        const command = interaction.options.getString("command")?.toLocaleLowerCase();
        if(command) { // if a command was provided, open its page
            const chatCommand: ChatCommand | undefined = client.commands.get(command);

            if(!chatCommand) {
                return await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    embeds: [ embed_error(`${command} doesn't exist as chat command, check spelling`) ]
                })
            }

            const embeds = embed_manual_command_pages(chatCommand.data, chatCommand.metadata);
            return await interaction.reply({embeds: embeds});
        } else {
            // if not, then all groups will be displayed inside an embed and a select menu will be used
            // to list all commands of the selected group
            const groups = await getGuildCommandGroups(guild.id, client);
            const manualMenuEmbed = new EmbedBuilder()
                .setTitle(`${client.user?.username}'s chat commands manual`)
                .setDescription("Select a group to see the command list.")
                .setColor("Aqua")
                .setFields({
                    name: "Groups",
                    value: groups.map(g => `- ${g}`).join("\n")
                });
            
            const groupOptions: {label: string, value: string, description: string}[] = [];
            groups.forEach(g => {
                groupOptions.push(
                    {
                        label: g,
                        value: g,
                        description: `View ${g} group commands`
                    }
                );
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId("select-command-group")
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(groupOptions);

            const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(selectMenu);

            await interaction.reply({
                embeds: [ manualMenuEmbed ],
                components: [ actionRow ]
            });

            const reply = await interaction.fetchReply();
            await message_collector<ComponentType.StringSelect>(
                reply,
                {
                    componentType: ComponentType.StringSelect
                },
                async (selectInteraction) => {
                    if(!selectInteraction.values[0]) {
                        await selectInteraction.reply({
                            embeds: [ embed_error("No selection was made.") ],
                            flags: MessageFlags.Ephemeral
                        });

                        return;
                    }

                    const selectedGroup = selectInteraction.values[0];
                    // comamnds within the selected group
                    const commands = Array.from(
                        client.commands
                            .filter((cmd) => cmd.metadata.group === selectedGroup)
                            .map(cmd => `**/${cmd.data.name}** - ${cmd.data.description}`)
                    );

                    await selectInteraction.reply({
                        embeds: [
                            embed_message("Aqua", commands.join("\n"), `${selectedGroup} commands`)
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                },
                async () => { return; }
            );

        }
    },

    metadata: {
        botPermissions: [ PermissionFlagsBits.SendMessages ],
        userPermissions: [],
        scope: "global",
        category: "Info",
        group: "global",
        cooldown: 3,
    }
}

export default man;