// Interfaces and types associated with the API server of the bot for requests and responses

interface BanInfo {
    banned: boolean,
    moderator: string | bigint | null,
    expires: string | bigint | number,
    reason: string,
    timestamp: string | bigint | null
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