export const GUILD_PLANS = {
  FREE: {
    maxSlots: {
      autovoiceManagers: 2
    }
  },
  PREMIUM: {
    maxSlots: {
      autovoiceManagers: 4
    }
  }
} as const;

export type GuildPlanName = keyof typeof GUILD_PLANS;
export type GuildPlan = typeof GUILD_PLANS[GuildPlanName];
