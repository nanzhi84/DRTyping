export {};

declare global {
  interface Command {
    id: string;
    name: string;
    content: string;
    createdAt: number;
    updatedAt: number;
  }

  interface SiteWhitelistEntry {
    id: string;
    hostname: string;
    createdAt: number;
  }

  interface StorageShape {
    commands: Command[];
    siteWhitelist: SiteWhitelistEntry[];
    version: number;
  }

  type CommandUpdate = Pick<Command, "id"> & Partial<Omit<Command, "id">>;

  interface PromptPaletteStore {
    listCommands(): Promise<Command[]>;
    createCommand(
      payload: Omit<Command, "id" | "createdAt" | "updatedAt">
    ): Promise<Command>;
    updateCommand(update: CommandUpdate): Promise<Command | null>;
    deleteCommand(id: string): Promise<boolean>;
    listWhitelist(): Promise<SiteWhitelistEntry[]>;
    addWhitelistEntry(hostname: string): Promise<SiteWhitelistEntry>;
    removeWhitelistEntry(id: string): Promise<boolean>;
    observeStorage(callback: (state: StorageShape) => void): () => void;
    exportState(): Promise<StorageShape>;
    importState(payload: StorageShape): Promise<void>;
  }
}

