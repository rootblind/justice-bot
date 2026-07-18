import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import database from "../../Config/database.js";
import { local_config } from "../../objects/local_config.js";
import { timestampNow } from "../../utility_modules/utility_methods.js";
import fs from "fs/promises";
import { embed_error } from "../../utility_modules/embed_builders.js";

const queryDbCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("query-db")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription("Sends a query request to the database and sends the response in the chat.")
        .addStringOption(option =>
            option.setName("query")
                .setDescription("Queries are sent as they are given.")
                .setRequired(true)
        )
        .toJSON(),
    metadata: {
        cooldown: 5,
        userPermissions: [],
        botPermissions: [],
        ownerOnly: true,
        group: "global",
        category: "Owner",
        scope: "global"
    },
    async execute(interaction) {
        const query = interaction.options.getString("query", true);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const response = await database.query(query);
            const rows = response.rows;
            let clientResponse: string =
                `**${response.command}** affected ${response.rowCount} rows.\n`;

            if (rows.length) {
                const columns = response.fields.map(field => field.name).join(" | ") + "\n";
                const joinedRows = rows.map(row => Object.values(row).join(" | ")).join("\n");
                clientResponse += columns + joinedRows;
            }

            if (clientResponse.length < 3000) {
                await interaction.editReply(clientResponse);
            } else {
                // create and dump a file with the contents of the response
                const filePath = `${local_config.sources.temp}/query_response_${timestampNow()}.txt`
                await fs.writeFile(filePath, clientResponse);
                await interaction.editReply({
                    content: "The response was dumped into the file.",
                    files: [filePath]
                });
                await fs.unlink(filePath);
            }
        } catch (error) {
            await interaction.editReply({
                embeds: [
                    embed_error("Bad input, check the console for details.")
                ]
            });
            console.error(error);
        }
    }
}

export default queryDbCommand;