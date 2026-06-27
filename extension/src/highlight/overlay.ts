import type { PageHighlight } from "@darkpatterns/shared/types";
import {
  clearHighlightBoxes,
  HIGHLIGHT_BOX_ATTR,
  HIGHLIGHT_ID_ATTR,
  isVisibleHighlightElement,
} from "../extract/highlights";

const SEVERITY_COLORS: Record<
  PageHighlight["severity"],
  { border: string; background: string }
> = {
  HIGH: { border: "#DC2626", background: "rgba(220, 38, 38, 0.14)" },
  MEDIUM: { border: "#D97706", background: "rgba(217, 119, 6, 0.14)" },
  LOW: { border: "#2563EB", background: "rgba(37, 99, 235, 0.12)" },
};

export class HighlightOverlay {
  private highlights: PageHighlight[] = [];
  private visible = false;
  private boundUpdate: (() => void) | null = null;
  private activeHighlightId: string | null = null;
  private rafId: number | null = null;

  show(highlights: PageHighlight[]): void {
    this.highlights = highlights;
    this.visible = highlights.length > 0;
    this.ensureBindings();
    this.render();
  }

  hide(): void {
    this.visible = false;
    this.activeHighlightId = null;
    clearHighlightBoxes();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  scrollToHighlight(highlightId: string): void {
    const element = document.querySelector(
      `[${HIGHLIGHT_ID_ATTR}="${highlightId}"]`,
    );
    if (!(element instanceof HTMLElement)) {
      return;
    }

    this.activeHighlightId = highlightId;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      this.render();
    }, 350);
  }

  private ensureBindings(): void {
    if (this.boundUpdate) {
      return;
    }

    this.boundUpdate = () => {
      if (!this.visible || this.rafId !== null) {
        return;
      }

      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.render();
      });
    };

    document.addEventListener("scroll", this.boundUpdate, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", this.boundUpdate, { passive: true });
  }

  private render(): void {
    if (!this.visible) {
      return;
    }

    clearHighlightBoxes();

    for (const highlight of this.highlights) {
      const element = document.querySelector(
        `[${HIGHLIGHT_ID_ATTR}="${highlight.id}"]`,
      );
      if (!(element instanceof HTMLElement)) {
        continue;
      }
      if (!isVisibleHighlightElement(element)) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }

      const colors = SEVERITY_COLORS[highlight.severity];
      const isActive = highlight.id === this.activeHighlightId;
      const borderWidth = isActive ? 3 : 2;
      const inset = borderWidth + 1;

      const box = document.createElement("div");
      box.setAttribute(HIGHLIGHT_BOX_ATTR, highlight.id);
      box.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "box-sizing:border-box",
        "border-radius:6px",
        `z-index:2147483646`,
        `left:${rect.left - inset}px`,
        `top:${rect.top - inset}px`,
        `width:${rect.width + inset * 2}px`,
        `height:${rect.height + inset * 2}px`,
        `border:${borderWidth}px solid ${colors.border}`,
        `background:${colors.background}`,
      ].join(";");

      const label = document.createElement("div");
      label.textContent = highlight.label;
      label.style.cssText = [
        "position:absolute",
        "top:-24px",
        "left:0",
        `background:${colors.border}`,
        "color:#fff",
        "font:600 11px/1.2 system-ui,sans-serif",
        "padding:4px 8px",
        "border-radius:4px",
        "white-space:nowrap",
        "max-width:240px",
        "overflow:hidden",
        "text-overflow:ellipsis",
      ].join(";");

      box.appendChild(label);
      document.body.appendChild(box);
    }
  }
}
