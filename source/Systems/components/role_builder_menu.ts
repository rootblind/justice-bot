import {
    Attachment,
    FileUploadBuilder,
    Guild,
    GuildFeature,
    GuildPremiumTier,
    LabelBuilder,
    ModalBuilder,
    PermissionResolvable,
    Role,
    RoleColorsResolvable,
    RoleCreateOptions,
    TextInputBuilder,
    TextInputStyle
} from "discord.js";
import { hasBlockedContent } from "../../utility_modules/discord_helpers.js";
import { local_config } from "../../objects/local_config.js";
import { HexcolorRole } from "../../Interfaces/helper_types.js";
import { hexcolorParser, numifyHexString } from "../../utility_modules/utility_methods.js";

export const HEXCOLOR_PATTERN = /^([0-9A-Fa-f]{6})(?:-([0-9A-Fa-f]{6}))?$/;
export function role_create_modal(): ModalBuilder {
    const nameTextInput: TextInputBuilder = new TextInputBuilder()
        .setCustomId("role-name-input")
        .setMinLength(1)
        .setMaxLength(100)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    const nameLabel: LabelBuilder = new LabelBuilder()
        .setLabel("Name")
        .setDescription("The name of the role.")
        .setTextInputComponent(nameTextInput);

    const hexcolorTextInput: TextInputBuilder = new TextInputBuilder()
        .setCustomId("hexcolor-input")
        .setMinLength(6)
        .setMaxLength(13)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 2596be or 2596be-0561ba for gradient.")
        .setRequired(true)
    const hexcolorLabel: LabelBuilder = new LabelBuilder()
        .setLabel("Hexcolor")
        .setDescription("The hexcolor or hexcolors of the role.")
        .setTextInputComponent(hexcolorTextInput)

    const iconFileInput: FileUploadBuilder = new FileUploadBuilder()
        .setCustomId("icon-file-input");
    const iconFileLabel: LabelBuilder = new LabelBuilder()
        .setLabel("Icon")
        .setDescription("Upload the role icon (under 256KB).")
        .setFileUploadComponent(iconFileInput);

    const roleCreateModal = new ModalBuilder()
        .setCustomId("role-create-modal")
        .setTitle("Create Role")
        .addLabelComponents(nameLabel, hexcolorLabel, iconFileLabel);

    return roleCreateModal;
}

export async function role_name_validator(name: string, guild: Guild, use_filter: boolean = false):
    Promise<boolean> {
    if (use_filter) {
        const localTriggers = Object.values(local_config.rules.toxic_pattern).flat();
        const isBadName = await hasBlockedContent(name, localTriggers, guild);
        if (isBadName) return false;
    }
    return true;
}

export function role_icon_validator(icon: Attachment): boolean {
    if (!icon.contentType?.includes("image")) return false;
    if (icon.size >= 256_000) return false;
    return true;
}

/**
 * Validates the input data to build a role.
 * 
 * @returns {valid: boolean, message?: string}
 */
export async function role_input_validator(
    guild: Guild,
    name: string,
    hexcolor: string,
    icon?: Attachment,
    options?: {
        use_filter: boolean
    }
): Promise<{ valid: boolean, message?: string }> {
    const response: { valid: boolean, message?: string } = { valid: true }
    // validate name
    const validName = await role_name_validator(name, guild, options?.use_filter)
    if (!validName) {
        response.message = "The name is not valid or contains filtered words.";
        response.valid = false;
    }
    // validate hexcolors
    const hexcolorRole: HexcolorRole | null = hexcolorParser(hexcolor, HEXCOLOR_PATTERN);
    if (!hexcolorRole) {
        response.message = "Invalid hexcolor input.";
        response.valid = false;
    }

    // validate icon
    if (icon && !role_icon_validator(icon)) {
        response.message = "Invalid file format or the image is larger than 256KB!";
        response.valid = false;
    }
    return response;
}

/**
 * Assumes role_input_validator() was used to validate the input.
 * 
 * @throws Error if creating the role fails
 */
export async function role_builder(
    guild: Guild,
    name: string,
    hexcolors: HexcolorRole,
    icon: Attachment,
    position?: number,
    permissions?: PermissionResolvable
): Promise<Role> {
    const roleColors: RoleColorsResolvable = {
        primaryColor: numifyHexString(hexcolors.color1)
    };
    // if a second color is provided and the guild has gradient unlocked
    if (guild.features.includes(GuildFeature.EnhancedRoleColors) && hexcolors.color2) {
        roleColors.secondaryColor = numifyHexString(hexcolors.color2);
    }

    const roleOptions: RoleCreateOptions = {
        name: name,
        colors: roleColors,
        permissions: permissions ?? []
    };
    if (position) roleOptions.position = position;

    if (guild.premiumTier > GuildPremiumTier.Tier2) roleOptions.icon = icon.url;

    const role: Role = await guild.roles.create(roleOptions);
    return role;
}