import { createBrowserRouter } from "react-router";
import Root from "./Root";
import HomeScreen from "./screens/HomeScreen";
import CreateTripScreen from "./screens/CreateTripScreen";
import TripSuccessScreen from "./screens/TripSuccessScreen";
import InviteFriendsScreen from "./screens/InviteFriendsScreen";
import TripDetailScreen from "./screens/TripDetailScreen";
import TripDetailEmptyScreen from "./screens/TripDetailEmptyScreen";
import PreferenceBudgetScreen from "./screens/PreferenceBudgetScreen";
import PreferenceEnergyScreen from "./screens/PreferenceEnergyScreen";
import PreferenceTimeScreen from "./screens/PreferenceTimeScreen";
import PreferenceActivityScreen from "./screens/PreferenceActivityScreen";
import PreferencePlaceScreen from "./screens/PreferencePlaceScreen";
import PreferencePlaceSearchScreen from "./screens/PreferencePlaceSearchScreen";
import PreferenceDealBreakerScreen from "./screens/PreferenceDealBreakerScreen";
import PreferenceMbtiScreen from "./screens/PreferenceMbtiScreen";
import VoteScreen from "./screens/VoteScreen";
import TripPlanScreen from "./screens/TripPlanScreen";
import MemberProfileScreen from "./screens/MemberProfileScreen.tsx";
import ProfileScreen from "./screens/ProfileScreen";
import JoinTripScreen from "./screens/JoinTripScreen";
import JoinSuccessScreen from "./screens/JoinSuccessScreen";


export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: HomeScreen },
      { path: "create-trip", Component: CreateTripScreen },
      { path: "trip-success/:tripId", Component: TripSuccessScreen },
      { path: "trips/:tripId/invite", Component: InviteFriendsScreen },
      { path: "invite-friends", Component: InviteFriendsScreen },
      { path: "trips/:tripId", Component: TripDetailScreen },
      { path: "trips/:tripId/members/:memberId", Component: MemberProfileScreen },
      { path: "join/:token", Component: JoinTripScreen },
      { path: "join/:token/success", Component: JoinSuccessScreen },
      { path: "trip-detail", Component: TripDetailScreen },
      { path: "trip-detail-empty", Component: TripDetailEmptyScreen },
      { path: "preference-budget", Component: PreferenceBudgetScreen },
      { path: "preference-energy", Component: PreferenceEnergyScreen },
      { path: "preference-time", Component: PreferenceTimeScreen },
      { path: "preference-activity", Component: PreferenceActivityScreen },
      { path: "preference-place", Component: PreferencePlaceScreen },
      { path: "preference-place-search", Component: PreferencePlaceSearchScreen },
      { path: "preference-deal-breaker", Component: PreferenceDealBreakerScreen },
      { path: "preference-mbti", Component: PreferenceMbtiScreen },
      { path: "vote", Component: VoteScreen },
      { path: "trip-plan", Component: TripPlanScreen },
      { path: "profile", Component: ProfileScreen },
    ],
  },
]);