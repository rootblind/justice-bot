import {
    GuildMember,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import {
    is_code_unique,
    key_details_string,
    premium_key_labels,
    validate_expiration_duration,
    validate_usesnumber
} from "../../Systems/premium/premium_system.js";
import { fetchGuildMember, fetchLogsChannel, fetchPremiumRole, handleModalCatch } from "../../utility_modules/discord_helpers.js";
import { embed_error, embed_message, embed_new_premium_membership } from "../../utility_modules/embed_builders.js";
import {
    decryptor,
    duration_to_seconds,
    encryptor,
    generate_unique_code,
    timestampNow
} from "../../utility_modules/utility_methods.js";
import PremiumSystemRepo from "../../Repositories/premiumsystem.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { PremiumKey } from "../../Interfaces/database_types.js";

const premiumAdminCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("premium-admin")
        .setDescription("Administrate keys and memberships.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("key")
                .setDescription("Administrative subcommands for premium keys.")
                .addSubcommand(subcommand =>
                    subcommand.setName("generate")
                        .setDescription("Open a menu to generate a new premium key.")
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("delete")
                        .setDescription("Delete a premium key by its code.")
                        .addStringOption(option =>
                            option.setName('code')
                                .setDescription('The code for the key to be deleted.')
                                .setMinLength(5)
                                .setMaxLength(10)
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("edit")
                        .setDescription("Open a menu to edit the code given.")
                        .addStringOption(option =>
                            option.setName('code')
                                .setDescription('The code of the key.')
                                .setMinLength(5)
                                .setMaxLength(10)
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('details')
                        .setDescription('List details about a specific key.')
                        .addStringOption(option =>
                            option.setName('code')
                                .setDescription('Show details about the specific code key.')
                                .setMinLength(5)
                                .setMaxLength(10)
                        )
                        .addNumberOption(option =>
                            option.setName("key-id")
                                .setDescription("Use the ID to look for the key instead.")
                                .setMinValue(0)
                        )
                )
        )
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("membership")
                .setDescription("Administrative subcommands for memberships.")
                .addSubcommand(subcommand =>
                    subcommand.setName("assign")
                        .setDescription("Assign a premium key to the selected member.")
                        .addUserOption(option =>
                            option.setName("user")
                                .setDescription("The targeted user.")
                                .setRequired(true)
                        )
                        .addStringOption(option =>
                            option.setName("code")
                                .setDescription("The code of the key to be assign for this membership.")
                                .setRequired(true)
                                .setMinLength(5)
                                .setMaxLength(10)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("remove")
                        .setDescription("Remove membership status.")
                        .addUserOption(option =>
                            option.setName("user")
                                .setDescription("The premium member to have their membership removed.")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("create-role")
                        .setDescription("Create a new role and set it as the custom role for this membership.")
                        .addUserOption(option =>
                            option.setName("user")
                                .setDescription("The premium member")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("set-role")
                        .setDescription("Set an existing role as the custom role for this membership.")
                        .addUserOption(option =>
                            option.setName("user")
                                .setDescription("The premium member")
                                .setRequired(true)
                        )
                        .addRoleOption(option =>
                            option.setName("role")
                                .setDescription("The role to set as custom role for the premium member.")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("details")
                        .setDescription("Details about a membership.")
                        .addUserOption(option =>
                            option.setName("user")
                                .setDescription("Details about the user's membership on this server.")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("migrate-boosters")
                        .setDescription("Go through all Nitro Boosters and assign them a premium key.")
                )

        )
        .toJSON(),
    metadata: {
        cooldown: 5,
        botPermissions: [
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.ManageChannels
        ],
        userPermissions: [PermissionFlagsBits.Administrator],
        group: "premium",
        category: "Administrator",
        scope: "guild"
    },
    async execute(interaction, client) {
        const interactionMember = interaction.member as GuildMember;
        const guild = interactionMember.guild;

        const options = interaction.options;
        const subcommand = options.getSubcommand();
        const subcommandGroup = options.getSubcommandGroup();

        const logChannel = await fetchLogsChannel(guild, "premium-activity");

        switch (subcommandGroup) {
            case "key": {
                switch (subcommand) {
                    case "generate": {
                        const newKeyModal = new ModalBuilder()
                            .setTitle("Generate premium key")
                            .setCustomId("new-key-modal")
                            .setLabelComponents(premium_key_labels())
                        await interaction.showModal(newKeyModal);
                        try {
                            const submit = await interaction.awaitModalSubmit({
                                time: 300_000,
                                filter: (i) => i.user.id === interaction.user.id
                            });

                            // selecting the tier is required and guarantees single selection.
                            // the value of a selection is a string
                            // values of tiers are guaranteed to be convertable to number equivalents
                            const tier: number = Number(submit.fields.getStringSelectValues("select-tier")[0]!);
                            // usesnumber is a required field
                            const usesnumber: number = Number(submit.fields.getTextInputValue("usesnumber-input")!);

                            if (!validate_usesnumber(usesnumber)) {
                                await submit.reply({
                                    embeds: [
                                        embed_message(
                                            "Red",
                                            "The field `usesnumber` is required and must be a valid number within [1 - 100.000]."
                                        )
                                    ],
                                    flags: MessageFlags.Ephemeral
                                });

                                return;
                            }

                            const expirationString = submit.fields.getTextInputValue("expiration-input");
                            const duration = duration_to_seconds(expirationString);

                            if (!validate_expiration_duration(duration)) {
                                await submit.reply({
                                    embeds: [
                                        embed_message(
                                            "Red",
                                            "The input must look something like: 1d, 2w, 3y and must be over one day of time.\n" +
                                            "A duration of 0d/0w/0y results in a permanent key.",
                                            "The expiration given is invalid."
                                        )
                                    ],
                                    flags: MessageFlags.Ephemeral
                                });
                                return;
                            }

                            // if duration is 0, then expirationTimestamp will be 0
                            const expirationTimestamp = duration === 0 ? duration : timestampNow() + duration!;
                            const now = timestampNow();

                            await submit.deferReply({ flags: MessageFlags.Ephemeral });
                            let code = submit.fields.getTextInputValue("code-input");
                            let decoded = code;
                            if (!code) {
                                // if no code was given, generate one
                                code = await generate_unique_code();
                                decoded = decryptor(code);
                            } else {
                                code = encryptor(code);
                            }
                            const codeIsUnique = await is_code_unique(code);
                            if (!codeIsUnique) {
                                await submit.editReply({
                                    embeds: [
                                        embed_message("Red", "This code already exists. Please try again with a unique code.")
                                    ]
                                });
                                return;
                            }

                            const dedicatedUser = submit.fields.getSelectedUsers("select-user", false)?.first();

                            const newKey: PremiumKey = {
                                guild: guild.id,
                                code: Buffer.from(code, "hex"),
                                tier: tier,
                                generatedby: interaction.user.id,
                                createdat: now,
                                expiresat: expirationTimestamp,
                                usesnumber: usesnumber,
                                dedicateduser: dedicatedUser?.id ?? null
                            }
                            await PremiumSystemRepo.newKey(newKey);
                            const embedSuccess = embed_message("Green", `New key generated with the code ||${decoded}||`, "Premium key generated")
                                .addFields(
                                    {
                                        name: "Details",
                                        value: key_details_string(newKey)
                                    }
                                )
                                .setTimestamp()

                            await submit.editReply({ embeds: [embedSuccess] });

                            if (logChannel) { // log the event
                                try {
                                    await logChannel.send({
                                        embeds: [embedSuccess.setFooter({ text: `Admin ID: ${interaction.user.id}` })]
                                    });
                                } catch (error) {
                                    await errorLogHandle(error);
                                }
                            }

                        } catch (error) {
                            await handleModalCatch(error, interaction);
                        }
                        break;
                    }
                    case "delete": {
                        const code = options.getString("code", true);
                        const premiumKey = await PremiumSystemRepo.getGuildKeyByCode(guild.id, code);
                        if (premiumKey) {
                            await PremiumSystemRepo.deleteGuildKeyCode(guild.id, code);
                            const embedSuccess = embed_message(
                                "Green",
                                `The premium key with the code **${code}** has been deleted.`,
                                `${interactionMember.user.username} deleted a key`
                            )
                                .addFields({
                                    name: "Details",
                                    value: key_details_string(premiumKey)
                                })
                                .setTimestamp()
                            await interaction.reply({ embeds: [embedSuccess], flags: MessageFlags.Ephemeral });

                            if (logChannel) {
                                try {
                                    await logChannel.send({
                                        embeds: [
                                            embedSuccess
                                                .setColor("Red")
                                                .setFooter({ text: `Admin ID: ${interaction.user.id}` })
                                        ]
                                    })
                                } catch (error) {
                                    await errorLogHandle(error);
                                }
                            }
                        } else {
                            await interaction.reply({
                                embeds: [
                                    embed_message("Red", "No key was found with that code on this guild.")
                                ],
                                flags: MessageFlags.Ephemeral
                            });
                        }
                        break;
                    }
                    case "edit": {
                        const code = options.getString("code", true);
                        const premiumKey = await PremiumSystemRepo.getGuildKeyByCode(guild.id, code);
                        if (!premiumKey) {
                            await interaction.reply({
                                embeds: [
                                    embed_message("Red", "No such key by this code.")
                                ],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        const editKeyModal = new ModalBuilder()
                            .setCustomId("edit-key-modal")
                            .setTitle("Edit key")
                            .setLabelComponents(premium_key_labels(true));

                        await interaction.showModal(editKeyModal);
                        try {
                            const submit = await interaction.awaitModalSubmit({
                                time: 300_000,
                                filter: (i) => i.user.id === interaction.user.id
                            });

                            const tierSelection = submit.fields.getStringSelectValues("select-tier");
                            // if no tier selected, tier remains unchanged
                            const tier = tierSelection.length ? Number(tierSelection[0]!) : premiumKey.tier;

                            const usesNumberInput = submit.fields.getTextInputValue("usesnumber-input");
                            let usesnumber: number;
                            if (usesNumberInput.length === 0) {
                                usesnumber = premiumKey.usesnumber;
                            } else {
                                usesnumber = Number(usesNumberInput);
                                if (!validate_usesnumber(usesnumber)) {
                                    await submit.reply({
                                        embeds: [
                                            embed_message(
                                                "Red",
                                                "The field `usesnumber` must be a valid number within [1 - 100.000].")
                                        ],
                                        flags: MessageFlags.Ephemeral
                                    });
                                    return;
                                }
                            }

                            const selectedUser = submit.fields.getSelectedUsers("select-user")?.first();
                            const dedicatedUser = selectedUser?.id ?? premiumKey.dedicateduser;

                            const expiresAtInput = submit.fields.getTextInputValue("expiration-input");
                            let expiresAt: number;
                            if (expiresAtInput.length === 0) {
                                expiresAt = premiumKey.expiresat
                            } else {
                                const duration = duration_to_seconds(expiresAtInput);
                                if (!validate_expiration_duration(duration)) {
                                    await submit.reply({
                                        embeds: [
                                            embed_message(
                                                "Red",
                                                "The input must look something like: 1d, 2w, 3y and must be over one day of time.\n" +
                                                "A duration of 0d/0w/0y results in a permanent key.",
                                                "The expiration given is invalid."
                                            )
                                        ],
                                        flags: MessageFlags.Ephemeral
                                    });
                                    return;
                                }
                                expiresAt = timestampNow() + duration!;
                            }

                            const updatedKey: PremiumKey & { id: number } = {
                                id: premiumKey.id,
                                guild: guild.id,
                                code: premiumKey.code,
                                tier: tier,
                                generatedby: premiumKey.generatedby,
                                createdat: premiumKey.createdat,
                                expiresat: expiresAt,
                                usesnumber: usesnumber,
                                dedicateduser: dedicatedUser
                            }

                            // check if anything changed
                            if (
                                updatedKey.tier === premiumKey.tier &&
                                updatedKey.expiresat === premiumKey.expiresat &&
                                updatedKey.usesnumber === premiumKey.usesnumber &&
                                updatedKey.dedicateduser === premiumKey.dedicateduser
                            ) {
                                await submit.reply({
                                    embeds: [embed_message("Red", "No input given. Nothing to change.")],
                                    flags: MessageFlags.Ephemeral
                                });
                                return;
                            }

                            await submit.deferReply({ flags: MessageFlags.Ephemeral });
                            await PremiumSystemRepo.updateKey(updatedKey);

                            const embedSuccess = embed_message("Aqua", `The key with the code ||${code}|| has been updated`,
                                `${interaction.user.username} updated premium key`
                            )
                                .addFields({
                                    name: "Details",
                                    value: key_details_string(updatedKey)
                                });
                            await submit.editReply({ embeds: [embedSuccess] });

                            if (logChannel) {
                                try {
                                    await logChannel.send({ embeds: [embedSuccess.setFooter({ text: `Admin ID: ${interaction.user.id}` })] })
                                } catch (error) {
                                    await errorLogHandle(error);
                                }
                            }
                        } catch (error) {
                            await handleModalCatch(error, interaction);
                        }
                        break;
                    }
                    case "details": {
                        const code = options.getString("code");
                        const keyId = options.getNumber("key-id");
                        if (code === null && keyId === null) {
                            await interaction.reply({
                                embeds: [embed_message("Red", "No input given. You must specify the code or the ID of the key.")],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        let premiumKey: PremiumKey & { id: number } | null;

                        // prioritize id over code
                        if (keyId) {
                            premiumKey = await PremiumSystemRepo.getGuildKeyById(keyId, guild.id)
                        } else { // as both nulls are invalidated above
                            // this else runs when only the code is given
                            premiumKey = await PremiumSystemRepo.getGuildKeyByCode(guild.id, code!);
                        }

                        if (!premiumKey) {
                            await interaction.reply({
                                embeds: [embed_message("Red", "No key was identified by the code given.")],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        const decoded = decryptor(premiumKey.code.toString("hex"));
                        await interaction.reply({
                            embeds: [
                                embed_message("Aqua", `Details about the premium key ||${decoded}||`)
                                    .setFields(
                                        {
                                            name: "ID",
                                            value: `${premiumKey.id}`
                                        },
                                        {
                                            name: "Details",
                                            value: key_details_string(premiumKey)
                                        }
                                    )
                            ],
                            flags: MessageFlags.Ephemeral
                        });

                        break;
                    }
                }
                break;
            }
            case "membership": {
                const premiumRole = await fetchPremiumRole(client, guild);
                if (!premiumRole) {
                    await interaction.reply({
                        embeds: [embed_error("Premium role was misconfigured")],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                switch (subcommand) {
                    case "assign": {
                        const code = options.getString("code", true);
                        const user = options.getUser("user", true);

                        const member = await fetchGuildMember(guild, user.id);
                        if (!member) {
                            await interaction.reply({
                                embeds: [embed_message("Red", "You can not assign membership to someone that is not a member of this guild.")],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        const premiumKey: PremiumKey & { id: number } | null =
                            await PremiumSystemRepo.getGuildKeyByCode(guild.id, code);

                        if (!premiumKey) {
                            await interaction.reply({
                                embeds: [embed_message("Red", "No key was identified by the code/id given.")],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        if (premiumKey.usesnumber === 0) {
                            await interaction.reply({
                                embeds: [
                                    embed_message("Red", "The given key has no more uses left.")
                                ],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        if (premiumKey.dedicateduser !== null && premiumKey.dedicateduser !== user.id) {
                            await interaction.reply({
                                embeds: [
                                    embed_message("Red", "The key has a dedicated user that is different from the user given.")
                                ],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        const decoded = decryptor(premiumKey.code.toString("hex"));

                        const membership = await PremiumSystemRepo.getGuildMembership(guild.id, user.id);
                        if (membership) {
                            // if the targeted user already has an active membership, then just update the code
                            await PremiumSystemRepo.updateMemberCode(guild.id, user.id, premiumKey.id);
                            const embedAssign = embed_message("Green",
                                `${member} has been assigned with a new key.`
                            )
                                .addFields(
                                    {
                                        name: "Code",
                                        value: `||${decoded}||`,
                                        inline: true
                                    },
                                    {
                                        name: "ID",
                                        value: `${premiumKey.id}`,
                                        inline: true
                                    },
                                    {
                                        name: "Details",
                                        value: key_details_string(premiumKey)
                                    }
                                )
                            await interaction.reply({ embeds: [embedAssign], flags: MessageFlags.Ephemeral });

                            if (logChannel) {
                                try {
                                    await logChannel.send({ embeds: [embedAssign.setFooter({ text: `Member ID: ${user.id}` })] })
                                } catch (error) {
                                    await errorLogHandle(error);
                                }
                            }
                        } else {
                            // assigning a key to a non membership user grants them with premium status
                            try {
                                await member.roles.add(premiumRole);
                            } catch (error) {
                                await errorLogHandle(error);
                                await interaction.reply({
                                    embeds: [embed_error(`An error occured while trying to assign the targeted member with ${premiumRole}.`)],
                                    flags: MessageFlags.Ephemeral
                                });
                            }

                            await PremiumSystemRepo.newMembership(user.id, guild.id, premiumKey.id); // register 
                            // decrement the uses number
                            premiumKey.usesnumber -= 1;
                            await PremiumSystemRepo.updateKey(premiumKey);

                            const embedNewMembership = embed_new_premium_membership(
                                member,
                                premiumKey.code.toString("hex"),
                                premiumKey.expiresat,
                                premiumKey.usesnumber,
                                premiumKey.tier
                            );

                            await interaction.reply({ embeds: [embedNewMembership], flags: MessageFlags.Ephemeral });
                            if (logChannel) {
                                try {
                                    await logChannel.send({ embeds: [embedNewMembership.setFooter({ text: `Member ID: ${user.id}` }).setTimestamp()] });
                                } catch (error) {
                                    await errorLogHandle(error);
                                }
                            }
                        }

                        break;
                    }
                    case "remove": {
                        const user = options.getUser("user", true);
                        const member = await fetchGuildMember(guild, user.id);

                        const membership = await PremiumSystemRepo.getGuildMembership(guild.id, user.id);
                        if (!membership) {
                            await interaction.reply({
                                embeds: [
                                    embed_message(
                                        "Red",
                                        "The specified user is not a premium member of this server.",
                                        "Invalid target"
                                    )
                                ],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        if (member) {
                            try {
                                member.roles.remove(premiumRole);
                            } catch (error) {
                                await errorLogHandle(error);
                                await interaction.reply({
                                    embeds: [embed_error(`An error occured while trying to remove the premium role of the member.`)],
                                    flags: MessageFlags.Ephemeral
                                });
                            }
                        }

                        await PremiumSystemRepo.removeGuildMembership(guild.id, user.id); // clear row

                        await interaction.reply({
                            embeds: [
                                embed_message("Green", `${user} is no longer a premium member of this server.`)
                            ],
                            flags: MessageFlags.Ephemeral
                        });

                        if (logChannel) {
                            try {
                                await logChannel.send({
                                    embeds: [
                                        embed_message(
                                            "Red",
                                            `${interactionMember} removed premium membership from ${user}`,
                                            `${user.username} lost their membership`
                                        ).setTimestamp()
                                            .setFooter({ text: `Member ID: ${user.id}` })
                                    ]
                                });
                            } catch (error) {
                                await errorLogHandle(error);
                            }
                        }
                        break;
                    }
                }
                break;
            }
        }
    }
}

export default premiumAdminCommand;