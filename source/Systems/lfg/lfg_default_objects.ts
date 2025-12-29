/**
 * To be replaced with a system where a json decides the ranks and gamemodes
 * To be compatible with general usage instead of league only
 */

const ranks = [
  "Iron",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Emerald",
  "Diamond",
  "Master",
  "Grand Master",
  "Challenger",
] as const;

type Rank = typeof ranks[number];
type RankId = number;
type RankOption = {
  label: typeof ranks[number];
  value: `${number}`;
  description: string;
};

const id2rank = ranks;
const rank2id = Object.fromEntries(
    ranks.map((rank, index) => [rank, index])
) as Record<Rank, RankId>;


const rankOptions: RankOption[] = ranks.map((rank, index) => ({
    label: rank,
    value: String(index) as `${number}`,
    description: `${rank} rank`
}));

export { rankOptions, id2rank, rank2id };