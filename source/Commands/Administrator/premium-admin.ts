import {
    EmbedBuilder,
    GuildMember,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    Role,
    SlashCommandBuilder
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import {
    assign_premium_to_member,
    is_code_unique,
    key_details_string,
    premium_key_labels,
    remove_premium_from_member,
    validate_expiration_duration,
    validate_usesnumber
} from "../../Systems/premium/premium_system.js";
import {
    fetchGuildMember,
    fetchGuildRole,
    fetchLogsChannel,
    fetchPremiumRole,
    handleModalCatch
} from "../../utility_modules/discord_helpers.js";
import {
    embed_error,
    embed_message,
    embed_new_premium_membership,
    embed_role_details
} from "../../utility_modules/embed_builders.js";
import {
    decryptor,
    duration_to_seconds,
    encryptor,
    generate_unique_code,
    hexcolorParser,
    timestampNow
} from "../../utility_modules/utility_methods.js";
import PremiumSystemRepo from "../../Repositories/premiumsystem.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { PremiumKey } from "../../Interfaces/database_types.js";
import { role_create_modal, role_input_validator, role_builder } from "../../Systems/components/role_builder_menu.js";

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
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
                        const code = options.getString("code", true);
                        const premiumKey = await PremiumSystemRepo.getGuildKeyByCode(guild.id, code);
                        if (premiumKey) {
                            const keyMembers = await PremiumSystemRepo.getMembersOfKeyId(guild.id, premiumKey.id);
                            for (const member_id of keyMembers) {
                                // when a key gets deleted, the premium members that are members of the server
                                // have to get their perks removed
                                const memberObject = await fetchGuildMember(guild, member_id);
                                if (memberObject) {
                                    try {
                                        await remove_premium_from_member(client, member_id, guild);
                                    } catch (error) {
                                        await errorLogHandle(error);
                                    }
                                }
                            }
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
                            await interaction.editReply({ embeds: [embedSuccess] });

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
                            await interaction.editReply({
                                embeds: [
                                    embed_message("Red", "No such key by this code.")
                                ]
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
                                await remove_premium_from_member(client, member.id, guild);
                            } catch (error) {
                                await errorLogHandle(error);
                                await interaction.reply({
                                    embeds: [embed_error(`An error occured while trying to remove the premium role of the member.`)],
                                    flags: MessageFlags.Ephemeral
                                });
                            }
                        }

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
                    case "create-role": {
                        const user = options.getUser("user", true);
                        const member = await fetchGuildMember(guild, user.id);

                        if (!member) {
                            await interaction.reply({
                                embeds: [embed_message("Red", "You can not assign a custom role to someone that is not a member of this guild.")],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

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

                        await interaction.showModal(role_create_modal())
                        try {
                            const submit = await interaction.awaitModalSubmit({
                                time: 300_000,
                                filter: (i) => i.user.id === interaction.user.id
                            });

                            const roleName = submit.fields.getTextInputValue("role-name-input");
                            const hexColor = submit.fields.getTextInputValue("hexcolor-input");
                            const iconFile = submit.fields.getUploadedFiles("icon-file-input", false);

                            const validatorResponse = await role_input_validator(
                                guild,
                                roleName,
                                hexColor,
                                iconFile?.first()
                            );

                            if (!validatorResponse.valid) {
                                await submit.reply({
                                    embeds: [
                                        embed_message("Red", validatorResponse.message ?? "Unknown error.")
                                    ],
                                    flags: MessageFlags.Ephemeral
                                });

                                return;
                            }

                            await submit.deferReply({ flags: MessageFlags.Ephemeral });

                            const hexcolors = hexcolorParser(hexColor)!; // validator assures reaching this line has a valid hexcolor

                            const newRole = await role_builder(
                                guild,
                                roleName,
                                hexcolors,
                                iconFile?.first(),
                                premiumRole.position // put custom roles of premium members under the premium role
                            );

                            // check if the member already has a custom role
                            const oldCustomRoleId = await PremiumSystemRepo.getMemberCustomRole(guild.id, user.id);
                            if (oldCustomRoleId) {
                                const oldCustomRole = await fetchGuildRole(guild, oldCustomRoleId);
                                if (oldCustomRole) {
                                    try {
                                        await oldCustomRole.delete(`Custom role replaced by ${interaction.user.username}`);
                                    } catch { /* do nothing */ }
                                }
                            }

                            try {
                                await member.roles.add(newRole);
                            } catch (error) {
                                await errorLogHandle(error);
                                await submit.editReply({
                                    embeds: [
                                        embed_error("An error occured while trying to assign the member with the new custom role.")
                                    ]
                                });
                                return;
                            }

                            // register the new role
                            await PremiumSystemRepo.assignCustomRole(membership.id, newRole.id)

                            await submit.editReply({
                                embeds: [
                                    embed_role_details(
                                        newRole,
                                        `${newRole} has been created and assigned to ${member}.`,
                                        "Custom Role Created"
                                    )
                                ]
                            });

                        } catch (error) {
                            await handleModalCatch(error);
                        }
                        break;
                    }
                    case "set-role": {
                        const user = options.getUser("user", true);
                        const member = await fetchGuildMember(guild, user.id);

                        if (!member) {
                            await interaction.reply({
                                embeds: [embed_message("Red", "You can not assign a custom role to someone that is not a member of this guild.")],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

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


                        const role = options.getRole("role") as Role;
                        const botMember = await guild.members.fetchMe();
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                        const oldCustomRoleId = await PremiumSystemRepo.getMemberCustomRole(guild.id, user.id);
                        if (
                            role.managed ||
                            botMember.roles.highest.position <= role.position ||
                            member.roles.highest.position <= role.position
                        ) {
                            await interaction.editReply({
                                embeds: [
                                    embed_message(
                                        "Red",
                                        "The role must be positioned under your and my highest role and it can not be a bot role.",
                                        "Invalid role given"
                                    )
                                ]
                            });
                            return;
                        }

                        if (role.id === oldCustomRoleId) {
                            await interaction.editReply({
                                embeds: [
                                    embed_message("Red", "The role given is already the custom role of this member.")
                                ]
                            });
                            return;
                        }

                        const lookupRole = await PremiumSystemRepo.getCustomRoleBySnowflake(role.id);
                        if (lookupRole) {
                            // if the given role is already in the premium custom role table, then it's already in use.
                            await interaction.editReply({
                                embeds: [embed_message("Red", "The role given is already someone else's custom role.")]
                            });
                            return;
                        }

                        if (oldCustomRoleId) {
                            // if the set-role is valid, the old one can be cleaned up if it exists
                            const oldCustomRole = await fetchGuildRole(guild, oldCustomRoleId);
                            if (oldCustomRole) {
                                try {
                                    await oldCustomRole.delete(`Custom role replaced by ${interaction.user.username}`);
                                } catch { /* do nothing */ }
                            }
                        }

                        try {
                            await role.setPosition(premiumRole.position - 1); // make sure the role is in the right place
                            await member.roles.add(role);
                        } catch (error) {
                            await errorLogHandle(error);
                            await interaction.editReply({
                                embeds: [
                                    embed_error("An error occured while trying to assign the member with the new custom role.")
                                ]
                            });
                            return;
                        }

                        // register the newly set role
                        await PremiumSystemRepo.assignCustomRole(membership.id, role.id)

                        await interaction.editReply({
                            embeds: [
                                embed_role_details(
                                    role,
                                    `${role} has been set and assigned to ${member}.`,
                                    "Custom Role Set"
                                )
                            ]
                        });
                        break;
                    }
                    case "details": {
                        const user = options.getUser("user", true);
                        const membership = await PremiumSystemRepo.getGuildMembershipFeatures(guild.id, user.id);
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

                        const embedMembership = new EmbedBuilder()
                            .setColor("Aqua")
                            .setAuthor({ name: `${user.username} premium membership`, iconURL: user.displayAvatarURL({ extension: "png" }) })
                            .setFields(
                                {
                                    name: "Tier",
                                    value: `${membership.tier}`,
                                    inline: true
                                },
                                {
                                    name: "Key ID",
                                    value: `${membership.premiumkey_id}`,
                                    inline: true
                                }
                            );

                        if (membership.role) {
                            const customRole = await fetchGuildRole(guild, membership.role);
                            if (customRole) {
                                embedMembership.addFields({
                                    name: "Custom role",
                                    value: customRole.toString()
                                });
                            }
                        }

                        await interaction.reply({
                            embeds: [embedMembership],
                            flags: MessageFlags.Ephemeral
                        });
                        break;
                    }
                    case "migrate-boosters": {
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                        const boosterRole = guild.roles.premiumSubscriberRole;
                        if (!boosterRole) {
                            await interaction.editReply({
                                embeds: [embed_message("Red", "The booster role couldn't be found.")]
                            });
                            return;
                        }

                        ;
                        const boosterMembers = (await guild.members.fetch()).map(m => m).filter(m => m.roles.cache.has(boosterRole.id))
                        let newMembershipsGenerated = boosterMembers.length;
                        let errorLogs = "";
                        for (const member of boosterMembers) {
                            const membership = await PremiumSystemRepo.getGuildMembership(guild.id, member.id);
                            if (membership) {
                                newMembershipsGenerated -= 1;
                                continue; // skip members with active membership
                            }

                            try {
                                await assign_premium_to_member(
                                    premiumRole,
                                    member,
                                    interactionMember,
                                    0, // nitro booster memberships do not expire in time
                                    1, // usesnumber
                                    true // nitro booster keys are dedicated to them
                                );
                            } catch (error) {
                                await errorLogHandle(error);
                                newMembershipsGenerated -= 1;
                                errorLogs += `A problem occured at member ID ${member.id}\n`;
                            }
                        }

                        await interaction.editReply({
                            embeds: [
                                embed_message(
                                    "Green",
                                    `**New memberships**: ${newMembershipsGenerated}\n` +
                                    `**Errors**: ${errorLogs.length ? errorLogs : "None"}`)
                            ]
                        });
                        break;
                    }
                }
                break;
            }
        }
    }
}

export default premiumAdminCommand;