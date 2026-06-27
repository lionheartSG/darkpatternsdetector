import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  manifest: {
    name: "Dark Patterns Detector",
    description:
      "Check whether a webpage uses pressure tactics or potentially deceptive design cues.",
    version: "0.1.0",
    permissions: ["storage", "tabs", "activeTab", "sidePanel", "scripting"],
    host_permissions: ["http://*/*", "https://*/*"],
    side_panel: {
      default_path: "sidepanel.html",
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
    action: {
      default_title: "Dark Patterns Detector",
    },
  },
});
