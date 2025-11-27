(() => {
  const globalContext = globalThis as typeof globalThis & {
    promptPaletteStore?: PromptPaletteStore;
  };
  const store = globalContext.promptPaletteStore;
  if (!store) {
    console.warn("Prompt Palette store not available.");
    return;
  }

  const commandList = document.getElementById("command-list") as HTMLUListElement;
  const whitelistList = document.getElementById("whitelist") as HTMLUListElement;
  const commandForm = document.getElementById("command-form") as HTMLFormElement;
  const whitelistForm = document.getElementById("whitelist-form") as HTMLFormElement;
  const importInput = document.getElementById("import-file") as HTMLInputElement;
  const exportButton = document.getElementById("export-commands") as HTMLButtonElement;
  const resetButton = document.getElementById("reset-command") as HTMLButtonElement;
  const nameInput = document.getElementById("command-name") as HTMLInputElement;
  const contentInput = document.getElementById("command-content") as HTMLTextAreaElement;
  const idInput = document.getElementById("command-id") as HTMLInputElement;

  let commands: Command[] = [];
  let whitelist: SiteWhitelistEntry[] = [];

  const renderCommands = (): void => {
    commandList.innerHTML = "";
    commands.forEach((command) => {
      const item = document.createElement("li");
      item.className = "list__item";

      const details = document.createElement("details");
      details.className = "command-details";

      const summary = document.createElement("summary");
      summary.className = "command-summary";

      const name = document.createElement("span");
      name.textContent = command.name;

      const actions = document.createElement("div");
      actions.className = "list__actions";

      const stopToggle = (event: MouseEvent): void => {
        event.preventDefault();
        event.stopPropagation();
      };

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", (event) => {
        stopToggle(event);
        populateForm(command);
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", async (event) => {
        stopToggle(event);
        if (!confirm(`Delete command "${command.name}"?`)) {
          return;
        }
        await store.deleteCommand(command.id);
        await refreshCommands();
      });

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);
      summary.appendChild(name);
      summary.appendChild(actions);

      const content = document.createElement("pre");
      content.className = "command-content";
      content.textContent = command.content;

      details.appendChild(summary);
      details.appendChild(content);
      item.appendChild(details);
      commandList.appendChild(item);
    });
  };

  const renderWhitelist = (): void => {
    whitelistList.innerHTML = "";
    whitelist.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "list__item";
      const label = document.createElement("span");
      label.textContent = entry.hostname;
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", async () => {
        await store.removeWhitelistEntry(entry.id);
        await refreshWhitelist();
      });
      item.appendChild(label);
      item.appendChild(removeButton);
      whitelistList.appendChild(item);
    });
  };

  const populateForm = (command: Command): void => {
    idInput.value = command.id;
    nameInput.value = command.name;
    contentInput.value = command.content;
    nameInput.focus();
  };

  const resetForm = (): void => {
    idInput.value = "";
    commandForm.reset();
  };

  const refreshCommands = async (): Promise<void> => {
    commands = await store.listCommands();
    renderCommands();
  };

  const refreshWhitelist = async (): Promise<void> => {
    whitelist = await store.listWhitelist();
    renderWhitelist();
  };

  const handleCommandSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    const payload = {
      name: nameInput.value.trim(),
      content: contentInput.value
    };
    if (!payload.name || !payload.content) {
      return;
    }
    if (idInput.value) {
      await store.updateCommand({ id: idInput.value, ...payload });
    } else {
      await store.createCommand(payload);
    }
    resetForm();
    await refreshCommands();
  };

  const handleWhitelistSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    const input = whitelistForm.elements.namedItem("hostname") as HTMLInputElement;
    if (!input.value) {
      return;
    }
    await store.addWhitelistEntry(input.value);
    input.value = "";
    await refreshWhitelist();
  };

  const handleExport = async (): Promise<void> => {
    const data = await store.exportState();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "prompt-palette.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleImport = (): void => {
    const file = importInput.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const payload = JSON.parse(reader.result as string);
        await store.importState(payload);
        await Promise.all([refreshCommands(), refreshWhitelist()]);
      } catch {
        alert("Invalid JSON file.");
      } finally {
        importInput.value = "";
      }
    };
    reader.readAsText(file);
  };

  const init = async (): Promise<void> => {
    commandForm.addEventListener("submit", (event) => {
      void handleCommandSubmit(event);
    });
    whitelistForm.addEventListener("submit", (event) => {
      void handleWhitelistSubmit(event);
    });
    exportButton.addEventListener("click", () => {
      void handleExport();
    });
    importInput.addEventListener("change", handleImport);
    resetButton.addEventListener("click", resetForm);
    await Promise.all([refreshCommands(), refreshWhitelist()]);
  };

  void init();
})();

