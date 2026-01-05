import { GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { add_block_collector, select_block_row } from "../../Systems/block/block_system.js";
import BlockSystemRepo from "../../Repositories/blocksystem.js";
import { embed_message } from "../../utility_modules/embed_builders.js";

const block: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("block")
        .setDescription("Manage your blocklist and see details about it.")
        .addSubcommand(subcommand =>
            subcommand.setName("menu")
                .setDescription("Open a user select menu to block members on this server.")
        )
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("list")
                .setDescription("List details about blocking.")
                .addSubcommand(subcommand =>
                    subcommand.setName("blocked")
                        .setDescription("List members you are currently blocking.")
                )
                .addSubcommand(subcommand => 
                    subcommand.setName("mutual-restricted")
                        .setDescription("List mutually restricted members.")
                )
        )
        .toJSON(),
    async execute(interaction) {
        const member = interaction.member as GuildMember;
        const guild = member.guild;
        const options = interaction.options;

        const subcommand = options.getSubcommand();
        
        switch(subcommand) {
            case "menu": {
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    components: [ select_block_row() ]
                });
                const reply = await interaction.fetchReply();
                await add_block_collector(reply, member, interaction);
                break;
            }
            case "blocked": {
                const blocklist = await BlockSystemRepo.getMemberBlockList(guild.id, member.id);
                const embed = embed_message("Purple", "placeholder")
                    .setTitle(`Blocklist [${blocklist.length}/32]`)
                    .setAuthor({
                        name: `${member.user.username} blocklist`,
                        iconURL: member.displayAvatarURL({extension: "jpg"})
                    });
                
                if(blocklist.length === 0) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [ embed.setDescription("Your blocklist is empty.") ]
                    });
                    return;
                }

                const userTags = blocklist.map(id => `<@${id}>`);
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    embeds: [ embed.setDescription(`You are currently blocking:\n ${userTags.join(" ")}`) ]
                });
                break;
            }
            case "mutual-restricted": {
                const mutualRestrictedList = await BlockSystemRepo.getMutualRestrictedList(guild.id, member.id);
                const embed = embed_message("Purple", "placeholder")
                    .setAuthor({
                        name: `${member.user.username} mutual restricted list`,
                        iconURL: member.displayAvatarURL({extension: "jpg"})
                    })
                    .setTitle(`Mutual restrictions: ${mutualRestrictedList.length}`)
                    .setFooter({text: "You are mutually restricted with members that have either blocked you or you are currently blocking them."})
                if(mutualRestrictedList.length === 0) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [ embed.setDescription("Your blocklist is empty and no one is blocking you either.") ]
                    });
                    return;
                }

                const userTags = mutualRestrictedList.map((id) => `<@${id}>`).slice(0, 100);
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    embeds: [ 
                        embed.setDescription(
                            `You are mutually restricted with
                            ${userTags.join(" ")}
                            ${mutualRestrictedList.length > 100 ?
                                `...and ${mutualRestrictedList.length - userTags.length} other members`: ""}`
                        ) 
                    ]
                });
                break;
            }
        }
    },
    metadata: {
        botPermissions: [ PermissionFlagsBits.SendMessages ],
        userPermissions: [],
        scope: "guild",
        category: "Social",
        group: "block",
        cooldown: 5
    }

}

export default block;