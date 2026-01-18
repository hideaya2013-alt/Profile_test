import type { ScreenId, ScreenModule } from "./types";
import { mountHistory } from "../screens/history";
import { mountNewActivity } from "../screens/newActivity";
import { mountProfile } from "../screens/profile";

export const screenOrder: ScreenId[] = ["profile", "new-activity", "history"];

export const screens: Record<ScreenId, ScreenModule> = {
  profile: { id: "profile", title: "Profile", mount: mountProfile },
  "new-activity": { id: "new-activity", title: "New Activity", mount: mountNewActivity },
  history: { id: "history", title: "History", mount: mountHistory },
};
