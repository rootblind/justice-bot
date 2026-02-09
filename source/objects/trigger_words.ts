export interface LocalConfigToxicPatterns {
	[key: string]: string[]
}

export const toxic_patterns: LocalConfigToxicPatterns = {
	Aggro: [
		"esti prost",
		"esti proasta",
		"esti idiot",
		"esti retard",
		"esti gunoi",
		"esti ratat",
		"esti fraier",
		"esti incel",
		"esti simp",
		"esti soyboy",
		"esti curva",
		"esti zdreanta",
		"cine te a intrebat",
		"du te dracu"
	],

	Violence: [
		"te omor",
		"iti rup gatul",
		"iti rup mainile",
		"te bat",
		"iti sparg fata",
		"te bag in pamant",
		"iti scot matele",
		"omoara te",
		"nu meriti sa traiesti",
		"meriti sa mori",
		"kill yourself",
		"hang yourself",
		"kys",
		"sa te vad mort"
	],

	Sexual: [
		"futu te",
		"du te sa o sugi",
		"o sugi",
		"muie",
		"esti muist",
		"suck my dick",
		"fuck you",
		"pizda"
	],

	Hateful: [
		"esti handicapat",
		"esti retard",
		"nigger",
		"faggot",
		"chink",
		"kike",
		"tranny",
		"white power",
		"sieg heil",
		"gas jews"
	]
};
