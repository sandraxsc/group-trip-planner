import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ThumbsUp, ThumbsDown, Users } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { BottomNav } from "../components/BottomNav";
import {
  candidateMatchesMemberSelectedPlaces,
  generateCandidateActivities,
} from "../../services/activityEngine";
import { mergeVoteGapAiSuggestions } from "../../services/voteGapFillService";
import { getMemberPreference } from "../../services/preferenceService";
import {
  getAggregatedVotesByTripId,
  saveMemberVotes,
  getVotesByTripId,
} from "../../services/voteService";
import type { RankedCandidate } from "../../types/activity";
import { getTripMembers } from "../../services/tripService";
import { hydrateTripFromCloud, subscribeTripCloudSync } from "../../services/cloudHydrateService";

const DEFAULT_IMG = "https://images.unsplash.com/photo-1516426122078-c23e76319801?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

type Vote = "up" | "down" | null;

interface VoteActivityItem {
  id: number;
  placeId: string;
  title: string;
  type: string;
  desc: string;
  /** AI gap-fill rationale when this row was added for diversity/pool size */
  aiReason?: string;
  image: string;
  votes: { up: number; down: number };
  duration: string;
  price: string;
}

function applyAggregatedVotes(
  items: VoteActivityItem[],
  aggregated: Record<string, { up: number; down: number }>
): VoteActivityItem[] {
  return items.map((it) => ({
    ...it,
    votes: aggregated[it.placeId] ?? { up: 0, down: 0 },
  }));
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} hr${h > 1 ? "s" : ""}`;
  return `${h}–${h + 1} hrs`;
}

/**
 * Map cost level and optional priceLevel (0–3) to display string.
 * Prefer real priceLevel when available so cards don’t all show the same.
 */
function costLevelToPrice(costLevel: string, priceLevel?: number): string {
  if (priceLevel !== undefined) {
    if (priceLevel <= 0) return "Free";
    if (priceLevel === 1) return "$";
    if (priceLevel === 2) return "$$";
    if (priceLevel >= 3) return "$$$";
  }
  if (costLevel === "low") return "Free–$";
  if (costLevel === "high") return "$$$";
  return "$$";
}

/** Emoji prefix for category; use displayCategoryLabel when available. */
function categoryToTypeLabel(displayCategoryLabel?: string, categories: string[] = []): string {
  if (displayCategoryLabel?.trim()) {
    const emojiMap: Record<string, string> = {
      Museum: "🏛️",
      "Art & Culture": "🎨",
      Beach: "🏖️",
      Temple: "⛩️",
      Park: "🌿",
      Nature: "🌲",
      "Hiking & Outdoors": "🥾",
      "Food & Drink": "🍜",
      Nightlife: "🎉",
      Shopping: "🛍️",
      Wildlife: "🦜",
      Attraction: "✨",
      Viewpoint: "👁️",
      Sports: "⚽",
      Wellness: "💆",
    };
    const emoji = emojiMap[displayCategoryLabel] ?? "✨";
    return `${emoji} ${displayCategoryLabel}`;
  }
  const first = categories[0] ?? "";
  const labels: Record<string, string> = {
    beach: "🏖️ Beach",
    hiking: "🥾 Hiking",
    museum: "🏛️ Museum",
    culture: "🏛️ Culture",
    food: "🍜 Food",
    nightlife: "🎉 Nightlife",
    shopping: "🛍️ Shopping",
    spa: "💆 Wellness",
    adventure: "🪂 Adventure",
    wildlife: "🦜 Wildlife",
    park: "🌿 Park",
    temple: "⛩️ Temple",
  };
  const key = first.toLowerCase().replace(/\s+/g, "");
  for (const [k, label] of Object.entries(labels)) {
    if (key.includes(k) || first.toLowerCase().includes(k)) return label;
  }
  return "✨ Activity";
}

export default function VoteScreen() {
  const navigate = useNavigate();
  const [votes, setVotes] = useState<Record<number, Vote>>({});
  const [showDone, setShowDone] = useState(false);
  const [doneMessage, setDoneMessage] = useState("Generating your trip plan…");
  const [countdown, setCountdown] = useState(3);
  const [activities, setActivities] = useState<VoteActivityItem[]>([]);
  const [allVoteCandidates, setAllVoteCandidates] = useState<RankedCandidate[]>([]);
  const [skippedOwnPickCount, setSkippedOwnPickCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [totalMembers, setTotalMembers] = useState(0);
  const [membersVoted, setMembersVoted] = useState(0);

  const tripId = typeof window !== "undefined" ? sessionStorage.getItem("currentTripId") : null;

  useEffect(() => {
    if (!tripId) {
      setActivities([]);
      setAllVoteCandidates([]);
      setSkippedOwnPickCount(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      // Hydrate first so candidates/members/votes reflect the whole group.
      await hydrateTripFromCloud(tripId, { force: true });
      if (cancelled) return;

      // Load members and vote progress
      const members = getTripMembers(tripId);
      const total = members.length;
      setTotalMembers(total);
      const votesForTrip = getVotesByTripId(tripId);
      const uniqueVoters = new Set(votesForTrip.map((v) => v.memberId));
      setMembersVoted(uniqueVoters.size);

      const memberId =
        typeof window !== "undefined" ? sessionStorage.getItem("currentMemberId") : null;
      const myPlaces =
        tripId && memberId ? getMemberPreference(tripId, memberId)?.selectedPlaces : undefined;

      generateCandidateActivities(tripId)
      .then(async (candidates) => {
        if (cancelled) return;
        let merged = candidates;
        try {
          merged = await mergeVoteGapAiSuggestions(tripId, candidates);
        } catch {
          merged = candidates;
        }
        if (cancelled) return;
        setAllVoteCandidates(merged);

        let toShow = merged;
        if (memberId && myPlaces?.length) {
          const notOwnPick = candidates.filter(
            (c) => !candidateMatchesMemberSelectedPlaces(myPlaces, c)
          );
          const nOwn = candidates.length - notOwnPick.length;
          setSkippedOwnPickCount(nOwn);
          if (notOwnPick.length > 0) {
            toShow = notOwnPick;
          } else {
            setSkippedOwnPickCount(0);
          }
        } else {
          setSkippedOwnPickCount(0);
        }

        const initialItems = toShow.map((c, i) => ({
          id: i,
          placeId: c.placeId,
          title: c.name,
          type: categoryToTypeLabel(c.displayCategoryLabel, c.categories),
          desc: c.description ?? "Explore this place.",
          aiReason: c.aiRecommendationReason?.trim() || undefined,
          image: c.imageUrl ?? DEFAULT_IMG,
          votes: { up: 0, down: 0 },
          duration: formatDuration(c.estimatedDuration),
          price: costLevelToPrice(c.costLevel, c.priceLevel),
        }));

        const aggregated = getAggregatedVotesByTripId(tripId);
        setActivities(
          applyAggregatedVotes(initialItems, aggregated)
        );
      })
      .catch(() => {
        if (!cancelled) {
          setActivities([]);
          setAllVoteCandidates([]);
          setSkippedOwnPickCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  // Keep vote progress in sync across devices (Realtime when enabled).
  useEffect(() => {
    if (!tripId) return;
    return subscribeTripCloudSync(tripId, () => {
      const members = getTripMembers(tripId);
      const votesForTrip = getVotesByTripId(tripId);
      const uniqueVoters = new Set(votesForTrip.map((v) => v.memberId));
      setTotalMembers(members.length);
      setMembersVoted(uniqueVoters.size);
      const aggregated = getAggregatedVotesByTripId(tripId);
      setActivities((prev) => applyAggregatedVotes(prev, aggregated));
    });
  }, [tripId]);

  const vote = (id: number, dir: Vote) => {
    setVotes((prev) => ({ ...prev, [id]: prev[id] === dir ? null : dir }));
  };

  const allVoted = activities.length > 0 && activities.every((a) => votes[a.id] != null);
  const votedCount = activities.filter((a) => votes[a.id] != null).length;
  const hasVotedAny = activities.length > 0 && votedCount > 0;

  const handleBack = () => {
    if (tripId) navigate(`/trips/${tripId}`);
    else navigate("/trip-detail");
  };

  const handleSubmit = () => {
    const memberId = typeof window !== "undefined" ? sessionStorage.getItem("currentMemberId") : null;

    const run = async () => {
      if (!tripId) return;

      if (tripId && memberId) {
        const fromUi = activities
          .filter((a) => votes[a.id] != null)
          .map((a) => ({ placeId: a.placeId, vote: votes[a.id] as "up" | "down" }));

        const myPlaces = getMemberPreference(tripId, memberId)?.selectedPlaces;
        const byPlace = new Map<string, "up" | "down">();
        for (const v of fromUi) {
          byPlace.set(v.placeId, v.vote);
        }
        if (myPlaces?.length) {
          for (const c of allVoteCandidates) {
            if (
              candidateMatchesMemberSelectedPlaces(myPlaces, c) &&
              !byPlace.has(c.placeId)
            ) {
              byPlace.set(c.placeId, "up");
            }
          }
        }

        saveMemberVotes(
          tripId,
          memberId,
          Array.from(byPlace.entries()).map(([placeId, vote]) => ({ placeId, vote }))
        );
      }

      const members = getTripMembers(tripId);
      const total = members.length;
      const votesForTripAfter = getVotesByTripId(tripId);
      const uniqueVotersAfter = new Set(votesForTripAfter.map((v) => v.memberId));
      const uniqueVotersSizeAfter = uniqueVotersAfter.size;

      setTotalMembers(total);
      setMembersVoted(uniqueVotersSizeAfter);

      const allMembersVoted = total > 0 && uniqueVotersSizeAfter >= total;
      setDoneMessage(allMembersVoted ? "Generating your trip plan…" : "Waiting for other members to finish voting…");
      setShowDone(true);
      setCountdown(3);
    };

    void run();
  };

  useEffect(() => {
    if (!showDone) return;
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [showDone, countdown]);

  useEffect(() => {
    if (!showDone) return;
    if (countdown !== 0) return;
    // If itinerary is already present, TripPlanScreen will show it immediately.
    // If not, it will wait until voting is complete.
    navigate("/trip-plan");
  }, [showDone, countdown, navigate]);

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F7] pb-24">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 border-b-2 border-[#E5E5E5]">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_3px_0_#D4D4D4]"
          >
            <ArrowLeft size={20} className="text-[#4B4B4B]" />
          </button>
          <h1 className="font-black text-[#3C3C3C] text-xl">Vote on Activities 🗳️</h1>
        </div>

        {/* Group vote progress */}
        <div className="bg-[#F0FDE4] rounded-2xl p-3 border-2 border-[#58CC02] flex items-center gap-3">
          <Users size={20} className="text-[#58CC02]" />
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-black text-[#2D7800]">Group voting</span>
              <span className="text-xs font-black text-[#58CC02]">
                {membersVoted} / {totalMembers || "?"} voted
              </span>
            </div>
            <div className="h-2 bg-[#D4F5B4] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#58CC02] rounded-full"
                style={{
                  width:
                    totalMembers > 0
                      ? `${Math.max(5, (membersVoted / totalMembers) * 100)}%`
                      : "0%",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {skippedOwnPickCount > 0 && (
        <div className="px-4 pt-3">
          <p className="text-xs font-bold text-[#5C8A00] bg-[#F0FDE4] border-2 border-[#B8E986] rounded-xl px-3 py-2">
            Your own place picks are hidden here and saved as thumbs-up automatically so you can focus on the rest of the list.
          </p>
        </div>
      )}

      {/* Success overlay */}
      {showDone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 mx-6 text-center border-4 border-[#58CC02] shadow-[0_8px_0_#46A302]">
            <span className="text-6xl block mb-4">🎉</span>
            <h2 className="font-black text-[#3C3C3C] text-2xl mb-2">Votes submitted!</h2>
            <p className="font-bold text-[#AFAFAF]">{doneMessage}</p>
            <p className="text-xs font-bold text-[#AFAFAF] mt-2">Redirecting in {countdown}…</p>
          </div>
        </div>
      )}

      <div className="px-4 pt-4 flex flex-col gap-4">
        {loading && (
          <div className="bg-white rounded-2xl border-2 border-[#E5E5E5] p-6 text-center">
            <p className="font-bold text-[#AFAFAF]">Loading activities…</p>
          </div>
        )}
        {!loading && activities.length === 0 && (
          <div className="bg-white rounded-2xl border-2 border-[#E5E5E5] p-6 text-center">
            <p className="font-bold text-[#AFAFAF]">No activities to vote on yet. Set preferences first or add places.</p>
          </div>
        )}
        {!loading && activities.map((act) => {
          const myVote = votes[act.id];
          const upCount = act.votes.up + (myVote === "up" ? 1 : 0);
          const downCount = act.votes.down + (myVote === "down" ? 1 : 0);
          const total = upCount + downCount;
          const upPct = total > 0 ? Math.round((upCount / total) * 100) : 50;

          return (
            <div
              key={act.id}
              className="bg-white rounded-2xl border-2 border-[#E5E5E5] shadow-[0_4px_0_#D4D4D4] overflow-hidden"
            >
              {/* Image */}
              <div className="relative h-40">
                <img src={act.image} alt={act.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
                <div className="absolute top-3 left-3">
                  <span className="bg-black/50 backdrop-blur text-white text-xs font-black px-2 py-1 rounded-full">
                    {act.type}
                  </span>
                </div>
                <div className="absolute top-3 right-3 flex gap-2">
                  <span className="bg-white/90 text-[#3C3C3C] text-xs font-bold px-2 py-1 rounded-full">
                    ⏱ {act.duration}
                  </span>
                  <span className="bg-white/90 text-[#3C3C3C] text-xs font-bold px-2 py-1 rounded-full">
                    💰 {act.price}
                  </span>
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="text-white font-black text-lg">{act.title}</h3>
                </div>
              </div>

              {/* Body */}
              <div className="p-4">
                {act.aiReason ? (
                  <p className="text-xs font-black text-[#4C5FD5] mb-2 leading-snug border-l-[3px] border-[#7C8BED] pl-2">
                    For your group: {act.aiReason}
                  </p>
                ) : null}
                <p className="text-sm font-bold text-[#AFAFAF] mb-3">{act.desc}</p>

                {/* Group vote bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs font-black mb-1">
                    <span className="text-[#58CC02]">👍 {upCount}</span>
                    <span className="text-[#FF4B4B]">👎 {downCount}</span>
                  </div>
                  <div className="h-3 bg-[#FFF0F0] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#58CC02] to-[#89E219] rounded-full transition-all duration-500"
                      style={{ width: `${upPct}%` }}
                    />
                  </div>
                </div>

                {/* Vote buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => vote(act.id, "up")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-b-4 font-black transition-all active:border-b-2 active:translate-y-0.5
                      ${myVote === "up"
                        ? "bg-[#F0FDE4] border-[#46A302] text-[#2D7800] shadow-[0_4px_0_#46A302]"
                        : "bg-white border-[#E5E5E5] text-[#AFAFAF] shadow-[0_4px_0_#D4D4D4]"
                      }`}
                  >
                    <ThumbsUp
                      size={18}
                      fill={myVote === "up" ? "#58CC02" : "none"}
                      className={myVote === "up" ? "text-[#58CC02]" : "text-[#AFAFAF]"}
                    />
                    Yes!
                  </button>
                  <button
                    onClick={() => vote(act.id, "down")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-b-4 font-black transition-all active:border-b-2 active:translate-y-0.5
                      ${myVote === "down"
                        ? "bg-[#FFF0F0] border-[#CC3B3B] text-[#8A1F1F] shadow-[0_4px_0_#CC3B3B]"
                        : "bg-white border-[#E5E5E5] text-[#AFAFAF] shadow-[0_4px_0_#D4D4D4]"
                      }`}
                  >
                    <ThumbsDown
                      size={18}
                      fill={myVote === "down" ? "#FF4B4B" : "none"}
                      className={myVote === "down" ? "text-[#FF4B4B]" : "text-[#AFAFAF]"}
                    />
                    Nope
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Submit */}
        <div className="pb-4">
          {allVoted && (
            <div className="bg-[#FFF8E7] rounded-2xl p-3 border-2 border-[#FFD900] flex items-center gap-3 mb-3">
              <span className="text-2xl">⭐</span>
              <p className="text-sm font-black text-[#9B8000]">You voted on everything! +100 XP</p>
            </div>
          )}
          <DuoButton
            onClick={handleSubmit}
            variant="primary"
            fullWidth
            className="py-4 text-base"
            disabled={!hasVotedAny || loading || activities.length === 0}
          >
            {hasVotedAny ? "🚀 Submit Votes" : "Vote on at least 1 activity"}
          </DuoButton>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
