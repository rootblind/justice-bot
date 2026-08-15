import {
    APISelectMenuOption,
    LabelBuilder,
    RestOrArray,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
    type Client,
    type Guild,
    type GuildMember,
    type GuildTextBasedChannel,
    type Role,
    type Snowflake
} from "discord.js";
import { fetchGuildMember, fetchMemberCustomRole, fetchPremiumRole } from "../../utility_modules/discord_helpers.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { duration_to_seconds, generate_unique_code, timestampNow } from "../../utility_modules/utility_methods.js";
import { embed_new_premium_membership, embed_premium_member_notification } from "../../utility_modules/embed_builders.js";
import PremiumSystemRepo from "../../Repositories/premiumsystem.js";
import { PremiumKey } from "../../Interfaces/database_types.js";

/**
 * Remove the membership of the member and handle the follow up actions.
 * 
 * Works on non members
 * @param client 
 * @param memberId 
 * @param guild 
 */
export async function remove_premium_from_member(
    client: Client,
    memberId: Snowflake,
    guild: Guild
) {
    const premiumRole = await fetchPremiumRole(client, guild);
    if (!premiumRole) {
        throw new Error(
            `remove_premium_membership was called, but failed to fetch ${guild.name}[${guild.id}] premium role.
            Method called incorrectly or there are residual rows in the database for this guild.`
        );
    }
    const member = await fetchGuildMember(guild, memberId);
    const customRole = await fetchMemberCustomRole(client, guild, memberId);
    // handling the case where the booster is still a guild member but no longer boosting
    if (member) {
        try {
            await member.roles.remove(premiumRole); // remove premium server role from the member
        } catch {/* do nothing */ }
    }

    if (customRole) {
        // Custom roles of members that no longer have premium must be deleted
        try {
            await customRole.delete();
        } catch (error) {
            errorLogHandle(error);
        }
    }

    // cleaning the database
    await PremiumSystemRepo.removeGuildMembership(guild.id, memberId);
}

/**
 * Assign premiumRole to member, generate an encrypted code, register the new key and premium membership
 * in database, log the event if logChannel is provided and notify the member.
 * @param premiumRole The premium role of the guild
 * @param member The premium member
 * @param generatorMember The entity GuildMember that generated the code
 * @param expiresAt Code expiration as timestamp. 0 means permanent
 * @param usesnumber How many uses does the code have. Defaults to 1. One is deducted from the usesnumber given.
 * @param dedicatedMember Whether the assigned code uses member as dedicatedmember
 * @param tier Premium Tier defaults to 0
 * @param logChannel The premium logs channel 
 */
export async function assign_premium_to_member(
    premiumRole: Role,
    member: GuildMember,
    generatorMember: GuildMember,
    expiresAt: string | number,
    usesnumber: number = 1,
    dedicatedMember: boolean = false,
    tier: number = 0,
    logChannel: GuildTextBasedChannel | null = null,
    codeInput?: string
) {
    try { // add the premium role to the member
        await member.roles.add(premiumRole);
    } catch (error) {
        await errorLogHandle(error);
    }

    const guild: Guild = member.guild;
    const code = codeInput ?? await generate_unique_code(); // generate the premium key code

    try { // register the new key
        const newKey = await PremiumSystemRepo.newKey({
            code: Buffer.from(code, "hex"),
            tier: tier,
            guild: guild.id,
            generatedby: generatorMember.id,
            createdat: timestampNow(),
            expiresat: Number(expiresAt),
            usesnumber: usesnumber - 1,
            dedicateduser: dedicatedMember ? member.id : null

        });
        // register the new membership
        await PremiumSystemRepo.newMembership(member.id, guild.id, newKey.id!);
    } catch (error) {
        await errorLogHandle(error, "There was a problem while trying to insert a new premium key");
    }

    if (logChannel) { // log the event
        try {
            await logChannel.send({
                embeds: [
                    embed_new_premium_membership(member, code, expiresAt, usesnumber - 1, tier)
                ]
            });
        } catch (error) {
            await errorLogHandle(error);
        }

        try { // send the member a notification if possible
            await member.send({
                embeds: [
                    embed_premium_member_notification(guild, member, code, expiresAt, tier)
                ]
            });
        } catch {/* do nothing */ }
    }

}

export const TIER_SELECT_OPTIONS: RestOrArray<APISelectMenuOption> = [
    {
        label: "Tier 0",
        value: "0"
    },
    {
        label: "Tier 1",
        value: "1"
    }
] as const;

/**
 * 
 * code: "code-input"
 * 
 * tier: "select-tier" required
 * 
 * dedicateduser: "select-user"
 * 
 * expiresat: "expiration-input" required
 * 
 * usesnumber: "usesnumber-input" required
 * @returns [selectTierLabel, usesNumberLabel, codeLabel, expirationStringLabel, selectDedicatedUserLabel]
 */
export function premium_key_labels(edit_mode: boolean = false): LabelBuilder[] {
    const codeInput = new TextInputBuilder()
        .setCustomId("code-input")
        .setMaxLength(10)
        .setMinLength(5)
        .setRequired(false)
        .setStyle(TextInputStyle.Short)

    const codeLabel = new LabelBuilder()
        .setLabel("Code")
        .setDescription("The code of this key.")
        .setTextInputComponent(codeInput);

    const selectTier = new StringSelectMenuBuilder()
        .setRequired(true)
        .setCustomId("select-tier")
        .setMaxValues(1)
        .setMinValues(1)
        .setOptions(...TIER_SELECT_OPTIONS)

    const selectTierLabel = new LabelBuilder()
        .setLabel("Select Tier")
        .setDescription("Select the tier of this premium key.")
        .setStringSelectMenuComponent(selectTier)

    const dedicatedUserInput = new UserSelectMenuBuilder()
        .setCustomId("select-user")
        .setMaxValues(1)
        .setMinValues(1)
        .setRequired(false)
    const selectDedicatedUserLabel = new LabelBuilder()
        .setLabel("Dedicated User")
        .setDescription("To dedicate this key to a user, select them.")
        .setUserSelectMenuComponent(dedicatedUserInput)

    const usesNumberInput = new TextInputBuilder()
        .setCustomId("usesnumber-input")
        .setMaxLength(6)
        .setMinLength(0)
        .setRequired(true)
        .setStyle(TextInputStyle.Short)

    const usesNumberLabel = new LabelBuilder()
        .setLabel("Uses number")
        .setDescription("How many times the code can be redeemed.")
        .setTextInputComponent(usesNumberInput)

    const expirationStringInput = new TextInputBuilder()
        .setCustomId("expiration-input")
        .setMaxLength(3)
        .setMinLength(2)
        .setRequired(true)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Defaults to permanent (0d). Ex: 3d")
    const expirationStringLabel = new LabelBuilder()
        .setLabel("Expiration")
        .setDescription("Leave this field empty for a permanent key.")
        .setTextInputComponent(expirationStringInput)

    if (edit_mode) {
        selectTier.setRequired(false);
        usesNumberInput.setRequired(false);
        expirationStringInput.setRequired(false);
        return [selectTierLabel, usesNumberLabel, expirationStringLabel, selectDedicatedUserLabel]
    }

    expirationStringInput.setValue("0d");

    return [selectTierLabel, usesNumberLabel, expirationStringLabel, codeLabel, selectDedicatedUserLabel]
}

/**
 * 
 * @param key The premium key
 * @returns A string representing the key details in key-value pair for embeds.
 */
export function key_details_string(key: PremiumKey): string {
    return `**Tier**: ${key.tier}
        **Generated by**: <@${key.generatedby}>
        **Expires**: ${Number(key.expiresat) ? `<t:${key.expiresat}:R>` : "Permanent"}
        **Uses number**: ${key.usesnumber}
        **Dedicated user**: ${key.dedicateduser ? `<@${key.dedicateduser}>` : "None"}`;
}

export function validate_usesnumber(usesnumber: number): boolean {
    return !Number.isNaN(usesnumber) && usesnumber >= 1 && usesnumber <= 100_000
}
export function validate_expiration_duration(duration: number | null): boolean {
    return duration !== null && (duration == 0 || duration >= duration_to_seconds("1d")!)
}

export async function is_code_unique(code: string): Promise<boolean> {
    const codes = await PremiumSystemRepo.getAllCodes();
    return !codes.includes(code);
}