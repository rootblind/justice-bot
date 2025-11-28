const rankOptions = [
    {
        label: "Iron",
        value: "0", 
        description: "Iron rank"
    },
    {
        label: "Bronze",
        value: "1", 
        description: "Bronze rank"
    },
    {
        label: "Silver",
        value: "2", 
        description: "Silver rank"
    },
    {
        label: "Gold",
        value: "3", 
        description: "Gold rank"
    },
    {
        label: "Platinum",
        value: "4", 
        description: "Platinum rank"
    },
    {
        label: "Emerald",
        value: "5", 
        description: "Emerald rank"
    },
    {
        label: "Diamond",
        value: "6", 
        description: "Diamond rank"
    },
    {
        label: "Master",
        value: "7", 
        description: "Master rank"
    },
    {
        label: "Grand Master",
        value: "8", 
        description: "Grand Master rank"
    },
    {
        label: "Challenger",
        value: "9", 
        description: "Challenger rank"
    }
];

const id2rank = {
    0 : "Iron",
    1 : "Bronze",
    2 : "Silver",
    3 : "Gold",
    4 : "Platinum",
    5 : "Emerald",
    6 : "Diamond",
    7 : "Master",
    8 : "Grand Master",
    9: "Challenger"
}

const rank2id = {
    "Iron": 0,
    "Bronze": 1,
    "Silver": 2,
    "Gold": 3,
    "Platinum": 4,
    "Emerald": 5,
    "Diamond": 6,
    "Master": 7,
    "Grand Master": 8,
    "Challenger": 9
}

module.exports = { rankOptions, id2rank, rank2id };