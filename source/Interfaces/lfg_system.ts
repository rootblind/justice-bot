export interface LfgSystemConfig {
    guild_id: string,
    force_voice: boolean,
    post_cooldown: number
}

export type PgBigInt = string;

export type Snowflake = string;

// ENUM for role type
export type LfgRoleType = 'rank' | 'role';

export interface LfgGame {
    guild_id: Snowflake;
    game_name: string;

    category_channel_id: Snowflake | null;
    manager_channel_id: Snowflake | null;
    manager_message_id: Snowflake | null;
}

export interface LfgGameTable extends LfgGame {
    id: number
}

export interface LfgChannel {
    game_id: number;
    name: string;
    discord_channel_id: Snowflake | null;
}

export interface LfgChannelTable extends LfgChannel {
    id: number
}

export interface LfgGamemode {
    game_id: number;
    name: string;
}

export interface LfgGamemodeTable extends LfgGamemode {
    id: number
}

export interface LfgChannelGamemode {
    channel_id: number;
    gamemode_id: number;
}

export interface LfgRole {
    guild_id: Snowflake;
    game_id: number;
    role_id: Snowflake;
    type: LfgRoleType;
}

export interface LfgRoleTable extends LfgRole {
    id: number
}

export interface LfgPost {
    guild_id: Snowflake;
    game_id: number;
    channel_id: number;
    gamemode_id: number | null;

    message_id: Snowflake;
    owner_id: Snowflake;

    slots: number;
    description: string | null;

    created_at: number;
}

export interface LfgPostTable extends LfgPost {
    id: number
}

export interface LfgPostRole {
    post_id: number;
    role_id: string;
}

// full game configuration
export interface LfgGameConfig {
    game: LfgGame;
    channels: LfgChannel[];
    gamemodes: LfgGamemode[];
    roles: LfgRole[];
}

// LFG post with relations
export interface LfgPostAndRoleIds {
    post: LfgPost;
    attachedRoleIds: number[]
}

export interface LfgPostWithChannelTable extends LfgPostTable {
    discord_channel_id: Snowflake
}

export interface LfgPostFullRow extends LfgPostTable {
    discord_channel_id: string;
    gamemode_name: string | null;
    roles: LfgRoleTable[];
}