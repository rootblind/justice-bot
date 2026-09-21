import { Collection, ComponentType, GuildMember, Message, MessageFlags } from "discord.js";
import { message_collector } from "../../utility_modules/discord_helpers.js";
import { hasCooldownSeconds, timestampNow } from "../../utility_modules/utility_methods.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import AntiAltGuardRepo from "../../Repositories/antialtguardsystem.js";

export async function attach_aa_guard_status_collector(message: Message<boolean>) {
    const COOLDOWN = 60; // 1 minute
    const cooldowns = new Collection<string, number>();

    const collector = await message_collector<ComponentType.Button>(message,
        {
            componentType: ComponentType.Button,
        },
        async (buttonInteraction) => {
            const userCooldown = hasCooldownSeconds(buttonInteraction.user.id, cooldowns, COOLDOWN);
            if (userCooldown) {
                await buttonInteraction.reply({
                    embeds: [
                        embed_message("Red", `This button is on cooldown! <t:${userCooldown}:R>`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            cooldowns.set(buttonInteraction.user.id, timestampNow());
            setTimeout(() => cooldowns.delete(buttonInteraction.user.id), COOLDOWN * 1000);

            const member = buttonInteraction.member as GuildMember;
            const guild = member.guild;
            const setupRow = await AntiAltGuardRepo.getGuildSetup(guild.id);
            if (!setupRow) {
                await buttonInteraction.reply({
                    embeds: [embed_error("It seems the setup disappeared during this session...")],
                    flags: MessageFlags.Ephemeral
                });
                collector.stop();
                return;
            }

            if (buttonInteraction.customId === "status-button") {
                await buttonInteraction.reply({
                    content: "placeholder",
                    flags: MessageFlags.Ephemeral
                });
            }
        },
        async () => { }
    );

    return collector;
}