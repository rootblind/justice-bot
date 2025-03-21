/*
    Autovoice is a voice channel created for a member that joins the designated voice channel.
    Also sets up the manager menu to make changes to the voice
*/

const {SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits} = require("discord.js");
const {poolConnection} = require("../../utility_modules/kayle-db.js");
const {autovoice_manager} = require("../../utility_modules/subcommands/autovoice.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("autovoice-setup")
        .setDescription("Create the channels and manager for autovoice.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        await interaction.deferReply({ephemeral: true});
        
        // Clearing the database in case a previous setup was ran
        await poolConnection.query(`DELETE FROM autovoicechannel WHERE guild=$1`, [interaction.guild.id]);
        await poolConnection.query(`DELETE FROM autovoiceroom WHERE guild=$1`, [interaction.guild.id]);
        await poolConnection.query(`DELETE FROM autovoicemanager WHERE guild=$1`, [interaction.guild.id]);
        await poolConnection.query(`DELETE FROM autovoicecd WHERE guild=$1`, [interaction.guild.id]);

        // 1: creating the category and its channels

        const category = await interaction.guild.channels.create({
            name: "Voice Rooms",
            type: ChannelType.GuildCategory
        });

        const manager = await interaction.guild.channels.create({
            name: "voice-manager",
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: interaction.guild.roles.everyone.id,
                    deny: [
                        PermissionFlagsBits.AddReactions, PermissionFlagsBits.SendMessages
                    ]
                }
            ],
            parent: category
        })

        const autovoice = await interaction.guild.channels.create({
            name: "➕ Auto Voice",
            type: ChannelType.GuildVoice,
            permissionOverwrites: [
                {
                    id: interaction.guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.Speak, PermissionFlagsBits.Stream, PermissionFlagsBits.SendMessages]
                }
            ],
            parent: category
        });

        await poolConnection.query(`INSERT INTO autovoicechannel(guild, channel, type)
            VALUES ($1, $2, 'category'), ($1, $3, 'manager'), ($1, $4, 'autovoice')`, 
            [interaction.guild.id, category.id, manager.id, autovoice.id]
        ); // register channels

        // 2: calling the autovoice manager method
        await autovoice_manager(manager);

        // 3: the voice room creation logic will be implemented in voiceStateUpdate since a voice channel is created when someone has
        // newState.channel.id == autovoice.id
        await interaction.editReply({
            content: "Executed!"
        });
    }

}