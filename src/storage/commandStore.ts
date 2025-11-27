const STORAGE_KEYS = {
  commands: "commands",
  siteWhitelist: "siteWhitelist",
  version: "version"
} as const;

const STORAGE_VERSION = 1;

const EMPTY_STATE: StorageShape = {
  commands: [],
  siteWhitelist: [],
  version: STORAGE_VERSION
};

const createId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return [
    Date.now().toString(16),
    Math.random().toString(16).slice(2, 10)
  ].join("-");
};

const cloneState = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const readState = (): Promise<StorageShape> =>
  new Promise<StorageShape>((resolve, reject) => {
    chrome.storage.local.get(
      [STORAGE_KEYS.commands, STORAGE_KEYS.siteWhitelist, STORAGE_KEYS.version],
      (raw: Record<string, unknown>) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(lastError);
          return;
        }

        const state: StorageShape = {
          commands: Array.isArray(raw[STORAGE_KEYS.commands])
            ? (raw[STORAGE_KEYS.commands] as Command[])
            : [],
          siteWhitelist: Array.isArray(raw[STORAGE_KEYS.siteWhitelist])
            ? (raw[STORAGE_KEYS.siteWhitelist] as SiteWhitelistEntry[])
            : [],
          version:
            typeof raw[STORAGE_KEYS.version] === "number"
              ? (raw[STORAGE_KEYS.version] as number)
              : 0
        };

        resolve(applyMigrations(state));
      }
    );
  });

const writeState = (next: StorageShape): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    chrome.storage.local.set(
      {
        [STORAGE_KEYS.commands]: next.commands,
        [STORAGE_KEYS.siteWhitelist]: next.siteWhitelist,
        [STORAGE_KEYS.version]: STORAGE_VERSION
      },
      () => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(lastError);
          return;
        }
        resolve();
      }
    );
  });

const applyMigrations = (state: StorageShape): StorageShape => {
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

const exportState = async (): Promise<StorageShape> => cloneState(await readState());

const importState = async (payload: StorageShape): Promise<void> => {
  const state = applyMigrations(payload);
  await writeState(state);
};

const listCommands = async (): Promise<Command[]> => {
  const state = await readState();
  return state.commands.sort((a, b) => a.name.localeCompare(b.name));
};

const createCommand = async (
  payload: Omit<Command, "id" | "createdAt" | "updatedAt">
): Promise<Command> => {
  const state = await readState();
  const now = Date.now();
  const command: Command = {
    ...payload,
    id: createId(),
    createdAt: now,
    updatedAt: now
  };
  state.commands.push(command);
  await writeState(state);
  return command;
};

const updateCommand = async (
  update: CommandUpdate
): Promise<Command | null> => {
  const state = await readState();
  const index = state.commands.findIndex(
    (command) => command.id === update.id
  );
  if (index < 0) {
    return null;
  }

  const updated: Command = {
    ...state.commands[index],
    ...update,
    updatedAt: Date.now()
  };
  state.commands[index] = updated;
  await writeState(state);
  return updated;
};

const deleteCommand = async (id: string): Promise<boolean> => {
  const state = await readState();
  const nextCommands = state.commands.filter((command) => command.id !== id);
  if (nextCommands.length === state.commands.length) {
    return false;
  }
  state.commands = nextCommands;
  await writeState(state);
  return true;
};

const formatHostname = (hostname: string): string =>
  hostname.trim().toLowerCase();

const listWhitelist = async (): Promise<SiteWhitelistEntry[]> => {
  const state = await readState();
  return state.siteWhitelist.sort((a, b) =>
    a.hostname.localeCompare(b.hostname)
  );
};

const addWhitelistEntry = async (
  hostname: string
): Promise<SiteWhitelistEntry> => {
  const normalized = formatHostname(hostname);
  if (!normalized) {
    throw new Error("Hostname is required.");
  }

  const state = await readState();
  const existing = state.siteWhitelist.find(
    (entry) => entry.hostname === normalized
  );
  if (existing) {
    return existing;
  }

  const entry: SiteWhitelistEntry = {
    id: createId(),
    hostname: normalized,
    createdAt: Date.now()
  };
  state.siteWhitelist.push(entry);
  await writeState(state);
  return entry;
};

const removeWhitelistEntry = async (id: string): Promise<boolean> => {
  const state = await readState();
  const next = state.siteWhitelist.filter((entry) => entry.id !== id);
  if (next.length === state.siteWhitelist.length) {
    return false;
  }
  state.siteWhitelist = next;
  await writeState(state);
  return true;
};

const observeStorage = (
  callback: (state: StorageShape) => void
): (() => void) => {
  const listener = async (
    _: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
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

const attachStoreToGlobal = (): void => {
  try {
    const globalTarget = globalThis as typeof globalThis & {
      promptPaletteStore?: PromptPaletteStore;
    };
    globalTarget.promptPaletteStore = exposedStore;
  } catch {
    // no-op: globalThis may be unavailable in some contexts
  }
};

attachStoreToGlobal();

