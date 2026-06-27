var background = (function() {
	//#region ../node_modules/wxt/dist/utils/define-background.mjs
	function defineBackground(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region ../shared/heuristics/index.ts
	var URGENCY_PATTERNS = [
		/countdown/i,
		/deal ends (in|soon|today)/i,
		/limited time only/i,
		/offer expires/i,
		/ends in \d+/i,
		/sale ends/i,
		/ends today/i,
		/last chance/i,
		/flash sale/i
	];
	var SCARCITY_PATTERNS = [
		/in stock/i,
		/only \d+ left/i,
		/only \d+ remaining/i,
		/low stock/i,
		/selling fast/i,
		/high demand/i,
		/people (are )?viewing/i,
		/in \d+ carts?/i,
		/almost sold out/i,
		/limited quantity/i,
		/few left/i,
		/left in stock/i
	];
	var SOCIAL_PROOF_PATTERNS = [
		/people (are )?viewing/i,
		/bought in the last/i,
		/someone just purchased/i,
		/recent(ly)? purchased/i,
		/\d+ (people|users|customers) (are )?(viewing|watching)/i
	];
	var CONFIRMSHAMING_PATTERNS = [
		/no thanks,? i hate saving/i,
		/i don['']t want a discount/i,
		/no,? i['']ll pay full price/i,
		/continue without/i
	];
	var PRESELECTION_PATTERNS = [
		/pre-checked/i,
		/checked by default/i,
		/opt.?out/i
	];
	function matchPatterns(text, patterns) {
		return patterns.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
	}
	function pressureText(visibleText, interactiveHtml, pageType) {
		if (pageType === "editorial") return interactiveHtml;
		return `${visibleText}\n${interactiveHtml}`;
	}
	function hasActiveTimer(html) {
		return /countdown|timer|ends in \d+/i.test(html) && (/class="[^"]*(countdown|timer)[^"]*"/i.test(html) || /data-countdown|role="timer"/i.test(html) || /ends in \d+/i.test(html));
	}
	function detectUrgency(visibleText, html, pageType = "general") {
		const matches = matchPatterns(pressureText(visibleText, html, pageType), URGENCY_PATTERNS);
		if (matches.length === 0) return [];
		const timerDetected = hasActiveTimer(html);
		return [{
			category: "URGENCY",
			patternType: timerDetected ? "CountdownTimer" : "LimitedTimeMessage",
			severity: timerDetected ? "HIGH" : "MEDIUM",
			description: timerDetected ? "Potential urgency cue detected. Countdown timers are common in marketing, but can create time pressure." : "Potential urgency cue detected. This may encourage faster decision-making.",
			evidence: matches.slice(0, 2).join("; "),
			confidence: timerDetected ? .85 : .7,
			source: "heuristic"
		}];
	}
	function detectScarcity(visibleText, pageType = "general", interactiveHtml = "") {
		const text = pageType === "editorial" ? interactiveHtml : visibleText;
		const matches = matchPatterns(text, SCARCITY_PATTERNS);
		if (matches.length === 0) return [];
		const isLowStock = /only \d+ left|low stock|almost sold out|in stock/i.test(text);
		return [{
			category: "SCARCITY",
			patternType: isLowStock ? "LowStockMessage" : "HighDemandMessage",
			severity: "MEDIUM",
			description: isLowStock ? "Possible scarcity cue detected. Scarcity messages may be useful when accurate, but are hard for users to verify." : "Possible scarcity cue detected. High-demand messaging may exaggerate scarcity.",
			evidence: matches.slice(0, 2).join("; "),
			confidence: .75,
			source: "heuristic"
		}];
	}
	function detectSocialProof(visibleText, pageType = "general", interactiveHtml = "") {
		const matches = matchPatterns(pageType === "editorial" ? interactiveHtml : visibleText, SOCIAL_PROOF_PATTERNS);
		if (matches.length === 0) return [];
		return [{
			category: "SOCIAL_PROOF",
			patternType: "ActivityNotifications",
			severity: "MEDIUM",
			description: "Possible social proof cue detected. Visitor count messages may create social proof.",
			evidence: matches.slice(0, 2).join("; "),
			confidence: .7,
			source: "heuristic"
		}];
	}
	function detectConfirmshaming(visibleText, pageType = "general", interactiveHtml = "") {
		const matches = matchPatterns(pageType === "editorial" ? interactiveHtml : visibleText, CONFIRMSHAMING_PATTERNS);
		if (matches.length === 0) return [];
		return [{
			category: "FORCED_ACTION",
			patternType: "Confirmshaming",
			severity: "MEDIUM",
			description: "Possible pressure cue detected in decline or opt-out wording.",
			evidence: matches.slice(0, 2).join("; "),
			confidence: .75,
			source: "heuristic"
		}];
	}
	function detectPreselection(html) {
		const hasCheckedInput = /<input[^>]*\bchecked\b/i.test(html);
		const matches = matchPatterns(html, PRESELECTION_PATTERNS);
		if (!hasCheckedInput && matches.length === 0) return [];
		return [{
			category: "PRESELECTION",
			patternType: "PreCheckedBox",
			severity: "MEDIUM",
			description: "Possible preselection cue detected. Pre-selected options can nudge users toward add-ons or marketing consent.",
			evidence: hasCheckedInput ? "Pre-checked input elements detected in page markup." : matches.join("; "),
			confidence: hasCheckedInput ? .8 : .65,
			source: "heuristic"
		}];
	}
	function detectObstruction(html, pageType = "general") {
		if (pageType === "editorial") return [];
		if (!(/position:\s*(fixed|sticky)/i.test(html) || /class="[^"]*(modal|popup|overlay|sticky-banner)[^"]*"/i.test(html))) return [];
		return [{
			category: "OBSTRUCTION",
			patternType: "StickyPressureBanner",
			severity: "MEDIUM",
			description: "Possible obstruction cue detected. Sticky banners or overlays may keep checkout pressure visible.",
			evidence: "Fixed or sticky overlay-like elements detected.",
			confidence: .65,
			source: "heuristic"
		}];
	}
	function runHeuristics(page) {
		const pageType = page.pageType ?? "general";
		return [
			...detectUrgency(page.visibleText, page.interactiveHtml, pageType),
			...detectScarcity(page.visibleText, pageType, page.interactiveHtml),
			...detectSocialProof(page.visibleText, pageType, page.interactiveHtml),
			...detectConfirmshaming(page.visibleText, pageType, page.interactiveHtml),
			...detectPreselection(page.interactiveHtml),
			...detectObstruction(page.interactiveHtml, pageType)
		];
	}
	//#endregion
	//#region ../shared/wording/index.ts
	var PROHIBITED_WORDS = [
		"scam",
		"fraud",
		"criminal",
		"illegal",
		"cheating",
		"dishonest seller",
		"predatory business",
		"predatory",
		"deceptive company"
	];
	function concernLevelFromScore(score) {
		if (score === null) return "UNABLE";
		if (score >= 70) return "HIGH";
		if (score >= 50) return "MODERATE";
		if (score >= 25) return "SOME";
		return "LOW";
	}
	function suggestedActionForCategory(category) {
		switch (category) {
			case "URGENCY": return "Consider revisiting the page later to check whether the offer changes.";
			case "SCARCITY": return "Compare availability on another channel before deciding.";
			case "SOCIAL_PROOF": return "Treat visitor or purchase counts as unverified social cues.";
			case "PRESELECTION": return "Review pre-selected options carefully before continuing.";
			case "FORCED_ACTION": return "Look for a clear way to decline without penalty.";
			default: return "Consider checking independently before paying.";
		}
	}
	function sanitizeText(text) {
		let result = text;
		for (const word of PROHIBITED_WORDS) {
			const pattern = new RegExp(`\\b${word}\\b`, "gi");
			result = result.replace(pattern, "potential pressure cue");
		}
		return result;
	}
	//#endregion
	//#region src/lib/excluded-hosts.ts
	/** Browser-internal pages that are never scanned. */
	var EXCLUDED_URL_PREFIXES = [
		"chrome://",
		"chrome-untrusted://",
		"chrome-extension://",
		"about:",
		"edge://",
		"brave://"
	];
	/** Popular sites skipped by auto-scan (email, chat, social, streaming, etc.). */
	var EXCLUDED_HOSTS = [
		"google.com",
		"gmail.com",
		"youtube.com",
		"facebook.com",
		"instagram.com",
		"meta.com",
		"messenger.com",
		"threads.net",
		"whatsapp.com",
		"microsoft.com",
		"outlook.com",
		"live.com",
		"hotmail.com",
		"office.com",
		"office365.com",
		"apple.com",
		"icloud.com",
		"twitter.com",
		"x.com",
		"linkedin.com",
		"tiktok.com",
		"reddit.com",
		"pinterest.com",
		"snapchat.com",
		"discord.com",
		"slack.com",
		"telegram.org",
		"t.me",
		"zoom.us",
		"zoom.com",
		"yahoo.com",
		"proton.me",
		"protonmail.com",
		"netflix.com",
		"spotify.com",
		"amazon.com",
		"bing.com"
	];
	function isExcludedUrl(url) {
		if (!url) return true;
		const lower = url.toLowerCase();
		for (const prefix of EXCLUDED_URL_PREFIXES) if (lower.startsWith(prefix)) return true;
		try {
			return isExcludedHost(new URL(url).hostname);
		} catch {
			return true;
		}
	}
	function isExcludedHost(hostname) {
		const host = hostname.toLowerCase();
		for (const excluded of EXCLUDED_HOSTS) if (host === excluded || host.endsWith(`.${excluded}`)) return true;
		return false;
	}
	//#endregion
	//#region src/lib/storage.ts
	var DEFAULT_SETTINGS = {
		termsAcceptedAt: null,
		autoScanEnabled: true,
		apiBaseUrl: "http://localhost:3000",
		apiKey: ""
	};
	function normalizeUrlForCache(url) {
		const parsed = new URL(url);
		parsed.hash = "";
		parsed.hostname = parsed.hostname.toLowerCase();
		return parsed.toString();
	}
	function urlsMatchForCache(a, b) {
		try {
			return normalizeUrlForCache(a) === normalizeUrlForCache(b);
		} catch {
			return a === b;
		}
	}
	async function getSettings() {
		const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
		return {
			...DEFAULT_SETTINGS,
			...stored
		};
	}
	async function getTabReport(tabId) {
		const key = `tabReport:${tabId}`;
		return (await chrome.storage.session.get(key))[key] ?? null;
	}
	async function setTabReport(tabId, state) {
		const key = `tabReport:${tabId}`;
		await chrome.storage.session.set({ [key]: state });
	}
	async function getUrlReportCache(url) {
		const key = `urlReport:${normalizeUrlForCache(url)}`;
		return (await chrome.storage.local.get(key))[key]?.report ?? null;
	}
	async function setUrlReportCache(url, report) {
		const normalizedUrl = normalizeUrlForCache(url);
		const key = `urlReport:${normalizedUrl}`;
		await chrome.storage.local.set({ [key]: {
			normalizedUrl,
			report,
			cachedAt: Date.now()
		} });
	}
	async function clearUrlReportCache(url) {
		const normalizedUrl = normalizeUrlForCache(url);
		await chrome.storage.local.remove(`urlReport:${normalizedUrl}`);
	}
	function isAnalyzableUrl(url) {
		if (!url) return false;
		if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
		return !isExcludedUrl(url);
	}
	//#endregion
	//#region src/api/client.ts
	async function fetchCachedReportFromBackend(url) {
		const settings = await getSettings();
		const endpoint = `${settings.apiBaseUrl.replace(/\/$/, "")}/api/extension/cache?url=${encodeURIComponent(url)}`;
		try {
			const response = await fetch(endpoint, { headers: { ...settings.apiKey ? { "X-Extension-Key": settings.apiKey } : {} } });
			if (response.status === 404) return null;
			const data = await response.json();
			if (!response.ok || !data.ok) return null;
			return data.scan;
		} catch {
			return null;
		}
	}
	async function analyzeWithBackend(payload, force = false) {
		const settings = await getSettings();
		const baseUrl = settings.apiBaseUrl.replace(/\/$/, "");
		const response = await fetch(`${baseUrl}/api/extension/analyze`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...settings.apiKey ? { "X-Extension-Key": settings.apiKey } : {}
			},
			body: JSON.stringify({
				...payload,
				scannedAt: (/* @__PURE__ */ new Date()).toISOString(),
				source: "chrome-extension",
				force
			})
		});
		const data = await response.json();
		if (!response.ok || !data.ok) throw new Error("error" in data ? data.error : "Unable to analyze this page.");
		return data;
	}
	//#endregion
	//#region src/entrypoints/background.ts
	var debounceTimers = /* @__PURE__ */ new Map();
	var inFlightUrls = /* @__PURE__ */ new Set();
	var pendingHighlights = /* @__PURE__ */ new Map();
	var DEBOUNCE_MS = 2e3;
	function notifyTabReportUpdated(tabId) {
		chrome.runtime.sendMessage({
			type: "TAB_REPORT_UPDATED",
			tabId
		}).catch(() => {});
	}
	async function updateTabReport(tabId, state) {
		await setTabReport(tabId, state);
		notifyTabReportUpdated(tabId);
	}
	function concernBadgeText(level) {
		switch (level) {
			case "HIGH": return "!";
			case "MODERATE": return "M";
			case "SOME": return "S";
			case "LOW": return "OK";
			default: return "?";
		}
	}
	async function updateBadge(tabId, concernLevel, analyzing = false) {
		if (analyzing) {
			await chrome.action.setBadgeText({
				tabId,
				text: "…"
			});
			await chrome.action.setBadgeBackgroundColor({
				tabId,
				color: "#1E40AF"
			});
			return;
		}
		if (!concernLevel) {
			await chrome.action.setBadgeText({
				tabId,
				text: ""
			});
			return;
		}
		await chrome.action.setBadgeText({
			tabId,
			text: concernBadgeText(concernLevel)
		});
		const color = concernLevel === "HIGH" ? "#DC2626" : concernLevel === "MODERATE" ? "#D97706" : concernLevel === "SOME" ? "#3B82F6" : "#16A34A";
		await chrome.action.setBadgeBackgroundColor({
			tabId,
			color
		});
	}
	function buildLocalFallbackReport(url, pageTitle, heuristicSignals) {
		const riskScore = heuristicSignals.length === 0 ? 5 : Math.min(100, Math.round(heuristicSignals.reduce((sum, signal) => {
			return sum + (signal.severity === "HIGH" ? 45 : signal.severity === "MEDIUM" ? 25 : 10) * signal.confidence;
		}, 0)));
		return {
			id: "local",
			url,
			normalizedUrl: url,
			status: "COMPLETED",
			riskScore,
			concernLevel: concernLevelFromScore(riskScore),
			summary: sanitizeText(heuristicSignals.length > 0 ? `We found ${heuristicSignals.length} potential pressure cues locally. Backend sync failed — findings were not saved.` : "Unable to assess this page right now."),
			pageTitle,
			completedAt: (/* @__PURE__ */ new Date()).toISOString(),
			detections: heuristicSignals.map((signal, index) => ({
				id: `local-${index}`,
				category: signal.category,
				patternType: signal.patternType,
				severity: signal.severity,
				description: sanitizeText(signal.description),
				evidence: signal.evidence,
				confidence: signal.confidence,
				suggestedAction: suggestedActionForCategory(signal.category)
			}))
		};
	}
	function isScanNewerThan(candidate, current) {
		if (candidate.id === current.id) return false;
		return (candidate.completedAt ? new Date(candidate.completedAt).getTime() : 0) >= (current.completedAt ? new Date(current.completedAt).getTime() : 0);
	}
	async function syncHighlightsToTab(tabId, highlights, visible, detections = [], reportId) {
		try {
			if (!visible) {
				await chrome.tabs.sendMessage(tabId, { type: "CLEAR_PAGE_HIGHLIGHTS" });
				return;
			}
			if (highlights.length === 0 && detections.length === 0) {
				await chrome.tabs.sendMessage(tabId, { type: "CLEAR_PAGE_HIGHLIGHTS" });
				return;
			}
			await chrome.tabs.sendMessage(tabId, {
				type: "SET_PAGE_HIGHLIGHTS",
				highlights,
				detections,
				visible: true,
				reportId
			});
		} catch {}
	}
	async function applyCachedReport(tabId, report, highlights = []) {
		await updateTabReport(tabId, {
			status: "complete",
			report,
			highlights
		});
		await updateBadge(tabId, report.concernLevel);
		await syncHighlightsToTab(tabId, highlights, highlights.length > 0 || report.detections.length > 0, report.detections, report.id);
	}
	async function hydrateTabFromCache(tabId, url) {
		const existing = await getTabReport(tabId);
		if (existing?.status === "analyzing") return true;
		let cached = await getUrlReportCache(url);
		if (!cached) {
			cached = await fetchCachedReportFromBackend(url);
			if (cached) await setUrlReportCache(url, cached);
		}
		if (!cached) return existing?.status === "complete" && urlsMatchForCache(existing.report.normalizedUrl ?? existing.report.url, url);
		if (existing?.status === "complete" && urlsMatchForCache(existing.report.normalizedUrl ?? existing.report.url, cached.normalizedUrl ?? cached.url) && !isScanNewerThan(cached, existing.report)) return true;
		await applyCachedReport(tabId, cached);
		return true;
	}
	async function runAnalysis(tabId, payload, force = false) {
		const settings = await getSettings();
		if (!settings.termsAcceptedAt) return;
		if (!settings.autoScanEnabled && !force) return;
		if (!isAnalyzableUrl(payload.url)) return;
		if (!force) {
			if (await hydrateTabFromCache(tabId, payload.url)) return;
		} else await clearUrlReportCache(payload.url);
		if (inFlightUrls.has(normalizeUrlForCache(payload.url)) && !force) return;
		inFlightUrls.add(normalizeUrlForCache(payload.url));
		const heuristicSignals = runHeuristics({
			visibleText: payload.visibleText,
			interactiveHtml: payload.interactiveHtml,
			pageType: payload.pageType
		});
		await updateTabReport(tabId, { status: "analyzing" });
		await updateBadge(tabId, null, true);
		await syncHighlightsToTab(tabId, [], false);
		const highlights = pendingHighlights.get(tabId) ?? [];
		try {
			const result = await analyzeWithBackend({
				url: payload.url,
				pageTitle: payload.pageTitle,
				visibleText: payload.visibleText,
				interactiveHtml: payload.interactiveHtml,
				pageType: payload.pageType,
				heuristicSignals
			}, force);
			await setUrlReportCache(payload.url, result.scan);
			await applyCachedReport(tabId, result.scan, highlights);
		} catch {
			const fallback = buildLocalFallbackReport(payload.url, payload.pageTitle, heuristicSignals);
			await setUrlReportCache(payload.url, fallback);
			await applyCachedReport(tabId, fallback, highlights);
		} finally {
			pendingHighlights.delete(tabId);
			inFlightUrls.delete(normalizeUrlForCache(payload.url));
		}
	}
	function scheduleAnalysis(tabId, payload, force = false) {
		const existing = debounceTimers.get(tabId);
		if (existing) clearTimeout(existing);
		debounceTimers.set(tabId, setTimeout(() => {
			debounceTimers.delete(tabId);
			runAnalysis(tabId, payload, force);
		}, DEBOUNCE_MS));
	}
	var background_default = defineBackground(() => {
		chrome.runtime.onInstalled.addListener(() => {
			chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
		});
		chrome.tabs.onActivated.addListener((activeInfo) => {
			(async () => {
				const tab = await chrome.tabs.get(activeInfo.tabId);
				if (!isAnalyzableUrl(tab.url)) {
					await updateBadge(activeInfo.tabId, null);
					await updateTabReport(activeInfo.tabId, { status: "idle" });
					await syncHighlightsToTab(activeInfo.tabId, [], false);
					return;
				}
				await hydrateTabFromCache(activeInfo.tabId, tab.url);
				const state = await getTabReport(activeInfo.tabId);
				if (state?.status === "complete") {
					const highlights = state.highlights ?? [];
					const detections = state.report.detections;
					if (highlights.length > 0 || detections.length > 0) await syncHighlightsToTab(activeInfo.tabId, highlights, true, detections, state.report.id);
				}
			})();
		});
		chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
			if (changeInfo.status !== "complete") return;
			if (!isAnalyzableUrl(tab.url)) return;
			(async () => {
				if (await hydrateTabFromCache(tabId, tab.url)) return;
				const existing = await getTabReport(tabId);
				if (existing?.status === "complete" && urlsMatchForCache(existing.report.normalizedUrl ?? existing.report.url, tab.url)) return;
				chrome.tabs.sendMessage(tabId, { type: "ANALYZE_PAGE" }).catch(() => {});
			})();
		});
		chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
			if (message?.type === "PAGE_CONTENT") {
				const tabId = sender.tab?.id;
				if (!tabId) return;
				if (!isAnalyzableUrl(message.url)) {
					sendResponse({ ok: true });
					return true;
				}
				scheduleAnalysis(tabId, {
					url: message.url,
					pageTitle: message.pageTitle,
					visibleText: message.visibleText,
					interactiveHtml: message.interactiveHtml,
					pageType: message.pageType ?? "general"
				}, Boolean(message.force));
				pendingHighlights.set(tabId, message.highlights ?? []);
				sendResponse({ ok: true });
				return true;
			}
			if (message?.type === "RESCAN_PAGE") {
				(async () => {
					const tabId = message.tabId ?? sender.tab?.id ?? (await chrome.tabs.query({
						active: true,
						currentWindow: true
					}))[0]?.id;
					if (!tabId) {
						sendResponse({
							ok: false,
							error: "No active tab found."
						});
						return;
					}
					const tab = await chrome.tabs.get(tabId);
					if (!isAnalyzableUrl(tab.url)) {
						sendResponse({
							ok: false,
							error: "This page is not eligible for scanning."
						});
						return;
					}
					await clearUrlReportCache(tab.url);
					await updateTabReport(tabId, { status: "analyzing" });
					await updateBadge(tabId, null, true);
					await syncHighlightsToTab(tabId, [], false);
					pendingHighlights.delete(tabId);
					try {
						await chrome.tabs.sendMessage(tabId, {
							type: "ANALYZE_PAGE",
							force: true
						});
						sendResponse({ ok: true });
					} catch {
						sendResponse({
							ok: false,
							error: "Could not reach this page. Try refreshing the tab, then rescan."
						});
					}
				})();
				return true;
			}
			if (message?.type === "SHOULD_ANALYZE") {
				const tabId = sender.tab?.id;
				if (!tabId) {
					sendResponse({ shouldAnalyze: false });
					return true;
				}
				(async () => {
					const url = message.url;
					if (!isAnalyzableUrl(url)) {
						sendResponse({ shouldAnalyze: false });
						return;
					}
					sendResponse({ shouldAnalyze: !await hydrateTabFromCache(tabId, url) });
				})();
				return true;
			}
			if (message?.type === "HIGHLIGHTS_UPDATED") {
				const tabId = sender.tab?.id;
				if (!tabId) return;
				(async () => {
					const state = await getTabReport(tabId);
					if (state?.status !== "complete") return;
					const reportId = message.reportId;
					if (reportId && state.report.id !== reportId) return;
					await updateTabReport(tabId, {
						...state,
						highlights: message.highlights
					});
				})();
				return true;
			}
			if (message?.type === "TOGGLE_PAGE_HIGHLIGHTS") {
				(async () => {
					const tabId = message.tabId ?? (await chrome.tabs.query({
						active: true,
						currentWindow: true
					}))[0]?.id;
					if (!tabId) {
						sendResponse({
							ok: false,
							error: "No active tab found."
						});
						return;
					}
					const state = await getTabReport(tabId);
					const highlights = state?.status === "complete" ? state.highlights ?? [] : [];
					const detections = state?.status === "complete" ? state.report.detections : [];
					await syncHighlightsToTab(tabId, highlights, Boolean(message.visible), detections, state?.status === "complete" ? state.report.id : void 0);
					sendResponse({ ok: true });
				})();
				return true;
			}
			if (message?.type === "SCROLL_TO_HIGHLIGHT") {
				(async () => {
					const tabId = message.tabId ?? (await chrome.tabs.query({
						active: true,
						currentWindow: true
					}))[0]?.id;
					if (!tabId) {
						sendResponse({
							ok: false,
							error: "No active tab found."
						});
						return;
					}
					try {
						await chrome.tabs.sendMessage(tabId, {
							type: "SCROLL_TO_HIGHLIGHT",
							highlightId: message.highlightId
						});
						sendResponse({ ok: true });
					} catch {
						sendResponse({
							ok: false,
							error: "Could not scroll to highlight on this page."
						});
					}
				})();
				return true;
			}
			return false;
		});
	});
	//#endregion
	//#region ../node_modules/wxt/dist/browser.mjs
	/**
	* Contains the `browser` export which you should use to access the extension
	* APIs in your project:
	*
	* ```ts
	* import { browser } from 'wxt/browser';
	*
	* browser.runtime.onInstalled.addListener(() => {
	*   // ...
	* });
	* ```
	*
	* @module wxt/browser
	*/
	var browser = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
	//#endregion
	//#region ../node_modules/@webext-core/match-patterns/lib/index.js
	var _MatchPattern = class {
		constructor(matchPattern) {
			if (matchPattern === "<all_urls>") {
				this.isAllUrls = true;
				this.protocolMatches = [..._MatchPattern.PROTOCOLS];
				this.hostnameMatch = "*";
				this.pathnameMatch = "*";
			} else {
				const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
				if (groups == null) throw new InvalidMatchPattern(matchPattern, "Incorrect format");
				const [_, protocol, hostname, pathname] = groups;
				validateProtocol(matchPattern, protocol);
				validateHostname(matchPattern, hostname);
				this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
				this.hostnameMatch = hostname;
				this.pathnameMatch = pathname;
			}
		}
		includes(url) {
			if (this.isAllUrls) return true;
			const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
			return !!this.protocolMatches.find((protocol) => {
				if (protocol === "http") return this.isHttpMatch(u);
				if (protocol === "https") return this.isHttpsMatch(u);
				if (protocol === "file") return this.isFileMatch(u);
				if (protocol === "ftp") return this.isFtpMatch(u);
				if (protocol === "urn") return this.isUrnMatch(u);
			});
		}
		isHttpMatch(url) {
			return url.protocol === "http:" && this.isHostPathMatch(url);
		}
		isHttpsMatch(url) {
			return url.protocol === "https:" && this.isHostPathMatch(url);
		}
		isHostPathMatch(url) {
			if (!this.hostnameMatch || !this.pathnameMatch) return false;
			const hostnameMatchRegexs = [this.convertPatternToRegex(this.hostnameMatch), this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))];
			const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
			return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
		}
		isFileMatch(url) {
			throw Error("Not implemented: file:// pattern matching. Open a PR to add support");
		}
		isFtpMatch(url) {
			throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
		}
		isUrnMatch(url) {
			throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
		}
		convertPatternToRegex(pattern) {
			const starsReplaced = this.escapeForRegex(pattern).replace(/\\\*/g, ".*");
			return RegExp(`^${starsReplaced}$`);
		}
		escapeForRegex(string) {
			return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
	};
	var MatchPattern = _MatchPattern;
	MatchPattern.PROTOCOLS = [
		"http",
		"https",
		"file",
		"ftp",
		"urn"
	];
	var InvalidMatchPattern = class extends Error {
		constructor(matchPattern, reason) {
			super(`Invalid match pattern "${matchPattern}": ${reason}`);
		}
	};
	function validateProtocol(matchPattern, protocol) {
		if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*") throw new InvalidMatchPattern(matchPattern, `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`);
	}
	function validateHostname(matchPattern, hostname) {
		if (hostname.includes(":")) throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
		if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*.")) throw new InvalidMatchPattern(matchPattern, `If using a wildcard (*), it must go at the start of the hostname`);
	}
	//#endregion
	//#region \0virtual:wxt-background-entrypoint?/home/lionheartsg/project/scamwebsitedetector/extension/src/entrypoints/background.ts
	function print(method, ...args) {
		if (typeof args[0] === "string") method(`[wxt] ${args.shift()}`, ...args);
		else method("[wxt]", ...args);
	}
	/** Wrapper around `console` with a "[wxt]" prefix */
	var logger = {
		debug: (...args) => print(console.debug, ...args),
		log: (...args) => print(console.log, ...args),
		warn: (...args) => print(console.warn, ...args),
		error: (...args) => print(console.error, ...args)
	};
	var ws;
	/** Connect to the websocket and listen for messages. */
	function getDevServerWebSocket() {
		if (ws == null) {
			const serverUrl = "ws://localhost:3001";
			logger.debug("Connecting to dev server @", serverUrl);
			ws = new WebSocket(serverUrl, "vite-hmr");
			ws.addWxtEventListener = ws.addEventListener.bind(ws);
			ws.sendCustom = (event, payload) => ws?.send(JSON.stringify({
				type: "custom",
				event,
				payload
			}));
			ws.addEventListener("open", () => {
				logger.debug("Connected to dev server");
			});
			ws.addEventListener("close", () => {
				logger.debug("Disconnected from dev server");
			});
			ws.addEventListener("error", (event) => {
				logger.error("Failed to connect to dev server", event);
			});
			ws.addEventListener("message", (e) => {
				try {
					const message = JSON.parse(e.data);
					if (message.type === "custom") ws?.dispatchEvent(new CustomEvent(message.event, { detail: message.data }));
				} catch (err) {
					logger.error("Failed to handle message", err);
				}
			});
		}
		return ws;
	}
	/** https://developer.chrome.com/blog/longer-esw-lifetimes/ */
	function keepServiceWorkerAlive() {
		setInterval(async () => {
			await browser.runtime.getPlatformInfo();
		}, 5e3);
	}
	function reloadContentScript(payload) {
		if (browser.runtime.getManifest().manifest_version == 2) reloadContentScriptMv2(payload);
		else reloadContentScriptMv3(payload);
	}
	async function reloadContentScriptMv3({ registration, contentScript }) {
		if (registration === "runtime") await reloadRuntimeContentScriptMv3(contentScript);
		else await reloadManifestContentScriptMv3(contentScript);
	}
	async function reloadManifestContentScriptMv3(contentScript) {
		const id = `wxt:${contentScript.js[0]}`;
		logger.log("Reloading content script:", contentScript);
		const registered = await browser.scripting.getRegisteredContentScripts();
		logger.debug("Existing scripts:", registered);
		const existing = registered.find((cs) => cs.id === id);
		if (existing) {
			logger.debug("Updating content script", existing);
			await browser.scripting.updateContentScripts([{
				...contentScript,
				id,
				css: contentScript.css ?? []
			}]);
		} else {
			logger.debug("Registering new content script...");
			await browser.scripting.registerContentScripts([{
				...contentScript,
				id,
				css: contentScript.css ?? []
			}]);
		}
		await reloadTabsForContentScript(contentScript);
	}
	async function reloadRuntimeContentScriptMv3(contentScript) {
		logger.log("Reloading content script:", contentScript);
		const registered = await browser.scripting.getRegisteredContentScripts();
		logger.debug("Existing scripts:", registered);
		const matches = registered.filter((cs) => {
			const hasJs = contentScript.js?.find((js) => cs.js?.includes(js));
			const hasCss = contentScript.css?.find((css) => cs.css?.includes(css));
			return hasJs || hasCss;
		});
		if (matches.length === 0) {
			logger.log("Content script is not registered yet, nothing to reload", contentScript);
			return;
		}
		await browser.scripting.updateContentScripts(matches);
		await reloadTabsForContentScript(contentScript);
	}
	async function reloadTabsForContentScript(contentScript) {
		const allTabs = await browser.tabs.query({});
		const matchPatterns = contentScript.matches.map((match) => new MatchPattern(match));
		const matchingTabs = allTabs.filter((tab) => {
			const url = tab.url;
			if (!url) return false;
			return !!matchPatterns.find((pattern) => pattern.includes(url));
		});
		await Promise.all(matchingTabs.map(async (tab) => {
			try {
				await browser.tabs.reload(tab.id);
			} catch (err) {
				logger.warn("Failed to reload tab:", err);
			}
		}));
	}
	async function reloadContentScriptMv2(_payload) {
		throw Error("TODO: reloadContentScriptMv2");
	}
	try {
		const ws = getDevServerWebSocket();
		ws.addWxtEventListener("wxt:reload-extension", () => {
			browser.runtime.reload();
		});
		ws.addWxtEventListener("wxt:reload-content-script", (event) => {
			reloadContentScript(event.detail);
		});
		ws.addEventListener("open", () => ws.sendCustom("wxt:background-initialized"));
		keepServiceWorkerAlive();
	} catch (err) {
		logger.error("Failed to setup web socket connection with dev server", err);
	}
	browser.commands.onCommand.addListener((command) => {
		if (command === "wxt:reload-extension") browser.runtime.reload();
	});
	var result;
	try {
		result = background_default.main();
		if (result instanceof Promise) console.warn("The background's main() function return a promise, but it must be synchronous");
	} catch (err) {
		logger.error("The background crashed on startup!");
		throw err;
	}
	//#endregion
	return result;
})();

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsIm5hbWVzIjpbImJyb3dzZXIiXSwic291cmNlcyI6WyIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWJhY2tncm91bmQubWpzIiwiLi4vLi4vLi4vc2hhcmVkL2hldXJpc3RpY3MvaW5kZXgudHMiLCIuLi8uLi8uLi9zaGFyZWQvd29yZGluZy9pbmRleC50cyIsIi4uLy4uL3NyYy9saWIvZXhjbHVkZWQtaG9zdHMudHMiLCIuLi8uLi9zcmMvbGliL3N0b3JhZ2UudHMiLCIuLi8uLi9zcmMvYXBpL2NsaWVudC50cyIsIi4uLy4uL3NyYy9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0B3eHQtZGV2L2Jyb3dzZXIvc3JjL2luZGV4Lm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad2ViZXh0LWNvcmUvbWF0Y2gtcGF0dGVybnMvbGliL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vI3JlZ2lvbiBzcmMvdXRpbHMvZGVmaW5lLWJhY2tncm91bmQudHNcbmZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG5cdGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuXHRyZXR1cm4gYXJnO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBkZWZpbmVCYWNrZ3JvdW5kIH07XG4iLCJpbXBvcnQgdHlwZSB7IEhldXJpc3RpY1NpZ25hbCwgUGFnZVR5cGUgfSBmcm9tIFwiLi4vdHlwZXMvc2NhblwiO1xuXG5jb25zdCBVUkdFTkNZX1BBVFRFUk5TID0gW1xuICAvY291bnRkb3duL2ksXG4gIC9kZWFsIGVuZHMgKGlufHNvb258dG9kYXkpL2ksXG4gIC9saW1pdGVkIHRpbWUgb25seS9pLFxuICAvb2ZmZXIgZXhwaXJlcy9pLFxuICAvZW5kcyBpbiBcXGQrL2ksXG4gIC9zYWxlIGVuZHMvaSxcbiAgL2VuZHMgdG9kYXkvaSxcbiAgL2xhc3QgY2hhbmNlL2ksXG4gIC9mbGFzaCBzYWxlL2ksXG5dO1xuXG5jb25zdCBTQ0FSQ0lUWV9QQVRURVJOUyA9IFtcbiAgL2luIHN0b2NrL2ksXG4gIC9vbmx5IFxcZCsgbGVmdC9pLFxuICAvb25seSBcXGQrIHJlbWFpbmluZy9pLFxuICAvbG93IHN0b2NrL2ksXG4gIC9zZWxsaW5nIGZhc3QvaSxcbiAgL2hpZ2ggZGVtYW5kL2ksXG4gIC9wZW9wbGUgKGFyZSApP3ZpZXdpbmcvaSxcbiAgL2luIFxcZCsgY2FydHM/L2ksXG4gIC9hbG1vc3Qgc29sZCBvdXQvaSxcbiAgL2xpbWl0ZWQgcXVhbnRpdHkvaSxcbiAgL2ZldyBsZWZ0L2ksXG4gIC9sZWZ0IGluIHN0b2NrL2ksXG5dO1xuXG5jb25zdCBTT0NJQUxfUFJPT0ZfUEFUVEVSTlMgPSBbXG4gIC9wZW9wbGUgKGFyZSApP3ZpZXdpbmcvaSxcbiAgL2JvdWdodCBpbiB0aGUgbGFzdC9pLFxuICAvc29tZW9uZSBqdXN0IHB1cmNoYXNlZC9pLFxuICAvcmVjZW50KGx5KT8gcHVyY2hhc2VkL2ksXG4gIC9cXGQrIChwZW9wbGV8dXNlcnN8Y3VzdG9tZXJzKSAoYXJlICk/KHZpZXdpbmd8d2F0Y2hpbmcpL2ksXG5dO1xuXG5jb25zdCBDT05GSVJNU0hBTUlOR19QQVRURVJOUyA9IFtcbiAgL25vIHRoYW5rcyw/IGkgaGF0ZSBzYXZpbmcvaSxcbiAgL2kgZG9uWycnXXQgd2FudCBhIGRpc2NvdW50L2ksXG4gIC9ubyw/IGlbJyddbGwgcGF5IGZ1bGwgcHJpY2UvaSxcbiAgL2NvbnRpbnVlIHdpdGhvdXQvaSxcbl07XG5cbmNvbnN0IFBSRVNFTEVDVElPTl9QQVRURVJOUyA9IFtcbiAgL3ByZS1jaGVja2VkL2ksXG4gIC9jaGVja2VkIGJ5IGRlZmF1bHQvaSxcbiAgL29wdC4/b3V0L2ksXG5dO1xuXG5mdW5jdGlvbiBtYXRjaFBhdHRlcm5zKHRleHQ6IHN0cmluZywgcGF0dGVybnM6IFJlZ0V4cFtdKTogc3RyaW5nW10ge1xuICByZXR1cm4gcGF0dGVybnNcbiAgICAuZmlsdGVyKChwYXR0ZXJuKSA9PiBwYXR0ZXJuLnRlc3QodGV4dCkpXG4gICAgLm1hcCgocGF0dGVybikgPT4gcGF0dGVybi5zb3VyY2UpO1xufVxuXG5mdW5jdGlvbiBwcmVzc3VyZVRleHQoXG4gIHZpc2libGVUZXh0OiBzdHJpbmcsXG4gIGludGVyYWN0aXZlSHRtbDogc3RyaW5nLFxuICBwYWdlVHlwZTogUGFnZVR5cGUsXG4pOiBzdHJpbmcge1xuICBpZiAocGFnZVR5cGUgPT09IFwiZWRpdG9yaWFsXCIpIHtcbiAgICByZXR1cm4gaW50ZXJhY3RpdmVIdG1sO1xuICB9XG4gIHJldHVybiBgJHt2aXNpYmxlVGV4dH1cXG4ke2ludGVyYWN0aXZlSHRtbH1gO1xufVxuXG5mdW5jdGlvbiBoYXNBY3RpdmVUaW1lcihodG1sOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIChcbiAgICAvY291bnRkb3dufHRpbWVyfGVuZHMgaW4gXFxkKy9pLnRlc3QoaHRtbCkgJiZcbiAgICAoL2NsYXNzPVwiW15cIl0qKGNvdW50ZG93bnx0aW1lcilbXlwiXSpcIi9pLnRlc3QoaHRtbCkgfHxcbiAgICAgIC9kYXRhLWNvdW50ZG93bnxyb2xlPVwidGltZXJcIi9pLnRlc3QoaHRtbCkgfHxcbiAgICAgIC9lbmRzIGluIFxcZCsvaS50ZXN0KGh0bWwpKVxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0VXJnZW5jeShcbiAgdmlzaWJsZVRleHQ6IHN0cmluZyxcbiAgaHRtbDogc3RyaW5nLFxuICBwYWdlVHlwZTogUGFnZVR5cGUgPSBcImdlbmVyYWxcIixcbik6IEhldXJpc3RpY1NpZ25hbFtdIHtcbiAgY29uc3QgcGF0dGVyblNvdXJjZSA9IHByZXNzdXJlVGV4dCh2aXNpYmxlVGV4dCwgaHRtbCwgcGFnZVR5cGUpO1xuICBjb25zdCBtYXRjaGVzID0gbWF0Y2hQYXR0ZXJucyhwYXR0ZXJuU291cmNlLCBVUkdFTkNZX1BBVFRFUk5TKTtcbiAgaWYgKG1hdGNoZXMubGVuZ3RoID09PSAwKSByZXR1cm4gW107XG5cbiAgY29uc3QgdGltZXJEZXRlY3RlZCA9IGhhc0FjdGl2ZVRpbWVyKGh0bWwpO1xuXG4gIHJldHVybiBbXG4gICAge1xuICAgICAgY2F0ZWdvcnk6IFwiVVJHRU5DWVwiLFxuICAgICAgcGF0dGVyblR5cGU6IHRpbWVyRGV0ZWN0ZWQgPyBcIkNvdW50ZG93blRpbWVyXCIgOiBcIkxpbWl0ZWRUaW1lTWVzc2FnZVwiLFxuICAgICAgc2V2ZXJpdHk6IHRpbWVyRGV0ZWN0ZWQgPyBcIkhJR0hcIiA6IFwiTUVESVVNXCIsXG4gICAgICBkZXNjcmlwdGlvbjogdGltZXJEZXRlY3RlZFxuICAgICAgICA/IFwiUG90ZW50aWFsIHVyZ2VuY3kgY3VlIGRldGVjdGVkLiBDb3VudGRvd24gdGltZXJzIGFyZSBjb21tb24gaW4gbWFya2V0aW5nLCBidXQgY2FuIGNyZWF0ZSB0aW1lIHByZXNzdXJlLlwiXG4gICAgICAgIDogXCJQb3RlbnRpYWwgdXJnZW5jeSBjdWUgZGV0ZWN0ZWQuIFRoaXMgbWF5IGVuY291cmFnZSBmYXN0ZXIgZGVjaXNpb24tbWFraW5nLlwiLFxuICAgICAgZXZpZGVuY2U6IG1hdGNoZXMuc2xpY2UoMCwgMikuam9pbihcIjsgXCIpLFxuICAgICAgY29uZmlkZW5jZTogdGltZXJEZXRlY3RlZCA/IDAuODUgOiAwLjcsXG4gICAgICBzb3VyY2U6IFwiaGV1cmlzdGljXCIsXG4gICAgfSxcbiAgXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRldGVjdFNjYXJjaXR5KFxuICB2aXNpYmxlVGV4dDogc3RyaW5nLFxuICBwYWdlVHlwZTogUGFnZVR5cGUgPSBcImdlbmVyYWxcIixcbiAgaW50ZXJhY3RpdmVIdG1sID0gXCJcIixcbik6IEhldXJpc3RpY1NpZ25hbFtdIHtcbiAgY29uc3QgdGV4dCA9XG4gICAgcGFnZVR5cGUgPT09IFwiZWRpdG9yaWFsXCIgPyBpbnRlcmFjdGl2ZUh0bWwgOiB2aXNpYmxlVGV4dDtcbiAgY29uc3QgbWF0Y2hlcyA9IG1hdGNoUGF0dGVybnModGV4dCwgU0NBUkNJVFlfUEFUVEVSTlMpO1xuICBpZiAobWF0Y2hlcy5sZW5ndGggPT09IDApIHJldHVybiBbXTtcblxuICBjb25zdCBpc0xvd1N0b2NrID0gL29ubHkgXFxkKyBsZWZ0fGxvdyBzdG9ja3xhbG1vc3Qgc29sZCBvdXR8aW4gc3RvY2svaS50ZXN0KFxuICAgIHRleHQsXG4gICk7XG4gIHJldHVybiBbXG4gICAge1xuICAgICAgY2F0ZWdvcnk6IFwiU0NBUkNJVFlcIixcbiAgICAgIHBhdHRlcm5UeXBlOiBpc0xvd1N0b2NrID8gXCJMb3dTdG9ja01lc3NhZ2VcIiA6IFwiSGlnaERlbWFuZE1lc3NhZ2VcIixcbiAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgZGVzY3JpcHRpb246IGlzTG93U3RvY2tcbiAgICAgICAgPyBcIlBvc3NpYmxlIHNjYXJjaXR5IGN1ZSBkZXRlY3RlZC4gU2NhcmNpdHkgbWVzc2FnZXMgbWF5IGJlIHVzZWZ1bCB3aGVuIGFjY3VyYXRlLCBidXQgYXJlIGhhcmQgZm9yIHVzZXJzIHRvIHZlcmlmeS5cIlxuICAgICAgICA6IFwiUG9zc2libGUgc2NhcmNpdHkgY3VlIGRldGVjdGVkLiBIaWdoLWRlbWFuZCBtZXNzYWdpbmcgbWF5IGV4YWdnZXJhdGUgc2NhcmNpdHkuXCIsXG4gICAgICBldmlkZW5jZTogbWF0Y2hlcy5zbGljZSgwLCAyKS5qb2luKFwiOyBcIiksXG4gICAgICBjb25maWRlbmNlOiAwLjc1LFxuICAgICAgc291cmNlOiBcImhldXJpc3RpY1wiLFxuICAgIH0sXG4gIF07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZXRlY3RTb2NpYWxQcm9vZihcbiAgdmlzaWJsZVRleHQ6IHN0cmluZyxcbiAgcGFnZVR5cGU6IFBhZ2VUeXBlID0gXCJnZW5lcmFsXCIsXG4gIGludGVyYWN0aXZlSHRtbCA9IFwiXCIsXG4pOiBIZXVyaXN0aWNTaWduYWxbXSB7XG4gIGNvbnN0IHRleHQgPVxuICAgIHBhZ2VUeXBlID09PSBcImVkaXRvcmlhbFwiID8gaW50ZXJhY3RpdmVIdG1sIDogdmlzaWJsZVRleHQ7XG4gIGNvbnN0IG1hdGNoZXMgPSBtYXRjaFBhdHRlcm5zKHRleHQsIFNPQ0lBTF9QUk9PRl9QQVRURVJOUyk7XG4gIGlmIChtYXRjaGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuXG4gIHJldHVybiBbXG4gICAge1xuICAgICAgY2F0ZWdvcnk6IFwiU09DSUFMX1BST09GXCIsXG4gICAgICBwYXR0ZXJuVHlwZTogXCJBY3Rpdml0eU5vdGlmaWNhdGlvbnNcIixcbiAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgZGVzY3JpcHRpb246XG4gICAgICAgIFwiUG9zc2libGUgc29jaWFsIHByb29mIGN1ZSBkZXRlY3RlZC4gVmlzaXRvciBjb3VudCBtZXNzYWdlcyBtYXkgY3JlYXRlIHNvY2lhbCBwcm9vZi5cIixcbiAgICAgIGV2aWRlbmNlOiBtYXRjaGVzLnNsaWNlKDAsIDIpLmpvaW4oXCI7IFwiKSxcbiAgICAgIGNvbmZpZGVuY2U6IDAuNyxcbiAgICAgIHNvdXJjZTogXCJoZXVyaXN0aWNcIixcbiAgICB9LFxuICBdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0Q29uZmlybXNoYW1pbmcoXG4gIHZpc2libGVUZXh0OiBzdHJpbmcsXG4gIHBhZ2VUeXBlOiBQYWdlVHlwZSA9IFwiZ2VuZXJhbFwiLFxuICBpbnRlcmFjdGl2ZUh0bWwgPSBcIlwiLFxuKTogSGV1cmlzdGljU2lnbmFsW10ge1xuICBjb25zdCB0ZXh0ID1cbiAgICBwYWdlVHlwZSA9PT0gXCJlZGl0b3JpYWxcIiA/IGludGVyYWN0aXZlSHRtbCA6IHZpc2libGVUZXh0O1xuICBjb25zdCBtYXRjaGVzID0gbWF0Y2hQYXR0ZXJucyh0ZXh0LCBDT05GSVJNU0hBTUlOR19QQVRURVJOUyk7XG4gIGlmIChtYXRjaGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuXG4gIHJldHVybiBbXG4gICAge1xuICAgICAgY2F0ZWdvcnk6IFwiRk9SQ0VEX0FDVElPTlwiLFxuICAgICAgcGF0dGVyblR5cGU6IFwiQ29uZmlybXNoYW1pbmdcIixcbiAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgZGVzY3JpcHRpb246XG4gICAgICAgIFwiUG9zc2libGUgcHJlc3N1cmUgY3VlIGRldGVjdGVkIGluIGRlY2xpbmUgb3Igb3B0LW91dCB3b3JkaW5nLlwiLFxuICAgICAgZXZpZGVuY2U6IG1hdGNoZXMuc2xpY2UoMCwgMikuam9pbihcIjsgXCIpLFxuICAgICAgY29uZmlkZW5jZTogMC43NSxcbiAgICAgIHNvdXJjZTogXCJoZXVyaXN0aWNcIixcbiAgICB9LFxuICBdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0UHJlc2VsZWN0aW9uKGh0bWw6IHN0cmluZyk6IEhldXJpc3RpY1NpZ25hbFtdIHtcbiAgY29uc3QgaGFzQ2hlY2tlZElucHV0ID0gLzxpbnB1dFtePl0qXFxiY2hlY2tlZFxcYi9pLnRlc3QoaHRtbCk7XG4gIGNvbnN0IG1hdGNoZXMgPSBtYXRjaFBhdHRlcm5zKGh0bWwsIFBSRVNFTEVDVElPTl9QQVRURVJOUyk7XG5cbiAgaWYgKCFoYXNDaGVja2VkSW5wdXQgJiYgbWF0Y2hlcy5sZW5ndGggPT09IDApIHJldHVybiBbXTtcblxuICByZXR1cm4gW1xuICAgIHtcbiAgICAgIGNhdGVnb3J5OiBcIlBSRVNFTEVDVElPTlwiLFxuICAgICAgcGF0dGVyblR5cGU6IFwiUHJlQ2hlY2tlZEJveFwiLFxuICAgICAgc2V2ZXJpdHk6IFwiTUVESVVNXCIsXG4gICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgXCJQb3NzaWJsZSBwcmVzZWxlY3Rpb24gY3VlIGRldGVjdGVkLiBQcmUtc2VsZWN0ZWQgb3B0aW9ucyBjYW4gbnVkZ2UgdXNlcnMgdG93YXJkIGFkZC1vbnMgb3IgbWFya2V0aW5nIGNvbnNlbnQuXCIsXG4gICAgICBldmlkZW5jZTogaGFzQ2hlY2tlZElucHV0XG4gICAgICAgID8gXCJQcmUtY2hlY2tlZCBpbnB1dCBlbGVtZW50cyBkZXRlY3RlZCBpbiBwYWdlIG1hcmt1cC5cIlxuICAgICAgICA6IG1hdGNoZXMuam9pbihcIjsgXCIpLFxuICAgICAgY29uZmlkZW5jZTogaGFzQ2hlY2tlZElucHV0ID8gMC44IDogMC42NSxcbiAgICAgIHNvdXJjZTogXCJoZXVyaXN0aWNcIixcbiAgICB9LFxuICBdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0T2JzdHJ1Y3Rpb24oXG4gIGh0bWw6IHN0cmluZyxcbiAgcGFnZVR5cGU6IFBhZ2VUeXBlID0gXCJnZW5lcmFsXCIsXG4pOiBIZXVyaXN0aWNTaWduYWxbXSB7XG4gIGlmIChwYWdlVHlwZSA9PT0gXCJlZGl0b3JpYWxcIikge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGNvbnN0IGhhc1N0aWNreU92ZXJsYXkgPVxuICAgIC9wb3NpdGlvbjpcXHMqKGZpeGVkfHN0aWNreSkvaS50ZXN0KGh0bWwpIHx8XG4gICAgL2NsYXNzPVwiW15cIl0qKG1vZGFsfHBvcHVwfG92ZXJsYXl8c3RpY2t5LWJhbm5lcilbXlwiXSpcIi9pLnRlc3QoaHRtbCk7XG5cbiAgaWYgKCFoYXNTdGlja3lPdmVybGF5KSByZXR1cm4gW107XG5cbiAgcmV0dXJuIFtcbiAgICB7XG4gICAgICBjYXRlZ29yeTogXCJPQlNUUlVDVElPTlwiLFxuICAgICAgcGF0dGVyblR5cGU6IFwiU3RpY2t5UHJlc3N1cmVCYW5uZXJcIixcbiAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgZGVzY3JpcHRpb246XG4gICAgICAgIFwiUG9zc2libGUgb2JzdHJ1Y3Rpb24gY3VlIGRldGVjdGVkLiBTdGlja3kgYmFubmVycyBvciBvdmVybGF5cyBtYXkga2VlcCBjaGVja291dCBwcmVzc3VyZSB2aXNpYmxlLlwiLFxuICAgICAgZXZpZGVuY2U6IFwiRml4ZWQgb3Igc3RpY2t5IG92ZXJsYXktbGlrZSBlbGVtZW50cyBkZXRlY3RlZC5cIixcbiAgICAgIGNvbmZpZGVuY2U6IDAuNjUsXG4gICAgICBzb3VyY2U6IFwiaGV1cmlzdGljXCIsXG4gICAgfSxcbiAgXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJ1bkhldXJpc3RpY3MocGFnZToge1xuICB2aXNpYmxlVGV4dDogc3RyaW5nO1xuICBpbnRlcmFjdGl2ZUh0bWw6IHN0cmluZztcbiAgcGFnZVR5cGU/OiBQYWdlVHlwZTtcbn0pOiBIZXVyaXN0aWNTaWduYWxbXSB7XG4gIGNvbnN0IHBhZ2VUeXBlID0gcGFnZS5wYWdlVHlwZSA/PyBcImdlbmVyYWxcIjtcblxuICByZXR1cm4gW1xuICAgIC4uLmRldGVjdFVyZ2VuY3kocGFnZS52aXNpYmxlVGV4dCwgcGFnZS5pbnRlcmFjdGl2ZUh0bWwsIHBhZ2VUeXBlKSxcbiAgICAuLi5kZXRlY3RTY2FyY2l0eShwYWdlLnZpc2libGVUZXh0LCBwYWdlVHlwZSwgcGFnZS5pbnRlcmFjdGl2ZUh0bWwpLFxuICAgIC4uLmRldGVjdFNvY2lhbFByb29mKHBhZ2UudmlzaWJsZVRleHQsIHBhZ2VUeXBlLCBwYWdlLmludGVyYWN0aXZlSHRtbCksXG4gICAgLi4uZGV0ZWN0Q29uZmlybXNoYW1pbmcoXG4gICAgICBwYWdlLnZpc2libGVUZXh0LFxuICAgICAgcGFnZVR5cGUsXG4gICAgICBwYWdlLmludGVyYWN0aXZlSHRtbCxcbiAgICApLFxuICAgIC4uLmRldGVjdFByZXNlbGVjdGlvbihwYWdlLmludGVyYWN0aXZlSHRtbCksXG4gICAgLi4uZGV0ZWN0T2JzdHJ1Y3Rpb24ocGFnZS5pbnRlcmFjdGl2ZUh0bWwsIHBhZ2VUeXBlKSxcbiAgXTtcbn1cbiIsImltcG9ydCB0eXBlIHsgQ29uY2VybkxldmVsIH0gZnJvbSBcIi4uL3R5cGVzL3NjYW5cIjtcblxuZXhwb3J0IGNvbnN0IEhPTUVfRElTQ0xBSU1FUiA9XG4gIFwiVGhpcyB0b29sIGlkZW50aWZpZXMgcG90ZW50aWFsIHByZXNzdXJlIHRhY3RpY3MgYW5kIGRlc2lnbiBjdWVzLiBJdCBkb2VzIG5vdCBkZXRlcm1pbmUgd2hldGhlciBhIHdlYnNpdGUgaXMgdW5sYXdmdWwsIGZyYXVkdWxlbnQsIG9yIHVuc2FmZS5cIjtcblxuZXhwb3J0IGNvbnN0IFJFUE9SVF9ESVNDTEFJTUVSID1cbiAgXCJGaW5kaW5ncyBhcmUgYmFzZWQgb24gYXV0b21hdGVkIGFuYWx5c2lzIGFuZCBtYXkgYmUgaW5jb21wbGV0ZSBvciBpbmNvcnJlY3QuXCI7XG5cbmV4cG9ydCBjb25zdCBQUk9ISUJJVEVEX1dPUkRTID0gW1xuICBcInNjYW1cIixcbiAgXCJmcmF1ZFwiLFxuICBcImNyaW1pbmFsXCIsXG4gIFwiaWxsZWdhbFwiLFxuICBcImNoZWF0aW5nXCIsXG4gIFwiZGlzaG9uZXN0IHNlbGxlclwiLFxuICBcInByZWRhdG9yeSBidXNpbmVzc1wiLFxuICBcInByZWRhdG9yeVwiLFxuICBcImRlY2VwdGl2ZSBjb21wYW55XCIsXG5dIGFzIGNvbnN0O1xuXG5leHBvcnQgY29uc3QgREVDSVNJT05fQ0hFQ0tMSVNUID0gW1xuICBcIkNoZWNrIHJlZnVuZCB0ZXJtcy5cIixcbiAgXCJDb21wYXJlIHByaWNlcyBlbHNld2hlcmUuXCIsXG4gIFwiTG9vayBmb3IgaW5kZXBlbmRlbnQgcmV2aWV3cy5cIixcbiAgXCJBdm9pZCBydXNoaW5nIGJlY2F1c2Ugb2YgdGltZXJzLlwiLFxuICBcIkNoZWNrIHdoZXRoZXIgZmVlcyBhcHBlYXIgb25seSBhdCBjaGVja291dC5cIixcbiAgXCJTYXZlIGEgY29weSBvZiBpbXBvcnRhbnQgdGVybXMgYmVmb3JlIHBheWluZy5cIixcbl0gYXMgY29uc3Q7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb25jZXJuTGV2ZWxGcm9tU2NvcmUoc2NvcmU6IG51bWJlciB8IG51bGwpOiBDb25jZXJuTGV2ZWwge1xuICBpZiAoc2NvcmUgPT09IG51bGwpIHJldHVybiBcIlVOQUJMRVwiO1xuICBpZiAoc2NvcmUgPj0gNzApIHJldHVybiBcIkhJR0hcIjtcbiAgaWYgKHNjb3JlID49IDUwKSByZXR1cm4gXCJNT0RFUkFURVwiO1xuICBpZiAoc2NvcmUgPj0gMjUpIHJldHVybiBcIlNPTUVcIjtcbiAgcmV0dXJuIFwiTE9XXCI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb25jZXJuTGV2ZWxMYWJlbChsZXZlbDogQ29uY2VybkxldmVsKTogc3RyaW5nIHtcbiAgc3dpdGNoIChsZXZlbCkge1xuICAgIGNhc2UgXCJMT1dcIjpcbiAgICAgIHJldHVybiBcIkxvdyBjb25jZXJuXCI7XG4gICAgY2FzZSBcIlNPTUVcIjpcbiAgICAgIHJldHVybiBcIlNvbWUgY2F1dGlvblwiO1xuICAgIGNhc2UgXCJNT0RFUkFURVwiOlxuICAgICAgcmV0dXJuIFwiTW9kZXJhdGUgY2F1dGlvblwiO1xuICAgIGNhc2UgXCJISUdIXCI6XG4gICAgICByZXR1cm4gXCJIaWdoIGNhdXRpb25cIjtcbiAgICBjYXNlIFwiVU5BQkxFXCI6XG4gICAgICByZXR1cm4gXCJVbmFibGUgdG8gYXNzZXNzXCI7XG4gICAgZGVmYXVsdDoge1xuICAgICAgY29uc3QgX2V4aGF1c3RpdmU6IG5ldmVyID0gbGV2ZWw7XG4gICAgICByZXR1cm4gX2V4aGF1c3RpdmU7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdWdnZXN0ZWRBY3Rpb25Gb3JDYXRlZ29yeShjYXRlZ29yeTogc3RyaW5nKTogc3RyaW5nIHtcbiAgc3dpdGNoIChjYXRlZ29yeSkge1xuICAgIGNhc2UgXCJVUkdFTkNZXCI6XG4gICAgICByZXR1cm4gXCJDb25zaWRlciByZXZpc2l0aW5nIHRoZSBwYWdlIGxhdGVyIHRvIGNoZWNrIHdoZXRoZXIgdGhlIG9mZmVyIGNoYW5nZXMuXCI7XG4gICAgY2FzZSBcIlNDQVJDSVRZXCI6XG4gICAgICByZXR1cm4gXCJDb21wYXJlIGF2YWlsYWJpbGl0eSBvbiBhbm90aGVyIGNoYW5uZWwgYmVmb3JlIGRlY2lkaW5nLlwiO1xuICAgIGNhc2UgXCJTT0NJQUxfUFJPT0ZcIjpcbiAgICAgIHJldHVybiBcIlRyZWF0IHZpc2l0b3Igb3IgcHVyY2hhc2UgY291bnRzIGFzIHVudmVyaWZpZWQgc29jaWFsIGN1ZXMuXCI7XG4gICAgY2FzZSBcIlBSRVNFTEVDVElPTlwiOlxuICAgICAgcmV0dXJuIFwiUmV2aWV3IHByZS1zZWxlY3RlZCBvcHRpb25zIGNhcmVmdWxseSBiZWZvcmUgY29udGludWluZy5cIjtcbiAgICBjYXNlIFwiRk9SQ0VEX0FDVElPTlwiOlxuICAgICAgcmV0dXJuIFwiTG9vayBmb3IgYSBjbGVhciB3YXkgdG8gZGVjbGluZSB3aXRob3V0IHBlbmFsdHkuXCI7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBcIkNvbnNpZGVyIGNoZWNraW5nIGluZGVwZW5kZW50bHkgYmVmb3JlIHBheWluZy5cIjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2FuaXRpemVUZXh0KHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCByZXN1bHQgPSB0ZXh0O1xuICBmb3IgKGNvbnN0IHdvcmQgb2YgUFJPSElCSVRFRF9XT1JEUykge1xuICAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgUmVnRXhwKGBcXFxcYiR7d29yZH1cXFxcYmAsIFwiZ2lcIik7XG4gICAgcmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UocGF0dGVybiwgXCJwb3RlbnRpYWwgcHJlc3N1cmUgY3VlXCIpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG4iLCIvKiogQnJvd3Nlci1pbnRlcm5hbCBwYWdlcyB0aGF0IGFyZSBuZXZlciBzY2FubmVkLiAqL1xuZXhwb3J0IGNvbnN0IEVYQ0xVREVEX1VSTF9QUkVGSVhFUyA9IFtcbiAgXCJjaHJvbWU6Ly9cIixcbiAgXCJjaHJvbWUtdW50cnVzdGVkOi8vXCIsXG4gIFwiY2hyb21lLWV4dGVuc2lvbjovL1wiLFxuICBcImFib3V0OlwiLFxuICBcImVkZ2U6Ly9cIixcbiAgXCJicmF2ZTovL1wiLFxuXSBhcyBjb25zdDtcblxuLyoqIFBvcHVsYXIgc2l0ZXMgc2tpcHBlZCBieSBhdXRvLXNjYW4gKGVtYWlsLCBjaGF0LCBzb2NpYWwsIHN0cmVhbWluZywgZXRjLikuICovXG5leHBvcnQgY29uc3QgRVhDTFVERURfSE9TVFMgPSBbXG4gIC8vIEdvb2dsZVxuICBcImdvb2dsZS5jb21cIixcbiAgXCJnbWFpbC5jb21cIixcbiAgXCJ5b3V0dWJlLmNvbVwiLFxuICAvLyBNZXRhXG4gIFwiZmFjZWJvb2suY29tXCIsXG4gIFwiaW5zdGFncmFtLmNvbVwiLFxuICBcIm1ldGEuY29tXCIsXG4gIFwibWVzc2VuZ2VyLmNvbVwiLFxuICBcInRocmVhZHMubmV0XCIsXG4gIFwid2hhdHNhcHAuY29tXCIsXG4gIC8vIE1pY3Jvc29mdFxuICBcIm1pY3Jvc29mdC5jb21cIixcbiAgXCJvdXRsb29rLmNvbVwiLFxuICBcImxpdmUuY29tXCIsXG4gIFwiaG90bWFpbC5jb21cIixcbiAgXCJvZmZpY2UuY29tXCIsXG4gIFwib2ZmaWNlMzY1LmNvbVwiLFxuICAvLyBBcHBsZVxuICBcImFwcGxlLmNvbVwiLFxuICBcImljbG91ZC5jb21cIixcbiAgLy8gU29jaWFsICYgbWVzc2FnaW5nXG4gIFwidHdpdHRlci5jb21cIixcbiAgXCJ4LmNvbVwiLFxuICBcImxpbmtlZGluLmNvbVwiLFxuICBcInRpa3Rvay5jb21cIixcbiAgXCJyZWRkaXQuY29tXCIsXG4gIFwicGludGVyZXN0LmNvbVwiLFxuICBcInNuYXBjaGF0LmNvbVwiLFxuICBcImRpc2NvcmQuY29tXCIsXG4gIFwic2xhY2suY29tXCIsXG4gIFwidGVsZWdyYW0ub3JnXCIsXG4gIFwidC5tZVwiLFxuICBcInpvb20udXNcIixcbiAgXCJ6b29tLmNvbVwiLFxuICAvLyBFbWFpbFxuICBcInlhaG9vLmNvbVwiLFxuICBcInByb3Rvbi5tZVwiLFxuICBcInByb3Rvbm1haWwuY29tXCIsXG4gIC8vIFN0cmVhbWluZyAmIGNvbW1lcmNlXG4gIFwibmV0ZmxpeC5jb21cIixcbiAgXCJzcG90aWZ5LmNvbVwiLFxuICBcImFtYXpvbi5jb21cIixcbiAgXCJiaW5nLmNvbVwiLFxuXSBhcyBjb25zdDtcblxuZXhwb3J0IGZ1bmN0aW9uIGlzRXhjbHVkZWRVcmwodXJsOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcbiAgaWYgKCF1cmwpIHJldHVybiB0cnVlO1xuXG4gIGNvbnN0IGxvd2VyID0gdXJsLnRvTG93ZXJDYXNlKCk7XG4gIGZvciAoY29uc3QgcHJlZml4IG9mIEVYQ0xVREVEX1VSTF9QUkVGSVhFUykge1xuICAgIGlmIChsb3dlci5zdGFydHNXaXRoKHByZWZpeCkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHRyeSB7XG4gICAgcmV0dXJuIGlzRXhjbHVkZWRIb3N0KG5ldyBVUkwodXJsKS5ob3N0bmFtZSk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0V4Y2x1ZGVkSG9zdChob3N0bmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IGhvc3QgPSBob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICBmb3IgKGNvbnN0IGV4Y2x1ZGVkIG9mIEVYQ0xVREVEX0hPU1RTKSB7XG4gICAgaWYgKGhvc3QgPT09IGV4Y2x1ZGVkIHx8IGhvc3QuZW5kc1dpdGgoYC4ke2V4Y2x1ZGVkfWApKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuIiwiaW1wb3J0IHR5cGUgeyBFeHRlbnNpb25BbmFseXplUmVzcG9uc2UgfSBmcm9tIFwiQGRhcmtwYXR0ZXJucy9zaGFyZWQvdHlwZXNcIjtcbmltcG9ydCB7IGlzRXhjbHVkZWRVcmwgfSBmcm9tIFwiLi9leGNsdWRlZC1ob3N0c1wiO1xuXG5leHBvcnQgdHlwZSBFeHRlbnNpb25TZXR0aW5ncyA9IHtcbiAgdGVybXNBY2NlcHRlZEF0OiBzdHJpbmcgfCBudWxsO1xuICBhdXRvU2NhbkVuYWJsZWQ6IGJvb2xlYW47XG4gIGFwaUJhc2VVcmw6IHN0cmluZztcbiAgYXBpS2V5OiBzdHJpbmc7XG59O1xuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBFeHRlbnNpb25TZXR0aW5ncyA9IHtcbiAgdGVybXNBY2NlcHRlZEF0OiBudWxsLFxuICBhdXRvU2NhbkVuYWJsZWQ6IHRydWUsXG4gIGFwaUJhc2VVcmw6IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gIGFwaUtleTogXCJcIixcbn07XG5cbnR5cGUgVXJsUmVwb3J0Q2FjaGUgPSB7XG4gIG5vcm1hbGl6ZWRVcmw6IHN0cmluZztcbiAgcmVwb3J0OiBFeHRlbnNpb25BbmFseXplUmVzcG9uc2VbXCJzY2FuXCJdO1xuICBjYWNoZWRBdDogbnVtYmVyO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVVybEZvckNhY2hlKHVybDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgcGFyc2VkID0gbmV3IFVSTCh1cmwpO1xuICBwYXJzZWQuaGFzaCA9IFwiXCI7XG4gIHBhcnNlZC5ob3N0bmFtZSA9IHBhcnNlZC5ob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICByZXR1cm4gcGFyc2VkLnRvU3RyaW5nKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1cmxzTWF0Y2hGb3JDYWNoZShhOiBzdHJpbmcsIGI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICB0cnkge1xuICAgIHJldHVybiBub3JtYWxpemVVcmxGb3JDYWNoZShhKSA9PT0gbm9ybWFsaXplVXJsRm9yQ2FjaGUoYik7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBhID09PSBiO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRTZXR0aW5ncygpOiBQcm9taXNlPEV4dGVuc2lvblNldHRpbmdzPiB7XG4gIGNvbnN0IHN0b3JlZCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChPYmplY3Qua2V5cyhERUZBVUxUX1NFVFRJTkdTKSk7XG4gIHJldHVybiB7IC4uLkRFRkFVTFRfU0VUVElOR1MsIC4uLnN0b3JlZCB9IGFzIEV4dGVuc2lvblNldHRpbmdzO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2F2ZVNldHRpbmdzKFxuICBwYXJ0aWFsOiBQYXJ0aWFsPEV4dGVuc2lvblNldHRpbmdzPixcbik6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQocGFydGlhbCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRUYWJSZXBvcnQoXG4gIHRhYklkOiBudW1iZXIsXG4pOiBQcm9taXNlPGltcG9ydChcIi4vbWVzc2FnZXNcIikuVGFiUmVwb3J0U3RhdGUgfCBudWxsPiB7XG4gIGNvbnN0IGtleSA9IGB0YWJSZXBvcnQ6JHt0YWJJZH1gO1xuICBjb25zdCBzdG9yZWQgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5zZXNzaW9uLmdldChrZXkpO1xuICByZXR1cm4gKFxuICAgIChzdG9yZWRba2V5XSBhcyBpbXBvcnQoXCIuL21lc3NhZ2VzXCIpLlRhYlJlcG9ydFN0YXRlIHwgdW5kZWZpbmVkKSA/PyBudWxsXG4gICk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXRUYWJSZXBvcnQoXG4gIHRhYklkOiBudW1iZXIsXG4gIHN0YXRlOiBpbXBvcnQoXCIuL21lc3NhZ2VzXCIpLlRhYlJlcG9ydFN0YXRlLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGtleSA9IGB0YWJSZXBvcnQ6JHt0YWJJZH1gO1xuICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5zZXNzaW9uLnNldCh7IFtrZXldOiBzdGF0ZSB9KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFVybFJlcG9ydENhY2hlKFxuICB1cmw6IHN0cmluZyxcbik6IFByb21pc2U8RXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlW1wic2NhblwiXSB8IG51bGw+IHtcbiAgY29uc3Qgbm9ybWFsaXplZFVybCA9IG5vcm1hbGl6ZVVybEZvckNhY2hlKHVybCk7XG4gIGNvbnN0IGtleSA9IGB1cmxSZXBvcnQ6JHtub3JtYWxpemVkVXJsfWA7XG4gIGNvbnN0IHN0b3JlZCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChrZXkpO1xuICBjb25zdCBjYWNoZSA9IHN0b3JlZFtrZXldIGFzIFVybFJlcG9ydENhY2hlIHwgdW5kZWZpbmVkO1xuICByZXR1cm4gY2FjaGU/LnJlcG9ydCA/PyBudWxsO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0VXJsUmVwb3J0Q2FjaGUoXG4gIHVybDogc3RyaW5nLFxuICByZXBvcnQ6IEV4dGVuc2lvbkFuYWx5emVSZXNwb25zZVtcInNjYW5cIl0sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgbm9ybWFsaXplZFVybCA9IG5vcm1hbGl6ZVVybEZvckNhY2hlKHVybCk7XG4gIGNvbnN0IGtleSA9IGB1cmxSZXBvcnQ6JHtub3JtYWxpemVkVXJsfWA7XG4gIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7XG4gICAgW2tleV06IHtcbiAgICAgIG5vcm1hbGl6ZWRVcmwsXG4gICAgICByZXBvcnQsXG4gICAgICBjYWNoZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9IHNhdGlzZmllcyBVcmxSZXBvcnRDYWNoZSxcbiAgfSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjbGVhclVybFJlcG9ydENhY2hlKHVybDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IG5vcm1hbGl6ZWRVcmwgPSBub3JtYWxpemVVcmxGb3JDYWNoZSh1cmwpO1xuICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5yZW1vdmUoYHVybFJlcG9ydDoke25vcm1hbGl6ZWRVcmx9YCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0FuYWx5emFibGVVcmwodXJsOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcbiAgaWYgKCF1cmwpIHJldHVybiBmYWxzZTtcbiAgaWYgKCF1cmwuc3RhcnRzV2l0aChcImh0dHA6Ly9cIikgJiYgIXVybC5zdGFydHNXaXRoKFwiaHR0cHM6Ly9cIikpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuICFpc0V4Y2x1ZGVkVXJsKHVybCk7XG59XG4iLCJpbXBvcnQgdHlwZSB7XG4gIEV4dGVuc2lvbkFuYWx5emVQYXlsb2FkLFxuICBFeHRlbnNpb25BbmFseXplUmVzcG9uc2UsXG59IGZyb20gXCJAZGFya3BhdHRlcm5zL3NoYXJlZC90eXBlc1wiO1xuaW1wb3J0IHsgZ2V0U2V0dGluZ3MgfSBmcm9tIFwiLi4vbGliL3N0b3JhZ2VcIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoQ2FjaGVkUmVwb3J0RnJvbUJhY2tlbmQoXG4gIHVybDogc3RyaW5nLFxuKTogUHJvbWlzZTxFeHRlbnNpb25BbmFseXplUmVzcG9uc2VbXCJzY2FuXCJdIHwgbnVsbD4ge1xuICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGdldFNldHRpbmdzKCk7XG4gIGNvbnN0IGJhc2VVcmwgPSBzZXR0aW5ncy5hcGlCYXNlVXJsLnJlcGxhY2UoL1xcLyQvLCBcIlwiKTtcbiAgY29uc3QgZW5kcG9pbnQgPSBgJHtiYXNlVXJsfS9hcGkvZXh0ZW5zaW9uL2NhY2hlP3VybD0ke2VuY29kZVVSSUNvbXBvbmVudCh1cmwpfWA7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGVuZHBvaW50LCB7XG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIC4uLihzZXR0aW5ncy5hcGlLZXkgPyB7IFwiWC1FeHRlbnNpb24tS2V5XCI6IHNldHRpbmdzLmFwaUtleSB9IDoge30pLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YSA9IChhd2FpdCByZXNwb25zZS5qc29uKCkpIGFzXG4gICAgICB8IEV4dGVuc2lvbkFuYWx5emVSZXNwb25zZVxuICAgICAgfCB7IG9rOiBmYWxzZTsgZXJyb3I6IHN0cmluZyB9O1xuXG4gICAgaWYgKCFyZXNwb25zZS5vayB8fCAhZGF0YS5vaykge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRhdGEuc2NhbjtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFuYWx5emVXaXRoQmFja2VuZChcbiAgcGF5bG9hZDogT21pdDxFeHRlbnNpb25BbmFseXplUGF5bG9hZCwgXCJzb3VyY2VcIiB8IFwic2Nhbm5lZEF0XCI+LFxuICBmb3JjZSA9IGZhbHNlLFxuKTogUHJvbWlzZTxFeHRlbnNpb25BbmFseXplUmVzcG9uc2U+IHtcbiAgY29uc3Qgc2V0dGluZ3MgPSBhd2FpdCBnZXRTZXR0aW5ncygpO1xuICBjb25zdCBiYXNlVXJsID0gc2V0dGluZ3MuYXBpQmFzZVVybC5yZXBsYWNlKC9cXC8kLywgXCJcIik7XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7YmFzZVVybH0vYXBpL2V4dGVuc2lvbi9hbmFseXplYCwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAuLi4oc2V0dGluZ3MuYXBpS2V5ID8geyBcIlgtRXh0ZW5zaW9uLUtleVwiOiBzZXR0aW5ncy5hcGlLZXkgfSA6IHt9KSxcbiAgICB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIC4uLnBheWxvYWQsXG4gICAgICBzY2FubmVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIHNvdXJjZTogXCJjaHJvbWUtZXh0ZW5zaW9uXCIsXG4gICAgICBmb3JjZSxcbiAgICB9IHNhdGlzZmllcyBFeHRlbnNpb25BbmFseXplUGF5bG9hZCksXG4gIH0pO1xuXG4gIGNvbnN0IGRhdGEgPSAoYXdhaXQgcmVzcG9uc2UuanNvbigpKSBhc1xuICAgIHwgRXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlXG4gICAgfCB7IG9rOiBmYWxzZTsgZXJyb3I6IHN0cmluZyB9O1xuXG4gIGlmICghcmVzcG9uc2Uub2sgfHwgIWRhdGEub2spIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcImVycm9yXCIgaW4gZGF0YSA/IGRhdGEuZXJyb3IgOiBcIlVuYWJsZSB0byBhbmFseXplIHRoaXMgcGFnZS5cIixcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIGRhdGE7XG59XG4iLCIvLy8gPHJlZmVyZW5jZSB0eXBlcz1cInd4dC9jbGllbnQtdHlwZXNcIiAvPlxuXG5pbXBvcnQgeyBydW5IZXVyaXN0aWNzIH0gZnJvbSBcIkBkYXJrcGF0dGVybnMvc2hhcmVkL2hldXJpc3RpY3NcIjtcbmltcG9ydCB0eXBlIHtcbiAgRXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlLFxuICBQYWdlSGlnaGxpZ2h0LFxuICBQYWdlVHlwZSxcbn0gZnJvbSBcIkBkYXJrcGF0dGVybnMvc2hhcmVkL3R5cGVzXCI7XG5pbXBvcnQge1xuICBjb25jZXJuTGV2ZWxGcm9tU2NvcmUsXG4gIHNhbml0aXplVGV4dCxcbiAgc3VnZ2VzdGVkQWN0aW9uRm9yQ2F0ZWdvcnksXG59IGZyb20gXCJAZGFya3BhdHRlcm5zL3NoYXJlZC93b3JkaW5nXCI7XG5pbXBvcnQgeyBhbmFseXplV2l0aEJhY2tlbmQsIGZldGNoQ2FjaGVkUmVwb3J0RnJvbUJhY2tlbmQgfSBmcm9tIFwiLi4vYXBpL2NsaWVudFwiO1xuaW1wb3J0IHR5cGUgeyBBbmFseXplUGFnZU1lc3NhZ2UsIFRhYlJlcG9ydFVwZGF0ZWRNZXNzYWdlIH0gZnJvbSBcIi4uL2xpYi9tZXNzYWdlc1wiO1xuaW1wb3J0IHtcbiAgY2xlYXJVcmxSZXBvcnRDYWNoZSxcbiAgZ2V0U2V0dGluZ3MsXG4gIGdldFRhYlJlcG9ydCxcbiAgZ2V0VXJsUmVwb3J0Q2FjaGUsXG4gIGlzQW5hbHl6YWJsZVVybCxcbiAgbm9ybWFsaXplVXJsRm9yQ2FjaGUsXG4gIHNldFRhYlJlcG9ydCxcbiAgc2V0VXJsUmVwb3J0Q2FjaGUsXG4gIHVybHNNYXRjaEZvckNhY2hlLFxufSBmcm9tIFwiLi4vbGliL3N0b3JhZ2VcIjtcblxuY29uc3QgZGVib3VuY2VUaW1lcnMgPSBuZXcgTWFwPG51bWJlciwgUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4+KCk7XG5jb25zdCBpbkZsaWdodFVybHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbmNvbnN0IHBlbmRpbmdIaWdobGlnaHRzID0gbmV3IE1hcDxudW1iZXIsIFBhZ2VIaWdobGlnaHRbXT4oKTtcbmNvbnN0IERFQk9VTkNFX01TID0gMjAwMDtcblxuZnVuY3Rpb24gbm90aWZ5VGFiUmVwb3J0VXBkYXRlZCh0YWJJZDogbnVtYmVyKTogdm9pZCB7XG4gIHZvaWQgY2hyb21lLnJ1bnRpbWVcbiAgICAuc2VuZE1lc3NhZ2UoeyB0eXBlOiBcIlRBQl9SRVBPUlRfVVBEQVRFRFwiLCB0YWJJZCB9IHNhdGlzZmllcyBUYWJSZXBvcnRVcGRhdGVkTWVzc2FnZSlcbiAgICAuY2F0Y2goKCkgPT4ge1xuICAgICAgLy8gU2lkZSBwYW5lbCBtYXkgYmUgY2xvc2VkLlxuICAgIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiB1cGRhdGVUYWJSZXBvcnQoXG4gIHRhYklkOiBudW1iZXIsXG4gIHN0YXRlOiBpbXBvcnQoXCIuLi9saWIvbWVzc2FnZXNcIikuVGFiUmVwb3J0U3RhdGUsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgc2V0VGFiUmVwb3J0KHRhYklkLCBzdGF0ZSk7XG4gIG5vdGlmeVRhYlJlcG9ydFVwZGF0ZWQodGFiSWQpO1xufVxuXG5mdW5jdGlvbiBjb25jZXJuQmFkZ2VUZXh0KGxldmVsOiBzdHJpbmcpOiBzdHJpbmcge1xuICBzd2l0Y2ggKGxldmVsKSB7XG4gICAgY2FzZSBcIkhJR0hcIjpcbiAgICAgIHJldHVybiBcIiFcIjtcbiAgICBjYXNlIFwiTU9ERVJBVEVcIjpcbiAgICAgIHJldHVybiBcIk1cIjtcbiAgICBjYXNlIFwiU09NRVwiOlxuICAgICAgcmV0dXJuIFwiU1wiO1xuICAgIGNhc2UgXCJMT1dcIjpcbiAgICAgIHJldHVybiBcIk9LXCI7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBcIj9cIjtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB1cGRhdGVCYWRnZShcbiAgdGFiSWQ6IG51bWJlcixcbiAgY29uY2VybkxldmVsOiBzdHJpbmcgfCBudWxsLFxuICBhbmFseXppbmcgPSBmYWxzZSxcbik6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoYW5hbHl6aW5nKSB7XG4gICAgYXdhaXQgY2hyb21lLmFjdGlvbi5zZXRCYWRnZVRleHQoeyB0YWJJZCwgdGV4dDogXCLigKZcIiB9KTtcbiAgICBhd2FpdCBjaHJvbWUuYWN0aW9uLnNldEJhZGdlQmFja2dyb3VuZENvbG9yKHsgdGFiSWQsIGNvbG9yOiBcIiMxRTQwQUZcIiB9KTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoIWNvbmNlcm5MZXZlbCkge1xuICAgIGF3YWl0IGNocm9tZS5hY3Rpb24uc2V0QmFkZ2VUZXh0KHsgdGFiSWQsIHRleHQ6IFwiXCIgfSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgYXdhaXQgY2hyb21lLmFjdGlvbi5zZXRCYWRnZVRleHQoe1xuICAgIHRhYklkLFxuICAgIHRleHQ6IGNvbmNlcm5CYWRnZVRleHQoY29uY2VybkxldmVsKSxcbiAgfSk7XG5cbiAgY29uc3QgY29sb3IgPVxuICAgIGNvbmNlcm5MZXZlbCA9PT0gXCJISUdIXCJcbiAgICAgID8gXCIjREMyNjI2XCJcbiAgICAgIDogY29uY2VybkxldmVsID09PSBcIk1PREVSQVRFXCJcbiAgICAgICAgPyBcIiNEOTc3MDZcIlxuICAgICAgICA6IGNvbmNlcm5MZXZlbCA9PT0gXCJTT01FXCJcbiAgICAgICAgICA/IFwiIzNCODJGNlwiXG4gICAgICAgICAgOiBcIiMxNkEzNEFcIjtcblxuICBhd2FpdCBjaHJvbWUuYWN0aW9uLnNldEJhZGdlQmFja2dyb3VuZENvbG9yKHsgdGFiSWQsIGNvbG9yIH0pO1xufVxuXG5mdW5jdGlvbiBidWlsZExvY2FsRmFsbGJhY2tSZXBvcnQoXG4gIHVybDogc3RyaW5nLFxuICBwYWdlVGl0bGU6IHN0cmluZyxcbiAgaGV1cmlzdGljU2lnbmFsczogUmV0dXJuVHlwZTx0eXBlb2YgcnVuSGV1cmlzdGljcz4sXG4pOiBFeHRlbnNpb25BbmFseXplUmVzcG9uc2VbXCJzY2FuXCJdIHtcbiAgY29uc3Qgcmlza1Njb3JlID1cbiAgICBoZXVyaXN0aWNTaWduYWxzLmxlbmd0aCA9PT0gMFxuICAgICAgPyA1XG4gICAgICA6IE1hdGgubWluKFxuICAgICAgICAgIDEwMCxcbiAgICAgICAgICBNYXRoLnJvdW5kKFxuICAgICAgICAgICAgaGV1cmlzdGljU2lnbmFscy5yZWR1Y2UoKHN1bSwgc2lnbmFsKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHdlaWdodCA9XG4gICAgICAgICAgICAgICAgc2lnbmFsLnNldmVyaXR5ID09PSBcIkhJR0hcIlxuICAgICAgICAgICAgICAgICAgPyA0NVxuICAgICAgICAgICAgICAgICAgOiBzaWduYWwuc2V2ZXJpdHkgPT09IFwiTUVESVVNXCJcbiAgICAgICAgICAgICAgICAgICAgPyAyNVxuICAgICAgICAgICAgICAgICAgICA6IDEwO1xuICAgICAgICAgICAgICByZXR1cm4gc3VtICsgd2VpZ2h0ICogc2lnbmFsLmNvbmZpZGVuY2U7XG4gICAgICAgICAgICB9LCAwKSxcbiAgICAgICAgICApLFxuICAgICAgICApO1xuXG4gIHJldHVybiB7XG4gICAgaWQ6IFwibG9jYWxcIixcbiAgICB1cmwsXG4gICAgbm9ybWFsaXplZFVybDogdXJsLFxuICAgIHN0YXR1czogXCJDT01QTEVURURcIixcbiAgICByaXNrU2NvcmUsXG4gICAgY29uY2VybkxldmVsOiBjb25jZXJuTGV2ZWxGcm9tU2NvcmUocmlza1Njb3JlKSxcbiAgICBzdW1tYXJ5OiBzYW5pdGl6ZVRleHQoXG4gICAgICBoZXVyaXN0aWNTaWduYWxzLmxlbmd0aCA+IDBcbiAgICAgICAgPyBgV2UgZm91bmQgJHtoZXVyaXN0aWNTaWduYWxzLmxlbmd0aH0gcG90ZW50aWFsIHByZXNzdXJlIGN1ZXMgbG9jYWxseS4gQmFja2VuZCBzeW5jIGZhaWxlZCDigJQgZmluZGluZ3Mgd2VyZSBub3Qgc2F2ZWQuYFxuICAgICAgICA6IFwiVW5hYmxlIHRvIGFzc2VzcyB0aGlzIHBhZ2UgcmlnaHQgbm93LlwiLFxuICAgICksXG4gICAgcGFnZVRpdGxlLFxuICAgIGNvbXBsZXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgZGV0ZWN0aW9uczogaGV1cmlzdGljU2lnbmFscy5tYXAoKHNpZ25hbCwgaW5kZXgpID0+ICh7XG4gICAgICBpZDogYGxvY2FsLSR7aW5kZXh9YCxcbiAgICAgIGNhdGVnb3J5OiBzaWduYWwuY2F0ZWdvcnksXG4gICAgICBwYXR0ZXJuVHlwZTogc2lnbmFsLnBhdHRlcm5UeXBlLFxuICAgICAgc2V2ZXJpdHk6IHNpZ25hbC5zZXZlcml0eSxcbiAgICAgIGRlc2NyaXB0aW9uOiBzYW5pdGl6ZVRleHQoc2lnbmFsLmRlc2NyaXB0aW9uKSxcbiAgICAgIGV2aWRlbmNlOiBzaWduYWwuZXZpZGVuY2UsXG4gICAgICBjb25maWRlbmNlOiBzaWduYWwuY29uZmlkZW5jZSxcbiAgICAgIHN1Z2dlc3RlZEFjdGlvbjogc3VnZ2VzdGVkQWN0aW9uRm9yQ2F0ZWdvcnkoc2lnbmFsLmNhdGVnb3J5KSxcbiAgICB9KSksXG4gIH07XG59XG5cbmZ1bmN0aW9uIGlzU2Nhbk5ld2VyVGhhbihcbiAgY2FuZGlkYXRlOiB7IGlkOiBzdHJpbmc7IGNvbXBsZXRlZEF0OiBzdHJpbmcgfCBudWxsIH0sXG4gIGN1cnJlbnQ6IHsgaWQ6IHN0cmluZzsgY29tcGxldGVkQXQ6IHN0cmluZyB8IG51bGwgfSxcbik6IGJvb2xlYW4ge1xuICBpZiAoY2FuZGlkYXRlLmlkID09PSBjdXJyZW50LmlkKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgY2FuZGlkYXRlQXQgPSBjYW5kaWRhdGUuY29tcGxldGVkQXRcbiAgICA/IG5ldyBEYXRlKGNhbmRpZGF0ZS5jb21wbGV0ZWRBdCkuZ2V0VGltZSgpXG4gICAgOiAwO1xuICBjb25zdCBjdXJyZW50QXQgPSBjdXJyZW50LmNvbXBsZXRlZEF0XG4gICAgPyBuZXcgRGF0ZShjdXJyZW50LmNvbXBsZXRlZEF0KS5nZXRUaW1lKClcbiAgICA6IDA7XG5cbiAgcmV0dXJuIGNhbmRpZGF0ZUF0ID49IGN1cnJlbnRBdDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc3luY0hpZ2hsaWdodHNUb1RhYihcbiAgdGFiSWQ6IG51bWJlcixcbiAgaGlnaGxpZ2h0czogUGFnZUhpZ2hsaWdodFtdLFxuICB2aXNpYmxlOiBib29sZWFuLFxuICBkZXRlY3Rpb25zOiBFeHRlbnNpb25BbmFseXplUmVzcG9uc2VbXCJzY2FuXCJdW1wiZGV0ZWN0aW9uc1wiXSA9IFtdLFxuICByZXBvcnRJZD86IHN0cmluZyxcbik6IFByb21pc2U8dm9pZD4ge1xuICB0cnkge1xuICAgIGlmICghdmlzaWJsZSkge1xuICAgICAgYXdhaXQgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2UodGFiSWQsIHsgdHlwZTogXCJDTEVBUl9QQUdFX0hJR0hMSUdIVFNcIiB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaGlnaGxpZ2h0cy5sZW5ndGggPT09IDAgJiYgZGV0ZWN0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgIGF3YWl0IGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHRhYklkLCB7IHR5cGU6IFwiQ0xFQVJfUEFHRV9ISUdITElHSFRTXCIgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgYXdhaXQgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2UodGFiSWQsIHtcbiAgICAgIHR5cGU6IFwiU0VUX1BBR0VfSElHSExJR0hUU1wiLFxuICAgICAgaGlnaGxpZ2h0cyxcbiAgICAgIGRldGVjdGlvbnMsXG4gICAgICB2aXNpYmxlOiB0cnVlLFxuICAgICAgcmVwb3J0SWQsXG4gICAgfSk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIENvbnRlbnQgc2NyaXB0IG1heSBub3QgYmUgcmVhZHkgb24gdGhpcyB0YWIuXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gYXBwbHlDYWNoZWRSZXBvcnQoXG4gIHRhYklkOiBudW1iZXIsXG4gIHJlcG9ydDogRXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlW1wic2NhblwiXSxcbiAgaGlnaGxpZ2h0czogUGFnZUhpZ2hsaWdodFtdID0gW10sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgdXBkYXRlVGFiUmVwb3J0KHRhYklkLCB7IHN0YXR1czogXCJjb21wbGV0ZVwiLCByZXBvcnQsIGhpZ2hsaWdodHMgfSk7XG4gIGF3YWl0IHVwZGF0ZUJhZGdlKHRhYklkLCByZXBvcnQuY29uY2VybkxldmVsKTtcbiAgYXdhaXQgc3luY0hpZ2hsaWdodHNUb1RhYihcbiAgICB0YWJJZCxcbiAgICBoaWdobGlnaHRzLFxuICAgIGhpZ2hsaWdodHMubGVuZ3RoID4gMCB8fCByZXBvcnQuZGV0ZWN0aW9ucy5sZW5ndGggPiAwLFxuICAgIHJlcG9ydC5kZXRlY3Rpb25zLFxuICAgIHJlcG9ydC5pZCxcbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaHlkcmF0ZVRhYkZyb21DYWNoZShcbiAgdGFiSWQ6IG51bWJlcixcbiAgdXJsOiBzdHJpbmcsXG4pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBnZXRUYWJSZXBvcnQodGFiSWQpO1xuXG4gIGlmIChleGlzdGluZz8uc3RhdHVzID09PSBcImFuYWx5emluZ1wiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBsZXQgY2FjaGVkID0gYXdhaXQgZ2V0VXJsUmVwb3J0Q2FjaGUodXJsKTtcbiAgaWYgKCFjYWNoZWQpIHtcbiAgICBjYWNoZWQgPSBhd2FpdCBmZXRjaENhY2hlZFJlcG9ydEZyb21CYWNrZW5kKHVybCk7XG4gICAgaWYgKGNhY2hlZCkge1xuICAgICAgYXdhaXQgc2V0VXJsUmVwb3J0Q2FjaGUodXJsLCBjYWNoZWQpO1xuICAgIH1cbiAgfVxuXG4gIGlmICghY2FjaGVkKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGV4aXN0aW5nPy5zdGF0dXMgPT09IFwiY29tcGxldGVcIiAmJlxuICAgICAgdXJsc01hdGNoRm9yQ2FjaGUoXG4gICAgICAgIGV4aXN0aW5nLnJlcG9ydC5ub3JtYWxpemVkVXJsID8/IGV4aXN0aW5nLnJlcG9ydC51cmwsXG4gICAgICAgIHVybCxcbiAgICAgIClcbiAgICApO1xuICB9XG5cbiAgaWYgKFxuICAgIGV4aXN0aW5nPy5zdGF0dXMgPT09IFwiY29tcGxldGVcIiAmJlxuICAgIHVybHNNYXRjaEZvckNhY2hlKFxuICAgICAgZXhpc3RpbmcucmVwb3J0Lm5vcm1hbGl6ZWRVcmwgPz8gZXhpc3RpbmcucmVwb3J0LnVybCxcbiAgICAgIGNhY2hlZC5ub3JtYWxpemVkVXJsID8/IGNhY2hlZC51cmwsXG4gICAgKSAmJlxuICAgICFpc1NjYW5OZXdlclRoYW4oY2FjaGVkLCBleGlzdGluZy5yZXBvcnQpXG4gICkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgYXdhaXQgYXBwbHlDYWNoZWRSZXBvcnQodGFiSWQsIGNhY2hlZCk7XG4gIHJldHVybiB0cnVlO1xufVxuXG5hc3luYyBmdW5jdGlvbiBydW5BbmFseXNpcyhcbiAgdGFiSWQ6IG51bWJlcixcbiAgcGF5bG9hZDoge1xuICAgIHVybDogc3RyaW5nO1xuICAgIHBhZ2VUaXRsZTogc3RyaW5nO1xuICAgIHZpc2libGVUZXh0OiBzdHJpbmc7XG4gICAgaW50ZXJhY3RpdmVIdG1sOiBzdHJpbmc7XG4gICAgcGFnZVR5cGU6IFBhZ2VUeXBlO1xuICB9LFxuICBmb3JjZSA9IGZhbHNlLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgZ2V0U2V0dGluZ3MoKTtcbiAgaWYgKCFzZXR0aW5ncy50ZXJtc0FjY2VwdGVkQXQpIHJldHVybjtcbiAgaWYgKCFzZXR0aW5ncy5hdXRvU2NhbkVuYWJsZWQgJiYgIWZvcmNlKSByZXR1cm47XG4gIGlmICghaXNBbmFseXphYmxlVXJsKHBheWxvYWQudXJsKSkgcmV0dXJuO1xuXG4gIGlmICghZm9yY2UpIHtcbiAgICBjb25zdCBoeWRyYXRlZCA9IGF3YWl0IGh5ZHJhdGVUYWJGcm9tQ2FjaGUodGFiSWQsIHBheWxvYWQudXJsKTtcbiAgICBpZiAoaHlkcmF0ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgYXdhaXQgY2xlYXJVcmxSZXBvcnRDYWNoZShwYXlsb2FkLnVybCk7XG4gIH1cblxuICBpZiAoaW5GbGlnaHRVcmxzLmhhcyhub3JtYWxpemVVcmxGb3JDYWNoZShwYXlsb2FkLnVybCkpICYmICFmb3JjZSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGluRmxpZ2h0VXJscy5hZGQobm9ybWFsaXplVXJsRm9yQ2FjaGUocGF5bG9hZC51cmwpKTtcblxuICBjb25zdCBoZXVyaXN0aWNTaWduYWxzID0gcnVuSGV1cmlzdGljcyh7XG4gICAgdmlzaWJsZVRleHQ6IHBheWxvYWQudmlzaWJsZVRleHQsXG4gICAgaW50ZXJhY3RpdmVIdG1sOiBwYXlsb2FkLmludGVyYWN0aXZlSHRtbCxcbiAgICBwYWdlVHlwZTogcGF5bG9hZC5wYWdlVHlwZSxcbiAgfSk7XG5cbiAgYXdhaXQgdXBkYXRlVGFiUmVwb3J0KHRhYklkLCB7IHN0YXR1czogXCJhbmFseXppbmdcIiB9KTtcbiAgYXdhaXQgdXBkYXRlQmFkZ2UodGFiSWQsIG51bGwsIHRydWUpO1xuICBhd2FpdCBzeW5jSGlnaGxpZ2h0c1RvVGFiKHRhYklkLCBbXSwgZmFsc2UpO1xuXG4gIGNvbnN0IGhpZ2hsaWdodHMgPSBwZW5kaW5nSGlnaGxpZ2h0cy5nZXQodGFiSWQpID8/IFtdO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYW5hbHl6ZVdpdGhCYWNrZW5kKFxuICAgICAge1xuICAgICAgICB1cmw6IHBheWxvYWQudXJsLFxuICAgICAgICBwYWdlVGl0bGU6IHBheWxvYWQucGFnZVRpdGxlLFxuICAgICAgICB2aXNpYmxlVGV4dDogcGF5bG9hZC52aXNpYmxlVGV4dCxcbiAgICAgICAgaW50ZXJhY3RpdmVIdG1sOiBwYXlsb2FkLmludGVyYWN0aXZlSHRtbCxcbiAgICAgICAgcGFnZVR5cGU6IHBheWxvYWQucGFnZVR5cGUsXG4gICAgICAgIGhldXJpc3RpY1NpZ25hbHMsXG4gICAgICB9LFxuICAgICAgZm9yY2UsXG4gICAgKTtcblxuICAgIGF3YWl0IHNldFVybFJlcG9ydENhY2hlKHBheWxvYWQudXJsLCByZXN1bHQuc2Nhbik7XG4gICAgYXdhaXQgYXBwbHlDYWNoZWRSZXBvcnQodGFiSWQsIHJlc3VsdC5zY2FuLCBoaWdobGlnaHRzKTtcbiAgfSBjYXRjaCB7XG4gICAgY29uc3QgZmFsbGJhY2sgPSBidWlsZExvY2FsRmFsbGJhY2tSZXBvcnQoXG4gICAgICBwYXlsb2FkLnVybCxcbiAgICAgIHBheWxvYWQucGFnZVRpdGxlLFxuICAgICAgaGV1cmlzdGljU2lnbmFscyxcbiAgICApO1xuXG4gICAgYXdhaXQgc2V0VXJsUmVwb3J0Q2FjaGUocGF5bG9hZC51cmwsIGZhbGxiYWNrKTtcbiAgICBhd2FpdCBhcHBseUNhY2hlZFJlcG9ydCh0YWJJZCwgZmFsbGJhY2ssIGhpZ2hsaWdodHMpO1xuICB9IGZpbmFsbHkge1xuICAgIHBlbmRpbmdIaWdobGlnaHRzLmRlbGV0ZSh0YWJJZCk7XG4gICAgaW5GbGlnaHRVcmxzLmRlbGV0ZShub3JtYWxpemVVcmxGb3JDYWNoZShwYXlsb2FkLnVybCkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNjaGVkdWxlQW5hbHlzaXMoXG4gIHRhYklkOiBudW1iZXIsXG4gIHBheWxvYWQ6IHtcbiAgICB1cmw6IHN0cmluZztcbiAgICBwYWdlVGl0bGU6IHN0cmluZztcbiAgICB2aXNpYmxlVGV4dDogc3RyaW5nO1xuICAgIGludGVyYWN0aXZlSHRtbDogc3RyaW5nO1xuICAgIHBhZ2VUeXBlOiBQYWdlVHlwZTtcbiAgfSxcbiAgZm9yY2UgPSBmYWxzZSxcbik6IHZvaWQge1xuICBjb25zdCBleGlzdGluZyA9IGRlYm91bmNlVGltZXJzLmdldCh0YWJJZCk7XG4gIGlmIChleGlzdGluZykgY2xlYXJUaW1lb3V0KGV4aXN0aW5nKTtcblxuICBkZWJvdW5jZVRpbWVycy5zZXQoXG4gICAgdGFiSWQsXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBkZWJvdW5jZVRpbWVycy5kZWxldGUodGFiSWQpO1xuICAgICAgdm9pZCBydW5BbmFseXNpcyh0YWJJZCwgcGF5bG9hZCwgZm9yY2UpO1xuICAgIH0sIERFQk9VTkNFX01TKSxcbiAgKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQmFja2dyb3VuZCgoKSA9PiB7XG4gIGNocm9tZS5ydW50aW1lLm9uSW5zdGFsbGVkLmFkZExpc3RlbmVyKCgpID0+IHtcbiAgICB2b2lkIGNocm9tZS5zaWRlUGFuZWwuc2V0UGFuZWxCZWhhdmlvcih7IG9wZW5QYW5lbE9uQWN0aW9uQ2xpY2s6IHRydWUgfSk7XG4gIH0pO1xuXG4gIGNocm9tZS50YWJzLm9uQWN0aXZhdGVkLmFkZExpc3RlbmVyKChhY3RpdmVJbmZvKSA9PiB7XG4gICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdGFiID0gYXdhaXQgY2hyb21lLnRhYnMuZ2V0KGFjdGl2ZUluZm8udGFiSWQpO1xuICAgICAgaWYgKCFpc0FuYWx5emFibGVVcmwodGFiLnVybCkpIHtcbiAgICAgICAgYXdhaXQgdXBkYXRlQmFkZ2UoYWN0aXZlSW5mby50YWJJZCwgbnVsbCk7XG4gICAgICAgIGF3YWl0IHVwZGF0ZVRhYlJlcG9ydChhY3RpdmVJbmZvLnRhYklkLCB7IHN0YXR1czogXCJpZGxlXCIgfSk7XG4gICAgICAgIGF3YWl0IHN5bmNIaWdobGlnaHRzVG9UYWIoYWN0aXZlSW5mby50YWJJZCwgW10sIGZhbHNlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgYXdhaXQgaHlkcmF0ZVRhYkZyb21DYWNoZShhY3RpdmVJbmZvLnRhYklkLCB0YWIudXJsIGFzIHN0cmluZyk7XG5cbiAgICAgIGNvbnN0IHN0YXRlID0gYXdhaXQgZ2V0VGFiUmVwb3J0KGFjdGl2ZUluZm8udGFiSWQpO1xuICAgICAgaWYgKHN0YXRlPy5zdGF0dXMgPT09IFwiY29tcGxldGVcIikge1xuICAgICAgICBjb25zdCBoaWdobGlnaHRzID0gc3RhdGUuaGlnaGxpZ2h0cyA/PyBbXTtcbiAgICAgICAgY29uc3QgZGV0ZWN0aW9ucyA9IHN0YXRlLnJlcG9ydC5kZXRlY3Rpb25zO1xuICAgICAgICBpZiAoaGlnaGxpZ2h0cy5sZW5ndGggPiAwIHx8IGRldGVjdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGF3YWl0IHN5bmNIaWdobGlnaHRzVG9UYWIoXG4gICAgICAgICAgICBhY3RpdmVJbmZvLnRhYklkLFxuICAgICAgICAgICAgaGlnaGxpZ2h0cyxcbiAgICAgICAgICAgIHRydWUsXG4gICAgICAgICAgICBkZXRlY3Rpb25zLFxuICAgICAgICAgICAgc3RhdGUucmVwb3J0LmlkLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSgpO1xuICB9KTtcblxuICBjaHJvbWUudGFicy5vblVwZGF0ZWQuYWRkTGlzdGVuZXIoKHRhYklkLCBjaGFuZ2VJbmZvLCB0YWIpID0+IHtcbiAgICBpZiAoY2hhbmdlSW5mby5zdGF0dXMgIT09IFwiY29tcGxldGVcIikgcmV0dXJuO1xuICAgIGlmICghaXNBbmFseXphYmxlVXJsKHRhYi51cmwpKSByZXR1cm47XG5cbiAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBoeWRyYXRlZCA9IGF3YWl0IGh5ZHJhdGVUYWJGcm9tQ2FjaGUodGFiSWQsIHRhYi51cmwgYXMgc3RyaW5nKTtcbiAgICAgIGlmIChoeWRyYXRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIEF2b2lkIHJlLXNjYW5uaW5nIHdoZW4gdGhlIHRhYiBhbHJlYWR5IGZpbmlzaGVkIGFuYWx5c2lzIChlLmcuIHRhYiBzd2l0Y2hcbiAgICAgIC8vIG9yIGRpc2NhcmRlZC10YWIgcmVsb2FkIGZpcmluZyBhbm90aGVyIFwiY29tcGxldGVcIiB3aXRob3V0IGEgVVJMIGNoYW5nZSkuXG4gICAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IGdldFRhYlJlcG9ydCh0YWJJZCk7XG4gICAgICBpZiAoXG4gICAgICAgIGV4aXN0aW5nPy5zdGF0dXMgPT09IFwiY29tcGxldGVcIiAmJlxuICAgICAgICB1cmxzTWF0Y2hGb3JDYWNoZShcbiAgICAgICAgICBleGlzdGluZy5yZXBvcnQubm9ybWFsaXplZFVybCA/PyBleGlzdGluZy5yZXBvcnQudXJsLFxuICAgICAgICAgIHRhYi51cmwgYXMgc3RyaW5nLFxuICAgICAgICApXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2b2lkIGNocm9tZS50YWJzXG4gICAgICAgIC5zZW5kTWVzc2FnZSh0YWJJZCwgeyB0eXBlOiBcIkFOQUxZWkVfUEFHRVwiIH0pXG4gICAgICAgIC5jYXRjaCgoKSA9PiB7XG4gICAgICAgICAgLy8gQ29udGVudCBzY3JpcHQgbWF5IG5vdCBiZSByZWFkeSB5ZXQgb24gc29tZSBwYWdlcy5cbiAgICAgICAgfSk7XG4gICAgfSkoKTtcbiAgfSk7XG5cbiAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIGlmIChtZXNzYWdlPy50eXBlID09PSBcIlBBR0VfQ09OVEVOVFwiKSB7XG4gICAgICBjb25zdCB0YWJJZCA9IHNlbmRlci50YWI/LmlkO1xuICAgICAgaWYgKCF0YWJJZCkgcmV0dXJuO1xuICAgICAgaWYgKCFpc0FuYWx5emFibGVVcmwobWVzc2FnZS51cmwgYXMgc3RyaW5nKSkge1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogdHJ1ZSB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIHNjaGVkdWxlQW5hbHlzaXMoXG4gICAgICAgIHRhYklkLFxuICAgICAgICB7XG4gICAgICAgICAgdXJsOiBtZXNzYWdlLnVybCBhcyBzdHJpbmcsXG4gICAgICAgICAgcGFnZVRpdGxlOiBtZXNzYWdlLnBhZ2VUaXRsZSBhcyBzdHJpbmcsXG4gICAgICAgICAgdmlzaWJsZVRleHQ6IG1lc3NhZ2UudmlzaWJsZVRleHQgYXMgc3RyaW5nLFxuICAgICAgICAgIGludGVyYWN0aXZlSHRtbDogbWVzc2FnZS5pbnRlcmFjdGl2ZUh0bWwgYXMgc3RyaW5nLFxuICAgICAgICAgIHBhZ2VUeXBlOiAobWVzc2FnZS5wYWdlVHlwZSBhcyBQYWdlVHlwZSB8IHVuZGVmaW5lZCkgPz8gXCJnZW5lcmFsXCIsXG4gICAgICAgIH0sXG4gICAgICAgIEJvb2xlYW4obWVzc2FnZS5mb3JjZSksXG4gICAgICApO1xuICAgICAgcGVuZGluZ0hpZ2hsaWdodHMuc2V0KFxuICAgICAgICB0YWJJZCxcbiAgICAgICAgKG1lc3NhZ2UuaGlnaGxpZ2h0cyBhcyBQYWdlSGlnaGxpZ2h0W10gfCB1bmRlZmluZWQpID8/IFtdLFxuICAgICAgKTtcbiAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiB0cnVlIH0pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKG1lc3NhZ2U/LnR5cGUgPT09IFwiUkVTQ0FOX1BBR0VcIikge1xuICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCB0YWJJZCA9XG4gICAgICAgICAgKG1lc3NhZ2UudGFiSWQgYXMgbnVtYmVyIHwgdW5kZWZpbmVkKSA/P1xuICAgICAgICAgIHNlbmRlci50YWI/LmlkID8/XG4gICAgICAgICAgKGF3YWl0IGNocm9tZS50YWJzLnF1ZXJ5KHsgYWN0aXZlOiB0cnVlLCBjdXJyZW50V2luZG93OiB0cnVlIH0pKVswXVxuICAgICAgICAgICAgPy5pZDtcblxuICAgICAgICBpZiAoIXRhYklkKSB7XG4gICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IGZhbHNlLCBlcnJvcjogXCJObyBhY3RpdmUgdGFiIGZvdW5kLlwiIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRhYiA9IGF3YWl0IGNocm9tZS50YWJzLmdldCh0YWJJZCk7XG4gICAgICAgIGlmICghaXNBbmFseXphYmxlVXJsKHRhYi51cmwpKSB7XG4gICAgICAgICAgc2VuZFJlc3BvbnNlKHtcbiAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgIGVycm9yOiBcIlRoaXMgcGFnZSBpcyBub3QgZWxpZ2libGUgZm9yIHNjYW5uaW5nLlwiLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IGNsZWFyVXJsUmVwb3J0Q2FjaGUodGFiLnVybCBhcyBzdHJpbmcpO1xuICAgICAgICBhd2FpdCB1cGRhdGVUYWJSZXBvcnQodGFiSWQsIHsgc3RhdHVzOiBcImFuYWx5emluZ1wiIH0pO1xuICAgICAgICBhd2FpdCB1cGRhdGVCYWRnZSh0YWJJZCwgbnVsbCwgdHJ1ZSk7XG4gICAgICAgIGF3YWl0IHN5bmNIaWdobGlnaHRzVG9UYWIodGFiSWQsIFtdLCBmYWxzZSk7XG4gICAgICAgIHBlbmRpbmdIaWdobGlnaHRzLmRlbGV0ZSh0YWJJZCk7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBjaHJvbWUudGFicy5zZW5kTWVzc2FnZSh0YWJJZCwge1xuICAgICAgICAgICAgdHlwZTogXCJBTkFMWVpFX1BBR0VcIixcbiAgICAgICAgICAgIGZvcmNlOiB0cnVlLFxuICAgICAgICAgIH0gc2F0aXNmaWVzIEFuYWx5emVQYWdlTWVzc2FnZSk7XG4gICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IHRydWUgfSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIHNlbmRSZXNwb25zZSh7XG4gICAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjpcbiAgICAgICAgICAgICAgXCJDb3VsZCBub3QgcmVhY2ggdGhpcyBwYWdlLiBUcnkgcmVmcmVzaGluZyB0aGUgdGFiLCB0aGVuIHJlc2Nhbi5cIixcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSkoKTtcblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKG1lc3NhZ2U/LnR5cGUgPT09IFwiU0hPVUxEX0FOQUxZWkVcIikge1xuICAgICAgY29uc3QgdGFiSWQgPSBzZW5kZXIudGFiPy5pZDtcbiAgICAgIGlmICghdGFiSWQpIHtcbiAgICAgICAgc2VuZFJlc3BvbnNlKHsgc2hvdWxkQW5hbHl6ZTogZmFsc2UgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHVybCA9IG1lc3NhZ2UudXJsIGFzIHN0cmluZztcbiAgICAgICAgaWYgKCFpc0FuYWx5emFibGVVcmwodXJsKSkge1xuICAgICAgICAgIHNlbmRSZXNwb25zZSh7IHNob3VsZEFuYWx5emU6IGZhbHNlIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBoeWRyYXRlZCA9IGF3YWl0IGh5ZHJhdGVUYWJGcm9tQ2FjaGUodGFiSWQsIHVybCk7XG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHNob3VsZEFuYWx5emU6ICFoeWRyYXRlZCB9KTtcbiAgICAgIH0pKCk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmIChtZXNzYWdlPy50eXBlID09PSBcIkhJR0hMSUdIVFNfVVBEQVRFRFwiKSB7XG4gICAgICBjb25zdCB0YWJJZCA9IHNlbmRlci50YWI/LmlkO1xuICAgICAgaWYgKCF0YWJJZCkgcmV0dXJuO1xuXG4gICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gYXdhaXQgZ2V0VGFiUmVwb3J0KHRhYklkKTtcbiAgICAgICAgaWYgKHN0YXRlPy5zdGF0dXMgIT09IFwiY29tcGxldGVcIikge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlcG9ydElkID0gbWVzc2FnZS5yZXBvcnRJZCBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIGlmIChyZXBvcnRJZCAmJiBzdGF0ZS5yZXBvcnQuaWQgIT09IHJlcG9ydElkKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgdXBkYXRlVGFiUmVwb3J0KHRhYklkLCB7XG4gICAgICAgICAgLi4uc3RhdGUsXG4gICAgICAgICAgaGlnaGxpZ2h0czogbWVzc2FnZS5oaWdobGlnaHRzIGFzIFBhZ2VIaWdobGlnaHRbXSxcbiAgICAgICAgfSk7XG4gICAgICB9KSgpO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAobWVzc2FnZT8udHlwZSA9PT0gXCJUT0dHTEVfUEFHRV9ISUdITElHSFRTXCIpIHtcbiAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgdGFiSWQgPVxuICAgICAgICAgIChtZXNzYWdlLnRhYklkIGFzIG51bWJlciB8IHVuZGVmaW5lZCkgPz9cbiAgICAgICAgICAoYXdhaXQgY2hyb21lLnRhYnMucXVlcnkoeyBhY3RpdmU6IHRydWUsIGN1cnJlbnRXaW5kb3c6IHRydWUgfSkpWzBdXG4gICAgICAgICAgICA/LmlkO1xuXG4gICAgICAgIGlmICghdGFiSWQpIHtcbiAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogZmFsc2UsIGVycm9yOiBcIk5vIGFjdGl2ZSB0YWIgZm91bmQuXCIgfSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3RhdGUgPSBhd2FpdCBnZXRUYWJSZXBvcnQodGFiSWQpO1xuICAgICAgICBjb25zdCBoaWdobGlnaHRzID1cbiAgICAgICAgICBzdGF0ZT8uc3RhdHVzID09PSBcImNvbXBsZXRlXCIgPyAoc3RhdGUuaGlnaGxpZ2h0cyA/PyBbXSkgOiBbXTtcbiAgICAgICAgY29uc3QgZGV0ZWN0aW9ucyA9XG4gICAgICAgICAgc3RhdGU/LnN0YXR1cyA9PT0gXCJjb21wbGV0ZVwiID8gc3RhdGUucmVwb3J0LmRldGVjdGlvbnMgOiBbXTtcblxuICAgICAgICBhd2FpdCBzeW5jSGlnaGxpZ2h0c1RvVGFiKFxuICAgICAgICAgIHRhYklkLFxuICAgICAgICAgIGhpZ2hsaWdodHMsXG4gICAgICAgICAgQm9vbGVhbihtZXNzYWdlLnZpc2libGUpLFxuICAgICAgICAgIGRldGVjdGlvbnMsXG4gICAgICAgICAgc3RhdGU/LnN0YXR1cyA9PT0gXCJjb21wbGV0ZVwiID8gc3RhdGUucmVwb3J0LmlkIDogdW5kZWZpbmVkLFxuICAgICAgICApO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogdHJ1ZSB9KTtcbiAgICAgIH0pKCk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmIChtZXNzYWdlPy50eXBlID09PSBcIlNDUk9MTF9UT19ISUdITElHSFRcIikge1xuICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCB0YWJJZCA9XG4gICAgICAgICAgKG1lc3NhZ2UudGFiSWQgYXMgbnVtYmVyIHwgdW5kZWZpbmVkKSA/P1xuICAgICAgICAgIChhd2FpdCBjaHJvbWUudGFicy5xdWVyeSh7IGFjdGl2ZTogdHJ1ZSwgY3VycmVudFdpbmRvdzogdHJ1ZSB9KSlbMF1cbiAgICAgICAgICAgID8uaWQ7XG5cbiAgICAgICAgaWYgKCF0YWJJZCkge1xuICAgICAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiBmYWxzZSwgZXJyb3I6IFwiTm8gYWN0aXZlIHRhYiBmb3VuZC5cIiB9KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHRhYklkLCB7XG4gICAgICAgICAgICB0eXBlOiBcIlNDUk9MTF9UT19ISUdITElHSFRcIixcbiAgICAgICAgICAgIGhpZ2hsaWdodElkOiBtZXNzYWdlLmhpZ2hsaWdodElkIGFzIHN0cmluZyxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogdHJ1ZSB9KTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgc2VuZFJlc3BvbnNlKHtcbiAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgIGVycm9yOiBcIkNvdWxkIG5vdCBzY3JvbGwgdG8gaGlnaGxpZ2h0IG9uIHRoaXMgcGFnZS5cIixcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSkoKTtcblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9KTtcbn0pO1xuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBicm93c2VyJDEgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuLy8jcmVnaW9uIHNyYy9icm93c2VyLnRzXG4vKipcbiogQ29udGFpbnMgdGhlIGBicm93c2VyYCBleHBvcnQgd2hpY2ggeW91IHNob3VsZCB1c2UgdG8gYWNjZXNzIHRoZSBleHRlbnNpb25cbiogQVBJcyBpbiB5b3VyIHByb2plY3Q6XG4qXG4qIGBgYHRzXG4qIGltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG4qXG4qIGJyb3dzZXIucnVudGltZS5vbkluc3RhbGxlZC5hZGRMaXN0ZW5lcigoKSA9PiB7XG4qICAgLy8gLi4uXG4qIH0pO1xuKiBgYGBcbipcbiogQG1vZHVsZSB3eHQvYnJvd3NlclxuKi9cbmNvbnN0IGJyb3dzZXIgPSBicm93c2VyJDE7XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGJyb3dzZXIgfTtcbiIsIi8vIHNyYy9pbmRleC50c1xudmFyIF9NYXRjaFBhdHRlcm4gPSBjbGFzcyB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybikge1xuICAgIGlmIChtYXRjaFBhdHRlcm4gPT09IFwiPGFsbF91cmxzPlwiKSB7XG4gICAgICB0aGlzLmlzQWxsVXJscyA9IHRydWU7XG4gICAgICB0aGlzLnByb3RvY29sTWF0Y2hlcyA9IFsuLi5fTWF0Y2hQYXR0ZXJuLlBST1RPQ09MU107XG4gICAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSBcIipcIjtcbiAgICAgIHRoaXMucGF0aG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBncm91cHMgPSAvKC4qKTpcXC9cXC8oLio/KShcXC8uKikvLmV4ZWMobWF0Y2hQYXR0ZXJuKTtcbiAgICAgIGlmIChncm91cHMgPT0gbnVsbClcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4obWF0Y2hQYXR0ZXJuLCBcIkluY29ycmVjdCBmb3JtYXRcIik7XG4gICAgICBjb25zdCBbXywgcHJvdG9jb2wsIGhvc3RuYW1lLCBwYXRobmFtZV0gPSBncm91cHM7XG4gICAgICB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpO1xuICAgICAgdmFsaWRhdGVIb3N0bmFtZShtYXRjaFBhdHRlcm4sIGhvc3RuYW1lKTtcbiAgICAgIHZhbGlkYXRlUGF0aG5hbWUobWF0Y2hQYXR0ZXJuLCBwYXRobmFtZSk7XG4gICAgICB0aGlzLnByb3RvY29sTWF0Y2hlcyA9IHByb3RvY29sID09PSBcIipcIiA/IFtcImh0dHBcIiwgXCJodHRwc1wiXSA6IFtwcm90b2NvbF07XG4gICAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSBob3N0bmFtZTtcbiAgICAgIHRoaXMucGF0aG5hbWVNYXRjaCA9IHBhdGhuYW1lO1xuICAgIH1cbiAgfVxuICBpbmNsdWRlcyh1cmwpIHtcbiAgICBpZiAodGhpcy5pc0FsbFVybHMpXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICBjb25zdCB1ID0gdHlwZW9mIHVybCA9PT0gXCJzdHJpbmdcIiA/IG5ldyBVUkwodXJsKSA6IHVybCBpbnN0YW5jZW9mIExvY2F0aW9uID8gbmV3IFVSTCh1cmwuaHJlZikgOiB1cmw7XG4gICAgcmV0dXJuICEhdGhpcy5wcm90b2NvbE1hdGNoZXMuZmluZCgocHJvdG9jb2wpID0+IHtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJodHRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzSHR0cE1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBzXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzSHR0cHNNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmaWxlXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRmlsZU1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZ0cFwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0Z0cE1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcInVyblwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc1Vybk1hdGNoKHUpO1xuICAgIH0pO1xuICB9XG4gIGlzSHR0cE1hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cDpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuICB9XG4gIGlzSHR0cHNNYXRjaCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHBzOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIb3N0UGF0aE1hdGNoKHVybCkge1xuICAgIGlmICghdGhpcy5ob3N0bmFtZU1hdGNoIHx8ICF0aGlzLnBhdGhuYW1lTWF0Y2gpXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgaG9zdG5hbWVNYXRjaFJlZ2V4cyA9IFtcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaCksXG4gICAgICB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gucmVwbGFjZSgvXlxcKlxcLi8sIFwiXCIpKVxuICAgIF07XG4gICAgY29uc3QgcGF0aG5hbWVNYXRjaFJlZ2V4ID0gdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5wYXRobmFtZU1hdGNoKTtcbiAgICByZXR1cm4gISFob3N0bmFtZU1hdGNoUmVnZXhzLmZpbmQoKHJlZ2V4KSA9PiByZWdleC50ZXN0KHVybC5ob3N0bmFtZSkpICYmIHBhdGhuYW1lTWF0Y2hSZWdleC50ZXN0KHVybC5wYXRobmFtZSk7XG4gIH1cbiAgaXNGaWxlTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZpbGU6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGlzRnRwTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZ0cDovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNVcm5NYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogdXJuOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBjb252ZXJ0UGF0dGVyblRvUmVnZXgocGF0dGVybikge1xuICAgIGNvbnN0IGVzY2FwZWQgPSB0aGlzLmVzY2FwZUZvclJlZ2V4KHBhdHRlcm4pO1xuICAgIGNvbnN0IHN0YXJzUmVwbGFjZWQgPSBlc2NhcGVkLnJlcGxhY2UoL1xcXFxcXCovZywgXCIuKlwiKTtcbiAgICByZXR1cm4gUmVnRXhwKGBeJHtzdGFyc1JlcGxhY2VkfSRgKTtcbiAgfVxuICBlc2NhcGVGb3JSZWdleChzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCBcIlxcXFwkJlwiKTtcbiAgfVxufTtcbnZhciBNYXRjaFBhdHRlcm4gPSBfTWF0Y2hQYXR0ZXJuO1xuTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUyA9IFtcImh0dHBcIiwgXCJodHRwc1wiLCBcImZpbGVcIiwgXCJmdHBcIiwgXCJ1cm5cIl07XG52YXIgSW52YWxpZE1hdGNoUGF0dGVybiA9IGNsYXNzIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4sIHJlYXNvbikge1xuICAgIHN1cGVyKGBJbnZhbGlkIG1hdGNoIHBhdHRlcm4gXCIke21hdGNoUGF0dGVybn1cIjogJHtyZWFzb259YCk7XG4gIH1cbn07XG5mdW5jdGlvbiB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpIHtcbiAgaWYgKCFNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmluY2x1ZGVzKHByb3RvY29sKSAmJiBwcm90b2NvbCAhPT0gXCIqXCIpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgJHtwcm90b2NvbH0gbm90IGEgdmFsaWQgcHJvdG9jb2wgKCR7TWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5qb2luKFwiLCBcIil9KWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVIb3N0bmFtZShtYXRjaFBhdHRlcm4sIGhvc3RuYW1lKSB7XG4gIGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIjpcIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4obWF0Y2hQYXR0ZXJuLCBgSG9zdG5hbWUgY2Fubm90IGluY2x1ZGUgYSBwb3J0YCk7XG4gIGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIipcIikgJiYgaG9zdG5hbWUubGVuZ3RoID4gMSAmJiAhaG9zdG5hbWUuc3RhcnRzV2l0aChcIiouXCIpKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxuICAgICAgbWF0Y2hQYXR0ZXJuLFxuICAgICAgYElmIHVzaW5nIGEgd2lsZGNhcmQgKCopLCBpdCBtdXN0IGdvIGF0IHRoZSBzdGFydCBvZiB0aGUgaG9zdG5hbWVgXG4gICAgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlUGF0aG5hbWUobWF0Y2hQYXR0ZXJuLCBwYXRobmFtZSkge1xuICByZXR1cm47XG59XG5leHBvcnQge1xuICBJbnZhbGlkTWF0Y2hQYXR0ZXJuLFxuICBNYXRjaFBhdHRlcm5cbn07XG4iXSwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsNyw4LDldLCJtYXBwaW5ncyI6Ijs7Q0FDQSxTQUFTLGlCQUFpQixLQUFLO0VBQzlCLElBQUksT0FBTyxRQUFRLE9BQU8sUUFBUSxZQUFZLE9BQU8sRUFBRSxNQUFNLElBQUk7RUFDakUsT0FBTztDQUNSOzs7Q0NGQSxJQUFNLG1CQUFtQjtFQUN2QjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7Q0FDRjtDQUVBLElBQU0sb0JBQW9CO0VBQ3hCO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtDQUNGO0NBRUEsSUFBTSx3QkFBd0I7RUFDNUI7RUFDQTtFQUNBO0VBQ0E7RUFDQTtDQUNGO0NBRUEsSUFBTSwwQkFBMEI7RUFDOUI7RUFDQTtFQUNBO0VBQ0E7Q0FDRjtDQUVBLElBQU0sd0JBQXdCO0VBQzVCO0VBQ0E7RUFDQTtDQUNGO0NBRUEsU0FBUyxjQUFjLE1BQWMsVUFBOEI7RUFDakUsT0FBTyxTQUNKLFFBQVEsWUFBWSxRQUFRLEtBQUssSUFBSSxD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