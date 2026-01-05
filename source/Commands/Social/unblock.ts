import { GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { remove_block_collector, select_unblock_builder } from "../../Systems/block/block_system.js";
import BlockSystemRepo from "../../Repositories/blocksystem.js";
import { embed_message } from "../../utility_modules/embed_builders.js";

const unblock: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("unblock")
        .setDescription("Open a select menu to remove members from your blocklist.")
        .toJSON(),
    async execute(interaction) {
        const member = interaction.member as GuildMember;
        const guild = member.guild;
        const blocklist = await BlockSystemRepo.getMemberBlockList(guild.id, member.id);
        if(blocklist.length === 0) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [ embed_message("Aqua", "Your blocklist is empty.") ]
            });
            return;
        }

        const actionRow = await select_unblock_builder(guild, blocklist);
        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            components: [ actionRow ]
        });
        const reply = await interaction.fetchReply();
        await remove_block_collector(reply, member, interaction);
    },
    metadata: {
        botPermissions: [ PermissionFlagsBits.SendMessages ],
        userPermissions: [],
        scope: "guild",
        category: "Social",
        group: "block",
        cooldown: 10
    }
}
export default unblock;