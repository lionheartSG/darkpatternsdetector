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
	var ANALYSIS_TIMEOUT_MS = 9e4;
	function withAnalysisTimeout(promise) {
		return Promise.race([promise, new Promise((_, reject) => {
			setTimeout(() => {
				reject(/* @__PURE__ */ new Error("Analysis timed out."));
			}, ANALYSIS_TIMEOUT_MS);
		})]);
	}
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
				return [];
			}
			if (highlights.length === 0 && detections.length === 0) {
				await chrome.tabs.sendMessage(tabId, { type: "CLEAR_PAGE_HIGHLIGHTS" });
				return [];
			}
			return (await chrome.tabs.sendMessage(tabId, {
				type: "SET_PAGE_HIGHLIGHTS",
				highlights,
				detections,
				visible: true,
				reportId
			}))?.highlights ?? highlights;
		} catch {
			return highlights;
		}
	}
	async function applyCachedReport(tabId, report, highlights = []) {
		await updateTabReport(tabId, {
			status: "complete",
			report,
			highlights
		});
		await updateBadge(tabId, report.concernLevel);
		const enrichedHighlights = await syncHighlightsToTab(tabId, highlights, highlights.length > 0 || report.detections.length > 0, report.detections, report.id);
		if (enrichedHighlights.length > 0) await updateTabReport(tabId, {
			status: "complete",
			report,
			highlights: enrichedHighlights
		});
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
			const result = await withAnalysisTimeout(analyzeWithBackend({
				url: payload.url,
				pageTitle: payload.pageTitle,
				visibleText: payload.visibleText,
				interactiveHtml: payload.interactiveHtml,
				pageType: payload.pageType,
				heuristicSignals
			}, force));
			await setUrlReportCache(payload.url, result.scan);
			await applyCachedReport(tabId, result.scan, highlights);
		} catch {
			const cached = await getUrlReportCache(payload.url) ?? await fetchCachedReportFromBackend(payload.url);
			if (cached) {
				await setUrlReportCache(payload.url, cached);
				await applyCachedReport(tabId, cached, highlights);
				return;
			}
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
					if (highlights.length > 0 || detections.length > 0) {
						const enrichedHighlights = await syncHighlightsToTab(activeInfo.tabId, highlights, true, detections, state.report.id);
						if (enrichedHighlights.length > 0) await updateTabReport(activeInfo.tabId, {
							...state,
							highlights: enrichedHighlights
						});
					}
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
					const enrichedHighlights = await syncHighlightsToTab(tabId, highlights, Boolean(message.visible), detections, state?.status === "complete" ? state.report.id : void 0);
					if (state?.status === "complete" && Boolean(message.visible) && enrichedHighlights.length > 0) await updateTabReport(tabId, {
						...state,
						highlights: enrichedHighlights
					});
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
							highlightId: message.highlightId,
							highlight: message.highlight,
							detection: message.detection
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsIm5hbWVzIjpbImJyb3dzZXIiXSwic291cmNlcyI6WyIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWJhY2tncm91bmQubWpzIiwiLi4vLi4vLi4vc2hhcmVkL2hldXJpc3RpY3MvaW5kZXgudHMiLCIuLi8uLi8uLi9zaGFyZWQvd29yZGluZy9pbmRleC50cyIsIi4uLy4uL3NyYy9saWIvZXhjbHVkZWQtaG9zdHMudHMiLCIuLi8uLi9zcmMvbGliL3N0b3JhZ2UudHMiLCIuLi8uLi9zcmMvYXBpL2NsaWVudC50cyIsIi4uLy4uL3NyYy9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0B3eHQtZGV2L2Jyb3dzZXIvc3JjL2luZGV4Lm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad2ViZXh0LWNvcmUvbWF0Y2gtcGF0dGVybnMvbGliL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vI3JlZ2lvbiBzcmMvdXRpbHMvZGVmaW5lLWJhY2tncm91bmQudHNcbmZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG5cdGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuXHRyZXR1cm4gYXJnO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBkZWZpbmVCYWNrZ3JvdW5kIH07XG4iLCJpbXBvcnQgdHlwZSB7IEhldXJpc3RpY1NpZ25hbCwgUGFnZVR5cGUgfSBmcm9tIFwiLi4vdHlwZXMvc2NhblwiO1xuXG5jb25zdCBVUkdFTkNZX1BBVFRFUk5TID0gW1xuICAvY291bnRkb3duL2ksXG4gIC9kZWFsIGVuZHMgKGlufHNvb258dG9kYXkpL2ksXG4gIC9saW1pdGVkIHRpbWUgb25seS9pLFxuICAvb2ZmZXIgZXhwaXJlcy9pLFxuICAvZW5kcyBpbiBcXGQrL2ksXG4gIC9zYWxlIGVuZHMvaSxcbiAgL2VuZHMgdG9kYXkvaSxcbiAgL2xhc3QgY2hhbmNlL2ksXG4gIC9mbGFzaCBzYWxlL2ksXG5dO1xuXG5jb25zdCBTQ0FSQ0lUWV9QQVRURVJOUyA9IFtcbiAgL2luIHN0b2NrL2ksXG4gIC9vbmx5IFxcZCsgbGVmdC9pLFxuICAvb25seSBcXGQrIHJlbWFpbmluZy9pLFxuICAvbG93IHN0b2NrL2ksXG4gIC9zZWxsaW5nIGZhc3QvaSxcbiAgL2hpZ2ggZGVtYW5kL2ksXG4gIC9wZW9wbGUgKGFyZSApP3ZpZXdpbmcvaSxcbiAgL2luIFxcZCsgY2FydHM/L2ksXG4gIC9hbG1vc3Qgc29sZCBvdXQvaSxcbiAgL2xpbWl0ZWQgcXVhbnRpdHkvaSxcbiAgL2ZldyBsZWZ0L2ksXG4gIC9sZWZ0IGluIHN0b2NrL2ksXG5dO1xuXG5jb25zdCBTT0NJQUxfUFJPT0ZfUEFUVEVSTlMgPSBbXG4gIC9wZW9wbGUgKGFyZSApP3ZpZXdpbmcvaSxcbiAgL2JvdWdodCBpbiB0aGUgbGFzdC9pLFxuICAvc29tZW9uZSBqdXN0IHB1cmNoYXNlZC9pLFxuICAvcmVjZW50KGx5KT8gcHVyY2hhc2VkL2ksXG4gIC9cXGQrIChwZW9wbGV8dXNlcnN8Y3VzdG9tZXJzKSAoYXJlICk/KHZpZXdpbmd8d2F0Y2hpbmcpL2ksXG5dO1xuXG5jb25zdCBDT05GSVJNU0hBTUlOR19QQVRURVJOUyA9IFtcbiAgL25vIHRoYW5rcyw/IGkgaGF0ZSBzYXZpbmcvaSxcbiAgL2kgZG9uWycnXXQgd2FudCBhIGRpc2NvdW50L2ksXG4gIC9ubyw/IGlbJyddbGwgcGF5IGZ1bGwgcHJpY2UvaSxcbiAgL2NvbnRpbnVlIHdpdGhvdXQvaSxcbl07XG5cbmNvbnN0IFBSRVNFTEVDVElPTl9QQVRURVJOUyA9IFtcbiAgL3ByZS1jaGVja2VkL2ksXG4gIC9jaGVja2VkIGJ5IGRlZmF1bHQvaSxcbiAgL29wdC4/b3V0L2ksXG5dO1xuXG5mdW5jdGlvbiBtYXRjaFBhdHRlcm5zKHRleHQ6IHN0cmluZywgcGF0dGVybnM6IFJlZ0V4cFtdKTogc3RyaW5nW10ge1xuICByZXR1cm4gcGF0dGVybnNcbiAgICAuZmlsdGVyKChwYXR0ZXJuKSA9PiBwYXR0ZXJuLnRlc3QodGV4dCkpXG4gICAgLm1hcCgocGF0dGVybikgPT4gcGF0dGVybi5zb3VyY2UpO1xufVxuXG5mdW5jdGlvbiBwcmVzc3VyZVRleHQoXG4gIHZpc2libGVUZXh0OiBzdHJpbmcsXG4gIGludGVyYWN0aXZlSHRtbDogc3RyaW5nLFxuICBwYWdlVHlwZTogUGFnZVR5cGUsXG4pOiBzdHJpbmcge1xuICBpZiAocGFnZVR5cGUgPT09IFwiZWRpdG9yaWFsXCIpIHtcbiAgICByZXR1cm4gaW50ZXJhY3RpdmVIdG1sO1xuICB9XG4gIHJldHVybiBgJHt2aXNpYmxlVGV4dH1cXG4ke2ludGVyYWN0aXZlSHRtbH1gO1xufVxuXG5mdW5jdGlvbiBoYXNBY3RpdmVUaW1lcihodG1sOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIChcbiAgICAvY291bnRkb3dufHRpbWVyfGVuZHMgaW4gXFxkKy9pLnRlc3QoaHRtbCkgJiZcbiAgICAoL2NsYXNzPVwiW15cIl0qKGNvdW50ZG93bnx0aW1lcilbXlwiXSpcIi9pLnRlc3QoaHRtbCkgfHxcbiAgICAgIC9kYXRhLWNvdW50ZG93bnxyb2xlPVwidGltZXJcIi9pLnRlc3QoaHRtbCkgfHxcbiAgICAgIC9lbmRzIGluIFxcZCsvaS50ZXN0KGh0bWwpKVxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0VXJnZW5jeShcbiAgdmlzaWJsZVRleHQ6IHN0cmluZyxcbiAgaHRtbDogc3RyaW5nLFxuICBwYWdlVHlwZTogUGFnZVR5cGUgPSBcImdlbmVyYWxcIixcbik6IEhldXJpc3RpY1NpZ25hbFtdIHtcbiAgY29uc3QgcGF0dGVyblNvdXJjZSA9IHByZXNzdXJlVGV4dCh2aXNpYmxlVGV4dCwgaHRtbCwgcGFnZVR5cGUpO1xuICBjb25zdCBtYXRjaGVzID0gbWF0Y2hQYXR0ZXJucyhwYXR0ZXJuU291cmNlLCBVUkdFTkNZX1BBVFRFUk5TKTtcbiAgaWYgKG1hdGNoZXMubGVuZ3RoID09PSAwKSByZXR1cm4gW107XG5cbiAgY29uc3QgdGltZXJEZXRlY3RlZCA9IGhhc0FjdGl2ZVRpbWVyKGh0bWwpO1xuXG4gIHJldHVybiBbXG4gICAge1xuICAgICAgY2F0ZWdvcnk6IFwiVVJHRU5DWVwiLFxuICAgICAgcGF0dGVyblR5cGU6IHRpbWVyRGV0ZWN0ZWQgPyBcIkNvdW50ZG93blRpbWVyXCIgOiBcIkxpbWl0ZWRUaW1lTWVzc2FnZVwiLFxuICAgICAgc2V2ZXJpdHk6IHRpbWVyRGV0ZWN0ZWQgPyBcIkhJR0hcIiA6IFwiTUVESVVNXCIsXG4gICAgICBkZXNjcmlwdGlvbjogdGltZXJEZXRlY3RlZFxuICAgICAgICA/IFwiUG90ZW50aWFsIHVyZ2VuY3kgY3VlIGRldGVjdGVkLiBDb3VudGRvd24gdGltZXJzIGFyZSBjb21tb24gaW4gbWFya2V0aW5nLCBidXQgY2FuIGNyZWF0ZSB0aW1lIHByZXNzdXJlLlwiXG4gICAgICAgIDogXCJQb3RlbnRpYWwgdXJnZW5jeSBjdWUgZGV0ZWN0ZWQuIFRoaXMgbWF5IGVuY291cmFnZSBmYXN0ZXIgZGVjaXNpb24tbWFraW5nLlwiLFxuICAgICAgZXZpZGVuY2U6IG1hdGNoZXMuc2xpY2UoMCwgMikuam9pbihcIjsgXCIpLFxuICAgICAgY29uZmlkZW5jZTogdGltZXJEZXRlY3RlZCA/IDAuODUgOiAwLjcsXG4gICAgICBzb3VyY2U6IFwiaGV1cmlzdGljXCIsXG4gICAgfSxcbiAgXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRldGVjdFNjYXJjaXR5KFxuICB2aXNpYmxlVGV4dDogc3RyaW5nLFxuICBwYWdlVHlwZTogUGFnZVR5cGUgPSBcImdlbmVyYWxcIixcbiAgaW50ZXJhY3RpdmVIdG1sID0gXCJcIixcbik6IEhldXJpc3RpY1NpZ25hbFtdIHtcbiAgY29uc3QgdGV4dCA9XG4gICAgcGFnZVR5cGUgPT09IFwiZWRpdG9yaWFsXCIgPyBpbnRlcmFjdGl2ZUh0bWwgOiB2aXNpYmxlVGV4dDtcbiAgY29uc3QgbWF0Y2hlcyA9IG1hdGNoUGF0dGVybnModGV4dCwgU0NBUkNJVFlfUEFUVEVSTlMpO1xuICBpZiAobWF0Y2hlcy5sZW5ndGggPT09IDApIHJldHVybiBbXTtcblxuICBjb25zdCBpc0xvd1N0b2NrID0gL29ubHkgXFxkKyBsZWZ0fGxvdyBzdG9ja3xhbG1vc3Qgc29sZCBvdXR8aW4gc3RvY2svaS50ZXN0KFxuICAgIHRleHQsXG4gICk7XG4gIHJldHVybiBbXG4gICAge1xuICAgICAgY2F0ZWdvcnk6IFwiU0NBUkNJVFlcIixcbiAgICAgIHBhdHRlcm5UeXBlOiBpc0xvd1N0b2NrID8gXCJMb3dTdG9ja01lc3NhZ2VcIiA6IFwiSGlnaERlbWFuZE1lc3NhZ2VcIixcbiAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgZGVzY3JpcHRpb246IGlzTG93U3RvY2tcbiAgICAgICAgPyBcIlBvc3NpYmxlIHNjYXJjaXR5IGN1ZSBkZXRlY3RlZC4gU2NhcmNpdHkgbWVzc2FnZXMgbWF5IGJlIHVzZWZ1bCB3aGVuIGFjY3VyYXRlLCBidXQgYXJlIGhhcmQgZm9yIHVzZXJzIHRvIHZlcmlmeS5cIlxuICAgICAgICA6IFwiUG9zc2libGUgc2NhcmNpdHkgY3VlIGRldGVjdGVkLiBIaWdoLWRlbWFuZCBtZXNzYWdpbmcgbWF5IGV4YWdnZXJhdGUgc2NhcmNpdHkuXCIsXG4gICAgICBldmlkZW5jZTogbWF0Y2hlcy5zbGljZSgwLCAyKS5qb2luKFwiOyBcIiksXG4gICAgICBjb25maWRlbmNlOiAwLjc1LFxuICAgICAgc291cmNlOiBcImhldXJpc3RpY1wiLFxuICAgIH0sXG4gIF07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZXRlY3RTb2NpYWxQcm9vZihcbiAgdmlzaWJsZVRleHQ6IHN0cmluZyxcbiAgcGFnZVR5cGU6IFBhZ2VUeXBlID0gXCJnZW5lcmFsXCIsXG4gIGludGVyYWN0aXZlSHRtbCA9IFwiXCIsXG4pOiBIZXVyaXN0aWNTaWduYWxbXSB7XG4gIGNvbnN0IHRleHQgPVxuICAgIHBhZ2VUeXBlID09PSBcImVkaXRvcmlhbFwiID8gaW50ZXJhY3RpdmVIdG1sIDogdmlzaWJsZVRleHQ7XG4gIGNvbnN0IG1hdGNoZXMgPSBtYXRjaFBhdHRlcm5zKHRleHQsIFNPQ0lBTF9QUk9PRl9QQVRURVJOUyk7XG4gIGlmIChtYXRjaGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuXG4gIHJldHVybiBbXG4gICAge1xuICAgICAgY2F0ZWdvcnk6IFwiU09DSUFMX1BST09GXCIsXG4gICAgICBwYXR0ZXJuVHlwZTogXCJBY3Rpdml0eU5vdGlmaWNhdGlvbnNcIixcbiAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgZGVzY3JpcHRpb246XG4gICAgICAgIFwiUG9zc2libGUgc29jaWFsIHByb29mIGN1ZSBkZXRlY3RlZC4gVmlzaXRvciBjb3VudCBtZXNzYWdlcyBtYXkgY3JlYXRlIHNvY2lhbCBwcm9vZi5cIixcbiAgICAgIGV2aWRlbmNlOiBtYXRjaGVzLnNsaWNlKDAsIDIpLmpvaW4oXCI7IFwiKSxcbiAgICAgIGNvbmZpZGVuY2U6IDAuNyxcbiAgICAgIHNvdXJjZTogXCJoZXVyaXN0aWNcIixcbiAgICB9LFxuICBdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0Q29uZmlybXNoYW1pbmcoXG4gIHZpc2libGVUZXh0OiBzdHJpbmcsXG4gIHBhZ2VUeXBlOiBQYWdlVHlwZSA9IFwiZ2VuZXJhbFwiLFxuICBpbnRlcmFjdGl2ZUh0bWwgPSBcIlwiLFxuKTogSGV1cmlzdGljU2lnbmFsW10ge1xuICBjb25zdCB0ZXh0ID1cbiAgICBwYWdlVHlwZSA9PT0gXCJlZGl0b3JpYWxcIiA/IGludGVyYWN0aXZlSHRtbCA6IHZpc2libGVUZXh0O1xuICBjb25zdCBtYXRjaGVzID0gbWF0Y2hQYXR0ZXJucyh0ZXh0LCBDT05GSVJNU0hBTUlOR19QQVRURVJOUyk7XG4gIGlmIChtYXRjaGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuXG4gIHJldHVybiBbXG4gICAge1xuICAgICAgY2F0ZWdvcnk6IFwiRk9SQ0VEX0FDVElPTlwiLFxuICAgICAgcGF0dGVyblR5cGU6IFwiQ29uZmlybXNoYW1pbmdcIixcbiAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgZGVzY3JpcHRpb246XG4gICAgICAgIFwiUG9zc2libGUgcHJlc3N1cmUgY3VlIGRldGVjdGVkIGluIGRlY2xpbmUgb3Igb3B0LW91dCB3b3JkaW5nLlwiLFxuICAgICAgZXZpZGVuY2U6IG1hdGNoZXMuc2xpY2UoMCwgMikuam9pbihcIjsgXCIpLFxuICAgICAgY29uZmlkZW5jZTogMC43NSxcbiAgICAgIHNvdXJjZTogXCJoZXVyaXN0aWNcIixcbiAgICB9LFxuICBdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0UHJlc2VsZWN0aW9uKGh0bWw6IHN0cmluZyk6IEhldXJpc3RpY1NpZ25hbFtdIHtcbiAgY29uc3QgaGFzQ2hlY2tlZElucHV0ID0gLzxpbnB1dFtePl0qXFxiY2hlY2tlZFxcYi9pLnRlc3QoaHRtbCk7XG4gIGNvbnN0IG1hdGNoZXMgPSBtYXRjaFBhdHRlcm5zKGh0bWwsIFBSRVNFTEVDVElPTl9QQVRURVJOUyk7XG5cbiAgaWYgKCFoYXNDaGVja2VkSW5wdXQgJiYgbWF0Y2hlcy5sZW5ndGggPT09IDApIHJldHVybiBbXTtcblxuICByZXR1cm4gW1xuICAgIHtcbiAgICAgIGNhdGVnb3J5OiBcIlBSRVNFTEVDVElPTlwiLFxuICAgICAgcGF0dGVyblR5cGU6IFwiUHJlQ2hlY2tlZEJveFwiLFxuICAgICAgc2V2ZXJpdHk6IFwiTUVESVVNXCIsXG4gICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgXCJQb3NzaWJsZSBwcmVzZWxlY3Rpb24gY3VlIGRldGVjdGVkLiBQcmUtc2VsZWN0ZWQgb3B0aW9ucyBjYW4gbnVkZ2UgdXNlcnMgdG93YXJkIGFkZC1vbnMgb3IgbWFya2V0aW5nIGNvbnNlbnQuXCIsXG4gICAgICBldmlkZW5jZTogaGFzQ2hlY2tlZElucHV0XG4gICAgICAgID8gXCJQcmUtY2hlY2tlZCBpbnB1dCBlbGVtZW50cyBkZXRlY3RlZCBpbiBwYWdlIG1hcmt1cC5cIlxuICAgICAgICA6IG1hdGNoZXMuam9pbihcIjsgXCIpLFxuICAgICAgY29uZmlkZW5jZTogaGFzQ2hlY2tlZElucHV0ID8gMC44IDogMC42NSxcbiAgICAgIHNvdXJjZTogXCJoZXVyaXN0aWNcIixcbiAgICB9LFxuICBdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0T2JzdHJ1Y3Rpb24oXG4gIGh0bWw6IHN0cmluZyxcbiAgcGFnZVR5cGU6IFBhZ2VUeXBlID0gXCJnZW5lcmFsXCIsXG4pOiBIZXVyaXN0aWNTaWduYWxbXSB7XG4gIGlmIChwYWdlVHlwZSA9PT0gXCJlZGl0b3JpYWxcIikge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGNvbnN0IGhhc1N0aWNreU92ZXJsYXkgPVxuICAgIC9wb3NpdGlvbjpcXHMqKGZpeGVkfHN0aWNreSkvaS50ZXN0KGh0bWwpIHx8XG4gICAgL2NsYXNzPVwiW15cIl0qKG1vZGFsfHBvcHVwfG92ZXJsYXl8c3RpY2t5LWJhbm5lcilbXlwiXSpcIi9pLnRlc3QoaHRtbCk7XG5cbiAgaWYgKCFoYXNTdGlja3lPdmVybGF5KSByZXR1cm4gW107XG5cbiAgcmV0dXJuIFtcbiAgICB7XG4gICAgICBjYXRlZ29yeTogXCJPQlNUUlVDVElPTlwiLFxuICAgICAgcGF0dGVyblR5cGU6IFwiU3RpY2t5UHJlc3N1cmVCYW5uZXJcIixcbiAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgZGVzY3JpcHRpb246XG4gICAgICAgIFwiUG9zc2libGUgb2JzdHJ1Y3Rpb24gY3VlIGRldGVjdGVkLiBTdGlja3kgYmFubmVycyBvciBvdmVybGF5cyBtYXkga2VlcCBjaGVja291dCBwcmVzc3VyZSB2aXNpYmxlLlwiLFxuICAgICAgZXZpZGVuY2U6IFwiRml4ZWQgb3Igc3RpY2t5IG92ZXJsYXktbGlrZSBlbGVtZW50cyBkZXRlY3RlZC5cIixcbiAgICAgIGNvbmZpZGVuY2U6IDAuNjUsXG4gICAgICBzb3VyY2U6IFwiaGV1cmlzdGljXCIsXG4gICAgfSxcbiAgXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJ1bkhldXJpc3RpY3MocGFnZToge1xuICB2aXNpYmxlVGV4dDogc3RyaW5nO1xuICBpbnRlcmFjdGl2ZUh0bWw6IHN0cmluZztcbiAgcGFnZVR5cGU/OiBQYWdlVHlwZTtcbn0pOiBIZXVyaXN0aWNTaWduYWxbXSB7XG4gIGNvbnN0IHBhZ2VUeXBlID0gcGFnZS5wYWdlVHlwZSA/PyBcImdlbmVyYWxcIjtcblxuICByZXR1cm4gW1xuICAgIC4uLmRldGVjdFVyZ2VuY3kocGFnZS52aXNpYmxlVGV4dCwgcGFnZS5pbnRlcmFjdGl2ZUh0bWwsIHBhZ2VUeXBlKSxcbiAgICAuLi5kZXRlY3RTY2FyY2l0eShwYWdlLnZpc2libGVUZXh0LCBwYWdlVHlwZSwgcGFnZS5pbnRlcmFjdGl2ZUh0bWwpLFxuICAgIC4uLmRldGVjdFNvY2lhbFByb29mKHBhZ2UudmlzaWJsZVRleHQsIHBhZ2VUeXBlLCBwYWdlLmludGVyYWN0aXZlSHRtbCksXG4gICAgLi4uZGV0ZWN0Q29uZmlybXNoYW1pbmcoXG4gICAgICBwYWdlLnZpc2libGVUZXh0LFxuICAgICAgcGFnZVR5cGUsXG4gICAgICBwYWdlLmludGVyYWN0aXZlSHRtbCxcbiAgICApLFxuICAgIC4uLmRldGVjdFByZXNlbGVjdGlvbihwYWdlLmludGVyYWN0aXZlSHRtbCksXG4gICAgLi4uZGV0ZWN0T2JzdHJ1Y3Rpb24ocGFnZS5pbnRlcmFjdGl2ZUh0bWwsIHBhZ2VUeXBlKSxcbiAgXTtcbn1cbiIsImltcG9ydCB0eXBlIHsgQ29uY2VybkxldmVsIH0gZnJvbSBcIi4uL3R5cGVzL3NjYW5cIjtcblxuZXhwb3J0IGNvbnN0IEhPTUVfRElTQ0xBSU1FUiA9XG4gIFwiVGhpcyB0b29sIGlkZW50aWZpZXMgcG90ZW50aWFsIHByZXNzdXJlIHRhY3RpY3MgYW5kIGRlc2lnbiBjdWVzLiBJdCBkb2VzIG5vdCBkZXRlcm1pbmUgd2hldGhlciBhIHdlYnNpdGUgaXMgdW5sYXdmdWwsIGZyYXVkdWxlbnQsIG9yIHVuc2FmZS5cIjtcblxuZXhwb3J0IGNvbnN0IFJFUE9SVF9ESVNDTEFJTUVSID1cbiAgXCJGaW5kaW5ncyBhcmUgYmFzZWQgb24gYXV0b21hdGVkIGFuYWx5c2lzIGFuZCBtYXkgYmUgaW5jb21wbGV0ZSBvciBpbmNvcnJlY3QuXCI7XG5cbmV4cG9ydCBjb25zdCBQUk9ISUJJVEVEX1dPUkRTID0gW1xuICBcInNjYW1cIixcbiAgXCJmcmF1ZFwiLFxuICBcImNyaW1pbmFsXCIsXG4gIFwiaWxsZWdhbFwiLFxuICBcImNoZWF0aW5nXCIsXG4gIFwiZGlzaG9uZXN0IHNlbGxlclwiLFxuICBcInByZWRhdG9yeSBidXNpbmVzc1wiLFxuICBcInByZWRhdG9yeVwiLFxuICBcImRlY2VwdGl2ZSBjb21wYW55XCIsXG5dIGFzIGNvbnN0O1xuXG5leHBvcnQgY29uc3QgREVDSVNJT05fQ0hFQ0tMSVNUID0gW1xuICBcIkNoZWNrIHJlZnVuZCB0ZXJtcy5cIixcbiAgXCJDb21wYXJlIHByaWNlcyBlbHNld2hlcmUuXCIsXG4gIFwiTG9vayBmb3IgaW5kZXBlbmRlbnQgcmV2aWV3cy5cIixcbiAgXCJBdm9pZCBydXNoaW5nIGJlY2F1c2Ugb2YgdGltZXJzLlwiLFxuICBcIkNoZWNrIHdoZXRoZXIgZmVlcyBhcHBlYXIgb25seSBhdCBjaGVja291dC5cIixcbiAgXCJTYXZlIGEgY29weSBvZiBpbXBvcnRhbnQgdGVybXMgYmVmb3JlIHBheWluZy5cIixcbl0gYXMgY29uc3Q7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb25jZXJuTGV2ZWxGcm9tU2NvcmUoc2NvcmU6IG51bWJlciB8IG51bGwpOiBDb25jZXJuTGV2ZWwge1xuICBpZiAoc2NvcmUgPT09IG51bGwpIHJldHVybiBcIlVOQUJMRVwiO1xuICBpZiAoc2NvcmUgPj0gNzApIHJldHVybiBcIkhJR0hcIjtcbiAgaWYgKHNjb3JlID49IDUwKSByZXR1cm4gXCJNT0RFUkFURVwiO1xuICBpZiAoc2NvcmUgPj0gMjUpIHJldHVybiBcIlNPTUVcIjtcbiAgcmV0dXJuIFwiTE9XXCI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb25jZXJuTGV2ZWxMYWJlbChsZXZlbDogQ29uY2VybkxldmVsKTogc3RyaW5nIHtcbiAgc3dpdGNoIChsZXZlbCkge1xuICAgIGNhc2UgXCJMT1dcIjpcbiAgICAgIHJldHVybiBcIkxvdyBjb25jZXJuXCI7XG4gICAgY2FzZSBcIlNPTUVcIjpcbiAgICAgIHJldHVybiBcIlNvbWUgY2F1dGlvblwiO1xuICAgIGNhc2UgXCJNT0RFUkFURVwiOlxuICAgICAgcmV0dXJuIFwiTW9kZXJhdGUgY2F1dGlvblwiO1xuICAgIGNhc2UgXCJISUdIXCI6XG4gICAgICByZXR1cm4gXCJIaWdoIGNhdXRpb25cIjtcbiAgICBjYXNlIFwiVU5BQkxFXCI6XG4gICAgICByZXR1cm4gXCJVbmFibGUgdG8gYXNzZXNzXCI7XG4gICAgZGVmYXVsdDoge1xuICAgICAgY29uc3QgX2V4aGF1c3RpdmU6IG5ldmVyID0gbGV2ZWw7XG4gICAgICByZXR1cm4gX2V4aGF1c3RpdmU7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdWdnZXN0ZWRBY3Rpb25Gb3JDYXRlZ29yeShjYXRlZ29yeTogc3RyaW5nKTogc3RyaW5nIHtcbiAgc3dpdGNoIChjYXRlZ29yeSkge1xuICAgIGNhc2UgXCJVUkdFTkNZXCI6XG4gICAgICByZXR1cm4gXCJDb25zaWRlciByZXZpc2l0aW5nIHRoZSBwYWdlIGxhdGVyIHRvIGNoZWNrIHdoZXRoZXIgdGhlIG9mZmVyIGNoYW5nZXMuXCI7XG4gICAgY2FzZSBcIlNDQVJDSVRZXCI6XG4gICAgICByZXR1cm4gXCJDb21wYXJlIGF2YWlsYWJpbGl0eSBvbiBhbm90aGVyIGNoYW5uZWwgYmVmb3JlIGRlY2lkaW5nLlwiO1xuICAgIGNhc2UgXCJTT0NJQUxfUFJPT0ZcIjpcbiAgICAgIHJldHVybiBcIlRyZWF0IHZpc2l0b3Igb3IgcHVyY2hhc2UgY291bnRzIGFzIHVudmVyaWZpZWQgc29jaWFsIGN1ZXMuXCI7XG4gICAgY2FzZSBcIlBSRVNFTEVDVElPTlwiOlxuICAgICAgcmV0dXJuIFwiUmV2aWV3IHByZS1zZWxlY3RlZCBvcHRpb25zIGNhcmVmdWxseSBiZWZvcmUgY29udGludWluZy5cIjtcbiAgICBjYXNlIFwiRk9SQ0VEX0FDVElPTlwiOlxuICAgICAgcmV0dXJuIFwiTG9vayBmb3IgYSBjbGVhciB3YXkgdG8gZGVjbGluZSB3aXRob3V0IHBlbmFsdHkuXCI7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBcIkNvbnNpZGVyIGNoZWNraW5nIGluZGVwZW5kZW50bHkgYmVmb3JlIHBheWluZy5cIjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2FuaXRpemVUZXh0KHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCByZXN1bHQgPSB0ZXh0O1xuICBmb3IgKGNvbnN0IHdvcmQgb2YgUFJPSElCSVRFRF9XT1JEUykge1xuICAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgUmVnRXhwKGBcXFxcYiR7d29yZH1cXFxcYmAsIFwiZ2lcIik7XG4gICAgcmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UocGF0dGVybiwgXCJwb3RlbnRpYWwgcHJlc3N1cmUgY3VlXCIpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG4iLCIvKiogQnJvd3Nlci1pbnRlcm5hbCBwYWdlcyB0aGF0IGFyZSBuZXZlciBzY2FubmVkLiAqL1xuZXhwb3J0IGNvbnN0IEVYQ0xVREVEX1VSTF9QUkVGSVhFUyA9IFtcbiAgXCJjaHJvbWU6Ly9cIixcbiAgXCJjaHJvbWUtdW50cnVzdGVkOi8vXCIsXG4gIFwiY2hyb21lLWV4dGVuc2lvbjovL1wiLFxuICBcImFib3V0OlwiLFxuICBcImVkZ2U6Ly9cIixcbiAgXCJicmF2ZTovL1wiLFxuXSBhcyBjb25zdDtcblxuLyoqIFBvcHVsYXIgc2l0ZXMgc2tpcHBlZCBieSBhdXRvLXNjYW4gKGVtYWlsLCBjaGF0LCBzb2NpYWwsIHN0cmVhbWluZywgZXRjLikuICovXG5leHBvcnQgY29uc3QgRVhDTFVERURfSE9TVFMgPSBbXG4gIC8vIEdvb2dsZVxuICBcImdvb2dsZS5jb21cIixcbiAgXCJnbWFpbC5jb21cIixcbiAgXCJ5b3V0dWJlLmNvbVwiLFxuICAvLyBNZXRhXG4gIFwiZmFjZWJvb2suY29tXCIsXG4gIFwiaW5zdGFncmFtLmNvbVwiLFxuICBcIm1ldGEuY29tXCIsXG4gIFwibWVzc2VuZ2VyLmNvbVwiLFxuICBcInRocmVhZHMubmV0XCIsXG4gIFwid2hhdHNhcHAuY29tXCIsXG4gIC8vIE1pY3Jvc29mdFxuICBcIm1pY3Jvc29mdC5jb21cIixcbiAgXCJvdXRsb29rLmNvbVwiLFxuICBcImxpdmUuY29tXCIsXG4gIFwiaG90bWFpbC5jb21cIixcbiAgXCJvZmZpY2UuY29tXCIsXG4gIFwib2ZmaWNlMzY1LmNvbVwiLFxuICAvLyBBcHBsZVxuICBcImFwcGxlLmNvbVwiLFxuICBcImljbG91ZC5jb21cIixcbiAgLy8gU29jaWFsICYgbWVzc2FnaW5nXG4gIFwidHdpdHRlci5jb21cIixcbiAgXCJ4LmNvbVwiLFxuICBcImxpbmtlZGluLmNvbVwiLFxuICBcInRpa3Rvay5jb21cIixcbiAgXCJyZWRkaXQuY29tXCIsXG4gIFwicGludGVyZXN0LmNvbVwiLFxuICBcInNuYXBjaGF0LmNvbVwiLFxuICBcImRpc2NvcmQuY29tXCIsXG4gIFwic2xhY2suY29tXCIsXG4gIFwidGVsZWdyYW0ub3JnXCIsXG4gIFwidC5tZVwiLFxuICBcInpvb20udXNcIixcbiAgXCJ6b29tLmNvbVwiLFxuICAvLyBFbWFpbFxuICBcInlhaG9vLmNvbVwiLFxuICBcInByb3Rvbi5tZVwiLFxuICBcInByb3Rvbm1haWwuY29tXCIsXG4gIC8vIFN0cmVhbWluZyAmIGNvbW1lcmNlXG4gIFwibmV0ZmxpeC5jb21cIixcbiAgXCJzcG90aWZ5LmNvbVwiLFxuICBcImFtYXpvbi5jb21cIixcbiAgXCJiaW5nLmNvbVwiLFxuXSBhcyBjb25zdDtcblxuZXhwb3J0IGZ1bmN0aW9uIGlzRXhjbHVkZWRVcmwodXJsOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcbiAgaWYgKCF1cmwpIHJldHVybiB0cnVlO1xuXG4gIGNvbnN0IGxvd2VyID0gdXJsLnRvTG93ZXJDYXNlKCk7XG4gIGZvciAoY29uc3QgcHJlZml4IG9mIEVYQ0xVREVEX1VSTF9QUkVGSVhFUykge1xuICAgIGlmIChsb3dlci5zdGFydHNXaXRoKHByZWZpeCkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHRyeSB7XG4gICAgcmV0dXJuIGlzRXhjbHVkZWRIb3N0KG5ldyBVUkwodXJsKS5ob3N0bmFtZSk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0V4Y2x1ZGVkSG9zdChob3N0bmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IGhvc3QgPSBob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICBmb3IgKGNvbnN0IGV4Y2x1ZGVkIG9mIEVYQ0xVREVEX0hPU1RTKSB7XG4gICAgaWYgKGhvc3QgPT09IGV4Y2x1ZGVkIHx8IGhvc3QuZW5kc1dpdGgoYC4ke2V4Y2x1ZGVkfWApKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuIiwiaW1wb3J0IHR5cGUgeyBFeHRlbnNpb25BbmFseXplUmVzcG9uc2UgfSBmcm9tIFwiQGRhcmtwYXR0ZXJucy9zaGFyZWQvdHlwZXNcIjtcbmltcG9ydCB7IGlzRXhjbHVkZWRVcmwgfSBmcm9tIFwiLi9leGNsdWRlZC1ob3N0c1wiO1xuXG5leHBvcnQgdHlwZSBFeHRlbnNpb25TZXR0aW5ncyA9IHtcbiAgdGVybXNBY2NlcHRlZEF0OiBzdHJpbmcgfCBudWxsO1xuICBhdXRvU2NhbkVuYWJsZWQ6IGJvb2xlYW47XG4gIGFwaUJhc2VVcmw6IHN0cmluZztcbiAgYXBpS2V5OiBzdHJpbmc7XG59O1xuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBFeHRlbnNpb25TZXR0aW5ncyA9IHtcbiAgdGVybXNBY2NlcHRlZEF0OiBudWxsLFxuICBhdXRvU2NhbkVuYWJsZWQ6IHRydWUsXG4gIGFwaUJhc2VVcmw6IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gIGFwaUtleTogXCJcIixcbn07XG5cbnR5cGUgVXJsUmVwb3J0Q2FjaGUgPSB7XG4gIG5vcm1hbGl6ZWRVcmw6IHN0cmluZztcbiAgcmVwb3J0OiBFeHRlbnNpb25BbmFseXplUmVzcG9uc2VbXCJzY2FuXCJdO1xuICBjYWNoZWRBdDogbnVtYmVyO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVVybEZvckNhY2hlKHVybDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgcGFyc2VkID0gbmV3IFVSTCh1cmwpO1xuICBwYXJzZWQuaGFzaCA9IFwiXCI7XG4gIHBhcnNlZC5ob3N0bmFtZSA9IHBhcnNlZC5ob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICByZXR1cm4gcGFyc2VkLnRvU3RyaW5nKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1cmxzTWF0Y2hGb3JDYWNoZShhOiBzdHJpbmcsIGI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICB0cnkge1xuICAgIHJldHVybiBub3JtYWxpemVVcmxGb3JDYWNoZShhKSA9PT0gbm9ybWFsaXplVXJsRm9yQ2FjaGUoYik7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBhID09PSBiO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRTZXR0aW5ncygpOiBQcm9taXNlPEV4dGVuc2lvblNldHRpbmdzPiB7XG4gIGNvbnN0IHN0b3JlZCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChPYmplY3Qua2V5cyhERUZBVUxUX1NFVFRJTkdTKSk7XG4gIHJldHVybiB7IC4uLkRFRkFVTFRfU0VUVElOR1MsIC4uLnN0b3JlZCB9IGFzIEV4dGVuc2lvblNldHRpbmdzO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2F2ZVNldHRpbmdzKFxuICBwYXJ0aWFsOiBQYXJ0aWFsPEV4dGVuc2lvblNldHRpbmdzPixcbik6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQocGFydGlhbCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRUYWJSZXBvcnQoXG4gIHRhYklkOiBudW1iZXIsXG4pOiBQcm9taXNlPGltcG9ydChcIi4vbWVzc2FnZXNcIikuVGFiUmVwb3J0U3RhdGUgfCBudWxsPiB7XG4gIGNvbnN0IGtleSA9IGB0YWJSZXBvcnQ6JHt0YWJJZH1gO1xuICBjb25zdCBzdG9yZWQgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5zZXNzaW9uLmdldChrZXkpO1xuICByZXR1cm4gKFxuICAgIChzdG9yZWRba2V5XSBhcyBpbXBvcnQoXCIuL21lc3NhZ2VzXCIpLlRhYlJlcG9ydFN0YXRlIHwgdW5kZWZpbmVkKSA/PyBudWxsXG4gICk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXRUYWJSZXBvcnQoXG4gIHRhYklkOiBudW1iZXIsXG4gIHN0YXRlOiBpbXBvcnQoXCIuL21lc3NhZ2VzXCIpLlRhYlJlcG9ydFN0YXRlLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGtleSA9IGB0YWJSZXBvcnQ6JHt0YWJJZH1gO1xuICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5zZXNzaW9uLnNldCh7IFtrZXldOiBzdGF0ZSB9KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFVybFJlcG9ydENhY2hlKFxuICB1cmw6IHN0cmluZyxcbik6IFByb21pc2U8RXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlW1wic2NhblwiXSB8IG51bGw+IHtcbiAgY29uc3Qgbm9ybWFsaXplZFVybCA9IG5vcm1hbGl6ZVVybEZvckNhY2hlKHVybCk7XG4gIGNvbnN0IGtleSA9IGB1cmxSZXBvcnQ6JHtub3JtYWxpemVkVXJsfWA7XG4gIGNvbnN0IHN0b3JlZCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChrZXkpO1xuICBjb25zdCBjYWNoZSA9IHN0b3JlZFtrZXldIGFzIFVybFJlcG9ydENhY2hlIHwgdW5kZWZpbmVkO1xuICByZXR1cm4gY2FjaGU/LnJlcG9ydCA/PyBudWxsO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0VXJsUmVwb3J0Q2FjaGUoXG4gIHVybDogc3RyaW5nLFxuICByZXBvcnQ6IEV4dGVuc2lvbkFuYWx5emVSZXNwb25zZVtcInNjYW5cIl0sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgbm9ybWFsaXplZFVybCA9IG5vcm1hbGl6ZVVybEZvckNhY2hlKHVybCk7XG4gIGNvbnN0IGtleSA9IGB1cmxSZXBvcnQ6JHtub3JtYWxpemVkVXJsfWA7XG4gIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7XG4gICAgW2tleV06IHtcbiAgICAgIG5vcm1hbGl6ZWRVcmwsXG4gICAgICByZXBvcnQsXG4gICAgICBjYWNoZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9IHNhdGlzZmllcyBVcmxSZXBvcnRDYWNoZSxcbiAgfSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjbGVhclVybFJlcG9ydENhY2hlKHVybDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IG5vcm1hbGl6ZWRVcmwgPSBub3JtYWxpemVVcmxGb3JDYWNoZSh1cmwpO1xuICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5yZW1vdmUoYHVybFJlcG9ydDoke25vcm1hbGl6ZWRVcmx9YCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0FuYWx5emFibGVVcmwodXJsOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcbiAgaWYgKCF1cmwpIHJldHVybiBmYWxzZTtcbiAgaWYgKCF1cmwuc3RhcnRzV2l0aChcImh0dHA6Ly9cIikgJiYgIXVybC5zdGFydHNXaXRoKFwiaHR0cHM6Ly9cIikpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuICFpc0V4Y2x1ZGVkVXJsKHVybCk7XG59XG4iLCJpbXBvcnQgdHlwZSB7XG4gIEV4dGVuc2lvbkFuYWx5emVQYXlsb2FkLFxuICBFeHRlbnNpb25BbmFseXplUmVzcG9uc2UsXG59IGZyb20gXCJAZGFya3BhdHRlcm5zL3NoYXJlZC90eXBlc1wiO1xuaW1wb3J0IHsgZ2V0U2V0dGluZ3MgfSBmcm9tIFwiLi4vbGliL3N0b3JhZ2VcIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoQ2FjaGVkUmVwb3J0RnJvbUJhY2tlbmQoXG4gIHVybDogc3RyaW5nLFxuKTogUHJvbWlzZTxFeHRlbnNpb25BbmFseXplUmVzcG9uc2VbXCJzY2FuXCJdIHwgbnVsbD4ge1xuICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGdldFNldHRpbmdzKCk7XG4gIGNvbnN0IGJhc2VVcmwgPSBzZXR0aW5ncy5hcGlCYXNlVXJsLnJlcGxhY2UoL1xcLyQvLCBcIlwiKTtcbiAgY29uc3QgZW5kcG9pbnQgPSBgJHtiYXNlVXJsfS9hcGkvZXh0ZW5zaW9uL2NhY2hlP3VybD0ke2VuY29kZVVSSUNvbXBvbmVudCh1cmwpfWA7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGVuZHBvaW50LCB7XG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIC4uLihzZXR0aW5ncy5hcGlLZXkgPyB7IFwiWC1FeHRlbnNpb24tS2V5XCI6IHNldHRpbmdzLmFwaUtleSB9IDoge30pLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YSA9IChhd2FpdCByZXNwb25zZS5qc29uKCkpIGFzXG4gICAgICB8IEV4dGVuc2lvbkFuYWx5emVSZXNwb25zZVxuICAgICAgfCB7IG9rOiBmYWxzZTsgZXJyb3I6IHN0cmluZyB9O1xuXG4gICAgaWYgKCFyZXNwb25zZS5vayB8fCAhZGF0YS5vaykge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRhdGEuc2NhbjtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFuYWx5emVXaXRoQmFja2VuZChcbiAgcGF5bG9hZDogT21pdDxFeHRlbnNpb25BbmFseXplUGF5bG9hZCwgXCJzb3VyY2VcIiB8IFwic2Nhbm5lZEF0XCI+LFxuICBmb3JjZSA9IGZhbHNlLFxuKTogUHJvbWlzZTxFeHRlbnNpb25BbmFseXplUmVzcG9uc2U+IHtcbiAgY29uc3Qgc2V0dGluZ3MgPSBhd2FpdCBnZXRTZXR0aW5ncygpO1xuICBjb25zdCBiYXNlVXJsID0gc2V0dGluZ3MuYXBpQmFzZVVybC5yZXBsYWNlKC9cXC8kLywgXCJcIik7XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7YmFzZVVybH0vYXBpL2V4dGVuc2lvbi9hbmFseXplYCwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAuLi4oc2V0dGluZ3MuYXBpS2V5ID8geyBcIlgtRXh0ZW5zaW9uLUtleVwiOiBzZXR0aW5ncy5hcGlLZXkgfSA6IHt9KSxcbiAgICB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIC4uLnBheWxvYWQsXG4gICAgICBzY2FubmVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIHNvdXJjZTogXCJjaHJvbWUtZXh0ZW5zaW9uXCIsXG4gICAgICBmb3JjZSxcbiAgICB9IHNhdGlzZmllcyBFeHRlbnNpb25BbmFseXplUGF5bG9hZCksXG4gIH0pO1xuXG4gIGNvbnN0IGRhdGEgPSAoYXdhaXQgcmVzcG9uc2UuanNvbigpKSBhc1xuICAgIHwgRXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlXG4gICAgfCB7IG9rOiBmYWxzZTsgZXJyb3I6IHN0cmluZyB9O1xuXG4gIGlmICghcmVzcG9uc2Uub2sgfHwgIWRhdGEub2spIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcImVycm9yXCIgaW4gZGF0YSA/IGRhdGEuZXJyb3IgOiBcIlVuYWJsZSB0byBhbmFseXplIHRoaXMgcGFnZS5cIixcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIGRhdGE7XG59XG4iLCIvLy8gPHJlZmVyZW5jZSB0eXBlcz1cInd4dC9jbGllbnQtdHlwZXNcIiAvPlxuXG5pbXBvcnQgeyBydW5IZXVyaXN0aWNzIH0gZnJvbSBcIkBkYXJrcGF0dGVybnMvc2hhcmVkL2hldXJpc3RpY3NcIjtcbmltcG9ydCB0eXBlIHtcbiAgRXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlLFxuICBQYWdlSGlnaGxpZ2h0LFxuICBQYWdlVHlwZSxcbn0gZnJvbSBcIkBkYXJrcGF0dGVybnMvc2hhcmVkL3R5cGVzXCI7XG5pbXBvcnQge1xuICBjb25jZXJuTGV2ZWxGcm9tU2NvcmUsXG4gIHNhbml0aXplVGV4dCxcbiAgc3VnZ2VzdGVkQWN0aW9uRm9yQ2F0ZWdvcnksXG59IGZyb20gXCJAZGFya3BhdHRlcm5zL3NoYXJlZC93b3JkaW5nXCI7XG5pbXBvcnQgeyBhbmFseXplV2l0aEJhY2tlbmQsIGZldGNoQ2FjaGVkUmVwb3J0RnJvbUJhY2tlbmQgfSBmcm9tIFwiLi4vYXBpL2NsaWVudFwiO1xuaW1wb3J0IHR5cGUgeyBBbmFseXplUGFnZU1lc3NhZ2UsIFRhYlJlcG9ydFVwZGF0ZWRNZXNzYWdlIH0gZnJvbSBcIi4uL2xpYi9tZXNzYWdlc1wiO1xuaW1wb3J0IHtcbiAgY2xlYXJVcmxSZXBvcnRDYWNoZSxcbiAgZ2V0U2V0dGluZ3MsXG4gIGdldFRhYlJlcG9ydCxcbiAgZ2V0VXJsUmVwb3J0Q2FjaGUsXG4gIGlzQW5hbHl6YWJsZVVybCxcbiAgbm9ybWFsaXplVXJsRm9yQ2FjaGUsXG4gIHNldFRhYlJlcG9ydCxcbiAgc2V0VXJsUmVwb3J0Q2FjaGUsXG4gIHVybHNNYXRjaEZvckNhY2hlLFxufSBmcm9tIFwiLi4vbGliL3N0b3JhZ2VcIjtcblxuY29uc3QgZGVib3VuY2VUaW1lcnMgPSBuZXcgTWFwPG51bWJlciwgUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4+KCk7XG5jb25zdCBpbkZsaWdodFVybHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbmNvbnN0IHBlbmRpbmdIaWdobGlnaHRzID0gbmV3IE1hcDxudW1iZXIsIFBhZ2VIaWdobGlnaHRbXT4oKTtcbmNvbnN0IERFQk9VTkNFX01TID0gMjAwMDtcbmNvbnN0IEFOQUxZU0lTX1RJTUVPVVRfTVMgPSA5MF8wMDA7XG5cbmZ1bmN0aW9uIHdpdGhBbmFseXNpc1RpbWVvdXQ8VD4ocHJvbWlzZTogUHJvbWlzZTxUPik6IFByb21pc2U8VD4ge1xuICByZXR1cm4gUHJvbWlzZS5yYWNlKFtcbiAgICBwcm9taXNlLFxuICAgIG5ldyBQcm9taXNlPFQ+KChfLCByZWplY3QpID0+IHtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICByZWplY3QobmV3IEVycm9yKFwiQW5hbHlzaXMgdGltZWQgb3V0LlwiKSk7XG4gICAgICB9LCBBTkFMWVNJU19USU1FT1VUX01TKTtcbiAgICB9KSxcbiAgXSk7XG59XG5cbmZ1bmN0aW9uIG5vdGlmeVRhYlJlcG9ydFVwZGF0ZWQodGFiSWQ6IG51bWJlcik6IHZvaWQge1xuICB2b2lkIGNocm9tZS5ydW50aW1lXG4gICAgLnNlbmRNZXNzYWdlKHsgdHlwZTogXCJUQUJfUkVQT1JUX1VQREFURURcIiwgdGFiSWQgfSBzYXRpc2ZpZXMgVGFiUmVwb3J0VXBkYXRlZE1lc3NhZ2UpXG4gICAgLmNhdGNoKCgpID0+IHtcbiAgICAgIC8vIFNpZGUgcGFuZWwgbWF5IGJlIGNsb3NlZC5cbiAgICB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdXBkYXRlVGFiUmVwb3J0KFxuICB0YWJJZDogbnVtYmVyLFxuICBzdGF0ZTogaW1wb3J0KFwiLi4vbGliL21lc3NhZ2VzXCIpLlRhYlJlcG9ydFN0YXRlLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IHNldFRhYlJlcG9ydCh0YWJJZCwgc3RhdGUpO1xuICBub3RpZnlUYWJSZXBvcnRVcGRhdGVkKHRhYklkKTtcbn1cblxuZnVuY3Rpb24gY29uY2VybkJhZGdlVGV4dChsZXZlbDogc3RyaW5nKTogc3RyaW5nIHtcbiAgc3dpdGNoIChsZXZlbCkge1xuICAgIGNhc2UgXCJISUdIXCI6XG4gICAgICByZXR1cm4gXCIhXCI7XG4gICAgY2FzZSBcIk1PREVSQVRFXCI6XG4gICAgICByZXR1cm4gXCJNXCI7XG4gICAgY2FzZSBcIlNPTUVcIjpcbiAgICAgIHJldHVybiBcIlNcIjtcbiAgICBjYXNlIFwiTE9XXCI6XG4gICAgICByZXR1cm4gXCJPS1wiO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gXCI/XCI7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gdXBkYXRlQmFkZ2UoXG4gIHRhYklkOiBudW1iZXIsXG4gIGNvbmNlcm5MZXZlbDogc3RyaW5nIHwgbnVsbCxcbiAgYW5hbHl6aW5nID0gZmFsc2UsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKGFuYWx5emluZykge1xuICAgIGF3YWl0IGNocm9tZS5hY3Rpb24uc2V0QmFkZ2VUZXh0KHsgdGFiSWQsIHRleHQ6IFwi4oCmXCIgfSk7XG4gICAgYXdhaXQgY2hyb21lLmFjdGlvbi5zZXRCYWRnZUJhY2tncm91bmRDb2xvcih7IHRhYklkLCBjb2xvcjogXCIjMUU0MEFGXCIgfSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKCFjb25jZXJuTGV2ZWwpIHtcbiAgICBhd2FpdCBjaHJvbWUuYWN0aW9uLnNldEJhZGdlVGV4dCh7IHRhYklkLCB0ZXh0OiBcIlwiIH0pO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGF3YWl0IGNocm9tZS5hY3Rpb24uc2V0QmFkZ2VUZXh0KHtcbiAgICB0YWJJZCxcbiAgICB0ZXh0OiBjb25jZXJuQmFkZ2VUZXh0KGNvbmNlcm5MZXZlbCksXG4gIH0pO1xuXG4gIGNvbnN0IGNvbG9yID1cbiAgICBjb25jZXJuTGV2ZWwgPT09IFwiSElHSFwiXG4gICAgICA/IFwiI0RDMjYyNlwiXG4gICAgICA6IGNvbmNlcm5MZXZlbCA9PT0gXCJNT0RFUkFURVwiXG4gICAgICAgID8gXCIjRDk3NzA2XCJcbiAgICAgICAgOiBjb25jZXJuTGV2ZWwgPT09IFwiU09NRVwiXG4gICAgICAgICAgPyBcIiMzQjgyRjZcIlxuICAgICAgICAgIDogXCIjMTZBMzRBXCI7XG5cbiAgYXdhaXQgY2hyb21lLmFjdGlvbi5zZXRCYWRnZUJhY2tncm91bmRDb2xvcih7IHRhYklkLCBjb2xvciB9KTtcbn1cblxuZnVuY3Rpb24gYnVpbGRMb2NhbEZhbGxiYWNrUmVwb3J0KFxuICB1cmw6IHN0cmluZyxcbiAgcGFnZVRpdGxlOiBzdHJpbmcsXG4gIGhldXJpc3RpY1NpZ25hbHM6IFJldHVyblR5cGU8dHlwZW9mIHJ1bkhldXJpc3RpY3M+LFxuKTogRXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlW1wic2NhblwiXSB7XG4gIGNvbnN0IHJpc2tTY29yZSA9XG4gICAgaGV1cmlzdGljU2lnbmFscy5sZW5ndGggPT09IDBcbiAgICAgID8gNVxuICAgICAgOiBNYXRoLm1pbihcbiAgICAgICAgICAxMDAsXG4gICAgICAgICAgTWF0aC5yb3VuZChcbiAgICAgICAgICAgIGhldXJpc3RpY1NpZ25hbHMucmVkdWNlKChzdW0sIHNpZ25hbCkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCB3ZWlnaHQgPVxuICAgICAgICAgICAgICAgIHNpZ25hbC5zZXZlcml0eSA9PT0gXCJISUdIXCJcbiAgICAgICAgICAgICAgICAgID8gNDVcbiAgICAgICAgICAgICAgICAgIDogc2lnbmFsLnNldmVyaXR5ID09PSBcIk1FRElVTVwiXG4gICAgICAgICAgICAgICAgICAgID8gMjVcbiAgICAgICAgICAgICAgICAgICAgOiAxMDtcbiAgICAgICAgICAgICAgcmV0dXJuIHN1bSArIHdlaWdodCAqIHNpZ25hbC5jb25maWRlbmNlO1xuICAgICAgICAgICAgfSwgMCksXG4gICAgICAgICAgKSxcbiAgICAgICAgKTtcblxuICByZXR1cm4ge1xuICAgIGlkOiBcImxvY2FsXCIsXG4gICAgdXJsLFxuICAgIG5vcm1hbGl6ZWRVcmw6IHVybCxcbiAgICBzdGF0dXM6IFwiQ09NUExFVEVEXCIsXG4gICAgcmlza1Njb3JlLFxuICAgIGNvbmNlcm5MZXZlbDogY29uY2VybkxldmVsRnJvbVNjb3JlKHJpc2tTY29yZSksXG4gICAgc3VtbWFyeTogc2FuaXRpemVUZXh0KFxuICAgICAgaGV1cmlzdGljU2lnbmFscy5sZW5ndGggPiAwXG4gICAgICAgID8gYFdlIGZvdW5kICR7aGV1cmlzdGljU2lnbmFscy5sZW5ndGh9IHBvdGVudGlhbCBwcmVzc3VyZSBjdWVzIGxvY2FsbHkuIEJhY2tlbmQgc3luYyBmYWlsZWQg4oCUIGZpbmRpbmdzIHdlcmUgbm90IHNhdmVkLmBcbiAgICAgICAgOiBcIlVuYWJsZSB0byBhc3Nlc3MgdGhpcyBwYWdlIHJpZ2h0IG5vdy5cIixcbiAgICApLFxuICAgIHBhZ2VUaXRsZSxcbiAgICBjb21wbGV0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIGRldGVjdGlvbnM6IGhldXJpc3RpY1NpZ25hbHMubWFwKChzaWduYWwsIGluZGV4KSA9PiAoe1xuICAgICAgaWQ6IGBsb2NhbC0ke2luZGV4fWAsXG4gICAgICBjYXRlZ29yeTogc2lnbmFsLmNhdGVnb3J5LFxuICAgICAgcGF0dGVyblR5cGU6IHNpZ25hbC5wYXR0ZXJuVHlwZSxcbiAgICAgIHNldmVyaXR5OiBzaWduYWwuc2V2ZXJpdHksXG4gICAgICBkZXNjcmlwdGlvbjogc2FuaXRpemVUZXh0KHNpZ25hbC5kZXNjcmlwdGlvbiksXG4gICAgICBldmlkZW5jZTogc2lnbmFsLmV2aWRlbmNlLFxuICAgICAgY29uZmlkZW5jZTogc2lnbmFsLmNvbmZpZGVuY2UsXG4gICAgICBzdWdnZXN0ZWRBY3Rpb246IHN1Z2dlc3RlZEFjdGlvbkZvckNhdGVnb3J5KHNpZ25hbC5jYXRlZ29yeSksXG4gICAgfSkpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpc1NjYW5OZXdlclRoYW4oXG4gIGNhbmRpZGF0ZTogeyBpZDogc3RyaW5nOyBjb21wbGV0ZWRBdDogc3RyaW5nIHwgbnVsbCB9LFxuICBjdXJyZW50OiB7IGlkOiBzdHJpbmc7IGNvbXBsZXRlZEF0OiBzdHJpbmcgfCBudWxsIH0sXG4pOiBib29sZWFuIHtcbiAgaWYgKGNhbmRpZGF0ZS5pZCA9PT0gY3VycmVudC5pZCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IGNhbmRpZGF0ZUF0ID0gY2FuZGlkYXRlLmNvbXBsZXRlZEF0XG4gICAgPyBuZXcgRGF0ZShjYW5kaWRhdGUuY29tcGxldGVkQXQpLmdldFRpbWUoKVxuICAgIDogMDtcbiAgY29uc3QgY3VycmVudEF0ID0gY3VycmVudC5jb21wbGV0ZWRBdFxuICAgID8gbmV3IERhdGUoY3VycmVudC5jb21wbGV0ZWRBdCkuZ2V0VGltZSgpXG4gICAgOiAwO1xuXG4gIHJldHVybiBjYW5kaWRhdGVBdCA+PSBjdXJyZW50QXQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHN5bmNIaWdobGlnaHRzVG9UYWIoXG4gIHRhYklkOiBudW1iZXIsXG4gIGhpZ2hsaWdodHM6IFBhZ2VIaWdobGlnaHRbXSxcbiAgdmlzaWJsZTogYm9vbGVhbixcbiAgZGV0ZWN0aW9uczogRXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlW1wic2NhblwiXVtcImRldGVjdGlvbnNcIl0gPSBbXSxcbiAgcmVwb3J0SWQ/OiBzdHJpbmcsXG4pOiBQcm9taXNlPFBhZ2VIaWdobGlnaHRbXT4ge1xuICB0cnkge1xuICAgIGlmICghdmlzaWJsZSkge1xuICAgICAgYXdhaXQgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2UodGFiSWQsIHsgdHlwZTogXCJDTEVBUl9QQUdFX0hJR0hMSUdIVFNcIiB9KTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBpZiAoaGlnaGxpZ2h0cy5sZW5ndGggPT09IDAgJiYgZGV0ZWN0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgIGF3YWl0IGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHRhYklkLCB7IHR5cGU6IFwiQ0xFQVJfUEFHRV9ISUdITElHSFRTXCIgfSk7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgcmVzcG9uc2UgPSAoYXdhaXQgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2UodGFiSWQsIHtcbiAgICAgIHR5cGU6IFwiU0VUX1BBR0VfSElHSExJR0hUU1wiLFxuICAgICAgaGlnaGxpZ2h0cyxcbiAgICAgIGRldGVjdGlvbnMsXG4gICAgICB2aXNpYmxlOiB0cnVlLFxuICAgICAgcmVwb3J0SWQsXG4gICAgfSkpIGFzIHsgaGlnaGxpZ2h0cz86IFBhZ2VIaWdobGlnaHRbXSB9IHwgdW5kZWZpbmVkO1xuXG4gICAgcmV0dXJuIHJlc3BvbnNlPy5oaWdobGlnaHRzID8/IGhpZ2hsaWdodHM7XG4gIH0gY2F0Y2gge1xuICAgIC8vIENvbnRlbnQgc2NyaXB0IG1heSBub3QgYmUgcmVhZHkgb24gdGhpcyB0YWIuXG4gICAgcmV0dXJuIGhpZ2hsaWdodHM7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gYXBwbHlDYWNoZWRSZXBvcnQoXG4gIHRhYklkOiBudW1iZXIsXG4gIHJlcG9ydDogRXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlW1wic2NhblwiXSxcbiAgaGlnaGxpZ2h0czogUGFnZUhpZ2hsaWdodFtdID0gW10sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgdXBkYXRlVGFiUmVwb3J0KHRhYklkLCB7IHN0YXR1czogXCJjb21wbGV0ZVwiLCByZXBvcnQsIGhpZ2hsaWdodHMgfSk7XG4gIGF3YWl0IHVwZGF0ZUJhZGdlKHRhYklkLCByZXBvcnQuY29uY2VybkxldmVsKTtcbiAgY29uc3QgZW5yaWNoZWRIaWdobGlnaHRzID0gYXdhaXQgc3luY0hpZ2hsaWdodHNUb1RhYihcbiAgICB0YWJJZCxcbiAgICBoaWdobGlnaHRzLFxuICAgIGhpZ2hsaWdodHMubGVuZ3RoID4gMCB8fCByZXBvcnQuZGV0ZWN0aW9ucy5sZW5ndGggPiAwLFxuICAgIHJlcG9ydC5kZXRlY3Rpb25zLFxuICAgIHJlcG9ydC5pZCxcbiAgKTtcblxuICBpZiAoZW5yaWNoZWRIaWdobGlnaHRzLmxlbmd0aCA+IDApIHtcbiAgICBhd2FpdCB1cGRhdGVUYWJSZXBvcnQodGFiSWQsIHtcbiAgICAgIHN0YXR1czogXCJjb21wbGV0ZVwiLFxuICAgICAgcmVwb3J0LFxuICAgICAgaGlnaGxpZ2h0czogZW5yaWNoZWRIaWdobGlnaHRzLFxuICAgIH0pO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGh5ZHJhdGVUYWJGcm9tQ2FjaGUoXG4gIHRhYklkOiBudW1iZXIsXG4gIHVybDogc3RyaW5nLFxuKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgZ2V0VGFiUmVwb3J0KHRhYklkKTtcblxuICBpZiAoZXhpc3Rpbmc/LnN0YXR1cyA9PT0gXCJhbmFseXppbmdcIikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgbGV0IGNhY2hlZCA9IGF3YWl0IGdldFVybFJlcG9ydENhY2hlKHVybCk7XG4gIGlmICghY2FjaGVkKSB7XG4gICAgY2FjaGVkID0gYXdhaXQgZmV0Y2hDYWNoZWRSZXBvcnRGcm9tQmFja2VuZCh1cmwpO1xuICAgIGlmIChjYWNoZWQpIHtcbiAgICAgIGF3YWl0IHNldFVybFJlcG9ydENhY2hlKHVybCwgY2FjaGVkKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWNhY2hlZCkge1xuICAgIHJldHVybiAoXG4gICAgICBleGlzdGluZz8uc3RhdHVzID09PSBcImNvbXBsZXRlXCIgJiZcbiAgICAgIHVybHNNYXRjaEZvckNhY2hlKFxuICAgICAgICBleGlzdGluZy5yZXBvcnQubm9ybWFsaXplZFVybCA/PyBleGlzdGluZy5yZXBvcnQudXJsLFxuICAgICAgICB1cmwsXG4gICAgICApXG4gICAgKTtcbiAgfVxuXG4gIGlmIChcbiAgICBleGlzdGluZz8uc3RhdHVzID09PSBcImNvbXBsZXRlXCIgJiZcbiAgICB1cmxzTWF0Y2hGb3JDYWNoZShcbiAgICAgIGV4aXN0aW5nLnJlcG9ydC5ub3JtYWxpemVkVXJsID8/IGV4aXN0aW5nLnJlcG9ydC51cmwsXG4gICAgICBjYWNoZWQubm9ybWFsaXplZFVybCA/PyBjYWNoZWQudXJsLFxuICAgICkgJiZcbiAgICAhaXNTY2FuTmV3ZXJUaGFuKGNhY2hlZCwgZXhpc3RpbmcucmVwb3J0KVxuICApIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGF3YWl0IGFwcGx5Q2FjaGVkUmVwb3J0KHRhYklkLCBjYWNoZWQpO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcnVuQW5hbHlzaXMoXG4gIHRhYklkOiBudW1iZXIsXG4gIHBheWxvYWQ6IHtcbiAgICB1cmw6IHN0cmluZztcbiAgICBwYWdlVGl0bGU6IHN0cmluZztcbiAgICB2aXNpYmxlVGV4dDogc3RyaW5nO1xuICAgIGludGVyYWN0aXZlSHRtbDogc3RyaW5nO1xuICAgIHBhZ2VUeXBlOiBQYWdlVHlwZTtcbiAgfSxcbiAgZm9yY2UgPSBmYWxzZSxcbik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGdldFNldHRpbmdzKCk7XG4gIGlmICghc2V0dGluZ3MudGVybXNBY2NlcHRlZEF0KSByZXR1cm47XG4gIGlmICghc2V0dGluZ3MuYXV0b1NjYW5FbmFibGVkICYmICFmb3JjZSkgcmV0dXJuO1xuICBpZiAoIWlzQW5hbHl6YWJsZVVybChwYXlsb2FkLnVybCkpIHJldHVybjtcblxuICBpZiAoIWZvcmNlKSB7XG4gICAgY29uc3QgaHlkcmF0ZWQgPSBhd2FpdCBoeWRyYXRlVGFiRnJvbUNhY2hlKHRhYklkLCBwYXlsb2FkLnVybCk7XG4gICAgaWYgKGh5ZHJhdGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGF3YWl0IGNsZWFyVXJsUmVwb3J0Q2FjaGUocGF5bG9hZC51cmwpO1xuICB9XG5cbiAgaWYgKGluRmxpZ2h0VXJscy5oYXMobm9ybWFsaXplVXJsRm9yQ2FjaGUocGF5bG9hZC51cmwpKSAmJiAhZm9yY2UpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBpbkZsaWdodFVybHMuYWRkKG5vcm1hbGl6ZVVybEZvckNhY2hlKHBheWxvYWQudXJsKSk7XG5cbiAgY29uc3QgaGV1cmlzdGljU2lnbmFscyA9IHJ1bkhldXJpc3RpY3Moe1xuICAgIHZpc2libGVUZXh0OiBwYXlsb2FkLnZpc2libGVUZXh0LFxuICAgIGludGVyYWN0aXZlSHRtbDogcGF5bG9hZC5pbnRlcmFjdGl2ZUh0bWwsXG4gICAgcGFnZVR5cGU6IHBheWxvYWQucGFnZVR5cGUsXG4gIH0pO1xuXG4gIGF3YWl0IHVwZGF0ZVRhYlJlcG9ydCh0YWJJZCwgeyBzdGF0dXM6IFwiYW5hbHl6aW5nXCIgfSk7XG4gIGF3YWl0IHVwZGF0ZUJhZGdlKHRhYklkLCBudWxsLCB0cnVlKTtcbiAgYXdhaXQgc3luY0hpZ2hsaWdodHNUb1RhYih0YWJJZCwgW10sIGZhbHNlKTtcblxuICBjb25zdCBoaWdobGlnaHRzID0gcGVuZGluZ0hpZ2hsaWdodHMuZ2V0KHRhYklkKSA/PyBbXTtcblxuICB0cnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpdGhBbmFseXNpc1RpbWVvdXQoXG4gICAgICBhbmFseXplV2l0aEJhY2tlbmQoXG4gICAgICAgIHtcbiAgICAgICAgICB1cmw6IHBheWxvYWQudXJsLFxuICAgICAgICAgIHBhZ2VUaXRsZTogcGF5bG9hZC5wYWdlVGl0bGUsXG4gICAgICAgICAgdmlzaWJsZVRleHQ6IHBheWxvYWQudmlzaWJsZVRleHQsXG4gICAgICAgICAgaW50ZXJhY3RpdmVIdG1sOiBwYXlsb2FkLmludGVyYWN0aXZlSHRtbCxcbiAgICAgICAgICBwYWdlVHlwZTogcGF5bG9hZC5wYWdlVHlwZSxcbiAgICAgICAgICBoZXVyaXN0aWNTaWduYWxzLFxuICAgICAgICB9LFxuICAgICAgICBmb3JjZSxcbiAgICAgICksXG4gICAgKTtcblxuICAgIGF3YWl0IHNldFVybFJlcG9ydENhY2hlKHBheWxvYWQudXJsLCByZXN1bHQuc2Nhbik7XG4gICAgYXdhaXQgYXBwbHlDYWNoZWRSZXBvcnQodGFiSWQsIHJlc3VsdC5zY2FuLCBoaWdobGlnaHRzKTtcbiAgfSBjYXRjaCB7XG4gICAgY29uc3QgY2FjaGVkID1cbiAgICAgIChhd2FpdCBnZXRVcmxSZXBvcnRDYWNoZShwYXlsb2FkLnVybCkpID8/XG4gICAgICAoYXdhaXQgZmV0Y2hDYWNoZWRSZXBvcnRGcm9tQmFja2VuZChwYXlsb2FkLnVybCkpO1xuXG4gICAgaWYgKGNhY2hlZCkge1xuICAgICAgYXdhaXQgc2V0VXJsUmVwb3J0Q2FjaGUocGF5bG9hZC51cmwsIGNhY2hlZCk7XG4gICAgICBhd2FpdCBhcHBseUNhY2hlZFJlcG9ydCh0YWJJZCwgY2FjaGVkLCBoaWdobGlnaHRzKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBmYWxsYmFjayA9IGJ1aWxkTG9jYWxGYWxsYmFja1JlcG9ydChcbiAgICAgIHBheWxvYWQudXJsLFxuICAgICAgcGF5bG9hZC5wYWdlVGl0bGUsXG4gICAgICBoZXVyaXN0aWNTaWduYWxzLFxuICAgICk7XG5cbiAgICBhd2FpdCBzZXRVcmxSZXBvcnRDYWNoZShwYXlsb2FkLnVybCwgZmFsbGJhY2spO1xuICAgIGF3YWl0IGFwcGx5Q2FjaGVkUmVwb3J0KHRhYklkLCBmYWxsYmFjaywgaGlnaGxpZ2h0cyk7XG4gIH0gZmluYWxseSB7XG4gICAgcGVuZGluZ0hpZ2hsaWdodHMuZGVsZXRlKHRhYklkKTtcbiAgICBpbkZsaWdodFVybHMuZGVsZXRlKG5vcm1hbGl6ZVVybEZvckNhY2hlKHBheWxvYWQudXJsKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2NoZWR1bGVBbmFseXNpcyhcbiAgdGFiSWQ6IG51bWJlcixcbiAgcGF5bG9hZDoge1xuICAgIHVybDogc3RyaW5nO1xuICAgIHBhZ2VUaXRsZTogc3RyaW5nO1xuICAgIHZpc2libGVUZXh0OiBzdHJpbmc7XG4gICAgaW50ZXJhY3RpdmVIdG1sOiBzdHJpbmc7XG4gICAgcGFnZVR5cGU6IFBhZ2VUeXBlO1xuICB9LFxuICBmb3JjZSA9IGZhbHNlLFxuKTogdm9pZCB7XG4gIGNvbnN0IGV4aXN0aW5nID0gZGVib3VuY2VUaW1lcnMuZ2V0KHRhYklkKTtcbiAgaWYgKGV4aXN0aW5nKSBjbGVhclRpbWVvdXQoZXhpc3RpbmcpO1xuXG4gIGRlYm91bmNlVGltZXJzLnNldChcbiAgICB0YWJJZCxcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGRlYm91bmNlVGltZXJzLmRlbGV0ZSh0YWJJZCk7XG4gICAgICB2b2lkIHJ1bkFuYWx5c2lzKHRhYklkLCBwYXlsb2FkLCBmb3JjZSk7XG4gICAgfSwgREVCT1VOQ0VfTVMpLFxuICApO1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVCYWNrZ3JvdW5kKCgpID0+IHtcbiAgY2hyb21lLnJ1bnRpbWUub25JbnN0YWxsZWQuYWRkTGlzdGVuZXIoKCkgPT4ge1xuICAgIHZvaWQgY2hyb21lLnNpZGVQYW5lbC5zZXRQYW5lbEJlaGF2aW9yKHsgb3BlblBhbmVsT25BY3Rpb25DbGljazogdHJ1ZSB9KTtcbiAgfSk7XG5cbiAgY2hyb21lLnRhYnMub25BY3RpdmF0ZWQuYWRkTGlzdGVuZXIoKGFjdGl2ZUluZm8pID0+IHtcbiAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB0YWIgPSBhd2FpdCBjaHJvbWUudGFicy5nZXQoYWN0aXZlSW5mby50YWJJZCk7XG4gICAgICBpZiAoIWlzQW5hbHl6YWJsZVVybCh0YWIudXJsKSkge1xuICAgICAgICBhd2FpdCB1cGRhdGVCYWRnZShhY3RpdmVJbmZvLnRhYklkLCBudWxsKTtcbiAgICAgICAgYXdhaXQgdXBkYXRlVGFiUmVwb3J0KGFjdGl2ZUluZm8udGFiSWQsIHsgc3RhdHVzOiBcImlkbGVcIiB9KTtcbiAgICAgICAgYXdhaXQgc3luY0hpZ2hsaWdodHNUb1RhYihhY3RpdmVJbmZvLnRhYklkLCBbXSwgZmFsc2UpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBhd2FpdCBoeWRyYXRlVGFiRnJvbUNhY2hlKGFjdGl2ZUluZm8udGFiSWQsIHRhYi51cmwgYXMgc3RyaW5nKTtcblxuICAgICAgY29uc3Qgc3RhdGUgPSBhd2FpdCBnZXRUYWJSZXBvcnQoYWN0aXZlSW5mby50YWJJZCk7XG4gICAgICBpZiAoc3RhdGU/LnN0YXR1cyA9PT0gXCJjb21wbGV0ZVwiKSB7XG4gICAgICAgIGNvbnN0IGhpZ2hsaWdodHMgPSBzdGF0ZS5oaWdobGlnaHRzID8/IFtdO1xuICAgICAgICBjb25zdCBkZXRlY3Rpb25zID0gc3RhdGUucmVwb3J0LmRldGVjdGlvbnM7XG4gICAgICAgIGlmIChoaWdobGlnaHRzLmxlbmd0aCA+IDAgfHwgZGV0ZWN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgY29uc3QgZW5yaWNoZWRIaWdobGlnaHRzID0gYXdhaXQgc3luY0hpZ2hsaWdodHNUb1RhYihcbiAgICAgICAgICAgIGFjdGl2ZUluZm8udGFiSWQsXG4gICAgICAgICAgICBoaWdobGlnaHRzLFxuICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICAgIGRldGVjdGlvbnMsXG4gICAgICAgICAgICBzdGF0ZS5yZXBvcnQuaWQsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGlmIChlbnJpY2hlZEhpZ2hsaWdodHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgYXdhaXQgdXBkYXRlVGFiUmVwb3J0KGFjdGl2ZUluZm8udGFiSWQsIHtcbiAgICAgICAgICAgICAgLi4uc3RhdGUsXG4gICAgICAgICAgICAgIGhpZ2hsaWdodHM6IGVucmljaGVkSGlnaGxpZ2h0cyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pKCk7XG4gIH0pO1xuXG4gIGNocm9tZS50YWJzLm9uVXBkYXRlZC5hZGRMaXN0ZW5lcigodGFiSWQsIGNoYW5nZUluZm8sIHRhYikgPT4ge1xuICAgIGlmIChjaGFuZ2VJbmZvLnN0YXR1cyAhPT0gXCJjb21wbGV0ZVwiKSByZXR1cm47XG4gICAgaWYgKCFpc0FuYWx5emFibGVVcmwodGFiLnVybCkpIHJldHVybjtcblxuICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGh5ZHJhdGVkID0gYXdhaXQgaHlkcmF0ZVRhYkZyb21DYWNoZSh0YWJJZCwgdGFiLnVybCBhcyBzdHJpbmcpO1xuICAgICAgaWYgKGh5ZHJhdGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gQXZvaWQgcmUtc2Nhbm5pbmcgd2hlbiB0aGUgdGFiIGFscmVhZHkgZmluaXNoZWQgYW5hbHlzaXMgKGUuZy4gdGFiIHN3aXRjaFxuICAgICAgLy8gb3IgZGlzY2FyZGVkLXRhYiByZWxvYWQgZmlyaW5nIGFub3RoZXIgXCJjb21wbGV0ZVwiIHdpdGhvdXQgYSBVUkwgY2hhbmdlKS5cbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgZ2V0VGFiUmVwb3J0KHRhYklkKTtcbiAgICAgIGlmIChcbiAgICAgICAgZXhpc3Rpbmc/LnN0YXR1cyA9PT0gXCJjb21wbGV0ZVwiICYmXG4gICAgICAgIHVybHNNYXRjaEZvckNhY2hlKFxuICAgICAgICAgIGV4aXN0aW5nLnJlcG9ydC5ub3JtYWxpemVkVXJsID8/IGV4aXN0aW5nLnJlcG9ydC51cmwsXG4gICAgICAgICAgdGFiLnVybCBhcyBzdHJpbmcsXG4gICAgICAgIClcbiAgICAgICkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZvaWQgY2hyb21lLnRhYnNcbiAgICAgICAgLnNlbmRNZXNzYWdlKHRhYklkLCB7IHR5cGU6IFwiQU5BTFlaRV9QQUdFXCIgfSlcbiAgICAgICAgLmNhdGNoKCgpID0+IHtcbiAgICAgICAgICAvLyBDb250ZW50IHNjcmlwdCBtYXkgbm90IGJlIHJlYWR5IHlldCBvbiBzb21lIHBhZ2VzLlxuICAgICAgICB9KTtcbiAgICB9KSgpO1xuICB9KTtcblxuICBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1lc3NhZ2UsIHNlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XG4gICAgaWYgKG1lc3NhZ2U/LnR5cGUgPT09IFwiUEFHRV9DT05URU5UXCIpIHtcbiAgICAgIGNvbnN0IHRhYklkID0gc2VuZGVyLnRhYj8uaWQ7XG4gICAgICBpZiAoIXRhYklkKSByZXR1cm47XG4gICAgICBpZiAoIWlzQW5hbHl6YWJsZVVybChtZXNzYWdlLnVybCBhcyBzdHJpbmcpKSB7XG4gICAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiB0cnVlIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgc2NoZWR1bGVBbmFseXNpcyhcbiAgICAgICAgdGFiSWQsXG4gICAgICAgIHtcbiAgICAgICAgICB1cmw6IG1lc3NhZ2UudXJsIGFzIHN0cmluZyxcbiAgICAgICAgICBwYWdlVGl0bGU6IG1lc3NhZ2UucGFnZVRpdGxlIGFzIHN0cmluZyxcbiAgICAgICAgICB2aXNpYmxlVGV4dDogbWVzc2FnZS52aXNpYmxlVGV4dCBhcyBzdHJpbmcsXG4gICAgICAgICAgaW50ZXJhY3RpdmVIdG1sOiBtZXNzYWdlLmludGVyYWN0aXZlSHRtbCBhcyBzdHJpbmcsXG4gICAgICAgICAgcGFnZVR5cGU6IChtZXNzYWdlLnBhZ2VUeXBlIGFzIFBhZ2VUeXBlIHwgdW5kZWZpbmVkKSA/PyBcImdlbmVyYWxcIixcbiAgICAgICAgfSxcbiAgICAgICAgQm9vbGVhbihtZXNzYWdlLmZvcmNlKSxcbiAgICAgICk7XG4gICAgICBwZW5kaW5nSGlnaGxpZ2h0cy5zZXQoXG4gICAgICAgIHRhYklkLFxuICAgICAgICAobWVzc2FnZS5oaWdobGlnaHRzIGFzIFBhZ2VIaWdobGlnaHRbXSB8IHVuZGVmaW5lZCkgPz8gW10sXG4gICAgICApO1xuICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IHRydWUgfSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAobWVzc2FnZT8udHlwZSA9PT0gXCJSRVNDQU5fUEFHRVwiKSB7XG4gICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHRhYklkID1cbiAgICAgICAgICAobWVzc2FnZS50YWJJZCBhcyBudW1iZXIgfCB1bmRlZmluZWQpID8/XG4gICAgICAgICAgc2VuZGVyLnRhYj8uaWQgPz9cbiAgICAgICAgICAoYXdhaXQgY2hyb21lLnRhYnMucXVlcnkoeyBhY3RpdmU6IHRydWUsIGN1cnJlbnRXaW5kb3c6IHRydWUgfSkpWzBdXG4gICAgICAgICAgICA/LmlkO1xuXG4gICAgICAgIGlmICghdGFiSWQpIHtcbiAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogZmFsc2UsIGVycm9yOiBcIk5vIGFjdGl2ZSB0YWIgZm91bmQuXCIgfSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGFiID0gYXdhaXQgY2hyb21lLnRhYnMuZ2V0KHRhYklkKTtcbiAgICAgICAgaWYgKCFpc0FuYWx5emFibGVVcmwodGFiLnVybCkpIHtcbiAgICAgICAgICBzZW5kUmVzcG9uc2Uoe1xuICAgICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgICAgZXJyb3I6IFwiVGhpcyBwYWdlIGlzIG5vdCBlbGlnaWJsZSBmb3Igc2Nhbm5pbmcuXCIsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgY2xlYXJVcmxSZXBvcnRDYWNoZSh0YWIudXJsIGFzIHN0cmluZyk7XG4gICAgICAgIGF3YWl0IHVwZGF0ZVRhYlJlcG9ydCh0YWJJZCwgeyBzdGF0dXM6IFwiYW5hbHl6aW5nXCIgfSk7XG4gICAgICAgIGF3YWl0IHVwZGF0ZUJhZGdlKHRhYklkLCBudWxsLCB0cnVlKTtcbiAgICAgICAgYXdhaXQgc3luY0hpZ2hsaWdodHNUb1RhYih0YWJJZCwgW10sIGZhbHNlKTtcbiAgICAgICAgcGVuZGluZ0hpZ2hsaWdodHMuZGVsZXRlKHRhYklkKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHRhYklkLCB7XG4gICAgICAgICAgICB0eXBlOiBcIkFOQUxZWkVfUEFHRVwiLFxuICAgICAgICAgICAgZm9yY2U6IHRydWUsXG4gICAgICAgICAgfSBzYXRpc2ZpZXMgQW5hbHl6ZVBhZ2VNZXNzYWdlKTtcbiAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogdHJ1ZSB9KTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgc2VuZFJlc3BvbnNlKHtcbiAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgIGVycm9yOlxuICAgICAgICAgICAgICBcIkNvdWxkIG5vdCByZWFjaCB0aGlzIHBhZ2UuIFRyeSByZWZyZXNoaW5nIHRoZSB0YWIsIHRoZW4gcmVzY2FuLlwiLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KSgpO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAobWVzc2FnZT8udHlwZSA9PT0gXCJTSE9VTERfQU5BTFlaRVwiKSB7XG4gICAgICBjb25zdCB0YWJJZCA9IHNlbmRlci50YWI/LmlkO1xuICAgICAgaWYgKCF0YWJJZCkge1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBzaG91bGRBbmFseXplOiBmYWxzZSB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgdXJsID0gbWVzc2FnZS51cmwgYXMgc3RyaW5nO1xuICAgICAgICBpZiAoIWlzQW5hbHl6YWJsZVVybCh1cmwpKSB7XG4gICAgICAgICAgc2VuZFJlc3BvbnNlKHsgc2hvdWxkQW5hbHl6ZTogZmFsc2UgfSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGh5ZHJhdGVkID0gYXdhaXQgaHlkcmF0ZVRhYkZyb21DYWNoZSh0YWJJZCwgdXJsKTtcbiAgICAgICAgc2VuZFJlc3BvbnNlKHsgc2hvdWxkQW5hbHl6ZTogIWh5ZHJhdGVkIH0pO1xuICAgICAgfSkoKTtcblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKG1lc3NhZ2U/LnR5cGUgPT09IFwiSElHSExJR0hUU19VUERBVEVEXCIpIHtcbiAgICAgIGNvbnN0IHRhYklkID0gc2VuZGVyLnRhYj8uaWQ7XG4gICAgICBpZiAoIXRhYklkKSByZXR1cm47XG5cbiAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBhd2FpdCBnZXRUYWJSZXBvcnQodGFiSWQpO1xuICAgICAgICBpZiAoc3RhdGU/LnN0YXR1cyAhPT0gXCJjb21wbGV0ZVwiKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVwb3J0SWQgPSBtZXNzYWdlLnJlcG9ydElkIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKHJlcG9ydElkICYmIHN0YXRlLnJlcG9ydC5pZCAhPT0gcmVwb3J0SWQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCB1cGRhdGVUYWJSZXBvcnQodGFiSWQsIHtcbiAgICAgICAgICAuLi5zdGF0ZSxcbiAgICAgICAgICBoaWdobGlnaHRzOiBtZXNzYWdlLmhpZ2hsaWdodHMgYXMgUGFnZUhpZ2hsaWdodFtdLFxuICAgICAgICB9KTtcbiAgICAgIH0pKCk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmIChtZXNzYWdlPy50eXBlID09PSBcIlRPR0dMRV9QQUdFX0hJR0hMSUdIVFNcIikge1xuICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCB0YWJJZCA9XG4gICAgICAgICAgKG1lc3NhZ2UudGFiSWQgYXMgbnVtYmVyIHwgdW5kZWZpbmVkKSA/P1xuICAgICAgICAgIChhd2FpdCBjaHJvbWUudGFicy5xdWVyeSh7IGFjdGl2ZTogdHJ1ZSwgY3VycmVudFdpbmRvdzogdHJ1ZSB9KSlbMF1cbiAgICAgICAgICAgID8uaWQ7XG5cbiAgICAgICAgaWYgKCF0YWJJZCkge1xuICAgICAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiBmYWxzZSwgZXJyb3I6IFwiTm8gYWN0aXZlIHRhYiBmb3VuZC5cIiB9KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzdGF0ZSA9IGF3YWl0IGdldFRhYlJlcG9ydCh0YWJJZCk7XG4gICAgICAgIGNvbnN0IGhpZ2hsaWdodHMgPVxuICAgICAgICAgIHN0YXRlPy5zdGF0dXMgPT09IFwiY29tcGxldGVcIiA/IChzdGF0ZS5oaWdobGlnaHRzID8/IFtdKSA6IFtdO1xuICAgICAgICBjb25zdCBkZXRlY3Rpb25zID1cbiAgICAgICAgICBzdGF0ZT8uc3RhdHVzID09PSBcImNvbXBsZXRlXCIgPyBzdGF0ZS5yZXBvcnQuZGV0ZWN0aW9ucyA6IFtdO1xuXG4gICAgICAgIGNvbnN0IGVucmljaGVkSGlnaGxpZ2h0cyA9IGF3YWl0IHN5bmNIaWdobGlnaHRzVG9UYWIoXG4gICAgICAgICAgdGFiSWQsXG4gICAgICAgICAgaGlnaGxpZ2h0cyxcbiAgICAgICAgICBCb29sZWFuKG1lc3NhZ2UudmlzaWJsZSksXG4gICAgICAgICAgZGV0ZWN0aW9ucyxcbiAgICAgICAgICBzdGF0ZT8uc3RhdHVzID09PSBcImNvbXBsZXRlXCIgPyBzdGF0ZS5yZXBvcnQuaWQgOiB1bmRlZmluZWQsXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgIHN0YXRlPy5zdGF0dXMgPT09IFwiY29tcGxldGVcIiAmJlxuICAgICAgICAgIEJvb2xlYW4obWVzc2FnZS52aXNpYmxlKSAmJlxuICAgICAgICAgIGVucmljaGVkSGlnaGxpZ2h0cy5sZW5ndGggPiAwXG4gICAgICAgICkge1xuICAgICAgICAgIGF3YWl0IHVwZGF0ZVRhYlJlcG9ydCh0YWJJZCwge1xuICAgICAgICAgICAgLi4uc3RhdGUsXG4gICAgICAgICAgICBoaWdobGlnaHRzOiBlbnJpY2hlZEhpZ2hsaWdodHMsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogdHJ1ZSB9KTtcbiAgICAgIH0pKCk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmIChtZXNzYWdlPy50eXBlID09PSBcIlNDUk9MTF9UT19ISUdITElHSFRcIikge1xuICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCB0YWJJZCA9XG4gICAgICAgICAgKG1lc3NhZ2UudGFiSWQgYXMgbnVtYmVyIHwgdW5kZWZpbmVkKSA/P1xuICAgICAgICAgIChhd2FpdCBjaHJvbWUudGFicy5xdWVyeSh7IGFjdGl2ZTogdHJ1ZSwgY3VycmVudFdpbmRvdzogdHJ1ZSB9KSlbMF1cbiAgICAgICAgICAgID8uaWQ7XG5cbiAgICAgICAgaWYgKCF0YWJJZCkge1xuICAgICAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiBmYWxzZSwgZXJyb3I6IFwiTm8gYWN0aXZlIHRhYiBmb3VuZC5cIiB9KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHRhYklkLCB7XG4gICAgICAgICAgICB0eXBlOiBcIlNDUk9MTF9UT19ISUdITElHSFRcIixcbiAgICAgICAgICAgIGhpZ2hsaWdodElkOiBtZXNzYWdlLmhpZ2hsaWdodElkIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGhpZ2hsaWdodDogbWVzc2FnZS5oaWdobGlnaHQsXG4gICAgICAgICAgICBkZXRlY3Rpb246IG1lc3NhZ2UuZGV0ZWN0aW9uLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiB0cnVlIH0pO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICBzZW5kUmVzcG9uc2Uoe1xuICAgICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgICAgZXJyb3I6IFwiQ291bGQgbm90IHNjcm9sbCB0byBoaWdobGlnaHQgb24gdGhpcyBwYWdlLlwiLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KSgpO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH0pO1xufSk7XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIGJyb3dzZXIkMSB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG4vLyNyZWdpb24gc3JjL2Jyb3dzZXIudHNcbi8qKlxuKiBDb250YWlucyB0aGUgYGJyb3dzZXJgIGV4cG9ydCB3aGljaCB5b3Ugc2hvdWxkIHVzZSB0byBhY2Nlc3MgdGhlIGV4dGVuc2lvblxuKiBBUElzIGluIHlvdXIgcHJvamVjdDpcbipcbiogYGBgdHNcbiogaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gJ3d4dC9icm93c2VyJztcbipcbiogYnJvd3Nlci5ydW50aW1lLm9uSW5zdGFsbGVkLmFkZExpc3RlbmVyKCgpID0+IHtcbiogICAvLyAuLi5cbiogfSk7XG4qIGBgYFxuKlxuKiBAbW9kdWxlIHd4dC9icm93c2VyXG4qL1xuY29uc3QgYnJvd3NlciA9IGJyb3dzZXIkMTtcbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgYnJvd3NlciB9O1xuIiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiJdLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCw3LDgsOV0sIm1hcHBpbmdzIjoiOztDQUNBLFNBQVMsaUJBQWlCLEtBQUs7RUFDOUIsSUFBSSxPQUFPLFFBQVEsT0FBTyxRQUFRLFlBQVksT0FBTyxFQUFFLE1BQU0sSUFBSTtFQUNqRSxPQUFPO0NBQ1I7OztDQ0ZBLElBQU0sbUJBQW1CO0VBQ3ZCO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtDQUNGO0NBRUEsSUFBTSxvQkFBb0I7RUFDeEI7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0NBQ0Y7Q0FFQSxJQUFNLHdCQUF3QjtFQUM1QjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0NBQ0Y7Q0FFQSxJQUFNLDBCQUEwQjtFQUM5QjtFQUNBO0VBQ0E7RUFDQTtDQUNGO0NBRUEsSUFBTSx3QkFBd0I7RUFDNUI7RUFDQTtFQUNBO0NBQ0Y7Q0FFQSxTQUFTLGNBQWMsTUFBYyxVQUE4QjtFQUNqRSxPQUFPLFNBQ0osUUFBUSxZQUFZLFFBQVEsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUN2QyxLQUFLLFlBQVksUUFBUSxNQUFNO0NBQ3BDO0NBRUEsU0FBUyxhQUNQLGFBQ0EsaUJBQ0EsVUFDUTtFQUNSLElBQUksYUFBYSxhQUNmLE9BQU87RUFFVCxPQUFPLEdBQUcsWUFBWSxJQUFJO0NBQzVCO0NBRUEsU0FBUyxlQUFlLE1BQXVC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Q1Q7OztDQzFDQSxJQUFBLGlDQUFBLElBQUEsSUFBQTtDQUNBLElBQUEsK0JBQUEsSUFBQSxJQUFBO0NBQ0EsSUFBQSxvQ0FBQSxJQUFBLElBQUE7Q0FDQSxJQUFBLGNBQUE7Q0FDQSxJQUFBLHNCQUFBO0NBRUEsU0FBQSxvQkFBQSxTQUFBOzs7Ozs7Q0FTQTtDQUVBLFNBQUEsdUJBQUEsT0FBQTs7Ozs7Q0FNQTtDQUVBLGVBQUEsZ0JBQUEsT0FBQSxPQUFBOzs7Q0FNQTtDQUVBLFNBQUEsaUJBQUEsT0FBQTs7Ozs7Ozs7Q0FhQTtDQUVBLGVBQUEsWUFBQSxPQUFBLGNBQUEsWUFBQSxPQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBK0JBO0NBRUEsU0FBQSx5QkFBQSxLQUFBLFdBQUEsa0JBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnREE7Q0FFQSxTQUFBLGdCQUFBLFdBQUEsU0FBQTs7O0NBZ0JBO0NBRUEsZUFBQSxvQkFBQSxPQUFBLFlBQUEsU0FBQSxhQUFBLENBQUEsR0FBQSxVQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQStCQTtDQUVBLGVBQUEsa0JBQUEsT0FBQSxRQUFBLGFBQUEsQ0FBQSxHQUFBOzs7Ozs7Ozs7Ozs7O0NBc0JBO0NBRUEsZUFBQSxvQkFBQSxPQUFBLEtBQUE7Ozs7Ozs7Ozs7OztDQXlDQTtDQUVBLGVBQUEsWUFBQSxPQUFBLFNBQUEsUUFBQSxPQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQW1GQTtDQUVBLFNBQUEsaUJBQUEsT0FBQSxTQUFBLFFBQUEsT0FBQTs7Ozs7OztDQXFCQTtDQUVBLElBQUEscUJBQUEsdUJBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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