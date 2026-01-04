export interface LocalConfigToxicPatterns {
    [key: string]: string[]
}

export const toxic_patterns: LocalConfigToxicPatterns = {
  Aggro: [
    "\\besti\\s+(un\\s+)?prost(ule)?\\b",
    "\\besti\\s+(o\\s+)?proasta\\b",
    "\\besti\\s+(un\\s+)?idiot(ule)?\\b",
    "\\besti\\s+(un\\s+)?retard(at)?\\b",
    "\\besti\\s+(un\\s+)?gunoi\\b",
    "\\besti\\s+(un\\s+)?ratat(a)?\\b",
    "\\besti\\s+(un\\s+)?fraier(ule)?\\b",
    "\\besti\\s+(un\\s+)?incel\\b",
    "\\besti\\s+(un\\s+)?simp\\b",
    "\\besti\\s+(un\\s+)?soyboy\\b",
    "\\besti\\s+curva\\b",
    "\\besti\\s+(o\\s+)?zdreanta\\b",
    "\\bcine\\s+te\\s+a\\s+intrebat\\b",
    "\\bdu\\s+te\\s+dracu\\b"
  ],
  Violence: [
    "\\bte\\s+omor\\b",
    "\\biti\\s+rup\\s+(gatul|mainile)\\b",
    "\\bte\\s+bat\\b",
    "\\biti\\s+sparg\\s+fata\\b",
    "\\bte\\s+bag\\s+in\\s+pamant\\b",
    "\\biti\\s+scot\\s+matele\\b",
    "\\bomoara\\s+te\\b",
    "\\bnu\\s+meriti\\s+sa\\s+traiesti\\b",
    "\\bmeriti\\s+sa\\s+mori\\b",
    "\\bkill\\s+yourself\\b",
    "\\bhang\\s+yourself\\b",
    "\\bkys\\b",
    "\\bsa\\s+te\\s+vad\\s+mort\\b"
  ],
  Sexual: [
    "\\bfutu\\s+te\\b",
    "\\bdu\\s+te\\s+sa\\s+o\\s+sugi\\b",
    "\\bo\\s+sugi\\b",
    "\\bmuie\\b",
    "\\besti\\s+muist\\b",
    "\\bsuck\\s+my\\s+dick\\b",
    "\\bfuck\\s+you\\b",
    "\\bpizd(a|e|le|lor)\\b"
  ],
  Hateful: [
    "\\besti\\s+handicapat\\b",
    "\\besti\\s+retard\\b",
    "\\bnig+er+\\b",
    "\\bfa(g)+ot\\b",
    "\\bchink\\b",
    "\\bkike\\b",
    "\\btrann(y|ie)\\b",
    "\\bwhite\\s+power\\b",
    "\\bsieg\\s+heil\\b",
    "\\bgas\\s+jews\\b",
    "\\brasa\\s+[a-z]+\\s+trebuie\\s+sa\\s+moara\\b"
  ]
}
