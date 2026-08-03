import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    GuildMember,
    InteractionReplyOptions,
    MessageEditOptions,
    MessageFlags,
    PermissionFlagsBits,
    Role,
    SlashCommandBuilder
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import PremiumSystemRepo, { DENY_INVITE_ROLE_COOLDOWN, INVITE_ROLE_COOLDOWN } from "../../Repositories/premiumsystem.js";
import { embed_error, embed_message, embed_role_details } from "../../utility_modules/embed_builders.js";
import { decryptor, hexcolorParser, timestampNow } from "../../utility_modules/utility_methods.js";
import {
    fetchGuildMember,
    fetchGuildRole,
    fetchMemberCustomRole,
    handleModalCatch,
    message_collector
} from "../../utility_modules/discord_helpers.js";
import {
    HEXCOLOR_PATTERN,
    role_builder,
    role_create_modal,
    role_editor_safe,
    role_icon_validator,
    role_input_validator,
    role_name_validator,
    RoleModificationOptions
} from "../../Systems/components/role_builder_menu.js";
import { HexcolorRole } from "../../Interfaces/helper_types.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

const premiumCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("premium")
        .setDescription("Manage and see your premium status and perks.")
        .addSubcommand(subcommand =>
            subcommand.setName("profile")
                .setDescription("Show your premium profile page.")
        )
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("role")
                .setDescription("Custom role related commands")
                .addSubcommand(subcommand =>
                    subcommand.setName("panel")
                        .setDescription("Open the panel to manage your custom role.")
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("invite")
                        .setDescription("Invite another member to share your custom role with.")
                        .addUserOption(option =>
                            option.setName("user")
                                .setDescription("The user to be invited.")
                                .setRequired(true)
                        )
                )
        )
        .toJSON(),
    metadata: {
        cooldown: 10,
        userPermissions: [],
        botPermissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles],
        group: "premium",
        category: "Premium",
        scope: "guild"
    },

    async execute(interaction, client) {
        const member = interaction.member as GuildMember;
        const guild = member.guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        const subcommandGroup = options.getSubcommandGroup();
        let membership = await PremiumSystemRepo.getGuildFullMembership(guild.id, member.id);
        if (!membership) {
            // interactionCreate should guarantee that execution if this command is reached only by premium members
            // this if is just another safeguard
            await interaction.reply({
                embeds: [
                    embed_error("Your membership couldn't be fetched. Contact an administrator if you think this is a mistake.")
                ],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        switch (subcommandGroup) {
            case null: {
                switch (subcommand) {
                    case "profile": {
                        const decoded = decryptor(membership.code.toString("hex"));
                        const expiration = Number(membership.expiresat) === 0 ? "Permanent" : membership.expiresat;
                        const customRole = membership.role ? (await fetchGuildRole(guild, membership.role)) : null;
                        const embedProfile = new EmbedBuilder()
                            .setAuthor({
                                name: `${member.user.username} premium profile`,
                                iconURL: member.displayAvatarURL({ extension: "png" })
                            })
                            .setColor("Purple")
                            .addFields(
                                {
                                    name: "Premium key details",
                                    value: `**Code**: ||${decoded}||
                            **Tier**: ${membership.tier}
                            **Expires**: ${expiration}`
                                },
                                {
                                    name: "Perks",
                                    value: `**Custom role**: ${customRole ? customRole.toString() : "None"}`
                                }
                            );

                        await interaction.reply({ embeds: [embedProfile] });
                        break;
                    }
                }
                break;
            }
            case "role": {
                switch (subcommand) {
                    case "panel": {
                        const embedHeader = new EmbedBuilder()
                            .setColor("Purple")
                            .setAuthor({
                                name: `${member.user.username} role page`,
                                iconURL: member.displayAvatarURL({ extension: "png" })
                            });

                        const createButton = new ButtonBuilder()
                            .setCustomId("create-button")
                            .setLabel("Create")
                            .setStyle(ButtonStyle.Success)
                        const editButton = new ButtonBuilder()
                            .setCustomId("edit-button")
                            .setLabel("Edit")
                            .setStyle(ButtonStyle.Primary)
                        const deleteButton = new ButtonBuilder()
                            .setCustomId("delete-button")
                            .setLabel("Delete")
                            .setStyle(ButtonStyle.Danger)

                        const noRoleActionRow = new ActionRowBuilder<ButtonBuilder>()
                            .addComponents(createButton);
                        const hasRoleActionRow = new ActionRowBuilder<ButtonBuilder>()
                            .addComponents(editButton, deleteButton);

                        const updateRolePage = (role: Role | null): InteractionReplyOptions => {
                            const embed = EmbedBuilder.from(embedHeader);
                            if (role) {
                                const colorsString =
                                    `${role.colors.primaryColor}${role.colors.secondaryColor ? ` - ${role.colors.secondaryColor}` : ""}`;

                                embed.addFields(
                                    {
                                        name: "Hexcode(s)",
                                        value: `${role.toString()} ${colorsString}`

                                    },
                                    {
                                        name: "Created",
                                        value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`
                                    },
                                    {
                                        name: "Member count",
                                        value: `${role.members.size ? role.members.size : 1}`
                                    }
                                );

                                if (role.iconURL()) embed.setThumbnail(role.iconURL({ size: 1024 }));

                                const replyObject: InteractionReplyOptions = {
                                    embeds: [embed],
                                    components: [hasRoleActionRow]
                                }

                                return replyObject;
                            } else {
                                embed.setTitle("You don't have a custom role")
                                    .setDescription("Use the **Create** button to create your own custom role.")

                                return {
                                    embeds: [embed],
                                    components: [noRoleActionRow]
                                }
                            }
                        }

                        let customRole: null | Role = null;
                        if (membership.role) { // initialize customRole
                            customRole = await fetchGuildRole(guild, membership.role);
                            if (!customRole) {
                                await interaction.reply({
                                    embeds: [embed_error("Custom role ID was found, but failed to fetch the role itself." +
                                        "\nPlease try again or contact an administrator if the problem persists."
                                    )],
                                    flags: MessageFlags.Ephemeral
                                });
                                return;
                            }
                        }
                        await interaction.reply({ ...updateRolePage(customRole) });
                        const reply = await interaction.fetchReply();
                        let cooldownExpires = 0;
                        const collector = message_collector<ComponentType.Button>(
                            reply,
                            {
                                componentType: ComponentType.Button,
                                filter: (i) => i.user.id === member.id,
                                time: 600_000
                            },
                            async (buttonInteraction) => {
                                const innerCooldown = 5; // 5 seconds
                                const now = timestampNow();
                                if (now < cooldownExpires) {
                                    await buttonInteraction.reply(`You are pressing the buttons too fast! <t:${cooldownExpires}:R>`);
                                    return;
                                }
                                cooldownExpires = now + innerCooldown;
                                const btn = buttonInteraction.customId;
                                // to avoid the abuse caused by opening multiple menus, each button press must distrust the data fetched before
                                membership = await PremiumSystemRepo.getGuildFullMembership(guild.id, member.id);
                                if (!membership) {
                                    await buttonInteraction.reply({
                                        embeds: [embed_error("Your premium membership expired during this session.")],
                                        flags: MessageFlags.Ephemeral
                                    });
                                    (await collector).stop();
                                    return;
                                }
                                if (btn === "delete-button" || btn === "edit-button") {
                                    if (membership.role === null) { // to avoid making multiple calls, first check the membership role key
                                        await buttonInteraction.reply({
                                            embeds: [embed_error("Your role got removed or failed to be fetched during this session.")],
                                            flags: MessageFlags.Ephemeral
                                        });
                                        (await collector).stop();
                                        return;
                                    }
                                    customRole = await fetchMemberCustomRole(client, guild, member);
                                    if (membership.role === null) { // double checking
                                        await buttonInteraction.reply({
                                            embeds: [embed_error("Your role got removed or failed to be fetched during this session.")],
                                            flags: MessageFlags.Ephemeral
                                        });
                                        (await collector).stop();
                                        return;
                                    }
                                }
                                switch (btn) {
                                    case "create-button": {
                                        if (membership.role !== null) {
                                            await buttonInteraction.reply({
                                                embeds: [
                                                    embed_error("During this session a custom role has been created.")
                                                ],
                                                flags: MessageFlags.Ephemeral
                                            });
                                            (await collector).stop();
                                            return;
                                        }
                                        await buttonInteraction.showModal(role_create_modal());
                                        try {
                                            const submit = await interaction.awaitModalSubmit({
                                                time: 300_000,
                                                filter: (i) => i.user.id === member.id
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

                                            const hexcolors = hexcolorParser(hexColor)!; // validator assures reaching this line has a valid hexcolor

                                            customRole = await role_builder(
                                                guild,
                                                roleName,
                                                hexcolors,
                                                iconFile?.first()
                                            );

                                            // register the custom role
                                            await PremiumSystemRepo.assignCustomRole(membership.membership_id, customRole.id);
                                            await reply.edit(updateRolePage(customRole) as MessageEditOptions);
                                            // assign the role
                                            await member.roles.add(customRole);

                                            await submit.reply({
                                                embeds: [
                                                    embed_role_details(
                                                        customRole,
                                                        `${customRole} has been created.`,
                                                        "Custom Role Created"
                                                    )
                                                ],
                                                flags: MessageFlags.Ephemeral
                                            });

                                        } catch (error) {
                                            await handleModalCatch(error);
                                        }
                                        break;
                                    }
                                    case "edit-button": {
                                        await buttonInteraction.showModal(role_create_modal(true)); // edit_mode = true
                                        try {
                                            const submit = await interaction.awaitModalSubmit({
                                                time: 300_000,
                                                filter: (i) => i.user.id === member.id
                                            });

                                            const roleName = submit.fields.getTextInputValue("role-name-input");
                                            const hexColor = submit.fields.getTextInputValue("hexcolor-input");
                                            const iconFile = submit.fields.getUploadedFiles("icon-file-input", false);
                                            const modifications: RoleModificationOptions = {}
                                            if (roleName.trim()) {
                                                const validName = await role_name_validator(roleName, guild);
                                                if (!validName) {
                                                    await submit.reply({
                                                        embeds: [
                                                            embed_message("Red", "The name is not valid.")
                                                        ],
                                                        flags: MessageFlags.Ephemeral
                                                    });
                                                    return;
                                                }

                                                modifications.name = roleName;
                                            }
                                            if (hexColor.trim()) {
                                                const hexcolorRole: HexcolorRole | null = hexcolorParser(hexColor, HEXCOLOR_PATTERN);
                                                if (!hexcolorRole) {
                                                    await submit.reply({
                                                        embeds: [
                                                            embed_message("Red", "The hexcolor is not valid.")
                                                        ],
                                                        flags: MessageFlags.Ephemeral
                                                    });
                                                    return;
                                                }
                                                modifications.colors = hexcolorRole;
                                            }

                                            if (iconFile && iconFile.first()) {
                                                const iconAttachment = iconFile.first()!;
                                                const validateIcon = role_icon_validator(iconAttachment);
                                                if (!validateIcon) {
                                                    await submit.reply({
                                                        embeds: [
                                                            embed_message("Red", "Invalid file format or the image is larger than 256KB!")
                                                        ],
                                                        flags: MessageFlags.Ephemeral
                                                    });
                                                    return;
                                                }
                                                modifications.icon = iconAttachment;
                                            }

                                            const modifiedRole = await role_editor_safe(customRole!, modifications);
                                            await reply.edit(updateRolePage(customRole) as MessageEditOptions);
                                            await submit.reply({
                                                embeds: [
                                                    embed_role_details(
                                                        modifiedRole,
                                                        `${modifiedRole} has been modified.`,
                                                        "Custom Role Edited"
                                                    )
                                                ],
                                                flags: MessageFlags.Ephemeral
                                            });

                                        } catch (error) {
                                            await handleModalCatch(error);
                                        }
                                        break;
                                    }
                                    case "delete-button": {
                                        if (!customRole) {
                                            await buttonInteraction.reply({
                                                embeds: [embed_error("Something went wrong while fetching your role for deletion...")],
                                                flags: MessageFlags.Ephemeral
                                            });
                                            return;
                                        }
                                        try {
                                            await PremiumSystemRepo.removeCustomRole(customRole.id);
                                            await customRole.delete(`${member.user.username} requested for their custom role to be deleted.`);
                                            customRole = null;
                                            await reply.edit(updateRolePage(customRole) as MessageEditOptions);
                                            await buttonInteraction.reply({
                                                embeds: [
                                                    embed_message("Green", "Your custom role has been deleted.")
                                                ],
                                                flags: MessageFlags.Ephemeral
                                            });
                                        } catch (error) {
                                            await errorLogHandle(error);
                                        }
                                        break;
                                    }
                                }
                            },
                            async () => {
                                try {
                                    await reply.edit({ components: [] });
                                } catch {/* do nothing */ }
                            }
                        )
                        break;
                    }
                    case "invite": {
                        const targetUser = options.getUser("user", true);
                        const customRole = await fetchMemberCustomRole(client, guild, member);
                        if (!customRole) {
                            await interaction.reply({
                                embeds: [
                                    embed_message(
                                        "Red",
                                        "You can't use this command unless you own a premium custom role.\n" +
                                        "Use `/premium role panel` and create a role first."
                                    )
                                ],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        if (targetUser.bot) {
                            await interaction.reply({
                                embeds: [embed_message("Red", "You can't target bots with this command.")],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        if (targetUser.id === member.id) {
                            await interaction.reply({
                                embeds: [embed_message("Red", "You can not invite yourself.")],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        const targetMember = await fetchGuildMember(guild, targetUser.id);
                        if (!targetMember) {
                            await interaction.reply({
                                embeds: [embed_message("Red", "The input given is not a member of this server")],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        // currently inviting someone to share the role with limits the invited user to a single such role
                        // so at most a member can have their own custom role and an additional one from accepting 
                        // someone else's invitation

                        const notOwnedCustomRoleIds = new Set(
                            await PremiumSystemRepo.getGuildRolesNotOwnedByMember(
                                guild.id,
                                targetMember.id
                            )
                        );
                        const hasCommonRoles = targetMember.roles.cache.some(role => notOwnedCustomRoleIds.has(role.id));
                        if (hasCommonRoles) {
                            await interaction.reply({
                                embeds: [
                                    embed_message("Red", `You can not invite ${targetMember} as they already share a custom role.`)
                                ],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        const inviteCooldown = PremiumSystemRepo.getInviteCooldown(member.id, targetMember.id);
                        const nowTimestamp = timestampNow();
                        if (inviteCooldown && nowTimestamp < inviteCooldown) {
                            await interaction.reply({
                                embeds: [
                                    embed_message("Red", `Inviting ${targetMember} is on cooldown. Expires <t:${inviteCooldown}:R>`)
                                ],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }
                        PremiumSystemRepo.removeInviteCooldown(member.id, targetMember.id);

                        const acceptButton = new ButtonBuilder()
                            .setCustomId("accept-button")
                            .setLabel("Accept")
                            .setStyle(ButtonStyle.Success)
                        const refuseButton = new ButtonBuilder()
                            .setCustomId("refuse-button")
                            .setLabel("Refuse")
                            .setStyle(ButtonStyle.Danger)
                        const inviteButtonsRow = new ActionRowBuilder<ButtonBuilder>()
                            .setComponents(acceptButton, refuseButton);

                        const embedInvite = embed_message(
                            "Aqua",
                            `You have been invited by ${member} to share their role ${customRole} with you.\n` +
                            `This invitation expires <t:${timestampNow() + INVITE_ROLE_COOLDOWN}:R>`
                        ).addFields({
                            name: "Options",
                            value: `**Accept**: You will be assigned the mentioned role.
                                    **Refuse**: You won't be assigned the role and this invitation will be put on a 10 minute cooldown.`
                        });

                        if (customRole.iconURL()) embedInvite.setThumbnail(customRole.iconURL({ size: 1024 }));

                        await interaction.reply({
                            content: targetMember.toString(),
                            embeds: [embedInvite],
                            components: [inviteButtonsRow]
                        });

                        const reply = await interaction.fetchReply();

                        PremiumSystemRepo.setInviteCooldown(member.id, targetMember.id, INVITE_ROLE_COOLDOWN);

                        const collector = message_collector<ComponentType.Button>(
                            reply,
                            {
                                componentType: ComponentType.Button,
                                filter: (i) => i.user.id === targetMember.id,
                                time: INVITE_ROLE_COOLDOWN * 1000 // milliseconds
                            },
                            async (buttonInteraction) => {
                                // re-fetch the custom role and check it
                                const customRole = await fetchMemberCustomRole(client, guild, member);
                                if (!customRole) {
                                    await buttonInteraction.reply({
                                        embeds: [
                                            embed_message(
                                                "Red",
                                                "Failed to fetch the custom role you just accepted.\n" +
                                                "Might have been deleted while this menu was open."
                                            )
                                        ],
                                        flags: MessageFlags.Ephemeral
                                    });
                                    try {
                                        await reply.edit({
                                            embeds: [embed_message("Red", "The invite couldn't be accepted.")]
                                        });
                                    } catch { /* do nothing */ }
                                    (await collector).stop();
                                    return;
                                }
                                const buttonMember = buttonInteraction.member as GuildMember;
                                // to avoid abuse from multiple parallel menus open at a time, the roles must be checked again
                                const alreadyHasRole = buttonMember.roles.cache.some(r => notOwnedCustomRoleIds.has(r.id));
                                if (alreadyHasRole) {
                                    await buttonInteraction.reply({
                                        embeds: [
                                            embed_message("Red", "Durng this session you accepted another invite.")
                                        ],
                                        flags: MessageFlags.Ephemeral
                                    });
                                    try {
                                        await reply.edit({
                                            embeds: [embed_message("Red", "The invite couldn't be accepted.")]
                                        });
                                    } catch { /* do nothing */ }
                                    (await collector).stop();
                                    return;
                                }

                                if (buttonInteraction.customId === "accept-button") {
                                    try {
                                        await buttonMember.roles.add(customRole);
                                        await reply.edit({
                                            embeds: [
                                                embed_message(
                                                    "Aqua",
                                                    `${buttonMember} accepted the invite and was assigned with ${customRole.toString()}.`
                                                )
                                            ]
                                        });
                                        await buttonInteraction.reply({
                                            embeds: [embed_message("Green", "The role has been assigned successfully.")],
                                            flags: MessageFlags.Ephemeral
                                        });

                                    } catch (error) {
                                        await errorLogHandle(error);
                                        await buttonInteraction.reply({
                                            embeds: [embed_error("Something went wrong while accepting the invitation...")],
                                            flags: MessageFlags.Ephemeral
                                        });
                                    }
                                } else if (buttonInteraction.customId === "refuse-button") {
                                    try {
                                        reply.edit({
                                            embeds: [
                                                embed_message("Aqua", `${targetMember} refused the invite.`)
                                            ]
                                        });
                                        buttonInteraction.reply({
                                            embeds: [embed_message("Green", "You refused the invite.")],
                                            flags: MessageFlags.Ephemeral
                                        });
                                        PremiumSystemRepo.setInviteCooldown(member.id, targetMember.id, DENY_INVITE_ROLE_COOLDOWN);
                                    } catch {/** do nothing */ }
                                }
                                (await collector).stop();
                            },
                            async () => {
                                acceptButton.setDisabled(true);
                                refuseButton.setDisabled(true);
                                try {
                                    await reply.edit({ components: [inviteButtonsRow] });
                                } catch {/* do nothing */ }
                            }
                        )
                        break;
                    }
                }
                break;
            }
        }
    }
}

export default premiumCommand;