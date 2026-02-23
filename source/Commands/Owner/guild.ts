import { APISelectMenuOption, ComponentType, PermissionFlagsBits, RestOrArray, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { get_env_var } from "../../utility_modules/utility_methods.js";
import { ActionRowBuilder, StringSelectMenuBuilder } from "@discordjs/builders";
import { embed_message } from "../../utility_modules/embed_builders.js";
import { fetchGuild, message_collector } from "../../utility_modules/discord_helpers.js";

const guildCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("guilds")
        .setDescription("Take actions inside guilds.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName("leave")
                .setDescription("Leave from selected guilds.")
        )
        .toJSON(),
    metadata: {
        cooldown: 10,
        userPermissions: [],
        botPermissions: [],
        group: "global",
        scope: "global",
        category: "Owner",
        ownerOnly: true
    },
    async execute(interaction, client) {
        const options = interaction.options;
        const subcommands = options.getSubcommand();
        const ownerId = get_env_var("OWNER_ID");

        await interaction.deferReply();
        const guilds = await client.guilds.fetch();
        switch (subcommands) {
            case "leave": {
                const guildOptions: RestOrArray<APISelectMenuOption> =
                    guilds.map(g => {
                        return {
                            label: g.name,
                            description: `Leave from ${g.name}`,
                            value: g.id
                        }
                    });

                const maxValues = guilds.size < 25 ? guilds.size : 25;
                const selectGuild = new StringSelectMenuBuilder()
                    .setCustomId("select-guilds")
                    .setMaxValues(maxValues)
                    .setMinValues(1)
                    .setOptions(guildOptions);
                await interaction.editReply({
                    embeds: [embed_message("Aqua", "Select the guilds to be left by the bot.")],
                    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectGuild)]
                });
                const reply = await interaction.fetchReply();
                const collector = await message_collector<ComponentType.StringSelect>(reply,
                    {
                        componentType: ComponentType.StringSelect,
                        filter: (i) => i.user.id === ownerId,
                        time: 300_000
                    },
                    async (selectInteraction) => {
                        const guildsIds = [...selectInteraction.values];
                        const failedIds: string[] = [];
                        for (const id of guildsIds) {
                            const guildFetched = await fetchGuild(client, id);
                            if (!guildFetched) {
                                failedIds.push(id);
                                continue;
                            }

                            try {
                                await guildFetched.leave();
                            } catch (error) {
                                console.error(error);
                            }
                        }

                        await selectInteraction.reply({
                            embeds: [
                                embed_message(
                                    "Green",
                                    `Action executed.\nFailed ids: ${failedIds.length > 0 ? failedIds.join(", ") : "None"}`
                                )
                            ]
                        });

                        collector.stop();
                    },
                    async () => {
                        try {
                            await reply.delete();
                        } catch { /* do nothing */ }
                    }
                )
                break;
            }
        }
    }
}

export default guildCommand;