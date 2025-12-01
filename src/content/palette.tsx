interface PaletteConfig {
  onSelect: (command: Command) => void;
}

class CommandPalette {
  private readonly root: HTMLDivElement;

  private readonly list: HTMLUListElement;

  private readonly onSelect: (command: Command) => void;

  private commands: Command[] = [];

  private activeIndex = 0;

  private isVisible = false;

  constructor(config: PaletteConfig) {
    this.onSelect = config.onSelect;
    this.root = document.createElement("div");
    this.root.className = "prompt-palette";
    this.root.setAttribute("role", "listbox");
    this.root.setAttribute("aria-hidden", "true");

    this.list = document.createElement("ul");
    this.list.className = "prompt-palette__list";
    this.root.appendChild(this.list);

    document.documentElement.appendChild(this.root);
  }

  destroy(): void {
    this.root.remove();
  }

  show(commands: Command[], anchorRect: DOMRect): void {
    if (!commands.length) {
      this.hide();
      return;
    }
    this.commands = commands;
    this.activeIndex = 0;
    this.render();
    this.positionAt(anchorRect);
    this.root.setAttribute("aria-hidden", "false");
    this.root.classList.add("prompt-palette--visible");
    this.isVisible = true;
  }

  hide(): void {
    if (!this.isVisible) {
      return;
    }
    this.isVisible = false;
    this.root.setAttribute("aria-hidden", "true");
    this.root.classList.remove("prompt-palette--visible");
    this.commands = [];
    this.list.innerHTML = "";
  }

  containsNode(node: Node): boolean {
    return this.root.contains(node);
  }

  handleKey(event: KeyboardEvent): boolean {
    if (!this.isVisible) {
      return false;
    }

    if (event.key === "PageDown") {
      this.moveSelection(1);
      event.preventDefault();
      return true;
    }

    if (event.key === "PageUp") {
      this.moveSelection(-1);
      event.preventDefault();
      return true;
    }

    if (event.key === "ArrowDown") {
      this.moveSelection(1);
      event.preventDefault();
      return true;
    }

    if (event.key === "ArrowUp") {
      this.moveSelection(-1);
      event.preventDefault();
      return true;
    }

    if (event.key === "Enter") {
      const command = this.commands[this.activeIndex];
      if (command) {
        this.onSelect(command);
      }
      event.preventDefault();
      return true;
    }

    if (event.key === "Escape") {
      this.hide();
      event.preventDefault();
      return true;
    }

    return false;
  }

  private moveSelection(delta: number): void {
    if (!this.commands.length) {
      return;
    }
    this.activeIndex = (this.activeIndex + delta + this.commands.length) % this.commands.length;
    this.render();
  }

  private render(): void {
    this.list.innerHTML = "";
    this.commands.forEach((command, index) => {
      const item = document.createElement("li");
      item.textContent = command.name;
      item.className = "prompt-palette__item";
      item.id = `prompt-palette-item-${command.id}`;
      if (index === this.activeIndex) {
        item.classList.add("prompt-palette__item--active");
        this.root.setAttribute("aria-activedescendant", item.id);
      }
      item.addEventListener("mousemove", () => {
        if (this.activeIndex === index) {
          return;
        }
        // Only update selection when the user actively moves the pointer
        this.activeIndex = index;
        this.render();
      });
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      item.addEventListener("click", () => this.onSelect(command));
      this.list.appendChild(item);
    });
    this.ensureActiveItemVisible();
  }

  private ensureActiveItemVisible(): void {
    const activeItem = this.list.querySelector(".prompt-palette__item--active");
    if (activeItem instanceof HTMLElement) {
      activeItem.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  private positionAt(anchorRect: DOMRect): void {
    const viewportPadding = 8;
    const top = Math.min(
      window.innerHeight - this.root.offsetHeight - viewportPadding,
      Math.max(viewportPadding, anchorRect.bottom + 6)
    );
    const left = Math.min(
      window.innerWidth - this.root.offsetWidth - viewportPadding,
      Math.max(viewportPadding, anchorRect.left)
    );
    this.root.style.top = `${top}px`;
    this.root.style.left = `${left}px`;
  }
}

const attachPalette = (): void => {
  try {
    const globalTarget = globalThis as typeof globalThis & {
      PromptPaletteUI?: {
        CommandPalette: typeof CommandPalette;
      };
    };
    globalTarget.PromptPaletteUI = {
      ...(globalTarget.PromptPaletteUI ?? {}),
      CommandPalette
    };
  } catch {
    // ignore
  }
};

attachPalette();

