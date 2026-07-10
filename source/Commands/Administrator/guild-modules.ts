import {
    ActionRowBuilder,
    APISelectMenuOption,
    ComponentType,
    EmbedBuilder,
    Guild,
    PermissionFlagsBits,
    RestOrArray,
    SlashCommandBuilder,
    StringSelectMenuBuilder
} from "discord.js";
import { CHAT_COMMAND_GROUPS, ChatCommand, ChatCommandGroup } from "../../Interfaces/command.js";
import GuildModulesRepo from "../../Repositories/guildmodules.js";
import { message_collector } from "../../utility_modules/discord_helpers.js";
import { duration_to_milliseconds } from "../../utility_modules/utility_methods.js";
import { sync_guild_commands } from "../../Handlers/commandHandler.js";

const guildModulesCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("guild-modules")
        .setDescription("Enable, disable and list guild command modules.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName("toggle")
                .setDescription("Toggle guild command modules.")
        )
        .addSubcommand(subcommand =>
            subcommand.setName("list")
                .setDescription("List all guild command modules grouped by their toggle status.")
        )
        .toJSON(),
    metadata: {
        botPermissions: [],
        userPermissions: [PermissionFlagsBits.Administrator],
        cooldown: 120,
        scope: "global",
        category: "Administrator",
        group: "global"
    },
    async execute(interaction, client) {
        const guild = interaction.guild as Guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();

        await interaction.deferReply();
        // all groups have unique names so using set for mutable operations
        const disabledModules = new Set(await GuildModulesRepo.getGuildDisabled(guild.id) as ChatCommandGroup[]);
        const enabledModules = new Set(CHAT_COMMAND_GROUPS.filter(group =>
            group !== "global" && !disabledModules.has(group)
        )); // enabled guild modules are the ones that are not disabled or global

        const embedList = (disabled: string[], enabled: string[]): EmbedBuilder => {
            const embed = new EmbedBuilder()
                .setColor("Purple")
                .setAuthor({
                    name: `${guild.name} guild modules`,
                    iconURL: `${guild.iconURL({ extension: "png" })}`
                });
            if (disabled.length) {
                embed.addFields({
                    name: "Disabled",
                    value: disabled.join(", ")
                });
            }
            if (enabled.length) {
                embed.addFields({
                    name: "Enabled",
                    value: enabled.join(", ")
                });
            }
            return embed;
        }
        switch (subcommand) {
            case "toggle": {
                // build a select menu to toggle multiple modules as once
                const selectModulesOptions: RestOrArray<APISelectMenuOption> = CHAT_COMMAND_GROUPS
                    .filter(group => group !== "global") // global can not be toggled
                    .map(group => {
                        const description = `${enabledModules.has(group) ? "Disable" : "Enable"} this module group.` // Description of the option represents the effect of toggling it
                        return {
                            label: group.toUpperCase(),
                            value: group,
                            description: description
                        }
                    });

                const selectModuleMenu: StringSelectMenuBuilder = new StringSelectMenuBuilder()
                    .setCustomId("select-module")
                    .setMaxValues(CHAT_COMMAND_GROUPS.length - 1) // deducing the count for global
                    .setMinValues(1)
                    .setPlaceholder("Select the command groups to toggle...")
                    .setOptions(selectModulesOptions);

                const actionRow: ActionRowBuilder<StringSelectMenuBuilder> = new ActionRowBuilder<StringSelectMenuBuilder>()
                    .addComponents(selectModuleMenu);

                await interaction.editReply({
                    embeds: [embedList([...disabledModules], [...enabledModules])],
                    components: [actionRow]
                });

                const message = await interaction.fetchReply();

                const collector = message_collector<ComponentType.StringSelect>(message, {
                    filter: (i) => i.user.id === interaction.user.id,
                    componentType: ComponentType.StringSelect,
                    time: duration_to_milliseconds("5m")!
                },
                    async (selectInteraction) => {
                        const selectValues = selectInteraction.values as ChatCommandGroup[];
                        for (const group of selectValues) {
                            if (enabledModules.has(group)) {
                                // by toggling, one set deletes the array and the other adds it
                                disabledModules.add(group);
                                enabledModules.delete(group);
                            } else if (disabledModules.has(group)) {
                                disabledModules.delete(group);
                                enabledModules.add(group);
                            }
                        }

                        // after the for loop, the sets are updated with the input given
                        await selectInteraction.deferReply();
                        await GuildModulesRepo.set(guild.id, [...disabledModules]); // update database
                        await sync_guild_commands(client, guild);
                        await selectInteraction.editReply({
                            embeds: [embedList([...disabledModules], [...enabledModules])]
                        });
                        (await collector).stop();
                    },
                    async () => {
                        try {
                            await message.delete();
                        } catch {/* do nothing */ }
                    }
                )
                break;
            }
            case "list": {
                await interaction.editReply({ embeds: [embedList([...disabledModules], [...enabledModules])] });
                break;
            }
        }
    }
}

export default guildModulesCommand;