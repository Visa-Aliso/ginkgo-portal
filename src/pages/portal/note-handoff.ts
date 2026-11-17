type Animate = (node: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) => Promise<unknown>;

/** One moving surface: settle the original, replace it in place, then expand. */
export async function expandNoteSurface(paper: HTMLElement, front: HTMLElement, veil: HTMLElement, page: HTMLElement, run: Animate) {
  const settling = [run(front, [
    { transform: getComputedStyle(front).transform },
    { transform: "none" },
  ], { duration: 280, easing: "cubic-bezier(.22,.65,.18,1)" })];
  for (const node of paper.querySelectorAll<HTMLElement>(".qp-note-layer, .qp-titles, .qp-arrow, .qp-ink")) {
    settling.push(run(node, [{ opacity: getComputedStyle(node).opacity }, { opacity: 0 }], { duration: 240 }));
  }
  // These promises reject on cancellation; never hand off an interrupted paper.
  await Promise.all(settling);
  const bounds = page.getBoundingClientRect();
  const surface = front.getBoundingClientRect();
  const scaleX = surface.width / bounds.width, scaleY = surface.height / bounds.height;
  const from = `translate(${surface.left - bounds.left}px, ${surface.top - bounds.top}px) scale(${scaleX}, ${scaleY})`;
  const radius = parseFloat(getComputedStyle(front).borderTopLeftRadius) || 0;
  const corners = `${radius / scaleX}px / ${radius / scaleY}px`;
  // These writes happen in one task, before paint. The old paper cannot peek
  // from beneath a second, differently sized rectangle on narrow screens.
  veil.style.transform = from;
  veil.style.borderRadius = corners;
  veil.style.opacity = "1";
  paper.classList.add("qp-handoff");
  await run(veil, [
    { transform: from, borderRadius: corners, opacity: 1 },
    { transform: "none", borderRadius: "0", opacity: 1 },
  ], { duration: 850, easing: "cubic-bezier(.48,.02,.25,1)" });
  // Preserve the full-page frame when navigation cancels the finished animation.
  veil.style.transform = "none";
  veil.style.borderRadius = "0";
}
