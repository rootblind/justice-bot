import { BaseGuildTextChannel, EmbedBuilder, GuildBasedChannel, GuildMember, type Guild } from "discord.js";
import { WelcomeScheme } from "../../Interfaces/database_types.js";
import WelcomeSchemeRepo from "../../Repositories/welcomescheme";
import { fetchGuildChannel } from "../../utility_modules/discord_helpers";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

/**
 * @param scheme The scheme stored in welcomescheme table
 * @param member The new member
 * @returns Embed
 */
export function welcome_builder(scheme: WelcomeScheme, member: GuildMember): EmbedBuilder {
    const guild: Guild = member.guild;
    const embed = new EmbedBuilder();
    if(scheme.author) {
        embed.setAuthor({
            name: member.user.username,
            iconURL: member.displayAvatarURL({extension: "jpg"})
        })
    }
    if(scheme.title) {
        embed.setTitle(scheme.title);
    }

    if(scheme.imagelink) {
        embed.setImage(scheme.imagelink)
    }

    embed
        .setDescription(scheme.message)
        .setThumbnail(guild.iconURL({extension: "png"}))
        .setColor(Number(scheme.colorcode))
        .setTimestamp()
        .setFooter({text: `Member ID: ${member.id}`});

    return embed;

}

/**
 * Fetches the welcome scheme from database and handles the welcome message
 * @param member The new guild member
 */
export async function welcome_handler(member: GuildMember): Promise<void> {
    const guild: Guild = member.guild;
    const scheme: WelcomeScheme | null = await WelcomeSchemeRepo.getScheme(guild.id);

    if(!scheme) return; // do nothing if there is no scheme to be used
    if(!scheme.active) return; // if the welcome system is set to be inactive, do nothing

    const channel: GuildBasedChannel | null = await fetchGuildChannel(guild, String(scheme.channel));
    if(!channel) return; // if there is no channel to send the welcome message, do nothing

    if(channel instanceof BaseGuildTextChannel) {
        // if the channel is a text channel
        try {
            await channel.send({
                embeds: [
                    welcome_builder(scheme, member)
                ]
            });
        } catch(error) {
            await errorLogHandle(error, `Failed to send the welcome message from ${guild.name}[${guild.id}]`);
        }
    }
}