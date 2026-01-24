import type { ScreenId, ScreenModule } from "./types";
import { mountHistory } from "../screens/history";
import { mountNewActivity } from "../screens/newActivity";
import { mountProfile } from "../screens/profile";
import { mountTriCoachChat } from "../screens/triCoachChat";
import { mountTriCoachMenu } from "../screens/triCoachMenu";

export const screenOrder: ScreenId[] = [
  "profile",
  "new-activity",
  "history",
  "tricoach-menu",
  "tricoach-chat",
];

export const screens: Record<ScreenId, ScreenModule> = {
  profile: { id: "profile", title: "Profile", mount: mountProfile },
  "new-activity": { id: "new-activity", title: "New Activity", mount: mountNewActivity },
  history: { id: "history", title: "History", mount: mountHistory },
  "tricoach-menu": { id: "tricoach-menu", title: "TriCoach Menu", mount: mountTriCoachMenu },
  "tricoach-chat": { id: "tricoach-chat", title: "TriCoach Chat", mount: mountTriCoachChat },
};
