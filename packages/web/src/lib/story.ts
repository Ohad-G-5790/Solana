import type { FeedMessage } from "./run";

/**
 * The negotiation happens in the band's browser (no server of ours), so its
 * story is kept there, per tour. On another device the feed shows the chain's
 * side only.
 */
const storyKey = (tour: string) => `greenroom.story.${tour}`;
export function saveStory(tour: string, story: FeedMessage[]): void {
  try {
    window.localStorage.setItem(storyKey(tour), JSON.stringify(story));
  } catch {
    /* storage blocked: the chain's side of the story still shows */
  }
}
export function loadStory(tour: string): FeedMessage[] {
  try {
    return JSON.parse(window.localStorage.getItem(storyKey(tour)) ?? "[]") as FeedMessage[];
  } catch {
    return [];
  }
}
