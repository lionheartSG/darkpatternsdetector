/// <reference types="wxt/client-types" />

import { detectPageType } from "@darkpatterns/shared/page-context";
import {
  clearHighlightMarkers,
  enrichHighlightsFromDetections,
  type HighlightDetection,
} from "../extract/highlights";
import { extractPageContent, hookSpaNavigation } from "../extract/page";
import { waitForPageReady } from "../extract/wait-for-page";
import { HighlightOverlay } from "../highlight/overlay";
import type { PageHighlight } from "@darkpatterns/shared/types";
import { isAnalyzableUrl } from "../lib/storage";

const DEBOUNCE_MS = 2000;

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main() {
    if (!isAnalyzableUrl(window.location.href)) {
      return;
    }

    const overlay = new HighlightOverlay();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const analyze = (force = false) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(
        () => {
          debounceTimer = null;

          void (async () => {
            if (!force) {
              const response = (await chrome.runtime.sendMessage({
                type: "SHOULD_ANALYZE",
                url: window.location.href,
              })) as { shouldAnalyze?: boolean } | undefined;

              if (!response?.shouldAnalyze) {
                return;
              }
            }

            overlay.hide();
            clearHighlightMarkers();

            await waitForPageReady();

            const page = extractPageContent();
            void chrome.runtime.sendMessage({
              type: "PAGE_CONTENT",
              ...page,
              force,
            });
          })();
        },
        force ? 0 : DEBOUNCE_MS,
      );
    };

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "ANALYZE_PAGE") {
        analyze(Boolean(message.force));
        return;
      }

      if (message?.type === "SET_PAGE_HIGHLIGHTS") {
        void (async () => {
          const pageType = detectPageType(document);
          const enriched = enrichHighlightsFromDetections(
            (message.highlights as PageHighlight[]) ?? [],
            (message.detections as HighlightDetection[] | undefined) ?? [],
            pageType,
          );

          if (message.visible) {
            overlay.show(enriched);
          } else {
            overlay.hide();
          }

          await chrome.runtime.sendMessage({
            type: "HIGHLIGHTS_UPDATED",
            highlights: enriched,
            reportId: message.reportId as string | undefined,
          });

          sendResponse({ highlights: enriched });
        })();
        return true;
      }

      if (message?.type === "CLEAR_PAGE_HIGHLIGHTS") {
        overlay.hide();
        return;
      }

      if (message?.type === "SCROLL_TO_HIGHLIGHT") {
        const highlight = message.highlight as PageHighlight | undefined;
        const detection = message.detection as HighlightDetection | undefined;
        overlay.scrollToHighlight(
          message.highlightId as string,
          highlight,
          detection,
        );
      }
    });

    hookSpaNavigation(() => {
      overlay.hide();
      clearHighlightMarkers();
      analyze(false);
    });
  },
});
