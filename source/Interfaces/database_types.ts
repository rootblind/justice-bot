interface GuildTable {
    id: number,
    guild: bigint
}

interface GuildChannelTable extends GuildTable{
    channel: bigint
}

type GuildMessageTable = 
    | (GuildChannelTable & { messageid: bigint })
    | (GuildChannelTable & { message: bigint })

type GuildChannelWithType =
    | (GuildChannelTable & { channeltype: string })
    | (GuildChannelTable & { type: string })
    | (GuildChannelTable & { eventtype: string })

interface WelcomeScheme {
  id: bigint,
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
    roleid: bigint,
    description: string
}

interface PanelHeaders extends GuildTable {
    panelname: string
}

type PanelMessages = GuildMessageTable & { panelname: string }

type ReactionRoles = GuildMessageTable & { roleid: bigint, emoji: string }

interface ServerRoles extends GuildTable {
    roletype: string,
    role: bigint
}

interface PremiumKey extends GuildTable {
    code: Buffer,
    generatedby: bigint,
    createdat: bigint,
    expiresat: bigint,
    usesnumber: number,
    dedicateduser: bigint | null,
}

interface PremiumMembers extends GuildTable {
    member: bigint,
    code: Buffer,
    customrole: bigint | null,
    from_boosting: boolean
}

interface BotConfig {
    id: number,
    application_scope: string,
    backup_db_schedule: string | null
}

interface BanList extends GuildTable {
    target: bigint,
    moderator: bigint,
    expires: bigint | number,
    reason: string
}

interface PunishLogs extends GuildTable {
    target: bigint,
    moderator: bigint,
    punishment_type: number,
    reason: string,
    timestamp: bigint
}

interface AutoPunishRule extends GuildTable {
    warncount: number,
    duration: bigint,
    punishment_type: number,
    punishment_duration: bigint | number
}


interface RankRole extends GuildTable {
    rankid: number,
    rankq: number,
    role: bigint
}

interface PartyBaseScheme extends GuildTable {
    owner: bigint,
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
    timestamp: bigint
}

interface PartyDraft extends PartyBaseScheme {
    slot: number,
    draftname: string,
}

interface PartyRoom extends PartyHistory {  
    channel: bigint,
    message: bigint,
}

interface LfgBlock extends GuildTable {
    blocker: bigint,
    blocked: bigint
}

interface AutoVoiceManager extends GuildTable {
    message: bigint
}

interface AutoVoiceRoom extends GuildChannelTable {
    owner: bigint,
    timestamp: bigint,
    order_room: number
}

interface AutoVoiceCd extends GuildTable {
    member: bigint,
    expires: bigint
}

type TicketManager = GuildMessageTable & { category: bigint }

interface TicketSubject extends GuildTable {
    subject: string,
    description: string
}

interface StaffRoles extends ServerRoles {
    position: number
}

interface StaffStrike extends GuildTable {
    striked: bigint,
    striker: bigint,
    reason: string,
    expires: bigint
}

interface StrikeRule extends GuildTable {
    strikecount: number,
    punishment: string
}

interface CustomReact extends GuildTable {
    keyword: string,
    reply: string
}

export type {
    GuildTable,
    GuildChannelTable,
    GuildMessageTable,
    GuildChannelWithType,

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