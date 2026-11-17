const readerKey = "ginkgoNoteReader";
const baseUrl = () => `${location.pathname}${location.search}`;
const state = () => history.state && typeof history.state === "object" ? history.state : {};

/** One history entry per reader session; adjacent articles replace that entry. */
export function createNoteNavigation(sync: () => void) {
  function open(id: string) {
    const url = `${baseUrl()}#note=${encodeURIComponent(id)}`;
    if (/^#note=/.test(location.hash)) history.replaceState(state(), "", url);
    else history.pushState({ ...state(), [readerKey]: baseUrl() }, "", url);
    // pushState/replaceState do not emit hashchange.
    sync();
  }
  function close() {
    if (state()[readerKey] === baseUrl()) history.back();
    else {
      // A directly loaded note has no list entry owned by this reader.
      const next = { ...state() };
      delete next[readerKey];
      history.replaceState(next, "", baseUrl());
    }
  }
  window.addEventListener("hashchange", sync);
  return { open, close };
}
