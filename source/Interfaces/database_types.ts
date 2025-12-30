// Interfaces and types to respect the database tables

import { Snowflake } from "discord.js"

interface GuildTable {
    id: number,
    guild: Snowflake
}

interface GuildChannelTable extends GuildTable{
    channel: Snowflake
}

interface GuildRolePair {
    guild: Snowflake,
    role: Snowflake
}

type GuildMessageTable = 
    | (GuildChannelTable & { messageid: Snowflake })
    | (GuildChannelTable & { message: Snowflake })

type GuildChannelWithType =
    | (GuildChannelTable & { channeltype: string })
    | (GuildChannelTable & { type: string })
    | (GuildChannelTable & { eventtype: string })

interface ColumnValuePair {
    column: string,
    value: unknown
}

interface WelcomeScheme {
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

interface PanelScheme extends GuildTable {
    panelname: string,
    roleid: Snowflake,
    description: string
}

interface PanelHeaders extends GuildTable {
    panelname: string
}

type PanelMessages = GuildMessageTable & { panelname: string }

type ReactionRoles = GuildMessageTable & { roleid: Snowflake, emoji: string }

interface ServerRoles extends GuildTable {
    roletype: string,
    role: Snowflake
}

interface PremiumKey extends GuildTable {
    code: Buffer,
    generatedby: Snowflake,
    createdat: Snowflake,
    expiresat: Snowflake,
    usesnumber: number,
    dedicateduser: Snowflake | null,
}

interface PremiumMembers extends GuildTable {
    member: Snowflake,
    code: Buffer,
    customrole: Snowflake | null,
    from_boosting: boolean
}

interface BotConfig {
    id: number,
    application_scope: string,
    backup_db_schedule: string | null
}

interface BanList extends GuildTable {
    target: Snowflake,
    moderator: Snowflake,
    expires: Snowflake | number,
    reason: string
}

interface PunishLogs extends GuildTable {
    target: Snowflake,
    moderator: Snowflake,
    punishment_type: number,
    reason: string,
    timestamp: Snowflake
}

interface AutoPunishRule extends GuildTable {
    warncount: number,
    duration: Snowflake,
    punishment_type: number,
    punishment_duration: Snowflake | number
}


interface RankRole extends GuildTable {
    rankid: number,
    rankq: number,
    role: Snowflake
}

interface PartyBaseScheme extends GuildTable {
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

interface PartyHistory extends PartyBaseScheme {
    timestamp: Snowflake
}

interface PartyDraft extends PartyBaseScheme {
    slot: number,
    draftname: string,
}

interface PartyRoom extends PartyHistory {  
    channel: Snowflake,
    message: Snowflake,
}

interface LfgBlock extends GuildTable {
    blocker: Snowflake,
    blocked: Snowflake
}

interface AutoVoiceManager extends GuildTable {
    message: Snowflake
}

interface AutoVoiceRoom extends GuildChannelTable {
    owner: Snowflake,
    timestamp: Snowflake,
    order_room: number
}

interface AutoVoiceCd extends GuildTable {
    member: Snowflake,
    expires: Snowflake
}

type TicketManager = GuildMessageTable & { category: Snowflake }

interface TicketSubject extends GuildTable {
    subject: string,
    description: string
}

interface StaffRoles extends ServerRoles {
    position: number
}

interface StaffStrike extends GuildTable {
    striked: Snowflake,
    striker: Snowflake,
    reason: string,
    expires: Snowflake
}

interface StrikeRule extends GuildTable {
    strikecount: number,
    punishment: string
}

interface CustomReact extends GuildTable {
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

interface GuildMemberCustomRole {
    guild: Snowflake,
    member: Snowflake,
    customrole: Snowflake | null
};

export type DbCacheKey = string;

export interface GuildModules {
    guild: Snowflake,
    disabled_groups: string[]
}

export type {
    GuildTable,
    GuildChannelTable,
    GuildMessageTable,
    GuildChannelWithType,
    GuildRolePair,
    GuildMemberCustomRole,
    ColumnValuePair,

    // database tables
    WelcomeScheme,
    PanelScheme,
    PanelHeaders,
    PanelMessages,
    ReactionRoles,
    ServerRoles,
    PremiumKey,
    PremiumMembers,
    BotConfig,
    BanList,
    PunishLogs,
    AutoPunishRule,
    RankRole,
    PartyDraft,
    PartyRoom,
    PartyHistory,
    LfgBlock,
    AutoVoiceManager,
    AutoVoiceRoom,
    AutoVoiceCd,
    TicketManager,
    TicketSubject,
    StaffRoles,
    StaffStrike,
    StrikeRule,
    CustomReact
}