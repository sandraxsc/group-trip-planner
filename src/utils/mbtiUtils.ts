export interface MBTITravelSignals {
  planningStyle: "structured" | "flexible" | null;
  groupOrientation: "prefers_group" | "comfortable_splitting" | null;
  decisionStyle: "logic_first" | "harmony_first" | null;
  noveltyPreference: "familiar_and_concrete" | "novel_and_varied" | null;
  scheduleRigidity: "needs_clear_plan" | "accept_open_days" | null;
  conflictApproach: "direct_resolution" | "seeks_compromise" | null;
  energyFromPeople: "gains" | "drains" | null;
}

export function mbtiToTravelSignals(mbti: string | null): MBTITravelSignals {
  if (!mbti) {
    return {
      planningStyle: null,
      groupOrientation: null,
      decisionStyle: null,
      noveltyPreference: null,
      scheduleRigidity: null,
      conflictApproach: null,
      energyFromPeople: null,
    };
  }

  const type = mbti.toUpperCase();
  return {
    planningStyle: type.includes("J") ? "structured" : "flexible",
    scheduleRigidity: type.includes("J") ? "needs_clear_plan" : "accept_open_days",
    groupOrientation: type.includes("E") ? "prefers_group" : "comfortable_splitting",
    energyFromPeople: type.includes("E") ? "gains" : "drains",
    noveltyPreference: type.includes("S") ? "familiar_and_concrete" : "novel_and_varied",
    decisionStyle: type.includes("T") ? "logic_first" : "harmony_first",
    conflictApproach: type.includes("T") ? "direct_resolution" : "seeks_compromise",
  };
}
