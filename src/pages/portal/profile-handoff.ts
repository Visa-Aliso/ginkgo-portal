type Animate = (node: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) => Promise<unknown>;

/** Fade the stationary scene into the document background before navigation. */
export async function leaveForProfile(veil: HTMLElement, run: Animate) {
  await run(veil, [{ opacity: 0 }, { opacity: 1 }], {
    duration: 800,
    easing: "ease-in-out",
  });
}
