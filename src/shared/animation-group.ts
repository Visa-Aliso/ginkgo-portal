/** Own temporary effects until their caller commits or cancels the transition. */
export function createAnimationGroup() {
  const running: Animation[] = [];
  return {
    play(target: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
      const animation = target.animate(frames, {
        fill: "both", easing: "cubic-bezier(.22,.65,.18,1)", ...options,
      });
      running.push(animation);
      // Cancellation resolves the wait; callers retain their revision guards.
      return animation.finished.catch(() => undefined);
    },
    cancel() {
      running.forEach(animation => animation.cancel());
      running.length = 0;
    },
    finish() {
      running.forEach(animation => animation.finish());
    },
  };
}
