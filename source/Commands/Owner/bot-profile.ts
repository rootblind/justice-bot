import {
    ActivityType,
    FileUploadBuilder,
    LabelBuilder,
    ModalBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { discord_image_validator, handleModalCatch } from "../../utility_modules/discord_helpers.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { read_json_async, write_json_async } from "../../utility_modules/utility_methods.js";
import { local_config } from "../../objects/local_config.js";
import { PresenceConfig, PresencePresetKey } from "../../Interfaces/helper_types.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

const botProfile: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("bot-profile")
        .setDescription("Change bot presence and profile.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("presence")
                .setDescription("Presence configuration.")
                .addSubcommand(subcommand =>
                    subcommand.setName("default")
                        .setDescription("Set the configuration of presence to default-presence-presets.")
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('custom-config')
                        .setDescription('Provide a custom configuration for presence.')
                        .addAttachmentOption(option =>
                            option.setName('config-json')
                                .setDescription('The configuration must be a JSON, check default-presence-presets.json to get the idea.')
                                .setRequired(true)

                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('auto-update')
                        .setDescription('Toggle if presence is auto updated or not and the delay')
                        .addBooleanOption(option =>
                            option.setName('toggle')
                                .setDescription('Toggle the auto-update')
                                .setRequired(true)
                        )
                        .addNumberOption(option =>
                            option.setName('delay')
                                .setDescription('Set the delay of auto updates in seconds.')
                                .setMinValue(0)
                                .setMaxValue(86_400)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('update')
                        .setDescription('Manually update the presence.')
                        .addStringOption(option =>
                            option.setName('activity-type')
                                .setDescription('The activity type to be displayed.')
                                .setRequired(true)
                                .addChoices(
                                    {
                                        name: 'Playing',
                                        value: 'Playing'
                                    },
                                    {
                                        name: 'Watching',
                                        value: 'Watching'
                                    },
                                    {
                                        name: 'Listening',
                                        value: 'Listening'
                                    }
                                )
                        )
                        .addStringOption(option =>
                            option.setName('activity-name')
                                .setDescription('The activity name to be displayed.')
                                .setRequired(true)
                                .setMaxLength(32)
                                .setMinLength(1)
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("appearence")
                .setDescription("Open a modal to update the appearence of the application.")
        )
        .toJSON(),
    metadata: {
        userPermissions: [],
        botPermissions: [],
        cooldown: 10,
        ownerOnly: true,
        scope: "global",
        category: "Owner",
        group: "global"
    },
    async execute(interaction, client) {
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        const group = options.getSubcommandGroup();

        const botUser = client.user!;

        switch (group) {
            case "presence": {
                await interaction.deferReply();
                /* 
                    The presence config file looks something like this:
                    {
                        "status": "enable", -> auto-update toggle
                        "delay": 60, -> auto-update delay in seconds
                        "type": 0 -> type 0 means the presets are provided by default-presence-presets
                                -> type 1 means the presets are custom and provided by custom-presence-presets
                                        which is created upon the first run of the custom-config subcommand
                    }
                */
                // In order to change the JSON configuration, the file must be read in an object
                // the object must be modified and then the file has to be re-written with the modified object.
                const presenceConfigPath = local_config.sources.presence_config;
                const presenceConfig: PresenceConfig = await read_json_async(presenceConfigPath);
                switch (subcommand) {
                    case "default": {
                        presenceConfig.type = 0;
                        // update the config with the default type
                        try {
                            await write_json_async(presenceConfigPath, presenceConfig);
                            await interaction.editReply({
                                embeds: [
                                    embed_message("Green", "Presence config type has been set to 0 (default).")
                                ]
                            });
                        } catch (error) {
                            await errorLogHandle(error);
                            await interaction.editReply({
                                embeds: [
                                    embed_error("Something went wrong while writing the presence config.")
                                ]
                            });
                        }
                        break;
                    }
                    case "custom-config": {
                        const customConfigFile = options.getAttachment("config-json", true);
                        // validate input
                        if (customConfigFile.contentType != "text/plain; charset=utf-8") {
                            await interaction.editReply({
                                embeds: [
                                    embed_message("Red", "The attachment must be a text/json file.", "Invalid content type")
                                ]
                            });
                            return;
                        }

                        const fetchFileResponse = await fetch(customConfigFile.url);
                        const presets: unknown = await fetchFileResponse.json();

                        const presenceKeys = ["Playing", "Watching", "Listening"] as const;
                        const hasKeys = typeof presets === "object" &&
                            presets !== null &&
                            presenceKeys.every(key =>
                                Object.prototype.hasOwnProperty.call(presets, key)
                            );
                        if (!hasKeys) {
                            await interaction.editReply({
                                embeds: [
                                    embed_message("Red", "The file provided doesn't respect the format.")
                                ]
                            });
                            return;
                        }

                        // set the type to 1 (custom)
                        presenceConfig.type = 1;

                        try {
                            await write_json_async(presenceConfigPath, presenceConfig);
                            await write_json_async(local_config.sources.custom_presence_presets, presets);
                            await interaction.editReply({
                                embeds: [
                                    embed_message("Green", "Presence config type has been set to 1 (custom).")
                                ]
                            });
                        } catch (error) {
                            await errorLogHandle(error);
                            await interaction.editReply({
                                embeds: [
                                    embed_error("Something went wrong while writing the presence config or the custom preset file.")
                                ]
                            });
                        }
                        break;
                    }
                    case "auto-update": {
                        const toggle = options.getBoolean("toggle", true);
                        const newDelay = options.getNumber("delay");
                        if (newDelay) presenceConfig.delay = newDelay;
                        presenceConfig.status = toggle ? "enable" : "disable";
                        try {
                            await write_json_async(presenceConfigPath, presenceConfig);
                            await interaction.editReply({
                                embeds: [
                                    embed_message("Green", "Auto-update configuration changed.")
                                        .setFields(
                                            {
                                                name: "Status",
                                                value: presenceConfig.status,
                                                inline: true
                                            },
                                            {
                                                name: "Delay",
                                                value: `${presenceConfig.delay} seconds`,
                                                inline: true
                                            }
                                        )
                                ]
                            });
                        } catch (error) {
                            await errorLogHandle(error);
                            await interaction.editReply({
                                embeds: [
                                    embed_error("Something went wrong while writing the presence config.")
                                ]
                            });
                        }
                        break;
                    }
                    case "update": {
                        const activityName = options.getString("activity-name", true);
                        const activityType = options.getString("activity-type", true) as PresencePresetKey;
                        const activityString = `${activityType} ${activityName}`;
                        botUser.setPresence({
                            activities: [
                                {
                                    name: activityString,
                                    type: ActivityType[activityType]
                                }
                            ],
                            status: "online"
                        });
                        presenceConfig.status = "disable";
                        try {
                            await write_json_async(presenceConfigPath, presenceConfig);
                            await interaction.editReply({
                                embeds: [
                                    embed_message(
                                        "Green",
                                        `${botUser.username} is now **${activityString}**\n` +
                                        "Auto-update status is now set to **disable**.",
                                        "Bot presence updated"
                                    )
                                ]
                            });
                        } catch (error) {
                            await errorLogHandle(error);
                            await interaction.editReply({
                                embeds: [
                                    embed_error("Something went wrong while writing the presence config.")
                                ]
                            });
                        }
                        break;
                    }
                }
                break;
            }
            case null: {
                switch (subcommand) {
                    case "appearence": {
                        const avatarInput = new FileUploadBuilder()
                            .setCustomId("avatar-input")
                            .setMinValues(1)
                            .setMaxValues(1)
                            .setRequired(false)
                        const avatarLabel = new LabelBuilder()
                            .setFileUploadComponent(avatarInput)
                            .setLabel("Avatar")
                            .setDescription("Recommanded dimensions 1024x1024. Max size 10MB");

                        const bannerInput = new FileUploadBuilder()
                            .setCustomId("banner-input")
                            .setMinValues(1)
                            .setMaxValues(1)
                            .setRequired(false)
                        const bannerLabel = new LabelBuilder()
                            .setLabel("Banner")
                            .setDescription("Recommanded dimensions 680x240. Max size 10MB")
                            .setFileUploadComponent(bannerInput);

                        const appearenceModal = new ModalBuilder()
                            .setTitle("Bot Appearence")
                            .setCustomId("appearence-modal")
                            .setLabelComponents(avatarLabel, bannerLabel);

                        await interaction.showModal(appearenceModal);
                        try {
                            const submit = await interaction.awaitModalSubmit({
                                filter: (i) => i.user.id === interaction.user.id,
                                time: 300_000
                            });
                            await submit.deferReply();
                            const avatarField = submit.fields.getUploadedFiles("avatar-input");
                            const TEN_MB = 10 * 1_000_000; // 10MB in bytes using 10^6 as MB to bytes conversion
                            if (avatarField) {
                                const avatar = avatarField.first();
                                if (avatar && discord_image_validator(avatar, TEN_MB)) {
                                    await botUser.setAvatar(avatar.url);
                                } else {
                                    await submit.editReply({
                                        embeds: [
                                            embed_message("Red", "The avatar provided is not a valid format or its size is too big.")
                                        ]
                                    });
                                    return;
                                }
                            }
                            const bannerField = submit.fields.getUploadedFiles("banner-input");
                            if (bannerField) {
                                const banner = bannerField.first();
                                if (banner && discord_image_validator(banner, TEN_MB)) {
                                    await botUser.setBanner(banner.url);
                                } else {
                                    await submit.editReply({
                                        embeds: [
                                            embed_message("Red", "The banner provided is not a valid format or its size is too big.")
                                        ]
                                    });
                                    return;
                                }
                            }

                            if (bannerField || avatarField) {
                                await submit.editReply({
                                    embeds: [
                                        embed_message("Green", "Appearence has been updated.")
                                    ]
                                });
                            } else {
                                await submit.editReply({
                                    embeds: [
                                        embed_message("Red", "No input given. Nothing was changed.")
                                    ]
                                });
                            }
                        } catch (error) {
                            await handleModalCatch(error);
                        }

                        break;
                    }
                }
                break;
            }

        }

    }

}

export default botProfile;