"use strict";
const STORAGE_KEYS = {
    commands: "commands",
    siteWhitelist: "siteWhitelist",
    version: "version"
};
const STORAGE_VERSION = 1;
const EMPTY_STATE = {
    commands: [],
    siteWhitelist: [],
    version: STORAGE_VERSION
};
const createId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return [
        Date.now().toString(16),
        Math.random().toString(16).slice(2, 10)
    ].join("-");
};
const cloneState = (value) => {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
};
const readState = () => new Promise((resolve, reject) => {
    chrome.storage.local.get([STORAGE_KEYS.commands, STORAGE_KEYS.siteWhitelist, STORAGE_KEYS.version], (raw) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
            reject(lastError);
            return;
        }
        const state = {
            commands: Array.isArray(raw[STORAGE_KEYS.commands])
                ? raw[STORAGE_KEYS.commands]
                : [],
            siteWhitelist: Array.isArray(raw[STORAGE_KEYS.siteWhitelist])
                ? raw[STORAGE_KEYS.siteWhitelist]
                : [],
            version: typeof raw[STORAGE_KEYS.version] === "number"
                ? raw[STORAGE_KEYS.version]
                : 0
        };
        resolve(applyMigrations(state));
    });
});
const writeState = (next) => new Promise((resolve, reject) => {
    chrome.storage.local.set({
        [STORAGE_KEYS.commands]: next.commands,
        [STORAGE_KEYS.siteWhitelist]: next.siteWhitelist,
        [STORAGE_KEYS.version]: STORAGE_VERSION
    }, () => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
            reject(lastError);
            return;
        }
        resolve();
    });
});
const applyMigrations = (state) => {
    if (!state) {
        return { ...EMPTY_STATE };
    }
    const commands = Array.isArray(state.commands)
        ? state.commands.map((command) => ({
            ...command,
            id: command.id ?? createId(),
            createdAt: command.createdAt ?? Date.now(),
            updatedAt: command.updatedAt ?? Date.now()
        }))
        : [];
    const siteWhitelist = Array.isArray(state.siteWhitelist)
        ? state.siteWhitelist.map((entry) => ({
            ...entry,
            id: entry.id ?? createId(),
            hostname: entry.hostname?.toLowerCase() ?? "",
            createdAt: entry.createdAt ?? Date.now()
        }))
        : [];
    return {
        commands,
        siteWhitelist,
        version: STORAGE_VERSION
    };
};
const exportState = async () => cloneState(await readState());
const importState = async (payload) => {
    const state = applyMigrations(payload);
    await writeState(state);
};
const listCommands = async () => {
    const state = await readState();
    return state.commands.sort((a, b) => a.name.localeCompare(b.name));
};
const createCommand = async (payload) => {
    const state = await readState();
    const now = Date.now();
    const command = {
        ...payload,
        id: createId(),
        createdAt: now,
        updatedAt: now
    };
    state.commands.push(command);
    await writeState(state);
    return command;
};
const updateCommand = async (update) => {
    const state = await readState();
    const index = state.commands.findIndex((command) => command.id === update.id);
    if (index < 0) {
        return null;
    }
    const updated = {
        ...state.commands[index],
        ...update,
        updatedAt: Date.now()
    };
    state.commands[index] = updated;
    await writeState(state);
    return updated;
};
const deleteCommand = async (id) => {
    const state = await readState();
    const nextCommands = state.commands.filter((command) => command.id !== id);
    if (nextCommands.length === state.commands.length) {
        return false;
    }
    state.commands = nextCommands;
    await writeState(state);
    return true;
};
const formatHostname = (hostname) => hostname.trim().toLowerCase();
const listWhitelist = async () => {
    const state = await readState();
    return state.siteWhitelist.sort((a, b) => a.hostname.localeCompare(b.hostname));
};
const addWhitelistEntry = async (hostname) => {
    const normalized = formatHostname(hostname);
    if (!normalized) {
        throw new Error("Hostname is required.");
    }
    const state = await readState();
    const existing = state.siteWhitelist.find((entry) => entry.hostname === normalized);
    if (existing) {
        return existing;
    }
    const entry = {
        id: createId(),
        hostname: normalized,
        createdAt: Date.now()
    };
    state.siteWhitelist.push(entry);
    await writeState(state);
    return entry;
};
const removeWhitelistEntry = async (id) => {
    const state = await readState();
    const next = state.siteWhitelist.filter((entry) => entry.id !== id);
    if (next.length === state.siteWhitelist.length) {
        return false;
    }
    state.siteWhitelist = next;
    await writeState(state);
    return true;
};
const observeStorage = (callback) => {
    const listener = async (_, areaName) => {
        if (areaName !== "local") {
            return;
        }
        const next = await readState();
        callback(next);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
};
const exposedStore = {
    listCommands,
    createCommand,
    updateCommand,
    deleteCommand,
    listWhitelist,
    addWhitelistEntry,
    removeWhitelistEntry,
    observeStorage,
    exportState,
    importState
};
const attachStoreToGlobal = () => {
    try {
        const globalTarget = globalThis;
        globalTarget.promptPaletteStore = exposedStore;
    }
    catch {
        // no-op: globalThis may be unavailable in some contexts
    }
};
attachStoreToGlobal();
