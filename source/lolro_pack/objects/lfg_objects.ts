export interface ConfigElement {
    name: string,
    alias: string[]
}

export interface LfgParserConfig {
    gameModes: ConfigElement[],
    roles: ConfigElement[],
    ranks: ConfigElement[]
}

export const lfgParserConfig: LfgParserConfig = {
    gameModes: [
        {
            name: "flex",
            alias: []
        },
        {
            name: "draft",
            alias: ["normal", "normale"]
        },
        {
            name: "solo/duo",
            alias: ["soloduo", "soloq", "duoq", "s/d", "solo-duo"],
        },
        {
            name: "aram",
            alias: []
        },
        {
            name: "arena",
            alias: []
        },
        {
            name: "clash",
            alias: []
        },
        {
            name: "custom",
            alias: ["custom game", "custom games"]
        },
        {
            name: "swiftplay",
            alias: []
        },
        {
            name: "featured gamemode",
            alias: ["urf", "arurf"]
        }
    ],
    roles: [
        {
            name: "top",
            alias: ["toplane"]
        },
        {
            name: "jungle",
            alias: ["jg", "jng", "padure", "padurar"]
        },
        {
            name: "mid",
            alias: ["middle", "midlane", "mijloc"]
        },
        {
            name: "adc",
            alias: ["bottom", "bot", "ad"]
        },
        {
            name: "supp",
            alias: ["support", "sup", "suport"]
        }
    ],
    ranks: [
        {
            name: "iron",
            alias: ["fier"]
        },
        {
            name: "bronze",
            alias: ["bronz"]
        },
        {
            name: "silver",
            alias: ["argint"]
        },
        {
            name: "gold",
            alias: ["aur"]
        },
        {
            name: "platinum",
            alias: ["platina", "plat"]
        },
        {
            name: "emerald",
            alias: ["smarald", "eme"]
        },
        {
            name: "diamond",
            alias: ["diamant", "dia"]
        },
        {
            name: "master",
            alias: []
        },
        {
            name: "grandmaster",
            alias: ["gm"]
        },
        {
            name: "challenger",
            alias: ["chall"]
        }
    ]
};