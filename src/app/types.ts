export type ScreenId = "profile" | "new-activity";

export type Cleanup = () => void;

export type ScreenModule = {
  id: ScreenId;
  title: string;
  mount: (root: HTMLElement) => void | Cleanup;
};
