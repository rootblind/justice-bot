// Interfaces and types to respect the database tables

import type { Snowflake } from "discord.js"

export interface GuildTable {
    id: number,
    guild: Snowflake
}

export interface GuildChannelTable extends GuildTable{
    channel: Snowflake
}

export interface GuildRolePair {
    guild: Snowflake,
    role: Snowflake
}

export type GuildMessageTable = 
    | (GuildChannelTable & { messageid: Snowflake })
    | (GuildChannelTable & { message: Snowflake })

export type GuildChannelWithType =
    | (GuildChannelTable & { channeltype: string })
    | (GuildChannelTable & { type: string })
    | (GuildChannelTable & { eventtype: string })

export interface ColumnValuePair {
    column: string,
    value: unknown
}

export interface WelcomeScheme {
  id: Snowflake,
  guild: string | null,
  active: boolean,
  channel: string | null,
  message: string | null,
  author: boolean | null,
  title: string | null,
  colorcode: string | null,
  imagelink: string | null
}

export interface PanelScheme extends GuildTable {
    panelname: string,
    roleid: Snowflake,
    description: string
}

export interface PanelHeaders extends GuildTable {
    panelname: string
}

export type PanelMessages = GuildMessageTable & { panelname: string }

export type ReactionRoles = GuildMessageTable & { roleid: Snowflake, emoji: string }

export interface ServerRoles extends GuildTable {
    roletype: string,
    role: Snowflake
}

export interface PremiumKey extends GuildTable {
    code: Buffer,
    generatedby: Snowflake,
    createdat: Snowflake,
    expiresat: Snowflake,
    usesnumber: number,
    dedicateduser: Snowflake | null,
}

export interface PremiumMembers extends GuildTable {
    member: Snowflake,
    code: Buffer,
    customrole: Snowflake | null,
    from_boosting: boolean
}

export interface BotConfig {
    id: number,
    application_scope: string,
    backup_db_schedule: string | null
}

export interface BanList extends GuildTable {
    target: Snowflake,
    moderator: Snowflake,
    expires: Snowflake | number,
    reason: string
}

export interface PunishLogs extends GuildTable {
    target: Snowflake,
    moderator: Snowflake,
    punishment_type: number,
    reason: string,
    timestamp: Snowflake
}

export interface AutoPunishRule extends GuildTable {
    warncount: number,
    duration: Snowflake,
    punishment_type: number,
    punishment_duration: Snowflake | number
}


export interface RankRole extends GuildTable {
    rankid: number,
    rankq: number,
    role: Snowflake
}

export interface PartyBaseScheme extends GuildTable {
    owner: Snowflake,
    ign: string,
    region: string,
    gamemode: number,
    size: number,
    private: boolean,
    minrank: number | null,
    maxrank: number | null,
    reqroles: string[] | null,
    description: string | null,
    hexcolor: number | null, 
}

export interface PartyHistory extends PartyBaseScheme {
    timestamp: Snowflake
}

export interface PartyDraft extends PartyBaseScheme {
    slot: number,
    draftname: string,
}

export interface PartyRoom extends PartyHistory {  
    channel: Snowflake,
    message: Snowflake,
}

export interface LfgBlock extends GuildTable {
    blocker: Snowflake,
    blocked: Snowflake
}

export interface AutoVoiceManager extends GuildTable {
    message: Snowflake
}

export interface AutoVoiceRoom extends GuildChannelTable {
    owner: Snowflake,
    timestamp: Snowflake,
    order_room: number
}

export interface AutoVoiceCd extends GuildTable {
    member: Snowflake,
    expires: Snowflake
}

export type TicketManager = GuildMessageTable & { category: Snowflake }

export interface TicketSubject extends GuildTable {
    subject: string,
    description: string
}

export interface StaffRoles extends ServerRoles {
    position: number
}

export interface StaffStrike extends GuildTable {
    striked: Snowflake,
    striker: Snowflake,
    reason: string,
    expires: Snowflake
}

export interface StrikeRule extends GuildTable {
    strikecount: number,
    punishment: string
}

export interface CustomReact extends GuildTable {
    keyword: string,
    reply: string
}

export type GuildRoleTypeString = 
    | "staff"
    | "premium"
    | "probation"
    | "bot"
    | "lfg-eune"
    | "lfg-euw"
    | "ticket-support"

export type EventGuildLogsString =
    | "moderation"
    | "voice"
    | "messages"
    | "user-activity"
    | "server-activity"
    | "flagged-messages"
    | "premium-activity"
    | "justice-logs"
    | "lfg-logs"
    | "ticket-support"

export interface GuildMemberCustomRole {
    guild: Snowflake,
    member: Snowflake,
    customrole: Snowflake | null
};

export type DbCacheKey = string;

export interface GuildModules {
    guild: Snowflake,
    disabled_groups: string[]
}

export interface GuildPlanTable {
    guild: Snowflake,
    plan: "free" | "premium",
    planSince: string,
    expiresAt: string | null
}