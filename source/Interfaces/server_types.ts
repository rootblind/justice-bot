// Interfaces and types associated with the API server of the bot for requests and responses

interface BanInfo {
    banned: boolean,
    moderator: string | null,
    expires: string | number,
    reason: string,
    timestamp: string | null
}

interface MemberInfo {
    avatar: string,
    joined_guild_at: number | null,
    premium: boolean
}

export type { 
    BanInfo, 
    MemberInfo, 
 };