/** Sixteen MBTI types grouped by temperament (4 per row). */
export const MBTI_TEMPERAMENT_GROUPS = [
  {
    id: "analysts",
    label: "Analysts",
    types: ["INTJ", "INTP", "ENTJ", "ENTP"] as const,
    accent: "#CE82FF",
    border: "#A355CF",
    bg: "#F9F0FF",
  },
  {
    id: "diplomats",
    label: "Diplomats",
    types: ["INFJ", "INFP", "ENFJ", "ENFP"] as const,
    accent: "#58CC02",
    border: "#46A302",
    bg: "#F0FDE4",
  },
  {
    id: "sentinels",
    label: "Sentinels",
    types: ["ISTJ", "ISFJ", "ESTJ", "ESFJ"] as const,
    accent: "#1CB0F6",
    border: "#0B8FCC",
    bg: "#E8F7FF",
  },
  {
    id: "explorers",
    label: "Explorers",
    types: ["ISTP", "ISFP", "ESTP", "ESFP"] as const,
    accent: "#FFD900",
    border: "#E5C400",
    bg: "#FFF8E7",
  },
] as const;

export type MbtiType = (typeof MBTI_TEMPERAMENT_GROUPS)[number]["types"][number];

export const MBTI_TYPES: readonly MbtiType[] = MBTI_TEMPERAMENT_GROUPS.flatMap((g) => g.types);

export function isMbtiType(value: string): value is MbtiType {
  return (MBTI_TYPES as readonly string[]).includes(value);
}

export type MbtiAxisId = "ei" | "sn" | "tf" | "jp";

export type MbtiAxisLetter = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";

export type MbtiAxes = Record<MbtiAxisId, MbtiAxisLetter | null>;

export const MBTI_DICHOTOMIES: {
  id: MbtiAxisId;
  label: string;
  left: { letter: MbtiAxisLetter; word: string };
  right: { letter: MbtiAxisLetter; word: string };
  accent: string;
  border: string;
  bg: string;
}[] = [
  {
    id: "ei",
    label: "Energy",
    left: { letter: "E", word: "Extrovert" },
    right: { letter: "I", word: "Introvert" },
    accent: "#FFD900",
    border: "#E5C400",
    bg: "#FFF8E7",
  },
  {
    id: "sn",
    label: "Mind",
    left: { letter: "S", word: "Sensing" },
    right: { letter: "N", word: "Intuition" },
    accent: "#1CB0F6",
    border: "#0B8FCC",
    bg: "#E8F7FF",
  },
  {
    id: "tf",
    label: "Nature",
    left: { letter: "T", word: "Thinking" },
    right: { letter: "F", word: "Feeling" },
    accent: "#CE82FF",
    border: "#A355CF",
    bg: "#F9F0FF",
  },
  {
    id: "jp",
    label: "Tactics",
    left: { letter: "J", word: "Judging" },
    right: { letter: "P", word: "Perceiving" },
    accent: "#58CC02",
    border: "#46A302",
    bg: "#F0FDE4",
  },
];

export const MBTI_TYPE_PROFILES: Record<
  MbtiType,
  { name: string; tagline: string }
> = {
  INTJ: { name: "Architect", tagline: "Imaginative strategist with a plan for everything." },
  INTP: { name: "Logician", tagline: "Innovative thinker with a thirst for knowledge." },
  ENTJ: { name: "Commander", tagline: "Bold leader who loves a good challenge." },
  ENTP: { name: "Debater", tagline: "Clever mind that loves testing ideas." },
  INFJ: { name: "Advocate", tagline: "Quiet visionary guided by deep conviction." },
  INFP: { name: "Mediator", tagline: "Poetic idealist eager to help a good cause." },
  ENFJ: { name: "Protagonist", tagline: "Charismatic leader who inspires others." },
  ENFP: { name: "Campaigner", tagline: "Enthusiastic free spirit—life is full of possibility." },
  ISTJ: { name: "Logistician", tagline: "Practical and fact-minded; reliability you can trust." },
  ISFJ: { name: "Defender", tagline: "Warm protector devoted to those they care about." },
  ESTJ: { name: "Executive", tagline: "Excellent administrator who brings order." },
  ESFJ: { name: "Consul", tagline: "Caring connector who loves harmony." },
  ISTP: { name: "Virtuoso", tagline: "Bold experimenter mastering tools and tactics." },
  ISFP: { name: "Adventurer", tagline: "Flexible artist who lives in the moment." },
  ESTP: { name: "Entrepreneur", tagline: "Smart and energetic—life is never dull." },
  ESFP: { name: "Entertainer", tagline: "Spontaneous entertainer; life is a stage." },
};

const AXIS_ORDER: MbtiAxisId[] = ["ei", "sn", "tf", "jp"];

export function parseMbtiTypeToAxes(type: string): MbtiAxes | null {
  if (!isMbtiType(type)) return null;
  return {
    ei: type[0] as "E" | "I",
    sn: type[1] as "S" | "N",
    tf: type[2] as "T" | "F",
    jp: type[3] as "J" | "P",
  };
}

export function axesToMbtiType(axes: MbtiAxes): MbtiType | null {
  const letters = AXIS_ORDER.map((id) => axes[id]);
  if (letters.some((l) => !l)) return null;
  const code = letters.join("");
  return isMbtiType(code) ? code : null;
}

export function emptyMbtiAxes(): MbtiAxes {
  return { ei: null, sn: null, tf: null, jp: null };
}
