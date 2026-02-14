import {
    ActionRowBuilder,
    APISelectMenuOption,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder, GuildMember, LabelBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, RestOrArray, SlashCommandBuilder,
    StringSelectMenuBuilder
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { fetchLogsChannel, message_collector } from "../../utility_modules/discord_helpers.js";
import AutopunishRuleRepo from "../../Repositories/autopunishrule.js";
import { embed_interaction_expired, embed_message, embed_new_autorule } from "../../utility_modules/embed_builders.js";
import { duration_to_seconds, durationRegex, timestampNow } from "../../utility_modules/utility_methods.js";
import { AutoPunishRule } from "../../Interfaces/database_types.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

const autoPunishRule: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName('autopunish-rule')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription('Manage auto punishment rules.')
        .addSubcommand(subcommand =>
            subcommand.setName('add')
                .setDescription('Add a new rule. Rules are unique based on warn count and duration pair.')
                .addNumberOption(option =>
                    option.setName('warncount')
                        .setDescription('The number of warnings within the duration to trigger the rule')
                        .setMinValue(1)
                        .setMaxValue(1000)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('The duration of the warns counted to the rule.')
                        .setMinLength(2)
                        .setMaxLength(3)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('punishment-type')
                        .setDescription('The type of punishment to be applied if the rule is triggered.')
                        .addChoices(
                            {
                                name: "Time out",
                                value: "timeout"
                            },
                            {
                                name: "Ban",
                                value: "ban"
                            }
                        )
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('punishment-duration')
                        .setDescription('The duration of the punishment. Bans can be set to 0 for indefinite ban.')
                        .setMaxLength(3)
                        .setMinLength(1)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('list')
                .setDescription('List all active auto punish rules.')
        )
        .toJSON(),
    metadata: {
        cooldown: 10,
        userPermissions: [PermissionFlagsBits.Administrator],
        botPermissions: [PermissionFlagsBits.Administrator],
        scope: "guild",
        category: "Administrator",
        group: "moderation"
    },
    async execute(interaction) {
        const member = interaction.member as GuildMember;
        const guild = member.guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();

        await interaction.deferReply();
        const logChannel = await fetchLogsChannel(guild, "moderation");

        switch (subcommand) {
            case "add": {
                const count = await AutopunishRuleRepo.count(guild.id);
                if (count > 20) {
                    // limit 20 rules per guild
                    await interaction.editReply({
                        embeds: [embed_message("Red", "This server exceeded the maximum number of autorules (20).")]
                    });
                    return;
                }
                const warnCount = options.getNumber("warncount", true);
                const durationString = options.getString("duration", true).toLowerCase();
                if (!durationRegex.test(durationString)) {
                    await interaction.editReply({
                        embeds: [embed_message("Red", "Provide a duration that respects the format: <number: 1-99>< m | h | d | w | y >", "Invalid input")]
                    });
                    return;
                }
                const duration = duration_to_seconds(durationString);
                if (!duration) {
                    await interaction.editReply({
                        embeds: [embed_message("Red", "Provide a duration that respects the format: <number: 1-99>< m | h | d | w | y >", "Invalid input")]
                    });
                    return;
                }

                if (timestampNow() - duration <= 0) {
                    // if the duration is longer than the unix time
                    await interaction.editReply({
                        embeds: [embed_message("Red", "Duration can not exceed the Unix timestamp!", "The duration is too high")]
                    });
                    return;
                }

                if (duration === 0) {
                    await interaction.editReply({
                        embeds: [embed_message("Red", "Rule duration can not be zero!")]
                    });
                    return;
                }

                const punishmentType = options.getString("punishment-type", true);
                const punishmentDurationString = options.getString("punishment-duration", true).toLowerCase();

                if (!durationRegex.test(punishmentDurationString) && punishmentDurationString != "0") {
                    await interaction.editReply({
                        embeds: [embed_message("Red", "Provide a duration that respects the format: <number: 1-99>< m | h | d | w | y > or 0 for indefinite ban.")]
                    });
                    return;
                }

                if (punishmentDurationString === "0" && punishmentType === "timeout") {
                    await interaction.editReply({
                        embeds: [embed_message("Red", "You can not set timeout duration to 0, that option is available for ban.")]
                    });
                    return;
                }

                const punishmentDuration =
                    punishmentDurationString === "0"
                        ? 0
                        : duration_to_seconds(punishmentDurationString);

                if (punishmentDuration === null) {
                    await interaction.editReply({
                        embeds: [embed_message("Red", "Provide a duration that respects the format: <number: 1-99>< m | h | d | w | y > or 0 for indefinite ban.")]
                    });
                    return;
                }

                if (punishmentDuration === 0 && punishmentType === "timeout") {
                    await interaction.editReply({
                        embeds: [embed_message("Red", "You can not set timeout duration to 0, that option is available for ban.")]
                    });
                    return;
                }

                const decidePunishmentIndex = (type: string, duration: number) => {
                    if (type === "timeout") return 1;
                    if (type === "ban" && duration > 0) return 2; // tempban
                    if (type === "ban" && duration === 0) return 3; // ban indefinite

                    // default to timeout
                    return 1;
                }

                const punishmentIndex = decidePunishmentIndex(punishmentType, punishmentDuration);

                // restrict duration per punishment
                if (punishmentType === "timeout" && punishmentDuration > duration_to_seconds("2d")!) {
                    await interaction.editReply({
                        embeds: [embed_message("Red", "Timeout can not last longer than 2 days.")]
                    });
                    return;
                }
                if ( // tempbans can not be shorter than 3 days
                    punishmentType === "ban"
                    && punishmentIndex === 2
                    && punishmentDuration < duration_to_seconds("3d")!
                ) {
                    await interaction.editReply({
                        embeds: [embed_message("Red", "Temporary ban can not be shorter than 3 days.")]
                    });
                    return;
                }

                const isValid = await AutopunishRuleRepo.isRuleValid(guild.id, warnCount, duration);
                if (!isValid) {
                    await interaction.editReply({
                        embeds: [embed_message("Red", "Rules are unique by their warn count and duration trigger.", "Rule duplicate")]
                    });
                    return;
                }

                // register the rule
                const newRule = await AutopunishRuleRepo.insert(guild.id, warnCount, duration, punishmentIndex, punishmentDuration);

                if (logChannel) {
                    await logChannel.send({
                        embeds: [
                            embed_new_autorule(member, AutopunishRuleRepo.stringifyRule(newRule))
                        ]
                    });
                }

                await interaction.editReply({
                    embeds: [
                        embed_message("Green",
                            `**Rule ID [${newRule.id}]**: ${AutopunishRuleRepo.stringifyRule(newRule)}`, "Rule added successfully"
                        )
                    ]
                });
                break;
            }
            case "list": {
                const autoRules = await AutopunishRuleRepo.getRules(guild.id);
                const emptyList = new EmbedBuilder()
                    .setColor("Purple")
                    .setTitle("Empty list")
                    .setDescription("Use `/autopunish-rule add` to add a rule.")
                if (autoRules.length === 0) {
                    await interaction.editReply({
                        embeds: [
                            emptyList
                        ]
                    });
                    return;
                }

                const buildListEmbed = (rules: (AutoPunishRule & { id: number })[]) => {
                    const embed = new EmbedBuilder().setColor("Purple").setTitle("Auto Punish Rules")
                        .setDescription("**Remove rules**: To remove one or more rules.\n**Clear**: To clear all rules.");

                    for (const rule of rules) {
                        embed.addFields({
                            name: `Rule ID[${rule.id}]`,
                            value: AutopunishRuleRepo.stringifyRule(rule)
                        });
                    }

                    return embed;
                }

                const removeRulesButton = new ButtonBuilder()
                    .setCustomId('remove-rules')
                    .setStyle(ButtonStyle.Danger)
                    .setLabel("Remove rules")
                const removeAllRulesButton = new ButtonBuilder()
                    .setCustomId('remove-all-rules')
                    .setStyle(ButtonStyle.Danger)
                    .setLabel("Clear")

                await interaction.editReply({
                    embeds: [buildListEmbed(autoRules)],
                    components: [
                        new ActionRowBuilder<ButtonBuilder>()
                            .addComponents(removeRulesButton, removeAllRulesButton)
                    ]
                });
                const reply = await interaction.fetchReply();
                await message_collector<ComponentType.Button>(reply,
                    {
                        componentType: ComponentType.Button,
                        filter: (i) => i.user.id === interaction.user.id,
                        time: 600_000
                    },
                    async (buttonInteraction) => {
                        switch (buttonInteraction.customId) {
                            case "remove-rules": {
                                const selectRuleOptions: RestOrArray<APISelectMenuOption> =
                                    autoRules.map(r => {
                                        return {
                                            label: `Rule ID [${r.id}]`,
                                            value: `${r.id}`,
                                            description: `Remove rule ID ${r.id}`
                                        }
                                    });

                                const selectRuleMenu = new StringSelectMenuBuilder()
                                    .setCustomId("select-rule-menu")
                                    .setMinValues(1)
                                    .setMaxValues(selectRuleOptions.length)
                                    .setPlaceholder("The rules to be deleted...")
                                    .setRequired(true);
                                const selectRuleLabel = new LabelBuilder()
                                    .setLabel("Select rules")
                                    .setDescription("Select rules by ID to delete them.")
                                    .setStringSelectMenuComponent(selectRuleMenu);
                                const modal = new ModalBuilder()
                                    .setCustomId("rule-modal")
                                    .setTitle("Delete autorules")
                                    .addLabelComponents(selectRuleLabel);
                                await buttonInteraction.showModal(modal);
                                try {
                                    const submit = await buttonInteraction.awaitModalSubmit({
                                        time: 600_000,
                                        filter: (i) => i.user.id === interaction.user.id
                                    });

                                    const ruleIds = [...submit.fields.getStringSelectValues("select-rule-menu")];
                                    await AutopunishRuleRepo.deleteRulesByIdArray(guild.id, ruleIds); // delete rules

                                    // update the list
                                    const updatedRules = await AutopunishRuleRepo.getRules(guild.id);
                                    if (updatedRules.length === 0) {
                                        try {
                                            await reply.edit({
                                                embeds: [emptyList],
                                                components: []
                                            });
                                        } catch (error) {
                                            await errorLogHandle(error);
                                        }
                                    } else {
                                        try {
                                            await reply.edit({
                                                embeds: [buildListEmbed(updatedRules)]
                                            });
                                        } catch (error) {
                                            await errorLogHandle(error);
                                        }
                                    }
                                } catch (error) {
                                    console.error(error); // remove after dev
                                    await buttonInteraction.followUp({ flags: MessageFlags.Ephemeral, embeds: [embed_interaction_expired()] });
                                }
                                break;
                            }
                            case "remove-all-rules": {
                                await AutopunishRuleRepo.cleanGuildRules(guild.id);
                                try {
                                    await reply.edit({ embeds: [emptyList], components: [] });
                                } catch (error) {
                                    await errorLogHandle(error);
                                }

                                await buttonInteraction.reply({
                                    embeds: [embed_message("Green", "All rules have been deleted.")],
                                    flags: MessageFlags.Ephemeral
                                });
                                break;
                            }
                        }
                    },
                    async () => {
                        if (reply.deletable) {
                            try {
                                await reply.delete();
                            } catch {/* do nothing */ }
                        }
                    }
                )

                break;
            }
        }
    }
}

export default autoPunishRule;