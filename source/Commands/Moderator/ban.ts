import { EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder, User } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { fetchAllBans, fetchGuildMember, fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { ValidatorResponseType } from "../../Interfaces/helper_types.js";
import ServerRolesRepo from "../../Repositories/serverroles.js";
import { embed_ban, embed_message } from "../../utility_modules/embed_builders.js";
import { ban_handler, ban_lookup, embed_ban_details } from "../../Systems/moderation/ban_system.js";
import { PunishmentType } from "../../objects/enums.js";
import { duration_timestamp, duration_to_seconds } from "../../utility_modules/utility_methods.js";
import { warn_handler } from "../../Systems/moderation/warning.js";
import PunishLogsRepo from "../../Repositories/punishlogs.js";
import { embedInfractionsShortList } from "../../Systems/moderation/infractions.js";

const banCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member of this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addSubcommand(subcommand =>
            subcommand.setName('indefinite')
                .setDescription('Indefinitely ban a member.')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The member to be banned.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason to be banned.')
                        .setMaxLength(512)
                        .setMinLength(4)
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('delete-messages')
                        .setDescription('True to delete messages. True is the default.')
                )
                .addBooleanOption(option =>
                    option.setName('apply-warn')
                        .setDescription("Apply a warn on top of the ban. True is the default")
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('temporary')
                .setDescription('Temporary ban a member')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The member to be banned.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('The ban duration.')
                        .setMaxLength(3)
                        .setMinLength(2)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason for the ban.')
                        .setMaxLength(512)
                        .setMinLength(4)
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('delete-messages')
                        .setDescription('True to delete messages. True is the default.')
                )
                .addBooleanOption(option =>
                    option.setName('apply-warn')
                        .setDescription("Apply a warn on top of the ban. True is the default")
                )

        )
        .addSubcommand(subcommand =>
            subcommand.setName('permanent')
                .setDescription('Perform a permanent ban that requires administrator perms.')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The member to be banned.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason for the ban.')
                        .setRequired(true)
                        .setMaxLength(512)
                        .setMinLength(4)
                )
                .addBooleanOption(option =>
                    option.setName('delete-messages')
                        .setDescription('True to delete messages. True is the default.')
                )
                .addBooleanOption(option =>
                    option.setName('apply-warn')
                        .setDescription("Apply a warn on top of the ban. True is the default")
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('counter')
                .setDescription('The number of all time bans on this server.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName("check")
                .setDescription("Check the status of a ban.")
                .addUserOption(option =>
                    option.setName("target")
                        .setDescription("The banned user to check.")
                        .setRequired(true)
                )
        )
        .toJSON(),
    metadata: {
        cooldown: 5,
        scope: "guild",
        group: "moderation",
        category: "Moderator",
        userPermissions: [PermissionFlagsBits.BanMembers],
        botPermissions: [PermissionFlagsBits.Administrator]
    },
    async execute(interaction) {
        const moderator = interaction.member as GuildMember;
        const guild = moderator.guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();

        const deleteMessages = options.getBoolean("delete-messages") ?? true;
        const applyWarn = options.getBoolean("apply-warn") ?? true;

        const botMember = await guild.members.fetchMe();
        const staffRoleId = await ServerRolesRepo.getGuildStaffRole(guild.id) as string; // guaranteed by interactionCreate
        const modLogs = await fetchLogsChannel(guild, "moderation");

        async function validateTarget(
            user: User,
            moderator: GuildMember,
            botMember: GuildMember
        ): Promise<ValidatorResponseType> {
            if (user.bot) {
                return { value: false, message: "You can not target bots with that action!" }
            }
            const targetMember = await fetchGuildMember(guild, user.id);
            if (targetMember) {
                if (targetMember.roles.highest.position >= moderator.roles.highest.position) {
                    return { value: false, message: "You lack permission to ban someone above your highest role." }
                }
                if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
                    return { value: false, message: "I lack the permission to ban someone above my highest role." }
                }
                if (targetMember.roles.cache.has(staffRoleId)) {
                    return { value: false, message: "You can not target a STAFF member with that action!" }
                }
                if (targetMember.permissions.has(PermissionFlagsBits.BanMembers)) {
                    return { value: false, message: "This member has moderation permissions!" }
                }
            }

            return { value: true, message: "ok" };
        }

        switch (subcommand) {
            case "indefinite": {
                await interaction.deferReply();
                const target = options.getUser("target", true);
                const validate = await validateTarget(target, moderator, botMember);
                const reason = options.getString("reason", true);

                if (!validate.value) {
                    await interaction.editReply({
                        embeds: [embed_message("Red", validate.message)]
                    });
                    return;
                }

                await ban_handler(
                    guild,
                    target,
                    moderator.user,
                    PunishmentType.INDEFINITE_BAN,
                    reason,
                    deleteMessages,
                    undefined, // no duration
                    modLogs
                );

                if (applyWarn) {
                    await warn_handler(
                        guild,
                        target,
                        moderator.user,
                        `Added warn | ${reason}`,
                        modLogs
                    );
                }

                await interaction.editReply({
                    embeds: [
                        embed_ban(
                            target,
                            moderator.user,
                            PunishmentType.INDEFINITE_BAN,
                            reason
                        )
                    ]
                });

                break;
            }
            case "temporary": {
                await interaction.deferReply();
                const target = options.getUser("target", true);
                const validate = await validateTarget(target, moderator, botMember);
                const reason = options.getString("reason", true);
                const duration = options.getString("duration", true);
                const seconds = duration_to_seconds(duration);

                if (!validate.value) {
                    await interaction.editReply({
                        embeds: [embed_message("Red", validate.message)]
                    });
                    return;
                }

                if (seconds === null) {
                    await interaction.editReply({
                        embeds: [embed_message("Red", "Invalid duration format. Provide a duration that respects the format: <number: 1-99>< d | w | y >")]
                    });
                    return;
                }

                if (seconds < 3 * 24 * 60 * 60) { // 3 days
                    // temp bans are restricted to a minimum of 3 days
                    await interaction.editReply({
                        embeds: [embed_message("Red",
                            "You must provide a duration of at least 3 days (3d). " +
                            "Use `/timeout` if you wish to apply a lesser sanction."
                        )]
                    });
                    return;
                }

                await ban_handler(
                    guild,
                    target,
                    moderator.user,
                    PunishmentType.TEMPBAN,
                    reason,
                    deleteMessages,
                    String(seconds),
                    modLogs
                );

                if (applyWarn) {
                    await warn_handler(
                        guild,
                        target,
                        moderator.user,
                        `Added warn | ${reason}`,
                        modLogs
                    );
                }

                await interaction.editReply({
                    embeds: [
                        embed_ban(
                            target,
                            moderator.user,
                            PunishmentType.TEMPBAN,
                            reason,
                            undefined, // color
                            `${duration_timestamp(duration)}`
                        )
                    ]
                });

                break;
            }
            case "permanent": {
                // permanent bans require admin perms
                await interaction.deferReply();
                const target = options.getUser("target", true);
                const validate = await validateTarget(target, moderator, botMember);
                const reason = options.getString("reason", true);

                if (!moderator.permissions.has(PermissionFlagsBits.Administrator)) {
                    await interaction.editReply({
                        embeds: [
                            embed_message("Red",
                                "Permanently banning someone required Administrator permissions.\n" +
                                "If you must, indefinitely ban the target and notify an administrator about it."
                            )
                        ]
                    });
                    return;
                }

                if (!validate.value) {
                    await interaction.editReply({
                        embeds: [embed_message("Red", validate.message)]
                    });
                    return;
                }

                await ban_handler(
                    guild,
                    target,
                    moderator.user,
                    PunishmentType.PERMANENT_BAN,
                    reason,
                    deleteMessages,
                    undefined,
                    modLogs
                );

                if (applyWarn) {
                    await warn_handler(
                        guild,
                        target,
                        moderator.user,
                        `Added warn | ${reason}`,
                        modLogs
                    );
                }

                await interaction.editReply({
                    embeds: [
                        embed_ban(
                            target,
                            moderator.user,
                            PunishmentType.PERMANENT_BAN,
                            reason
                        )
                    ]
                });

                break;
            }
            case "counter": {
                await interaction.deferReply();
                const bans = await fetchAllBans(guild);
                await interaction.editReply({
                    embeds: [
                        embed_message("Aqua", `**${guild.name}** total ban count: ${bans.size}`, "Ban count")
                    ]
                });
                break;
            }
            case "check": {
                const target = options.getUser("target", true);
                await interaction.deferReply();
                const banLookup = await ban_lookup(guild, target);
                const banLookupEmbed = embed_ban_details(target, banLookup);
                if (!banLookup) { // the target is not banned
                    await interaction.editReply({ embeds: [banLookupEmbed] });
                    return;
                }
                const banLogs = await PunishLogsRepo.fetchBans(guild.id, target.id);
                const shortBanList = embedInfractionsShortList(target, "ban", banLogs);
                const embeds: EmbedBuilder[] = [banLookupEmbed]
                if (banLogs.length > 0) embeds.push(shortBanList);

                await interaction.editReply({ embeds: embeds });
                break;
            }
        }
    }
}

export default banCommand;