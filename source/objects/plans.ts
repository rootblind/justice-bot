export const GUILD_PLANS = {
  free: {
    autoVoiceSystem: {
      maxSlots: 2
    }
  },
  premium: {
    autoVoiceSystem: {
      maxSlots: 4
    }
  }
} as const;

export type GuildPlanName = keyof typeof GUILD_PLANS;
export type GuildPlan = typeof GUILD_PLANS[GuildPlanName];
