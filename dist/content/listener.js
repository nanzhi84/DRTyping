"use strict";
const CARET_STYLE_PROPS = [
    "direction",
    "boxSizing",
    "width",
    "height",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "fontSizeAdjust",
    "lineHeight",
    "fontFamily",
    "textAlign",
    "textTransform",
    "textIndent",
    "textDecoration",
    "letterSpacing",
    "wordSpacing"
];
const buildMirrorElement = (element) => {
    const mirror = document.createElement("div");
    const style = window.getComputedStyle(element);
    CARET_STYLE_PROPS.forEach((prop) => {
        // @ts-expect-error dynamic assignment for caret mirror
        mirror.style[prop] = style[prop];
    });
    const rect = element.getBoundingClientRect();
    mirror.style.position = "absolute";
    mirror.style.visibility = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordWrap = "break-word";
    mirror.style.top = `${rect.top + window.scrollY}px`;
    mirror.style.left = `${rect.left + window.scrollX}px`;
    mirror.style.pointerEvents = "none";
    mirror.style.overflow = "hidden";
    mirror.textContent = "";
    document.body.appendChild(mirror);
    return mirror;
};
const getTextCaretRect = (element) => {
    const cursor = element.selectionStart ?? 0;
    const mirror = buildMirrorElement(element);
    const textBefore = element.value.slice(0, cursor);
    mirror.textContent = textBefore.replace(/\n$/g, "\n\u200b");
    const caretSpan = document.createElement("span");
    caretSpan.textContent = element.value.slice(cursor) || "\u200b";
    mirror.appendChild(caretSpan);
    const rect = caretSpan.getBoundingClientRect();
    document.body.removeChild(mirror);
    return rect;
};
const HOST_CACHE = new Set();
let allowAllHosts = true;
const globalContext = globalThis;
const store = globalContext.promptPaletteStore;
const PaletteCtor = globalContext.PromptPaletteUI?.CommandPalette;
if (!store || !PaletteCtor) {
    console.warn("Prompt Palette: dependencies missing, content script aborted.");
}
let commands = [];
let palette = null;
let session = null;
const normalizeHost = (host) => host.trim().toLowerCase();
const hydrateWhitelist = async () => {
    if (!store) {
        return;
    }
    const entries = await store.listWhitelist();
    HOST_CACHE.clear();
    entries.forEach((entry) => HOST_CACHE.add(normalizeHost(entry.hostname)));
    allowAllHosts = HOST_CACHE.size === 0;
};
const hydrateCommands = async () => {
    if (!store) {
        return;
    }
    commands = await store.listCommands();
};
const ensureSetup = async () => {
    if (!store || !PaletteCtor) {
        return;
    }
    if (!palette) {
        palette = new PaletteCtor({
            onSelect: handleCommandSelect
        });
    }
    if (!commands.length) {
        await hydrateCommands();
    }
};
const isTextInput = (node) => {
    if (node instanceof HTMLTextAreaElement) {
        return !node.readOnly && !node.disabled;
    }
    if (node instanceof HTMLInputElement) {
        const invalidTypes = new Set(["button", "submit", "checkbox", "radio", "color", "range", "file"]);
        return !node.readOnly && !node.disabled && !invalidTypes.has(node.type);
    }
    return false;
};
const isEditableElement = (target) => {
    if (!(target instanceof Element)) {
        return false;
    }
    if (isTextInput(target)) {
        return true;
    }
    return target instanceof HTMLElement && target.isContentEditable;
};
const hostIsAllowed = () => {
    if (allowAllHosts) {
        return true;
    }
    return HOST_CACHE.has(normalizeHost(window.location.hostname));
};
const computeAnchorRect = (element) => {
    if (isTextInput(element)) {
        return getTextCaretRect(element);
    }
    const selection = window.getSelection();
    if (element instanceof HTMLElement && element.isContentEditable && selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rects = range.getClientRects();
        if (rects.length) {
            return rects[rects.length - 1];
        }
    }
    const rect = element.getBoundingClientRect();
    return new DOMRect(rect.left, rect.top, rect.width, rect.height);
};
const resetSession = () => {
    session = null;
    palette?.hide();
};
const startTextSession = (element) => {
    const cursor = element.selectionStart;
    if (cursor === null || cursor < 1) {
        return;
    }
    const previousChar = cursor >= 2 ? element.value.charAt(cursor - 2) : "";
    if (previousChar === "/") {
        resetSession();
        return;
    }
    session = {
        type: "text",
        element,
        slashIndex: cursor - 1,
        pointerRect: computeAnchorRect(element)
    };
    palette?.show(commands, session.pointerRect);
};
const startContentSession = (element) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return;
    }
    const range = selection.getRangeAt(0).cloneRange();
    if (range.startOffset === 0) {
        return;
    }
    range.setStart(range.startContainer, range.startOffset - 1);
    const anchorNode = selection.anchorNode;
    const anchorOffset = selection.anchorOffset ?? 0;
    const anchorText = anchorNode && anchorNode.textContent ? anchorNode.textContent : "";
    if (typeof anchorOffset === "number" &&
        anchorOffset >= 2 &&
        anchorText.charAt(anchorOffset - 2) === "/") {
        resetSession();
        return;
    }
    session = {
        type: "content",
        element,
        range,
        pointerRect: computeAnchorRect(element)
    };
    palette?.show(commands, session.pointerRect);
};
const isSlashInputEvent = (event) => {
    if (event.inputType !== "insertText") {
        return false;
    }
    return event.data === "/";
};
const handleInput = async (event) => {
    if (!hostIsAllowed()) {
        return;
    }
    if (!(event instanceof InputEvent)) {
        return;
    }
    const target = event.target;
    if (!isEditableElement(target)) {
        return;
    }
    await ensureSetup();
    if (isSlashInputEvent(event)) {
        if (isTextInput(target)) {
            startTextSession(target);
        }
        else if (target.isContentEditable) {
            startContentSession(target);
        }
        return;
    }
    if (!session || session.element !== target) {
        return;
    }
    const query = readQueryForSession(session);
    if (query === null) {
        resetSession();
        return;
    }
    if (query.length > 0) {
        resetSession();
        return;
    }
    session.pointerRect = computeAnchorRect(session.element);
    palette?.show(commands, session.pointerRect);
};
const readQueryForSession = (current) => {
    if (current.type === "text") {
        const { element, slashIndex } = current;
        const cursor = element.selectionStart;
        if (cursor === null || cursor < slashIndex + 1) {
            return null;
        }
        const raw = element.value.slice(slashIndex + 1, cursor);
        if (/\s/.test(raw)) {
            return null;
        }
        return raw;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }
    const range = selection.getRangeAt(0).cloneRange();
    const working = current.range.cloneRange();
    working.setEnd(range.endContainer, range.endOffset);
    const raw = working.toString().slice(1);
    if (/\s/.test(raw)) {
        return null;
    }
    return raw;
};
const handleCommandSelect = (command) => {
    if (!session) {
        return;
    }
    if (session.type === "text") {
        insertIntoTextInput(session, command.content);
    }
    else {
        insertIntoContentEditable(session, command.content);
    }
    resetSession();
};
const insertIntoTextInput = (current, content) => {
    const { element, slashIndex } = current;
    const start = slashIndex;
    const cursor = element.selectionEnd ?? element.selectionStart ?? start + 1;
    const before = element.value.slice(0, start);
    const after = element.value.slice(cursor);
    const nextValue = `${before}${content}${after}`;
    element.value = nextValue;
    const position = before.length + content.length;
    element.setSelectionRange(position, position);
    element.dispatchEvent(new Event("input", { bubbles: true }));
};
const insertIntoContentEditable = (current, content) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return;
    }
    const activeRange = selection.getRangeAt(0);
    const range = current.range.cloneRange();
    range.setEnd(activeRange.endContainer, activeRange.endOffset);
    range.deleteContents();
    const textNode = document.createTextNode(content);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
};
const handleKeyDown = (event) => {
    if (!palette || !session) {
        return;
    }
    if (palette.handleKey(event)) {
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
        }
        return;
    }
    if (event.key === " ") {
        resetSession();
    }
};
const handleClick = (event) => {
    if (!session) {
        return;
    }
    const target = event.target;
    if (!(target instanceof Node)) {
        resetSession();
        return;
    }
    if (session.element.contains(target)) {
        return;
    }
    if (palette?.containsNode(target)) {
        return;
    }
    resetSession();
};
const handleStorageChange = (state) => {
    commands = state.commands;
    HOST_CACHE.clear();
    state.siteWhitelist.forEach((entry) => HOST_CACHE.add(normalizeHost(entry.hostname)));
    allowAllHosts = HOST_CACHE.size === 0;
};
const bootstrap = async () => {
    if (!store) {
        return;
    }
    await hydrateWhitelist();
    await hydrateCommands();
    await ensureSetup();
    document.addEventListener("input", (event) => {
        void handleInput(event);
    }, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("click", handleClick, true);
    store.observeStorage(handleStorageChange);
};
if (store && PaletteCtor) {
    void bootstrap();
}
