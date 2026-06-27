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
		const isLowStock = /only \d+ left|low stock|almost sold out/i.test(text);
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
			patternType: "LiveActivityMessage",
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
	async function syncHighlightsToTab(tabId, highlights, visible, detections = []) {
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
				visible: true
			});
		} catch {}
	}
	async function applyCachedReport(tabId, report, highlights = []) {
		await setTabReport(tabId, {
			status: "complete",
			report,
			highlights
		});
		await updateBadge(tabId, report.concernLevel);
		await syncHighlightsToTab(tabId, highlights, highlights.length > 0 || report.detections.length > 0, report.detections);
	}
	async function hydrateTabFromCache(tabId, url) {
		const existing = await getTabReport(tabId);
		if (existing?.status === "complete" && urlsMatchForCache(existing.report.normalizedUrl ?? existing.report.url, url)) return true;
		let cached = await getUrlReportCache(url);
		if (!cached) {
			cached = await fetchCachedReportFromBackend(url);
			if (cached) await setUrlReportCache(url, cached);
		}
		if (!cached) return false;
		if (existing?.status === "complete" && urlsMatchForCache(existing.report.normalizedUrl ?? existing.report.url, cached.normalizedUrl ?? cached.url)) return true;
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
		await setTabReport(tabId, { status: "analyzing" });
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
			await applyCachedReport(tabId, buildLocalFallbackReport(payload.url, payload.pageTitle, heuristicSignals), highlights);
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
					await setTabReport(activeInfo.tabId, { status: "idle" });
					await syncHighlightsToTab(activeInfo.tabId, [], false);
					return;
				}
				await hydrateTabFromCache(activeInfo.tabId, tab.url);
				const state = await getTabReport(activeInfo.tabId);
				if (state?.status === "complete") {
					const highlights = state.highlights ?? [];
					const detections = state.report.detections;
					if (highlights.length > 0 || detections.length > 0) await syncHighlightsToTab(activeInfo.tabId, highlights, true, detections);
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
					await setTabReport(tabId, { status: "analyzing" });
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
					if (state?.status === "complete") await setTabReport(tabId, {
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
					await syncHighlightsToTab(tabId, highlights, Boolean(message.visible), detections);
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsIm5hbWVzIjpbImJyb3dzZXIiXSwic291cmNlcyI6WyIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWJhY2tncm91bmQubWpzIiwiLi4vLi4vLi4vc2hhcmVkL2hldXJpc3RpY3MvaW5kZXgudHMiLCIuLi8uLi8uLi9zaGFyZWQvd29yZGluZy9pbmRleC50cyIsIi4uLy4uL3NyYy9saWIvZXhjbHVkZWQtaG9zdHMudHMiLCIuLi8uLi9zcmMvbGliL3N0b3JhZ2UudHMiLCIuLi8uLi9zcmMvYXBpL2NsaWVudC50cyIsIi4uLy4uL3NyYy9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0B3eHQtZGV2L2Jyb3dzZXIvc3JjL2luZGV4Lm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad2ViZXh0LWNvcmUvbWF0Y2gtcGF0dGVybnMvbGliL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vI3JlZ2lvbiBzcmMvdXRpbHMvZGVmaW5lLWJhY2tncm91bmQudHNcbmZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG5cdGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuXHRyZXR1cm4gYXJnO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBkZWZpbmVCYWNrZ3JvdW5kIH07XG4iLCJpbXBvcnQgdHlwZSB7IEhldXJpc3RpY1NpZ25hbCwgUGFnZVR5cGUgfSBmcm9tIFwiLi4vdHlwZXMvc2NhblwiO1xuXG5jb25zdCBVUkdFTkNZX1BBVFRFUk5TID0gW1xuICAvY291bnRkb3duL2ksXG4gIC9kZWFsIGVuZHMgKGlufHNvb258dG9kYXkpL2ksXG4gIC9saW1pdGVkIHRpbWUgb25seS9pLFxuICAvb2ZmZXIgZXhwaXJlcy9pLFxuICAvZW5kcyBpbiBcXGQrL2ksXG4gIC9zYWxlIGVuZHMvaSxcbiAgL2VuZHMgdG9kYXkvaSxcbiAgL2xhc3QgY2hhbmNlL2ksXG4gIC9mbGFzaCBzYWxlL2ksXG5dO1xuXG5jb25zdCBTQ0FSQ0lUWV9QQVRURVJOUyA9IFtcbiAgL2luIHN0b2NrL2ksXG4gIC9vbmx5IFxcZCsgbGVmdC9pLFxuICAvb25seSBcXGQrIHJlbWFpbmluZy9pLFxuICAvbG93IHN0b2NrL2ksXG4gIC9zZWxsaW5nIGZhc3QvaSxcbiAgL2hpZ2ggZGVtYW5kL2ksXG4gIC9wZW9wbGUgKGFyZSApP3ZpZXdpbmcvaSxcbiAgL2luIFxcZCsgY2FydHM/L2ksXG4gIC9hbG1vc3Qgc29sZCBvdXQvaSxcbiAgL2xpbWl0ZWQgcXVhbnRpdHkvaSxcbiAgL2ZldyBsZWZ0L2ksXG4gIC9sZWZ0IGluIHN0b2NrL2ksXG5dO1xuXG5jb25zdCBTT0NJQUxfUFJPT0ZfUEFUVEVSTlMgPSBbXG4gIC9wZW9wbGUgKGFyZSApP3ZpZXdpbmcvaSxcbiAgL2JvdWdodCBpbiB0aGUgbGFzdC9pLFxuICAvc29tZW9uZSBqdXN0IHB1cmNoYXNlZC9pLFxuICAvcmVjZW50KGx5KT8gcHVyY2hhc2VkL2ksXG4gIC9cXGQrIChwZW9wbGV8dXNlcnN8Y3VzdG9tZXJzKSAoYXJlICk/KHZpZXdpbmd8d2F0Y2hpbmcpL2ksXG5dO1xuXG5jb25zdCBDT05GSVJNU0hBTUlOR19QQVRURVJOUyA9IFtcbiAgL25vIHRoYW5rcyw/IGkgaGF0ZSBzYXZpbmcvaSxcbiAgL2kgZG9uWycnXXQgd2FudCBhIGRpc2NvdW50L2ksXG4gIC9ubyw/IGlbJyddbGwgcGF5IGZ1bGwgcHJpY2UvaSxcbiAgL2NvbnRpbnVlIHdpdGhvdXQvaSxcbl07XG5cbmNvbnN0IFBSRVNFTEVDVElPTl9QQVRURVJOUyA9IFtcbiAgL3ByZS1jaGVja2VkL2ksXG4gIC9jaGVja2VkIGJ5IGRlZmF1bHQvaSxcbiAgL29wdC4/b3V0L2ksXG5dO1xuXG5mdW5jdGlvbiBtYXRjaFBhdHRlcm5zKHRleHQ6IHN0cmluZywgcGF0dGVybnM6IFJlZ0V4cFtdKTogc3RyaW5nW10ge1xuICByZXR1cm4gcGF0dGVybnNcbiAgICAuZmlsdGVyKChwYXR0ZXJuKSA9PiBwYXR0ZXJuLnRlc3QodGV4dCkpXG4gICAgLm1hcCgocGF0dGVybikgPT4gcGF0dGVybi5zb3VyY2UpO1xufVxuXG5mdW5jdGlvbiBwcmVzc3VyZVRleHQoXG4gIHZpc2libGVUZXh0OiBzdHJpbmcsXG4gIGludGVyYWN0aXZlSHRtbDogc3RyaW5nLFxuICBwYWdlVHlwZTogUGFnZVR5cGUsXG4pOiBzdHJpbmcge1xuICBpZiAocGFnZVR5cGUgPT09IFwiZWRpdG9yaWFsXCIpIHtcbiAgICByZXR1cm4gaW50ZXJhY3RpdmVIdG1sO1xuICB9XG4gIHJldHVybiBgJHt2aXNpYmxlVGV4dH1cXG4ke2ludGVyYWN0aXZlSHRtbH1gO1xufVxuXG5mdW5jdGlvbiBoYXNBY3RpdmVUaW1lcihodG1sOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIChcbiAgICAvY291bnRkb3dufHRpbWVyfGVuZHMgaW4gXFxkKy9pLnRlc3QoaHRtbCkgJiZcbiAgICAoL2NsYXNzPVwiW15cIl0qKGNvdW50ZG93bnx0aW1lcilbXlwiXSpcIi9pLnRlc3QoaHRtbCkgfHxcbiAgICAgIC9kYXRhLWNvdW50ZG93bnxyb2xlPVwidGltZXJcIi9pLnRlc3QoaHRtbCkgfHxcbiAgICAgIC9lbmRzIGluIFxcZCsvaS50ZXN0KGh0bWwpKVxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0VXJnZW5jeShcbiAgdmlzaWJsZVRleHQ6IHN0cmluZyxcbiAgaHRtbDogc3RyaW5nLFxuICBwYWdlVHlwZTogUGFnZVR5cGUgPSBcImdlbmVyYWxcIixcbik6IEhldXJpc3RpY1NpZ25hbFtdIHtcbiAgY29uc3QgcGF0dGVyblNvdXJjZSA9IHByZXNzdXJlVGV4dCh2aXNpYmxlVGV4dCwgaHRtbCwgcGFnZVR5cGUpO1xuICBjb25zdCBtYXRjaGVzID0gbWF0Y2hQYXR0ZXJucyhwYXR0ZXJuU291cmNlLCBVUkdFTkNZX1BBVFRFUk5TKTtcbiAgaWYgKG1hdGNoZXMubGVuZ3RoID09PSAwKSByZXR1cm4gW107XG5cbiAgY29uc3QgdGltZXJEZXRlY3RlZCA9IGhhc0FjdGl2ZVRpbWVyKGh0bWwpO1xuXG4gIHJldHVybiBbXG4gICAge1xuICAgICAgY2F0ZWdvcnk6IFwiVVJHRU5DWVwiLFxuICAgICAgcGF0dGVyblR5cGU6IHRpbWVyRGV0ZWN0ZWQgPyBcIkNvdW50ZG93blRpbWVyXCIgOiBcIkxpbWl0ZWRUaW1lTWVzc2FnZVwiLFxuICAgICAgc2V2ZXJpdHk6IHRpbWVyRGV0ZWN0ZWQgPyBcIkhJR0hcIiA6IFwiTUVESVVNXCIsXG4gICAgICBkZXNjcmlwdGlvbjogdGltZXJEZXRlY3RlZFxuICAgICAgICA/IFwiUG90ZW50aWFsIHVyZ2VuY3kgY3VlIGRldGVjdGVkLiBDb3VudGRvd24gdGltZXJzIGFyZSBjb21tb24gaW4gbWFya2V0aW5nLCBidXQgY2FuIGNyZWF0ZSB0aW1lIHByZXNzdXJlLlwiXG4gICAgICAgIDogXCJQb3RlbnRpYWwgdXJnZW5jeSBjdWUgZGV0ZWN0ZWQuIFRoaXMgbWF5IGVuY291cmFnZSBmYXN0ZXIgZGVjaXNpb24tbWFraW5nLlwiLFxuICAgICAgZXZpZGVuY2U6IG1hdGNoZXMuc2xpY2UoMCwgMikuam9pbihcIjsgXCIpLFxuICAgICAgY29uZmlkZW5jZTogdGltZXJEZXRlY3RlZCA/IDAuODUgOiAwLjcsXG4gICAgICBzb3VyY2U6IFwiaGV1cmlzdGljXCIsXG4gICAgfSxcbiAgXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRldGVjdFNjYXJjaXR5KFxuICB2aXNpYmxlVGV4dDogc3RyaW5nLFxuICBwYWdlVHlwZTogUGFnZVR5cGUgPSBcImdlbmVyYWxcIixcbiAgaW50ZXJhY3RpdmVIdG1sID0gXCJcIixcbik6IEhldXJpc3RpY1NpZ25hbFtdIHtcbiAgY29uc3QgdGV4dCA9XG4gICAgcGFnZVR5cGUgPT09IFwiZWRpdG9yaWFsXCIgPyBpbnRlcmFjdGl2ZUh0bWwgOiB2aXNpYmxlVGV4dDtcbiAgY29uc3QgbWF0Y2hlcyA9IG1hdGNoUGF0dGVybnModGV4dCwgU0NBUkNJVFlfUEFUVEVSTlMpO1xuICBpZiAobWF0Y2hlcy5sZW5ndGggPT09IDApIHJldHVybiBbXTtcblxuICBjb25zdCBpc0xvd1N0b2NrID0gL29ubHkgXFxkKyBsZWZ0fGxvdyBzdG9ja3xhbG1vc3Qgc29sZCBvdXQvaS50ZXN0KHRleHQpO1xuICByZXR1cm4gW1xuICAgIHtcbiAgICAgIGNhdGVnb3J5OiBcIlNDQVJDSVRZXCIsXG4gICAgICBwYXR0ZXJuVHlwZTogaXNMb3dTdG9jayA/IFwiTG93U3RvY2tNZXNzYWdlXCIgOiBcIkhpZ2hEZW1hbmRNZXNzYWdlXCIsXG4gICAgICBzZXZlcml0eTogXCJNRURJVU1cIixcbiAgICAgIGRlc2NyaXB0aW9uOiBpc0xvd1N0b2NrXG4gICAgICAgID8gXCJQb3NzaWJsZSBzY2FyY2l0eSBjdWUgZGV0ZWN0ZWQuIFNjYXJjaXR5IG1lc3NhZ2VzIG1heSBiZSB1c2VmdWwgd2hlbiBhY2N1cmF0ZSwgYnV0IGFyZSBoYXJkIGZvciB1c2VycyB0byB2ZXJpZnkuXCJcbiAgICAgICAgOiBcIlBvc3NpYmxlIHNjYXJjaXR5IGN1ZSBkZXRlY3RlZC4gSGlnaC1kZW1hbmQgbWVzc2FnaW5nIG1heSBleGFnZ2VyYXRlIHNjYXJjaXR5LlwiLFxuICAgICAgZXZpZGVuY2U6IG1hdGNoZXMuc2xpY2UoMCwgMikuam9pbihcIjsgXCIpLFxuICAgICAgY29uZmlkZW5jZTogMC43NSxcbiAgICAgIHNvdXJjZTogXCJoZXVyaXN0aWNcIixcbiAgICB9LFxuICBdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0U29jaWFsUHJvb2YoXG4gIHZpc2libGVUZXh0OiBzdHJpbmcsXG4gIHBhZ2VUeXBlOiBQYWdlVHlwZSA9IFwiZ2VuZXJhbFwiLFxuICBpbnRlcmFjdGl2ZUh0bWwgPSBcIlwiLFxuKTogSGV1cmlzdGljU2lnbmFsW10ge1xuICBjb25zdCB0ZXh0ID1cbiAgICBwYWdlVHlwZSA9PT0gXCJlZGl0b3JpYWxcIiA/IGludGVyYWN0aXZlSHRtbCA6IHZpc2libGVUZXh0O1xuICBjb25zdCBtYXRjaGVzID0gbWF0Y2hQYXR0ZXJucyh0ZXh0LCBTT0NJQUxfUFJPT0ZfUEFUVEVSTlMpO1xuICBpZiAobWF0Y2hlcy5sZW5ndGggPT09IDApIHJldHVybiBbXTtcblxuICByZXR1cm4gW1xuICAgIHtcbiAgICAgIGNhdGVnb3J5OiBcIlNPQ0lBTF9QUk9PRlwiLFxuICAgICAgcGF0dGVyblR5cGU6IFwiTGl2ZUFjdGl2aXR5TWVzc2FnZVwiLFxuICAgICAgc2V2ZXJpdHk6IFwiTUVESVVNXCIsXG4gICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgXCJQb3NzaWJsZSBzb2NpYWwgcHJvb2YgY3VlIGRldGVjdGVkLiBWaXNpdG9yIGNvdW50IG1lc3NhZ2VzIG1heSBjcmVhdGUgc29jaWFsIHByb29mLlwiLFxuICAgICAgZXZpZGVuY2U6IG1hdGNoZXMuc2xpY2UoMCwgMikuam9pbihcIjsgXCIpLFxuICAgICAgY29uZmlkZW5jZTogMC43LFxuICAgICAgc291cmNlOiBcImhldXJpc3RpY1wiLFxuICAgIH0sXG4gIF07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZXRlY3RDb25maXJtc2hhbWluZyhcbiAgdmlzaWJsZVRleHQ6IHN0cmluZyxcbiAgcGFnZVR5cGU6IFBhZ2VUeXBlID0gXCJnZW5lcmFsXCIsXG4gIGludGVyYWN0aXZlSHRtbCA9IFwiXCIsXG4pOiBIZXVyaXN0aWNTaWduYWxbXSB7XG4gIGNvbnN0IHRleHQgPVxuICAgIHBhZ2VUeXBlID09PSBcImVkaXRvcmlhbFwiID8gaW50ZXJhY3RpdmVIdG1sIDogdmlzaWJsZVRleHQ7XG4gIGNvbnN0IG1hdGNoZXMgPSBtYXRjaFBhdHRlcm5zKHRleHQsIENPTkZJUk1TSEFNSU5HX1BBVFRFUk5TKTtcbiAgaWYgKG1hdGNoZXMubGVuZ3RoID09PSAwKSByZXR1cm4gW107XG5cbiAgcmV0dXJuIFtcbiAgICB7XG4gICAgICBjYXRlZ29yeTogXCJGT1JDRURfQUNUSU9OXCIsXG4gICAgICBwYXR0ZXJuVHlwZTogXCJDb25maXJtc2hhbWluZ1wiLFxuICAgICAgc2V2ZXJpdHk6IFwiTUVESVVNXCIsXG4gICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgXCJQb3NzaWJsZSBwcmVzc3VyZSBjdWUgZGV0ZWN0ZWQgaW4gZGVjbGluZSBvciBvcHQtb3V0IHdvcmRpbmcuXCIsXG4gICAgICBldmlkZW5jZTogbWF0Y2hlcy5zbGljZSgwLCAyKS5qb2luKFwiOyBcIiksXG4gICAgICBjb25maWRlbmNlOiAwLjc1LFxuICAgICAgc291cmNlOiBcImhldXJpc3RpY1wiLFxuICAgIH0sXG4gIF07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZXRlY3RQcmVzZWxlY3Rpb24oaHRtbDogc3RyaW5nKTogSGV1cmlzdGljU2lnbmFsW10ge1xuICBjb25zdCBoYXNDaGVja2VkSW5wdXQgPSAvPGlucHV0W14+XSpcXGJjaGVja2VkXFxiL2kudGVzdChodG1sKTtcbiAgY29uc3QgbWF0Y2hlcyA9IG1hdGNoUGF0dGVybnMoaHRtbCwgUFJFU0VMRUNUSU9OX1BBVFRFUk5TKTtcblxuICBpZiAoIWhhc0NoZWNrZWRJbnB1dCAmJiBtYXRjaGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuXG4gIHJldHVybiBbXG4gICAge1xuICAgICAgY2F0ZWdvcnk6IFwiUFJFU0VMRUNUSU9OXCIsXG4gICAgICBwYXR0ZXJuVHlwZTogXCJQcmVDaGVja2VkQm94XCIsXG4gICAgICBzZXZlcml0eTogXCJNRURJVU1cIixcbiAgICAgIGRlc2NyaXB0aW9uOlxuICAgICAgICBcIlBvc3NpYmxlIHByZXNlbGVjdGlvbiBjdWUgZGV0ZWN0ZWQuIFByZS1zZWxlY3RlZCBvcHRpb25zIGNhbiBudWRnZSB1c2VycyB0b3dhcmQgYWRkLW9ucyBvciBtYXJrZXRpbmcgY29uc2VudC5cIixcbiAgICAgIGV2aWRlbmNlOiBoYXNDaGVja2VkSW5wdXRcbiAgICAgICAgPyBcIlByZS1jaGVja2VkIGlucHV0IGVsZW1lbnRzIGRldGVjdGVkIGluIHBhZ2UgbWFya3VwLlwiXG4gICAgICAgIDogbWF0Y2hlcy5qb2luKFwiOyBcIiksXG4gICAgICBjb25maWRlbmNlOiBoYXNDaGVja2VkSW5wdXQgPyAwLjggOiAwLjY1LFxuICAgICAgc291cmNlOiBcImhldXJpc3RpY1wiLFxuICAgIH0sXG4gIF07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZXRlY3RPYnN0cnVjdGlvbihcbiAgaHRtbDogc3RyaW5nLFxuICBwYWdlVHlwZTogUGFnZVR5cGUgPSBcImdlbmVyYWxcIixcbik6IEhldXJpc3RpY1NpZ25hbFtdIHtcbiAgaWYgKHBhZ2VUeXBlID09PSBcImVkaXRvcmlhbFwiKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgY29uc3QgaGFzU3RpY2t5T3ZlcmxheSA9XG4gICAgL3Bvc2l0aW9uOlxccyooZml4ZWR8c3RpY2t5KS9pLnRlc3QoaHRtbCkgfHxcbiAgICAvY2xhc3M9XCJbXlwiXSoobW9kYWx8cG9wdXB8b3ZlcmxheXxzdGlja3ktYmFubmVyKVteXCJdKlwiL2kudGVzdChodG1sKTtcblxuICBpZiAoIWhhc1N0aWNreU92ZXJsYXkpIHJldHVybiBbXTtcblxuICByZXR1cm4gW1xuICAgIHtcbiAgICAgIGNhdGVnb3J5OiBcIk9CU1RSVUNUSU9OXCIsXG4gICAgICBwYXR0ZXJuVHlwZTogXCJTdGlja3lQcmVzc3VyZUJhbm5lclwiLFxuICAgICAgc2V2ZXJpdHk6IFwiTUVESVVNXCIsXG4gICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgXCJQb3NzaWJsZSBvYnN0cnVjdGlvbiBjdWUgZGV0ZWN0ZWQuIFN0aWNreSBiYW5uZXJzIG9yIG92ZXJsYXlzIG1heSBrZWVwIGNoZWNrb3V0IHByZXNzdXJlIHZpc2libGUuXCIsXG4gICAgICBldmlkZW5jZTogXCJGaXhlZCBvciBzdGlja3kgb3ZlcmxheS1saWtlIGVsZW1lbnRzIGRldGVjdGVkLlwiLFxuICAgICAgY29uZmlkZW5jZTogMC42NSxcbiAgICAgIHNvdXJjZTogXCJoZXVyaXN0aWNcIixcbiAgICB9LFxuICBdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcnVuSGV1cmlzdGljcyhwYWdlOiB7XG4gIHZpc2libGVUZXh0OiBzdHJpbmc7XG4gIGludGVyYWN0aXZlSHRtbDogc3RyaW5nO1xuICBwYWdlVHlwZT86IFBhZ2VUeXBlO1xufSk6IEhldXJpc3RpY1NpZ25hbFtdIHtcbiAgY29uc3QgcGFnZVR5cGUgPSBwYWdlLnBhZ2VUeXBlID8/IFwiZ2VuZXJhbFwiO1xuXG4gIHJldHVybiBbXG4gICAgLi4uZGV0ZWN0VXJnZW5jeShwYWdlLnZpc2libGVUZXh0LCBwYWdlLmludGVyYWN0aXZlSHRtbCwgcGFnZVR5cGUpLFxuICAgIC4uLmRldGVjdFNjYXJjaXR5KHBhZ2UudmlzaWJsZVRleHQsIHBhZ2VUeXBlLCBwYWdlLmludGVyYWN0aXZlSHRtbCksXG4gICAgLi4uZGV0ZWN0U29jaWFsUHJvb2YocGFnZS52aXNpYmxlVGV4dCwgcGFnZVR5cGUsIHBhZ2UuaW50ZXJhY3RpdmVIdG1sKSxcbiAgICAuLi5kZXRlY3RDb25maXJtc2hhbWluZyhcbiAgICAgIHBhZ2UudmlzaWJsZVRleHQsXG4gICAgICBwYWdlVHlwZSxcbiAgICAgIHBhZ2UuaW50ZXJhY3RpdmVIdG1sLFxuICAgICksXG4gICAgLi4uZGV0ZWN0UHJlc2VsZWN0aW9uKHBhZ2UuaW50ZXJhY3RpdmVIdG1sKSxcbiAgICAuLi5kZXRlY3RPYnN0cnVjdGlvbihwYWdlLmludGVyYWN0aXZlSHRtbCwgcGFnZVR5cGUpLFxuICBdO1xufVxuIiwiaW1wb3J0IHR5cGUgeyBDb25jZXJuTGV2ZWwgfSBmcm9tIFwiLi4vdHlwZXMvc2NhblwiO1xuXG5leHBvcnQgY29uc3QgSE9NRV9ESVNDTEFJTUVSID1cbiAgXCJUaGlzIHRvb2wgaWRlbnRpZmllcyBwb3RlbnRpYWwgcHJlc3N1cmUgdGFjdGljcyBhbmQgZGVzaWduIGN1ZXMuIEl0IGRvZXMgbm90IGRldGVybWluZSB3aGV0aGVyIGEgd2Vic2l0ZSBpcyB1bmxhd2Z1bCwgZnJhdWR1bGVudCwgb3IgdW5zYWZlLlwiO1xuXG5leHBvcnQgY29uc3QgUkVQT1JUX0RJU0NMQUlNRVIgPVxuICBcIkZpbmRpbmdzIGFyZSBiYXNlZCBvbiBhdXRvbWF0ZWQgYW5hbHlzaXMgYW5kIG1heSBiZSBpbmNvbXBsZXRlIG9yIGluY29ycmVjdC5cIjtcblxuZXhwb3J0IGNvbnN0IFBST0hJQklURURfV09SRFMgPSBbXG4gIFwic2NhbVwiLFxuICBcImZyYXVkXCIsXG4gIFwiY3JpbWluYWxcIixcbiAgXCJpbGxlZ2FsXCIsXG4gIFwiY2hlYXRpbmdcIixcbiAgXCJkaXNob25lc3Qgc2VsbGVyXCIsXG4gIFwicHJlZGF0b3J5IGJ1c2luZXNzXCIsXG4gIFwicHJlZGF0b3J5XCIsXG4gIFwiZGVjZXB0aXZlIGNvbXBhbnlcIixcbl0gYXMgY29uc3Q7XG5cbmV4cG9ydCBjb25zdCBERUNJU0lPTl9DSEVDS0xJU1QgPSBbXG4gIFwiQ2hlY2sgcmVmdW5kIHRlcm1zLlwiLFxuICBcIkNvbXBhcmUgcHJpY2VzIGVsc2V3aGVyZS5cIixcbiAgXCJMb29rIGZvciBpbmRlcGVuZGVudCByZXZpZXdzLlwiLFxuICBcIkF2b2lkIHJ1c2hpbmcgYmVjYXVzZSBvZiB0aW1lcnMuXCIsXG4gIFwiQ2hlY2sgd2hldGhlciBmZWVzIGFwcGVhciBvbmx5IGF0IGNoZWNrb3V0LlwiLFxuICBcIlNhdmUgYSBjb3B5IG9mIGltcG9ydGFudCB0ZXJtcyBiZWZvcmUgcGF5aW5nLlwiLFxuXSBhcyBjb25zdDtcblxuZXhwb3J0IGZ1bmN0aW9uIGNvbmNlcm5MZXZlbEZyb21TY29yZShzY29yZTogbnVtYmVyIHwgbnVsbCk6IENvbmNlcm5MZXZlbCB7XG4gIGlmIChzY29yZSA9PT0gbnVsbCkgcmV0dXJuIFwiVU5BQkxFXCI7XG4gIGlmIChzY29yZSA+PSA3MCkgcmV0dXJuIFwiSElHSFwiO1xuICBpZiAoc2NvcmUgPj0gNTApIHJldHVybiBcIk1PREVSQVRFXCI7XG4gIGlmIChzY29yZSA+PSAyNSkgcmV0dXJuIFwiU09NRVwiO1xuICByZXR1cm4gXCJMT1dcIjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbmNlcm5MZXZlbExhYmVsKGxldmVsOiBDb25jZXJuTGV2ZWwpOiBzdHJpbmcge1xuICBzd2l0Y2ggKGxldmVsKSB7XG4gICAgY2FzZSBcIkxPV1wiOlxuICAgICAgcmV0dXJuIFwiTG93IGNvbmNlcm5cIjtcbiAgICBjYXNlIFwiU09NRVwiOlxuICAgICAgcmV0dXJuIFwiU29tZSBjYXV0aW9uXCI7XG4gICAgY2FzZSBcIk1PREVSQVRFXCI6XG4gICAgICByZXR1cm4gXCJNb2RlcmF0ZSBjYXV0aW9uXCI7XG4gICAgY2FzZSBcIkhJR0hcIjpcbiAgICAgIHJldHVybiBcIkhpZ2ggY2F1dGlvblwiO1xuICAgIGNhc2UgXCJVTkFCTEVcIjpcbiAgICAgIHJldHVybiBcIlVuYWJsZSB0byBhc3Nlc3NcIjtcbiAgICBkZWZhdWx0OiB7XG4gICAgICBjb25zdCBfZXhoYXVzdGl2ZTogbmV2ZXIgPSBsZXZlbDtcbiAgICAgIHJldHVybiBfZXhoYXVzdGl2ZTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN1Z2dlc3RlZEFjdGlvbkZvckNhdGVnb3J5KGNhdGVnb3J5OiBzdHJpbmcpOiBzdHJpbmcge1xuICBzd2l0Y2ggKGNhdGVnb3J5KSB7XG4gICAgY2FzZSBcIlVSR0VOQ1lcIjpcbiAgICAgIHJldHVybiBcIkNvbnNpZGVyIHJldmlzaXRpbmcgdGhlIHBhZ2UgbGF0ZXIgdG8gY2hlY2sgd2hldGhlciB0aGUgb2ZmZXIgY2hhbmdlcy5cIjtcbiAgICBjYXNlIFwiU0NBUkNJVFlcIjpcbiAgICAgIHJldHVybiBcIkNvbXBhcmUgYXZhaWxhYmlsaXR5IG9uIGFub3RoZXIgY2hhbm5lbCBiZWZvcmUgZGVjaWRpbmcuXCI7XG4gICAgY2FzZSBcIlNPQ0lBTF9QUk9PRlwiOlxuICAgICAgcmV0dXJuIFwiVHJlYXQgdmlzaXRvciBvciBwdXJjaGFzZSBjb3VudHMgYXMgdW52ZXJpZmllZCBzb2NpYWwgY3Vlcy5cIjtcbiAgICBjYXNlIFwiUFJFU0VMRUNUSU9OXCI6XG4gICAgICByZXR1cm4gXCJSZXZpZXcgcHJlLXNlbGVjdGVkIG9wdGlvbnMgY2FyZWZ1bGx5IGJlZm9yZSBjb250aW51aW5nLlwiO1xuICAgIGNhc2UgXCJGT1JDRURfQUNUSU9OXCI6XG4gICAgICByZXR1cm4gXCJMb29rIGZvciBhIGNsZWFyIHdheSB0byBkZWNsaW5lIHdpdGhvdXQgcGVuYWx0eS5cIjtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFwiQ29uc2lkZXIgY2hlY2tpbmcgaW5kZXBlbmRlbnRseSBiZWZvcmUgcGF5aW5nLlwiO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzYW5pdGl6ZVRleHQodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHJlc3VsdCA9IHRleHQ7XG4gIGZvciAoY29uc3Qgd29yZCBvZiBQUk9ISUJJVEVEX1dPUkRTKSB7XG4gICAgY29uc3QgcGF0dGVybiA9IG5ldyBSZWdFeHAoYFxcXFxiJHt3b3JkfVxcXFxiYCwgXCJnaVwiKTtcbiAgICByZXN1bHQgPSByZXN1bHQucmVwbGFjZShwYXR0ZXJuLCBcInBvdGVudGlhbCBwcmVzc3VyZSBjdWVcIik7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiIsIi8qKiBCcm93c2VyLWludGVybmFsIHBhZ2VzIHRoYXQgYXJlIG5ldmVyIHNjYW5uZWQuICovXG5leHBvcnQgY29uc3QgRVhDTFVERURfVVJMX1BSRUZJWEVTID0gW1xuICBcImNocm9tZTovL1wiLFxuICBcImNocm9tZS11bnRydXN0ZWQ6Ly9cIixcbiAgXCJjaHJvbWUtZXh0ZW5zaW9uOi8vXCIsXG4gIFwiYWJvdXQ6XCIsXG4gIFwiZWRnZTovL1wiLFxuICBcImJyYXZlOi8vXCIsXG5dIGFzIGNvbnN0O1xuXG4vKiogUG9wdWxhciBzaXRlcyBza2lwcGVkIGJ5IGF1dG8tc2NhbiAoZW1haWwsIGNoYXQsIHNvY2lhbCwgc3RyZWFtaW5nLCBldGMuKS4gKi9cbmV4cG9ydCBjb25zdCBFWENMVURFRF9IT1NUUyA9IFtcbiAgLy8gR29vZ2xlXG4gIFwiZ29vZ2xlLmNvbVwiLFxuICBcImdtYWlsLmNvbVwiLFxuICBcInlvdXR1YmUuY29tXCIsXG4gIC8vIE1ldGFcbiAgXCJmYWNlYm9vay5jb21cIixcbiAgXCJpbnN0YWdyYW0uY29tXCIsXG4gIFwibWV0YS5jb21cIixcbiAgXCJtZXNzZW5nZXIuY29tXCIsXG4gIFwidGhyZWFkcy5uZXRcIixcbiAgXCJ3aGF0c2FwcC5jb21cIixcbiAgLy8gTWljcm9zb2Z0XG4gIFwibWljcm9zb2Z0LmNvbVwiLFxuICBcIm91dGxvb2suY29tXCIsXG4gIFwibGl2ZS5jb21cIixcbiAgXCJob3RtYWlsLmNvbVwiLFxuICBcIm9mZmljZS5jb21cIixcbiAgXCJvZmZpY2UzNjUuY29tXCIsXG4gIC8vIEFwcGxlXG4gIFwiYXBwbGUuY29tXCIsXG4gIFwiaWNsb3VkLmNvbVwiLFxuICAvLyBTb2NpYWwgJiBtZXNzYWdpbmdcbiAgXCJ0d2l0dGVyLmNvbVwiLFxuICBcInguY29tXCIsXG4gIFwibGlua2VkaW4uY29tXCIsXG4gIFwidGlrdG9rLmNvbVwiLFxuICBcInJlZGRpdC5jb21cIixcbiAgXCJwaW50ZXJlc3QuY29tXCIsXG4gIFwic25hcGNoYXQuY29tXCIsXG4gIFwiZGlzY29yZC5jb21cIixcbiAgXCJzbGFjay5jb21cIixcbiAgXCJ0ZWxlZ3JhbS5vcmdcIixcbiAgXCJ0Lm1lXCIsXG4gIFwiem9vbS51c1wiLFxuICBcInpvb20uY29tXCIsXG4gIC8vIEVtYWlsXG4gIFwieWFob28uY29tXCIsXG4gIFwicHJvdG9uLm1lXCIsXG4gIFwicHJvdG9ubWFpbC5jb21cIixcbiAgLy8gU3RyZWFtaW5nICYgY29tbWVyY2VcbiAgXCJuZXRmbGl4LmNvbVwiLFxuICBcInNwb3RpZnkuY29tXCIsXG4gIFwiYW1hem9uLmNvbVwiLFxuICBcImJpbmcuY29tXCIsXG5dIGFzIGNvbnN0O1xuXG5leHBvcnQgZnVuY3Rpb24gaXNFeGNsdWRlZFVybCh1cmw6IHN0cmluZyB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuICBpZiAoIXVybCkgcmV0dXJuIHRydWU7XG5cbiAgY29uc3QgbG93ZXIgPSB1cmwudG9Mb3dlckNhc2UoKTtcbiAgZm9yIChjb25zdCBwcmVmaXggb2YgRVhDTFVERURfVVJMX1BSRUZJWEVTKSB7XG4gICAgaWYgKGxvd2VyLnN0YXJ0c1dpdGgocHJlZml4KSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgdHJ5IHtcbiAgICByZXR1cm4gaXNFeGNsdWRlZEhvc3QobmV3IFVSTCh1cmwpLmhvc3RuYW1lKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRXhjbHVkZWRIb3N0KGhvc3RuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgaG9zdCA9IGhvc3RuYW1lLnRvTG93ZXJDYXNlKCk7XG4gIGZvciAoY29uc3QgZXhjbHVkZWQgb2YgRVhDTFVERURfSE9TVFMpIHtcbiAgICBpZiAoaG9zdCA9PT0gZXhjbHVkZWQgfHwgaG9zdC5lbmRzV2l0aChgLiR7ZXhjbHVkZWR9YCkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG4iLCJpbXBvcnQgdHlwZSB7IEV4dGVuc2lvbkFuYWx5emVSZXNwb25zZSB9IGZyb20gXCJAZGFya3BhdHRlcm5zL3NoYXJlZC90eXBlc1wiO1xuaW1wb3J0IHsgaXNFeGNsdWRlZFVybCB9IGZyb20gXCIuL2V4Y2x1ZGVkLWhvc3RzXCI7XG5cbmV4cG9ydCB0eXBlIEV4dGVuc2lvblNldHRpbmdzID0ge1xuICB0ZXJtc0FjY2VwdGVkQXQ6IHN0cmluZyB8IG51bGw7XG4gIGF1dG9TY2FuRW5hYmxlZDogYm9vbGVhbjtcbiAgYXBpQmFzZVVybDogc3RyaW5nO1xuICBhcGlLZXk6IHN0cmluZztcbn07XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1M6IEV4dGVuc2lvblNldHRpbmdzID0ge1xuICB0ZXJtc0FjY2VwdGVkQXQ6IG51bGwsXG4gIGF1dG9TY2FuRW5hYmxlZDogdHJ1ZSxcbiAgYXBpQmFzZVVybDogXCJodHRwOi8vbG9jYWxob3N0OjMwMDBcIixcbiAgYXBpS2V5OiBcIlwiLFxufTtcblxudHlwZSBVcmxSZXBvcnRDYWNoZSA9IHtcbiAgbm9ybWFsaXplZFVybDogc3RyaW5nO1xuICByZXBvcnQ6IEV4dGVuc2lvbkFuYWx5emVSZXNwb25zZVtcInNjYW5cIl07XG4gIGNhY2hlZEF0OiBudW1iZXI7XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplVXJsRm9yQ2FjaGUodXJsOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBwYXJzZWQgPSBuZXcgVVJMKHVybCk7XG4gIHBhcnNlZC5oYXNoID0gXCJcIjtcbiAgcGFyc2VkLmhvc3RuYW1lID0gcGFyc2VkLmhvc3RuYW1lLnRvTG93ZXJDYXNlKCk7XG4gIHJldHVybiBwYXJzZWQudG9TdHJpbmcoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVybHNNYXRjaEZvckNhY2hlKGE6IHN0cmluZywgYjogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIG5vcm1hbGl6ZVVybEZvckNhY2hlKGEpID09PSBub3JtYWxpemVVcmxGb3JDYWNoZShiKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGEgPT09IGI7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFNldHRpbmdzKCk6IFByb21pc2U8RXh0ZW5zaW9uU2V0dGluZ3M+IHtcbiAgY29uc3Qgc3RvcmVkID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KE9iamVjdC5rZXlzKERFRkFVTFRfU0VUVElOR1MpKTtcbiAgcmV0dXJuIHsgLi4uREVGQVVMVF9TRVRUSU5HUywgLi4uc3RvcmVkIH0gYXMgRXh0ZW5zaW9uU2V0dGluZ3M7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzYXZlU2V0dGluZ3MoXG4gIHBhcnRpYWw6IFBhcnRpYWw8RXh0ZW5zaW9uU2V0dGluZ3M+LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldChwYXJ0aWFsKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFRhYlJlcG9ydChcbiAgdGFiSWQ6IG51bWJlcixcbik6IFByb21pc2U8aW1wb3J0KFwiLi9tZXNzYWdlc1wiKS5UYWJSZXBvcnRTdGF0ZSB8IG51bGw+IHtcbiAgY29uc3Qga2V5ID0gYHRhYlJlcG9ydDoke3RhYklkfWA7XG4gIGNvbnN0IHN0b3JlZCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLnNlc3Npb24uZ2V0KGtleSk7XG4gIHJldHVybiAoXG4gICAgKHN0b3JlZFtrZXldIGFzIGltcG9ydChcIi4vbWVzc2FnZXNcIikuVGFiUmVwb3J0U3RhdGUgfCB1bmRlZmluZWQpID8/IG51bGxcbiAgKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldFRhYlJlcG9ydChcbiAgdGFiSWQ6IG51bWJlcixcbiAgc3RhdGU6IGltcG9ydChcIi4vbWVzc2FnZXNcIikuVGFiUmVwb3J0U3RhdGUsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qga2V5ID0gYHRhYlJlcG9ydDoke3RhYklkfWA7XG4gIGF3YWl0IGNocm9tZS5zdG9yYWdlLnNlc3Npb24uc2V0KHsgW2tleV06IHN0YXRlIH0pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0VXJsUmVwb3J0Q2FjaGUoXG4gIHVybDogc3RyaW5nLFxuKTogUHJvbWlzZTxFeHRlbnNpb25BbmFseXplUmVzcG9uc2VbXCJzY2FuXCJdIHwgbnVsbD4ge1xuICBjb25zdCBub3JtYWxpemVkVXJsID0gbm9ybWFsaXplVXJsRm9yQ2FjaGUodXJsKTtcbiAgY29uc3Qga2V5ID0gYHVybFJlcG9ydDoke25vcm1hbGl6ZWRVcmx9YDtcbiAgY29uc3Qgc3RvcmVkID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KGtleSk7XG4gIGNvbnN0IGNhY2hlID0gc3RvcmVkW2tleV0gYXMgVXJsUmVwb3J0Q2FjaGUgfCB1bmRlZmluZWQ7XG4gIHJldHVybiBjYWNoZT8ucmVwb3J0ID8/IG51bGw7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXRVcmxSZXBvcnRDYWNoZShcbiAgdXJsOiBzdHJpbmcsXG4gIHJlcG9ydDogRXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlW1wic2NhblwiXSxcbik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBub3JtYWxpemVkVXJsID0gbm9ybWFsaXplVXJsRm9yQ2FjaGUodXJsKTtcbiAgY29uc3Qga2V5ID0gYHVybFJlcG9ydDoke25vcm1hbGl6ZWRVcmx9YDtcbiAgYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHtcbiAgICBba2V5XToge1xuICAgICAgbm9ybWFsaXplZFVybCxcbiAgICAgIHJlcG9ydCxcbiAgICAgIGNhY2hlZEF0OiBEYXRlLm5vdygpLFxuICAgIH0gc2F0aXNmaWVzIFVybFJlcG9ydENhY2hlLFxuICB9KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNsZWFyVXJsUmVwb3J0Q2FjaGUodXJsOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgbm9ybWFsaXplZFVybCA9IG5vcm1hbGl6ZVVybEZvckNhY2hlKHVybCk7XG4gIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnJlbW92ZShgdXJsUmVwb3J0OiR7bm9ybWFsaXplZFVybH1gKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQW5hbHl6YWJsZVVybCh1cmw6IHN0cmluZyB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuICBpZiAoIXVybCkgcmV0dXJuIGZhbHNlO1xuICBpZiAoIXVybC5zdGFydHNXaXRoKFwiaHR0cDovL1wiKSAmJiAhdXJsLnN0YXJ0c1dpdGgoXCJodHRwczovL1wiKSkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gIWlzRXhjbHVkZWRVcmwodXJsKTtcbn1cbiIsImltcG9ydCB0eXBlIHtcbiAgRXh0ZW5zaW9uQW5hbHl6ZVBheWxvYWQsXG4gIEV4dGVuc2lvbkFuYWx5emVSZXNwb25zZSxcbn0gZnJvbSBcIkBkYXJrcGF0dGVybnMvc2hhcmVkL3R5cGVzXCI7XG5pbXBvcnQgeyBnZXRTZXR0aW5ncyB9IGZyb20gXCIuLi9saWIvc3RvcmFnZVwiO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmV0Y2hDYWNoZWRSZXBvcnRGcm9tQmFja2VuZChcbiAgdXJsOiBzdHJpbmcsXG4pOiBQcm9taXNlPEV4dGVuc2lvbkFuYWx5emVSZXNwb25zZVtcInNjYW5cIl0gfCBudWxsPiB7XG4gIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgZ2V0U2V0dGluZ3MoKTtcbiAgY29uc3QgYmFzZVVybCA9IHNldHRpbmdzLmFwaUJhc2VVcmwucmVwbGFjZSgvXFwvJC8sIFwiXCIpO1xuICBjb25zdCBlbmRwb2ludCA9IGAke2Jhc2VVcmx9L2FwaS9leHRlbnNpb24vY2FjaGU/dXJsPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHVybCl9YDtcblxuICB0cnkge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goZW5kcG9pbnQsIHtcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgLi4uKHNldHRpbmdzLmFwaUtleSA/IHsgXCJYLUV4dGVuc2lvbi1LZXlcIjogc2V0dGluZ3MuYXBpS2V5IH0gOiB7fSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDA0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBkYXRhID0gKGF3YWl0IHJlc3BvbnNlLmpzb24oKSkgYXNcbiAgICAgIHwgRXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlXG4gICAgICB8IHsgb2s6IGZhbHNlOyBlcnJvcjogc3RyaW5nIH07XG5cbiAgICBpZiAoIXJlc3BvbnNlLm9rIHx8ICFkYXRhLm9rKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gZGF0YS5zY2FuO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYW5hbHl6ZVdpdGhCYWNrZW5kKFxuICBwYXlsb2FkOiBPbWl0PEV4dGVuc2lvbkFuYWx5emVQYXlsb2FkLCBcInNvdXJjZVwiIHwgXCJzY2FubmVkQXRcIj4sXG4gIGZvcmNlID0gZmFsc2UsXG4pOiBQcm9taXNlPEV4dGVuc2lvbkFuYWx5emVSZXNwb25zZT4ge1xuICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGdldFNldHRpbmdzKCk7XG4gIGNvbnN0IGJhc2VVcmwgPSBzZXR0aW5ncy5hcGlCYXNlVXJsLnJlcGxhY2UoL1xcLyQvLCBcIlwiKTtcbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHtiYXNlVXJsfS9hcGkvZXh0ZW5zaW9uL2FuYWx5emVgLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7XG4gICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgIC4uLihzZXR0aW5ncy5hcGlLZXkgPyB7IFwiWC1FeHRlbnNpb24tS2V5XCI6IHNldHRpbmdzLmFwaUtleSB9IDoge30pLFxuICAgIH0sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgLi4ucGF5bG9hZCxcbiAgICAgIHNjYW5uZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgc291cmNlOiBcImNocm9tZS1leHRlbnNpb25cIixcbiAgICAgIGZvcmNlLFxuICAgIH0gc2F0aXNmaWVzIEV4dGVuc2lvbkFuYWx5emVQYXlsb2FkKSxcbiAgfSk7XG5cbiAgY29uc3QgZGF0YSA9IChhd2FpdCByZXNwb25zZS5qc29uKCkpIGFzXG4gICAgfCBFeHRlbnNpb25BbmFseXplUmVzcG9uc2VcbiAgICB8IHsgb2s6IGZhbHNlOyBlcnJvcjogc3RyaW5nIH07XG5cbiAgaWYgKCFyZXNwb25zZS5vayB8fCAhZGF0YS5vaykge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIFwiZXJyb3JcIiBpbiBkYXRhID8gZGF0YS5lcnJvciA6IFwiVW5hYmxlIHRvIGFuYWx5emUgdGhpcyBwYWdlLlwiLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gZGF0YTtcbn1cbiIsIi8vLyA8cmVmZXJlbmNlIHR5cGVzPVwid3h0L2NsaWVudC10eXBlc1wiIC8+XG5cbmltcG9ydCB7IHJ1bkhldXJpc3RpY3MgfSBmcm9tIFwiQGRhcmtwYXR0ZXJucy9zaGFyZWQvaGV1cmlzdGljc1wiO1xuaW1wb3J0IHR5cGUge1xuICBFeHRlbnNpb25BbmFseXplUmVzcG9uc2UsXG4gIFBhZ2VIaWdobGlnaHQsXG4gIFBhZ2VUeXBlLFxufSBmcm9tIFwiQGRhcmtwYXR0ZXJucy9zaGFyZWQvdHlwZXNcIjtcbmltcG9ydCB7XG4gIGNvbmNlcm5MZXZlbEZyb21TY29yZSxcbiAgc2FuaXRpemVUZXh0LFxuICBzdWdnZXN0ZWRBY3Rpb25Gb3JDYXRlZ29yeSxcbn0gZnJvbSBcIkBkYXJrcGF0dGVybnMvc2hhcmVkL3dvcmRpbmdcIjtcbmltcG9ydCB7IGFuYWx5emVXaXRoQmFja2VuZCwgZmV0Y2hDYWNoZWRSZXBvcnRGcm9tQmFja2VuZCB9IGZyb20gXCIuLi9hcGkvY2xpZW50XCI7XG5pbXBvcnQgdHlwZSB7IEFuYWx5emVQYWdlTWVzc2FnZSB9IGZyb20gXCIuLi9saWIvbWVzc2FnZXNcIjtcbmltcG9ydCB7XG4gIGNsZWFyVXJsUmVwb3J0Q2FjaGUsXG4gIGdldFNldHRpbmdzLFxuICBnZXRUYWJSZXBvcnQsXG4gIGdldFVybFJlcG9ydENhY2hlLFxuICBpc0FuYWx5emFibGVVcmwsXG4gIG5vcm1hbGl6ZVVybEZvckNhY2hlLFxuICBzZXRUYWJSZXBvcnQsXG4gIHNldFVybFJlcG9ydENhY2hlLFxuICB1cmxzTWF0Y2hGb3JDYWNoZSxcbn0gZnJvbSBcIi4uL2xpYi9zdG9yYWdlXCI7XG5cbmNvbnN0IGRlYm91bmNlVGltZXJzID0gbmV3IE1hcDxudW1iZXIsIFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+PigpO1xuY29uc3QgaW5GbGlnaHRVcmxzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5jb25zdCBwZW5kaW5nSGlnaGxpZ2h0cyA9IG5ldyBNYXA8bnVtYmVyLCBQYWdlSGlnaGxpZ2h0W10+KCk7XG5jb25zdCBERUJPVU5DRV9NUyA9IDIwMDA7XG5cbmZ1bmN0aW9uIGNvbmNlcm5CYWRnZVRleHQobGV2ZWw6IHN0cmluZyk6IHN0cmluZyB7XG4gIHN3aXRjaCAobGV2ZWwpIHtcbiAgICBjYXNlIFwiSElHSFwiOlxuICAgICAgcmV0dXJuIFwiIVwiO1xuICAgIGNhc2UgXCJNT0RFUkFURVwiOlxuICAgICAgcmV0dXJuIFwiTVwiO1xuICAgIGNhc2UgXCJTT01FXCI6XG4gICAgICByZXR1cm4gXCJTXCI7XG4gICAgY2FzZSBcIkxPV1wiOlxuICAgICAgcmV0dXJuIFwiT0tcIjtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFwiP1wiO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUJhZGdlKFxuICB0YWJJZDogbnVtYmVyLFxuICBjb25jZXJuTGV2ZWw6IHN0cmluZyB8IG51bGwsXG4gIGFuYWx5emluZyA9IGZhbHNlLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmIChhbmFseXppbmcpIHtcbiAgICBhd2FpdCBjaHJvbWUuYWN0aW9uLnNldEJhZGdlVGV4dCh7IHRhYklkLCB0ZXh0OiBcIuKAplwiIH0pO1xuICAgIGF3YWl0IGNocm9tZS5hY3Rpb24uc2V0QmFkZ2VCYWNrZ3JvdW5kQ29sb3IoeyB0YWJJZCwgY29sb3I6IFwiIzFFNDBBRlwiIH0pO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmICghY29uY2VybkxldmVsKSB7XG4gICAgYXdhaXQgY2hyb21lLmFjdGlvbi5zZXRCYWRnZVRleHQoeyB0YWJJZCwgdGV4dDogXCJcIiB9KTtcbiAgICByZXR1cm47XG4gIH1cblxuICBhd2FpdCBjaHJvbWUuYWN0aW9uLnNldEJhZGdlVGV4dCh7XG4gICAgdGFiSWQsXG4gICAgdGV4dDogY29uY2VybkJhZGdlVGV4dChjb25jZXJuTGV2ZWwpLFxuICB9KTtcblxuICBjb25zdCBjb2xvciA9XG4gICAgY29uY2VybkxldmVsID09PSBcIkhJR0hcIlxuICAgICAgPyBcIiNEQzI2MjZcIlxuICAgICAgOiBjb25jZXJuTGV2ZWwgPT09IFwiTU9ERVJBVEVcIlxuICAgICAgICA/IFwiI0Q5NzcwNlwiXG4gICAgICAgIDogY29uY2VybkxldmVsID09PSBcIlNPTUVcIlxuICAgICAgICAgID8gXCIjM0I4MkY2XCJcbiAgICAgICAgICA6IFwiIzE2QTM0QVwiO1xuXG4gIGF3YWl0IGNocm9tZS5hY3Rpb24uc2V0QmFkZ2VCYWNrZ3JvdW5kQ29sb3IoeyB0YWJJZCwgY29sb3IgfSk7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkTG9jYWxGYWxsYmFja1JlcG9ydChcbiAgdXJsOiBzdHJpbmcsXG4gIHBhZ2VUaXRsZTogc3RyaW5nLFxuICBoZXVyaXN0aWNTaWduYWxzOiBSZXR1cm5UeXBlPHR5cGVvZiBydW5IZXVyaXN0aWNzPixcbik6IEV4dGVuc2lvbkFuYWx5emVSZXNwb25zZVtcInNjYW5cIl0ge1xuICBjb25zdCByaXNrU2NvcmUgPVxuICAgIGhldXJpc3RpY1NpZ25hbHMubGVuZ3RoID09PSAwXG4gICAgICA/IDVcbiAgICAgIDogTWF0aC5taW4oXG4gICAgICAgICAgMTAwLFxuICAgICAgICAgIE1hdGgucm91bmQoXG4gICAgICAgICAgICBoZXVyaXN0aWNTaWduYWxzLnJlZHVjZSgoc3VtLCBzaWduYWwpID0+IHtcbiAgICAgICAgICAgICAgY29uc3Qgd2VpZ2h0ID1cbiAgICAgICAgICAgICAgICBzaWduYWwuc2V2ZXJpdHkgPT09IFwiSElHSFwiXG4gICAgICAgICAgICAgICAgICA/IDQ1XG4gICAgICAgICAgICAgICAgICA6IHNpZ25hbC5zZXZlcml0eSA9PT0gXCJNRURJVU1cIlxuICAgICAgICAgICAgICAgICAgICA/IDI1XG4gICAgICAgICAgICAgICAgICAgIDogMTA7XG4gICAgICAgICAgICAgIHJldHVybiBzdW0gKyB3ZWlnaHQgKiBzaWduYWwuY29uZmlkZW5jZTtcbiAgICAgICAgICAgIH0sIDApLFxuICAgICAgICAgICksXG4gICAgICAgICk7XG5cbiAgcmV0dXJuIHtcbiAgICBpZDogXCJsb2NhbFwiLFxuICAgIHVybCxcbiAgICBub3JtYWxpemVkVXJsOiB1cmwsXG4gICAgc3RhdHVzOiBcIkNPTVBMRVRFRFwiLFxuICAgIHJpc2tTY29yZSxcbiAgICBjb25jZXJuTGV2ZWw6IGNvbmNlcm5MZXZlbEZyb21TY29yZShyaXNrU2NvcmUpLFxuICAgIHN1bW1hcnk6IHNhbml0aXplVGV4dChcbiAgICAgIGhldXJpc3RpY1NpZ25hbHMubGVuZ3RoID4gMFxuICAgICAgICA/IGBXZSBmb3VuZCAke2hldXJpc3RpY1NpZ25hbHMubGVuZ3RofSBwb3RlbnRpYWwgcHJlc3N1cmUgY3VlcyBsb2NhbGx5LiBCYWNrZW5kIHN5bmMgZmFpbGVkIOKAlCBmaW5kaW5ncyB3ZXJlIG5vdCBzYXZlZC5gXG4gICAgICAgIDogXCJVbmFibGUgdG8gYXNzZXNzIHRoaXMgcGFnZSByaWdodCBub3cuXCIsXG4gICAgKSxcbiAgICBwYWdlVGl0bGUsXG4gICAgY29tcGxldGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICBkZXRlY3Rpb25zOiBoZXVyaXN0aWNTaWduYWxzLm1hcCgoc2lnbmFsLCBpbmRleCkgPT4gKHtcbiAgICAgIGlkOiBgbG9jYWwtJHtpbmRleH1gLFxuICAgICAgY2F0ZWdvcnk6IHNpZ25hbC5jYXRlZ29yeSxcbiAgICAgIHBhdHRlcm5UeXBlOiBzaWduYWwucGF0dGVyblR5cGUsXG4gICAgICBzZXZlcml0eTogc2lnbmFsLnNldmVyaXR5LFxuICAgICAgZGVzY3JpcHRpb246IHNhbml0aXplVGV4dChzaWduYWwuZGVzY3JpcHRpb24pLFxuICAgICAgZXZpZGVuY2U6IHNpZ25hbC5ldmlkZW5jZSxcbiAgICAgIGNvbmZpZGVuY2U6IHNpZ25hbC5jb25maWRlbmNlLFxuICAgICAgc3VnZ2VzdGVkQWN0aW9uOiBzdWdnZXN0ZWRBY3Rpb25Gb3JDYXRlZ29yeShzaWduYWwuY2F0ZWdvcnkpLFxuICAgIH0pKSxcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc3luY0hpZ2hsaWdodHNUb1RhYihcbiAgdGFiSWQ6IG51bWJlcixcbiAgaGlnaGxpZ2h0czogUGFnZUhpZ2hsaWdodFtdLFxuICB2aXNpYmxlOiBib29sZWFuLFxuICBkZXRlY3Rpb25zOiBFeHRlbnNpb25BbmFseXplUmVzcG9uc2VbXCJzY2FuXCJdW1wiZGV0ZWN0aW9uc1wiXSA9IFtdLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgaWYgKCF2aXNpYmxlKSB7XG4gICAgICBhd2FpdCBjaHJvbWUudGFicy5zZW5kTWVzc2FnZSh0YWJJZCwgeyB0eXBlOiBcIkNMRUFSX1BBR0VfSElHSExJR0hUU1wiIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChoaWdobGlnaHRzLmxlbmd0aCA9PT0gMCAmJiBkZXRlY3Rpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgYXdhaXQgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2UodGFiSWQsIHsgdHlwZTogXCJDTEVBUl9QQUdFX0hJR0hMSUdIVFNcIiB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBhd2FpdCBjaHJvbWUudGFicy5zZW5kTWVzc2FnZSh0YWJJZCwge1xuICAgICAgdHlwZTogXCJTRVRfUEFHRV9ISUdITElHSFRTXCIsXG4gICAgICBoaWdobGlnaHRzLFxuICAgICAgZGV0ZWN0aW9ucyxcbiAgICAgIHZpc2libGU6IHRydWUsXG4gICAgfSk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIENvbnRlbnQgc2NyaXB0IG1heSBub3QgYmUgcmVhZHkgb24gdGhpcyB0YWIuXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gYXBwbHlDYWNoZWRSZXBvcnQoXG4gIHRhYklkOiBudW1iZXIsXG4gIHJlcG9ydDogRXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlW1wic2NhblwiXSxcbiAgaGlnaGxpZ2h0czogUGFnZUhpZ2hsaWdodFtdID0gW10sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgc2V0VGFiUmVwb3J0KHRhYklkLCB7IHN0YXR1czogXCJjb21wbGV0ZVwiLCByZXBvcnQsIGhpZ2hsaWdodHMgfSk7XG4gIGF3YWl0IHVwZGF0ZUJhZGdlKHRhYklkLCByZXBvcnQuY29uY2VybkxldmVsKTtcbiAgYXdhaXQgc3luY0hpZ2hsaWdodHNUb1RhYihcbiAgICB0YWJJZCxcbiAgICBoaWdobGlnaHRzLFxuICAgIGhpZ2hsaWdodHMubGVuZ3RoID4gMCB8fCByZXBvcnQuZGV0ZWN0aW9ucy5sZW5ndGggPiAwLFxuICAgIHJlcG9ydC5kZXRlY3Rpb25zLFxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBoeWRyYXRlVGFiRnJvbUNhY2hlKFxuICB0YWJJZDogbnVtYmVyLFxuICB1cmw6IHN0cmluZyxcbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBjb25zdCBleGlzdGluZyA9IGF3YWl0IGdldFRhYlJlcG9ydCh0YWJJZCk7XG4gIGlmIChcbiAgICBleGlzdGluZz8uc3RhdHVzID09PSBcImNvbXBsZXRlXCIgJiZcbiAgICB1cmxzTWF0Y2hGb3JDYWNoZShleGlzdGluZy5yZXBvcnQubm9ybWFsaXplZFVybCA/PyBleGlzdGluZy5yZXBvcnQudXJsLCB1cmwpXG4gICkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgbGV0IGNhY2hlZCA9IGF3YWl0IGdldFVybFJlcG9ydENhY2hlKHVybCk7XG4gIGlmICghY2FjaGVkKSB7XG4gICAgY2FjaGVkID0gYXdhaXQgZmV0Y2hDYWNoZWRSZXBvcnRGcm9tQmFja2VuZCh1cmwpO1xuICAgIGlmIChjYWNoZWQpIHtcbiAgICAgIGF3YWl0IHNldFVybFJlcG9ydENhY2hlKHVybCwgY2FjaGVkKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWNhY2hlZCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChcbiAgICBleGlzdGluZz8uc3RhdHVzID09PSBcImNvbXBsZXRlXCIgJiZcbiAgICB1cmxzTWF0Y2hGb3JDYWNoZShcbiAgICAgIGV4aXN0aW5nLnJlcG9ydC5ub3JtYWxpemVkVXJsID8/IGV4aXN0aW5nLnJlcG9ydC51cmwsXG4gICAgICBjYWNoZWQubm9ybWFsaXplZFVybCA/PyBjYWNoZWQudXJsLFxuICAgIClcbiAgKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBhd2FpdCBhcHBseUNhY2hlZFJlcG9ydCh0YWJJZCwgY2FjaGVkKTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJ1bkFuYWx5c2lzKFxuICB0YWJJZDogbnVtYmVyLFxuICBwYXlsb2FkOiB7XG4gICAgdXJsOiBzdHJpbmc7XG4gICAgcGFnZVRpdGxlOiBzdHJpbmc7XG4gICAgdmlzaWJsZVRleHQ6IHN0cmluZztcbiAgICBpbnRlcmFjdGl2ZUh0bWw6IHN0cmluZztcbiAgICBwYWdlVHlwZTogUGFnZVR5cGU7XG4gIH0sXG4gIGZvcmNlID0gZmFsc2UsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgc2V0dGluZ3MgPSBhd2FpdCBnZXRTZXR0aW5ncygpO1xuICBpZiAoIXNldHRpbmdzLnRlcm1zQWNjZXB0ZWRBdCkgcmV0dXJuO1xuICBpZiAoIXNldHRpbmdzLmF1dG9TY2FuRW5hYmxlZCAmJiAhZm9yY2UpIHJldHVybjtcbiAgaWYgKCFpc0FuYWx5emFibGVVcmwocGF5bG9hZC51cmwpKSByZXR1cm47XG5cbiAgaWYgKCFmb3JjZSkge1xuICAgIGNvbnN0IGh5ZHJhdGVkID0gYXdhaXQgaHlkcmF0ZVRhYkZyb21DYWNoZSh0YWJJZCwgcGF5bG9hZC51cmwpO1xuICAgIGlmIChoeWRyYXRlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBhd2FpdCBjbGVhclVybFJlcG9ydENhY2hlKHBheWxvYWQudXJsKTtcbiAgfVxuXG4gIGlmIChpbkZsaWdodFVybHMuaGFzKG5vcm1hbGl6ZVVybEZvckNhY2hlKHBheWxvYWQudXJsKSkgJiYgIWZvcmNlKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaW5GbGlnaHRVcmxzLmFkZChub3JtYWxpemVVcmxGb3JDYWNoZShwYXlsb2FkLnVybCkpO1xuXG4gIGNvbnN0IGhldXJpc3RpY1NpZ25hbHMgPSBydW5IZXVyaXN0aWNzKHtcbiAgICB2aXNpYmxlVGV4dDogcGF5bG9hZC52aXNpYmxlVGV4dCxcbiAgICBpbnRlcmFjdGl2ZUh0bWw6IHBheWxvYWQuaW50ZXJhY3RpdmVIdG1sLFxuICAgIHBhZ2VUeXBlOiBwYXlsb2FkLnBhZ2VUeXBlLFxuICB9KTtcblxuICBhd2FpdCBzZXRUYWJSZXBvcnQodGFiSWQsIHsgc3RhdHVzOiBcImFuYWx5emluZ1wiIH0pO1xuICBhd2FpdCB1cGRhdGVCYWRnZSh0YWJJZCwgbnVsbCwgdHJ1ZSk7XG4gIGF3YWl0IHN5bmNIaWdobGlnaHRzVG9UYWIodGFiSWQsIFtdLCBmYWxzZSk7XG5cbiAgY29uc3QgaGlnaGxpZ2h0cyA9IHBlbmRpbmdIaWdobGlnaHRzLmdldCh0YWJJZCkgPz8gW107XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhbmFseXplV2l0aEJhY2tlbmQoXG4gICAgICB7XG4gICAgICAgIHVybDogcGF5bG9hZC51cmwsXG4gICAgICAgIHBhZ2VUaXRsZTogcGF5bG9hZC5wYWdlVGl0bGUsXG4gICAgICAgIHZpc2libGVUZXh0OiBwYXlsb2FkLnZpc2libGVUZXh0LFxuICAgICAgICBpbnRlcmFjdGl2ZUh0bWw6IHBheWxvYWQuaW50ZXJhY3RpdmVIdG1sLFxuICAgICAgICBwYWdlVHlwZTogcGF5bG9hZC5wYWdlVHlwZSxcbiAgICAgICAgaGV1cmlzdGljU2lnbmFscyxcbiAgICAgIH0sXG4gICAgICBmb3JjZSxcbiAgICApO1xuXG4gICAgYXdhaXQgc2V0VXJsUmVwb3J0Q2FjaGUocGF5bG9hZC51cmwsIHJlc3VsdC5zY2FuKTtcbiAgICBhd2FpdCBhcHBseUNhY2hlZFJlcG9ydCh0YWJJZCwgcmVzdWx0LnNjYW4sIGhpZ2hsaWdodHMpO1xuICB9IGNhdGNoIHtcbiAgICBjb25zdCBmYWxsYmFjayA9IGJ1aWxkTG9jYWxGYWxsYmFja1JlcG9ydChcbiAgICAgIHBheWxvYWQudXJsLFxuICAgICAgcGF5bG9hZC5wYWdlVGl0bGUsXG4gICAgICBoZXVyaXN0aWNTaWduYWxzLFxuICAgICk7XG5cbiAgICBhd2FpdCBhcHBseUNhY2hlZFJlcG9ydCh0YWJJZCwgZmFsbGJhY2ssIGhpZ2hsaWdodHMpO1xuICB9IGZpbmFsbHkge1xuICAgIHBlbmRpbmdIaWdobGlnaHRzLmRlbGV0ZSh0YWJJZCk7XG4gICAgaW5GbGlnaHRVcmxzLmRlbGV0ZShub3JtYWxpemVVcmxGb3JDYWNoZShwYXlsb2FkLnVybCkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNjaGVkdWxlQW5hbHlzaXMoXG4gIHRhYklkOiBudW1iZXIsXG4gIHBheWxvYWQ6IHtcbiAgICB1cmw6IHN0cmluZztcbiAgICBwYWdlVGl0bGU6IHN0cmluZztcbiAgICB2aXNpYmxlVGV4dDogc3RyaW5nO1xuICAgIGludGVyYWN0aXZlSHRtbDogc3RyaW5nO1xuICAgIHBhZ2VUeXBlOiBQYWdlVHlwZTtcbiAgfSxcbiAgZm9yY2UgPSBmYWxzZSxcbik6IHZvaWQge1xuICBjb25zdCBleGlzdGluZyA9IGRlYm91bmNlVGltZXJzLmdldCh0YWJJZCk7XG4gIGlmIChleGlzdGluZykgY2xlYXJUaW1lb3V0KGV4aXN0aW5nKTtcblxuICBkZWJvdW5jZVRpbWVycy5zZXQoXG4gICAgdGFiSWQsXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBkZWJvdW5jZVRpbWVycy5kZWxldGUodGFiSWQpO1xuICAgICAgdm9pZCBydW5BbmFseXNpcyh0YWJJZCwgcGF5bG9hZCwgZm9yY2UpO1xuICAgIH0sIERFQk9VTkNFX01TKSxcbiAgKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQmFja2dyb3VuZCgoKSA9PiB7XG4gIGNocm9tZS5ydW50aW1lLm9uSW5zdGFsbGVkLmFkZExpc3RlbmVyKCgpID0+IHtcbiAgICB2b2lkIGNocm9tZS5zaWRlUGFuZWwuc2V0UGFuZWxCZWhhdmlvcih7IG9wZW5QYW5lbE9uQWN0aW9uQ2xpY2s6IHRydWUgfSk7XG4gIH0pO1xuXG4gIGNocm9tZS50YWJzLm9uQWN0aXZhdGVkLmFkZExpc3RlbmVyKChhY3RpdmVJbmZvKSA9PiB7XG4gICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdGFiID0gYXdhaXQgY2hyb21lLnRhYnMuZ2V0KGFjdGl2ZUluZm8udGFiSWQpO1xuICAgICAgaWYgKCFpc0FuYWx5emFibGVVcmwodGFiLnVybCkpIHtcbiAgICAgICAgYXdhaXQgdXBkYXRlQmFkZ2UoYWN0aXZlSW5mby50YWJJZCwgbnVsbCk7XG4gICAgICAgIGF3YWl0IHNldFRhYlJlcG9ydChhY3RpdmVJbmZvLnRhYklkLCB7IHN0YXR1czogXCJpZGxlXCIgfSk7XG4gICAgICAgIGF3YWl0IHN5bmNIaWdobGlnaHRzVG9UYWIoYWN0aXZlSW5mby50YWJJZCwgW10sIGZhbHNlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgYXdhaXQgaHlkcmF0ZVRhYkZyb21DYWNoZShhY3RpdmVJbmZvLnRhYklkLCB0YWIudXJsIGFzIHN0cmluZyk7XG5cbiAgICAgIGNvbnN0IHN0YXRlID0gYXdhaXQgZ2V0VGFiUmVwb3J0KGFjdGl2ZUluZm8udGFiSWQpO1xuICAgICAgaWYgKHN0YXRlPy5zdGF0dXMgPT09IFwiY29tcGxldGVcIikge1xuICAgICAgICBjb25zdCBoaWdobGlnaHRzID0gc3RhdGUuaGlnaGxpZ2h0cyA/PyBbXTtcbiAgICAgICAgY29uc3QgZGV0ZWN0aW9ucyA9IHN0YXRlLnJlcG9ydC5kZXRlY3Rpb25zO1xuICAgICAgICBpZiAoaGlnaGxpZ2h0cy5sZW5ndGggPiAwIHx8IGRldGVjdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGF3YWl0IHN5bmNIaWdobGlnaHRzVG9UYWIoXG4gICAgICAgICAgICBhY3RpdmVJbmZvLnRhYklkLFxuICAgICAgICAgICAgaGlnaGxpZ2h0cyxcbiAgICAgICAgICAgIHRydWUsXG4gICAgICAgICAgICBkZXRlY3Rpb25zLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSgpO1xuICB9KTtcblxuICBjaHJvbWUudGFicy5vblVwZGF0ZWQuYWRkTGlzdGVuZXIoKHRhYklkLCBjaGFuZ2VJbmZvLCB0YWIpID0+IHtcbiAgICBpZiAoY2hhbmdlSW5mby5zdGF0dXMgIT09IFwiY29tcGxldGVcIikgcmV0dXJuO1xuICAgIGlmICghaXNBbmFseXphYmxlVXJsKHRhYi51cmwpKSByZXR1cm47XG5cbiAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBoeWRyYXRlZCA9IGF3YWl0IGh5ZHJhdGVUYWJGcm9tQ2FjaGUodGFiSWQsIHRhYi51cmwgYXMgc3RyaW5nKTtcbiAgICAgIGlmIChoeWRyYXRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIEF2b2lkIHJlLXNjYW5uaW5nIHdoZW4gdGhlIHRhYiBhbHJlYWR5IGZpbmlzaGVkIGFuYWx5c2lzIChlLmcuIHRhYiBzd2l0Y2hcbiAgICAgIC8vIG9yIGRpc2NhcmRlZC10YWIgcmVsb2FkIGZpcmluZyBhbm90aGVyIFwiY29tcGxldGVcIiB3aXRob3V0IGEgVVJMIGNoYW5nZSkuXG4gICAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IGdldFRhYlJlcG9ydCh0YWJJZCk7XG4gICAgICBpZiAoXG4gICAgICAgIGV4aXN0aW5nPy5zdGF0dXMgPT09IFwiY29tcGxldGVcIiAmJlxuICAgICAgICB1cmxzTWF0Y2hGb3JDYWNoZShcbiAgICAgICAgICBleGlzdGluZy5yZXBvcnQubm9ybWFsaXplZFVybCA/PyBleGlzdGluZy5yZXBvcnQudXJsLFxuICAgICAgICAgIHRhYi51cmwgYXMgc3RyaW5nLFxuICAgICAgICApXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2b2lkIGNocm9tZS50YWJzXG4gICAgICAgIC5zZW5kTWVzc2FnZSh0YWJJZCwgeyB0eXBlOiBcIkFOQUxZWkVfUEFHRVwiIH0pXG4gICAgICAgIC5jYXRjaCgoKSA9PiB7XG4gICAgICAgICAgLy8gQ29udGVudCBzY3JpcHQgbWF5IG5vdCBiZSByZWFkeSB5ZXQgb24gc29tZSBwYWdlcy5cbiAgICAgICAgfSk7XG4gICAgfSkoKTtcbiAgfSk7XG5cbiAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIGlmIChtZXNzYWdlPy50eXBlID09PSBcIlBBR0VfQ09OVEVOVFwiKSB7XG4gICAgICBjb25zdCB0YWJJZCA9IHNlbmRlci50YWI/LmlkO1xuICAgICAgaWYgKCF0YWJJZCkgcmV0dXJuO1xuICAgICAgaWYgKCFpc0FuYWx5emFibGVVcmwobWVzc2FnZS51cmwgYXMgc3RyaW5nKSkge1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogdHJ1ZSB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIHNjaGVkdWxlQW5hbHlzaXMoXG4gICAgICAgIHRhYklkLFxuICAgICAgICB7XG4gICAgICAgICAgdXJsOiBtZXNzYWdlLnVybCBhcyBzdHJpbmcsXG4gICAgICAgICAgcGFnZVRpdGxlOiBtZXNzYWdlLnBhZ2VUaXRsZSBhcyBzdHJpbmcsXG4gICAgICAgICAgdmlzaWJsZVRleHQ6IG1lc3NhZ2UudmlzaWJsZVRleHQgYXMgc3RyaW5nLFxuICAgICAgICAgIGludGVyYWN0aXZlSHRtbDogbWVzc2FnZS5pbnRlcmFjdGl2ZUh0bWwgYXMgc3RyaW5nLFxuICAgICAgICAgIHBhZ2VUeXBlOiAobWVzc2FnZS5wYWdlVHlwZSBhcyBQYWdlVHlwZSB8IHVuZGVmaW5lZCkgPz8gXCJnZW5lcmFsXCIsXG4gICAgICAgIH0sXG4gICAgICAgIEJvb2xlYW4obWVzc2FnZS5mb3JjZSksXG4gICAgICApO1xuICAgICAgcGVuZGluZ0hpZ2hsaWdodHMuc2V0KFxuICAgICAgICB0YWJJZCxcbiAgICAgICAgKG1lc3NhZ2UuaGlnaGxpZ2h0cyBhcyBQYWdlSGlnaGxpZ2h0W10gfCB1bmRlZmluZWQpID8/IFtdLFxuICAgICAgKTtcbiAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiB0cnVlIH0pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKG1lc3NhZ2U/LnR5cGUgPT09IFwiUkVTQ0FOX1BBR0VcIikge1xuICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCB0YWJJZCA9XG4gICAgICAgICAgKG1lc3NhZ2UudGFiSWQgYXMgbnVtYmVyIHwgdW5kZWZpbmVkKSA/P1xuICAgICAgICAgIHNlbmRlci50YWI/LmlkID8/XG4gICAgICAgICAgKGF3YWl0IGNocm9tZS50YWJzLnF1ZXJ5KHsgYWN0aXZlOiB0cnVlLCBjdXJyZW50V2luZG93OiB0cnVlIH0pKVswXVxuICAgICAgICAgICAgPy5pZDtcblxuICAgICAgICBpZiAoIXRhYklkKSB7XG4gICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IGZhbHNlLCBlcnJvcjogXCJObyBhY3RpdmUgdGFiIGZvdW5kLlwiIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRhYiA9IGF3YWl0IGNocm9tZS50YWJzLmdldCh0YWJJZCk7XG4gICAgICAgIGlmICghaXNBbmFseXphYmxlVXJsKHRhYi51cmwpKSB7XG4gICAgICAgICAgc2VuZFJlc3BvbnNlKHtcbiAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgIGVycm9yOiBcIlRoaXMgcGFnZSBpcyBub3QgZWxpZ2libGUgZm9yIHNjYW5uaW5nLlwiLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IGNsZWFyVXJsUmVwb3J0Q2FjaGUodGFiLnVybCBhcyBzdHJpbmcpO1xuICAgICAgICBhd2FpdCBzZXRUYWJSZXBvcnQodGFiSWQsIHsgc3RhdHVzOiBcImFuYWx5emluZ1wiIH0pO1xuICAgICAgICBhd2FpdCB1cGRhdGVCYWRnZSh0YWJJZCwgbnVsbCwgdHJ1ZSk7XG4gICAgICAgIGF3YWl0IHN5bmNIaWdobGlnaHRzVG9UYWIodGFiSWQsIFtdLCBmYWxzZSk7XG4gICAgICAgIHBlbmRpbmdIaWdobGlnaHRzLmRlbGV0ZSh0YWJJZCk7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBjaHJvbWUudGFicy5zZW5kTWVzc2FnZSh0YWJJZCwge1xuICAgICAgICAgICAgdHlwZTogXCJBTkFMWVpFX1BBR0VcIixcbiAgICAgICAgICAgIGZvcmNlOiB0cnVlLFxuICAgICAgICAgIH0gc2F0aXNmaWVzIEFuYWx5emVQYWdlTWVzc2FnZSk7XG4gICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IHRydWUgfSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIHNlbmRSZXNwb25zZSh7XG4gICAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjpcbiAgICAgICAgICAgICAgXCJDb3VsZCBub3QgcmVhY2ggdGhpcyBwYWdlLiBUcnkgcmVmcmVzaGluZyB0aGUgdGFiLCB0aGVuIHJlc2Nhbi5cIixcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSkoKTtcblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKG1lc3NhZ2U/LnR5cGUgPT09IFwiU0hPVUxEX0FOQUxZWkVcIikge1xuICAgICAgY29uc3QgdGFiSWQgPSBzZW5kZXIudGFiPy5pZDtcbiAgICAgIGlmICghdGFiSWQpIHtcbiAgICAgICAgc2VuZFJlc3BvbnNlKHsgc2hvdWxkQW5hbHl6ZTogZmFsc2UgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHVybCA9IG1lc3NhZ2UudXJsIGFzIHN0cmluZztcbiAgICAgICAgaWYgKCFpc0FuYWx5emFibGVVcmwodXJsKSkge1xuICAgICAgICAgIHNlbmRSZXNwb25zZSh7IHNob3VsZEFuYWx5emU6IGZhbHNlIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBoeWRyYXRlZCA9IGF3YWl0IGh5ZHJhdGVUYWJGcm9tQ2FjaGUodGFiSWQsIHVybCk7XG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHNob3VsZEFuYWx5emU6ICFoeWRyYXRlZCB9KTtcbiAgICAgIH0pKCk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmIChtZXNzYWdlPy50eXBlID09PSBcIkhJR0hMSUdIVFNfVVBEQVRFRFwiKSB7XG4gICAgICBjb25zdCB0YWJJZCA9IHNlbmRlci50YWI/LmlkO1xuICAgICAgaWYgKCF0YWJJZCkgcmV0dXJuO1xuXG4gICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gYXdhaXQgZ2V0VGFiUmVwb3J0KHRhYklkKTtcbiAgICAgICAgaWYgKHN0YXRlPy5zdGF0dXMgPT09IFwiY29tcGxldGVcIikge1xuICAgICAgICAgIGF3YWl0IHNldFRhYlJlcG9ydCh0YWJJZCwge1xuICAgICAgICAgICAgLi4uc3RhdGUsXG4gICAgICAgICAgICBoaWdobGlnaHRzOiBtZXNzYWdlLmhpZ2hsaWdodHMgYXMgUGFnZUhpZ2hsaWdodFtdLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KSgpO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAobWVzc2FnZT8udHlwZSA9PT0gXCJUT0dHTEVfUEFHRV9ISUdITElHSFRTXCIpIHtcbiAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgdGFiSWQgPVxuICAgICAgICAgIChtZXNzYWdlLnRhYklkIGFzIG51bWJlciB8IHVuZGVmaW5lZCkgPz9cbiAgICAgICAgICAoYXdhaXQgY2hyb21lLnRhYnMucXVlcnkoeyBhY3RpdmU6IHRydWUsIGN1cnJlbnRXaW5kb3c6IHRydWUgfSkpWzBdXG4gICAgICAgICAgICA/LmlkO1xuXG4gICAgICAgIGlmICghdGFiSWQpIHtcbiAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogZmFsc2UsIGVycm9yOiBcIk5vIGFjdGl2ZSB0YWIgZm91bmQuXCIgfSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3RhdGUgPSBhd2FpdCBnZXRUYWJSZXBvcnQodGFiSWQpO1xuICAgICAgICBjb25zdCBoaWdobGlnaHRzID1cbiAgICAgICAgICBzdGF0ZT8uc3RhdHVzID09PSBcImNvbXBsZXRlXCIgPyAoc3RhdGUuaGlnaGxpZ2h0cyA/PyBbXSkgOiBbXTtcbiAgICAgICAgY29uc3QgZGV0ZWN0aW9ucyA9XG4gICAgICAgICAgc3RhdGU/LnN0YXR1cyA9PT0gXCJjb21wbGV0ZVwiID8gc3RhdGUucmVwb3J0LmRldGVjdGlvbnMgOiBbXTtcblxuICAgICAgICBhd2FpdCBzeW5jSGlnaGxpZ2h0c1RvVGFiKFxuICAgICAgICAgIHRhYklkLFxuICAgICAgICAgIGhpZ2hsaWdodHMsXG4gICAgICAgICAgQm9vbGVhbihtZXNzYWdlLnZpc2libGUpLFxuICAgICAgICAgIGRldGVjdGlvbnMsXG4gICAgICAgICk7XG4gICAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiB0cnVlIH0pO1xuICAgICAgfSkoKTtcblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKG1lc3NhZ2U/LnR5cGUgPT09IFwiU0NST0xMX1RPX0hJR0hMSUdIVFwiKSB7XG4gICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHRhYklkID1cbiAgICAgICAgICAobWVzc2FnZS50YWJJZCBhcyBudW1iZXIgfCB1bmRlZmluZWQpID8/XG4gICAgICAgICAgKGF3YWl0IGNocm9tZS50YWJzLnF1ZXJ5KHsgYWN0aXZlOiB0cnVlLCBjdXJyZW50V2luZG93OiB0cnVlIH0pKVswXVxuICAgICAgICAgICAgPy5pZDtcblxuICAgICAgICBpZiAoIXRhYklkKSB7XG4gICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IGZhbHNlLCBlcnJvcjogXCJObyBhY3RpdmUgdGFiIGZvdW5kLlwiIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2UodGFiSWQsIHtcbiAgICAgICAgICAgIHR5cGU6IFwiU0NST0xMX1RPX0hJR0hMSUdIVFwiLFxuICAgICAgICAgICAgaGlnaGxpZ2h0SWQ6IG1lc3NhZ2UuaGlnaGxpZ2h0SWQgYXMgc3RyaW5nLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiB0cnVlIH0pO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICBzZW5kUmVzcG9uc2Uoe1xuICAgICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgICAgZXJyb3I6IFwiQ291bGQgbm90IHNjcm9sbCB0byBoaWdobGlnaHQgb24gdGhpcyBwYWdlLlwiLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KSgpO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH0pO1xufSk7XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIGJyb3dzZXIkMSB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG4vLyNyZWdpb24gc3JjL2Jyb3dzZXIudHNcbi8qKlxuKiBDb250YWlucyB0aGUgYGJyb3dzZXJgIGV4cG9ydCB3aGljaCB5b3Ugc2hvdWxkIHVzZSB0byBhY2Nlc3MgdGhlIGV4dGVuc2lvblxuKiBBUElzIGluIHlvdXIgcHJvamVjdDpcbipcbiogYGBgdHNcbiogaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gJ3d4dC9icm93c2VyJztcbipcbiogYnJvd3Nlci5ydW50aW1lLm9uSW5zdGFsbGVkLmFkZExpc3RlbmVyKCgpID0+IHtcbiogICAvLyAuLi5cbiogfSk7XG4qIGBgYFxuKlxuKiBAbW9kdWxlIHd4dC9icm93c2VyXG4qL1xuY29uc3QgYnJvd3NlciA9IGJyb3dzZXIkMTtcbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgYnJvd3NlciB9O1xuIiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiJdLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCw3LDgsOV0sIm1hcHBpbmdzIjoiOztDQUNBLFNBQVMsaUJBQWlCLEtBQUs7RUFDOUIsSUFBSSxPQUFPLFFBQVEsT0FBTyxRQUFRLFlBQVksT0FBTyxFQUFFLE1BQU0sSUFBSTtFQUNqRSxPQUFPO0NBQ1I7OztDQ0ZBLElBQU0sbUJB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