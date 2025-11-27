"use strict";
class CommandPalette {
    constructor(config) {
        this.commands = [];
        this.activeIndex = 0;
        this.isVisible = false;
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
    destroy() {
        this.root.remove();
    }
    show(commands, anchorRect) {
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
    hide() {
        if (!this.isVisible) {
            return;
        }
        this.isVisible = false;
        this.root.setAttribute("aria-hidden", "true");
        this.root.classList.remove("prompt-palette--visible");
        this.commands = [];
        this.list.innerHTML = "";
    }
    handleKey(event) {
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
    moveSelection(delta) {
        if (!this.commands.length) {
            return;
        }
        this.activeIndex = (this.activeIndex + delta + this.commands.length) % this.commands.length;
        this.render();
    }
    render() {
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
            item.addEventListener("mouseenter", () => {
                this.activeIndex = index;
                this.render();
            });
            item.addEventListener("mousedown", (event) => {
                event.preventDefault();
            });
            item.addEventListener("click", () => this.onSelect(command));
            this.list.appendChild(item);
        });
    }
    positionAt(anchorRect) {
        const viewportPadding = 8;
        const top = Math.min(window.innerHeight - this.root.offsetHeight - viewportPadding, Math.max(viewportPadding, anchorRect.bottom + 6));
        const left = Math.min(window.innerWidth - this.root.offsetWidth - viewportPadding, Math.max(viewportPadding, anchorRect.left));
        this.root.style.top = `${top}px`;
        this.root.style.left = `${left}px`;
    }
}
const attachPalette = () => {
    try {
        const globalTarget = globalThis;
        globalTarget.PromptPaletteUI = {
            ...(globalTarget.PromptPaletteUI ?? {}),
            CommandPalette
        };
    }
    catch {
        // ignore
    }
};
attachPalette();
