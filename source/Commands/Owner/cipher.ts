import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { encryptor, decryptor } from "../../utility_modules/utility_methods.js";

const cipherCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("cipher")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription("Encrypt and decrypt input using the environment keys.")
        .addSubcommand(subcommand =>
            subcommand.setName("encrypt")
                .setDescription("Encrypt a string")
                .addStringOption(option =>
                    option.setName("data")
                        .setDescription("The text to be encrypted.")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("decrypt")
                .setDescription("Decrypt the given input.")
                .addStringOption(option =>
                    option.setName("data")
                        .setDescription("The text to be dencrypted.")
                        .setRequired(true)
                )
        )
        .toJSON(),
    metadata: {
        cooldown: 10,
        userPermissions: [],
        botPermissions: [],
        ownerOnly: true,
        group: "global",
        category: "Owner",
        scope: "global"
    },
    async execute(interaction) {
        const options = interaction.options;
        const subcommand = options.getSubcommand();

        const data = options.getString("data", true);

        if (subcommand === "encrypt") {
            try {
                await interaction.reply({
                    content: encryptor(data),
                    flags: MessageFlags.Ephemeral
                });
            } catch (error) {
                await errorLogHandle(error);
                await interaction.reply({
                    embeds: [
                        embed_error(`Something went wrong while running the encrypt command.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
        } else {
            // else goes for the decrypt branch
            try {
                await interaction.reply({
                    content: decryptor(data),
                    flags: MessageFlags.Ephemeral
                });
            } catch (error) {
                if (error instanceof Error && error.message.includes("routines::bad decrypt")) {
                    await interaction.reply({
                        embeds: [
                            embed_message(
                                "Red",
                                "The data provided is not a hex string encrypted with the right keys.",
                                "Bad Input"
                            )
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                } else {
                    await errorLogHandle(error);
                    await interaction.reply({
                        embeds: [
                            embed_error(`Something went wrong while running the decrypt command.`)
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                }
            }
        }
    }

}

export default cipherCommand;