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
    RoleEditOptions,
    TextInputBuilder,
    TextInputStyle
} from "discord.js";
import { hasBlockedContent } from "../../utility_modules/discord_helpers.js";
import { local_config } from "../../objects/local_config.js";
import { HexcolorRole } from "../../Interfaces/helper_types.js";
import { hexcolorParser, numifyHexString } from "../../utility_modules/utility_methods.js";

export const HEXCOLOR_PATTERN = /^([0-9A-Fa-f]{6})(?:-([0-9A-Fa-f]{6}))?$/;

export function role_input_modal() {
    const nameTextInput: TextInputBuilder = new TextInputBuilder()
        .setCustomId("role-name-input")
        .setMinLength(1)
        .setMaxLength(100)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)

    const hexcolorTextInput: TextInputBuilder = new TextInputBuilder()
        .setCustomId("hexcolor-input")
        .setMinLength(6)
        .setMaxLength(13)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 2596be or 2596be-0561ba for gradient.")
        .setRequired(true)

    const iconFileInput: FileUploadBuilder = new FileUploadBuilder()
        .setCustomId("icon-file-input")
        .setMaxValues(1)
        .setRequired(false);

    return { nameTextInput, hexcolorTextInput, iconFileInput };
}

/**
 * Build the modal used to fetch input for role creation.
 * 
 * Contains name, hexcolor and icon.
 * 
 * @param edit_mode Set all input fields to be optional. Used for editing a role instead.
 */
export function role_create_modal(edit_mode: boolean = false): ModalBuilder {
    const { nameTextInput, hexcolorTextInput, iconFileInput } = role_input_modal();
    if (edit_mode === true) {
        nameTextInput.setRequired(false);
        hexcolorTextInput.setRequired(false);
        iconFileInput.setRequired(false);
    }
    const nameLabel: LabelBuilder = new LabelBuilder()
        .setLabel("Name")
        .setDescription("The name of the role.")
        .setTextInputComponent(nameTextInput);
    const hexcolorLabel: LabelBuilder = new LabelBuilder()
        .setLabel("Hexcolor")
        .setDescription("The hexcolor or hexcolors of the role.")
        .setTextInputComponent(hexcolorTextInput)
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
    icon?: Attachment,
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

    if (guild.premiumTier > GuildPremiumTier.Tier2 && icon) roleOptions.icon = icon.url;

    const role: Role = await guild.roles.create(roleOptions);
    return role;
}

export interface RoleModificationOptions {
    name?: string,
    colors?: HexcolorRole,
    icon?: Attachment,
    position?: number
    // permissions not added
}

export async function role_editor_safe(
    role: Role,
    modify: RoleModificationOptions
): Promise<Role> {
    const guild = role.guild;
    const roleEditOptions: RoleEditOptions = {};
    const { name, colors, icon, position } = modify;
    if (name) {
        roleEditOptions.name = name
    }
    if (colors) {
        const roleColors: RoleColorsResolvable = {
            primaryColor: numifyHexString(colors.color1)
        };
        if (guild.features.includes(GuildFeature.EnhancedRoleColors) && colors.color2) {
            roleColors.secondaryColor = numifyHexString(colors.color2);
        }
        roleEditOptions.colors = roleColors;
    }

    if (icon) {
        if (guild.premiumTier > GuildPremiumTier.Tier2) roleEditOptions.icon = icon.url;
    }

    if (position) {
        roleEditOptions.position = position;
    }

    const modifiedRole: Role = await role.edit(roleEditOptions);
    return modifiedRole;
}