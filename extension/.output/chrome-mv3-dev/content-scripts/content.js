var content = (function() {
	//#region ../node_modules/wxt/dist/utils/define-content-script.mjs
	function defineContentScript(definition) {
		return definition;
	}
	//#endregion
	//#region ../shared/page-context.ts
	function parseStructuredDataType(raw) {
		try {
			const parsed = JSON.parse(raw);
			const items = Array.isArray(parsed) ? parsed : [parsed];
			for (const item of items) {
				if (!item || typeof item !== "object") continue;
				const record = item;
				const graph = record["@graph"];
				if (Array.isArray(graph)) {
					for (const node of graph) if (node && typeof node === "object") {
						const type = node["@type"];
						if (typeof type === "string") return type;
					}
				}
				const type = record["@type"];
				if (typeof type === "string") return type;
			}
		} catch {
			return null;
		}
		return null;
	}
	function detectPageType(doc) {
		const ogType = doc.querySelector("meta[property=\"og:type\"]")?.getAttribute("content")?.toLowerCase();
		if (ogType === "article" || ogType === "newsarticle") return "editorial";
		for (const script of doc.querySelectorAll("script[type=\"application/ld+json\"]")) {
			const structuredType = parseStructuredDataType(script.textContent ?? "");
			if (structuredType === "NewsArticle" || structuredType === "Article" || structuredType === "BlogPosting") return "editorial";
		}
		const article = doc.querySelector("article");
		if (article) {
			const articleLength = (article.textContent ?? "").trim().length;
			const bodyLength = (doc.body?.textContent ?? "").trim().length;
			if (articleLength > 400 && articleLength / Math.max(bodyLength, 1) > .35) return "editorial";
		}
		return "general";
	}
	//#endregion
	//#region src/extract/highlights.ts
	var HIGHLIGHT_ID_ATTR = "data-dpd-highlight-id";
	var HIGHLIGHT_BOX_ATTR = "data-dpd-highlight-box";
	var MAX_HIGHLIGHTS = 15;
	var COUNTDOWN_SELECTORS = [
		"[class*=\"countdown\"]",
		"[class*=\"timer\"]",
		"[id*=\"countdown\"]",
		"[id*=\"timer\"]",
		"[role=\"timer\"]"
	].join(",");
	var INTERACTIVE_SELECTORS$1 = [
		"button",
		"a",
		"input",
		"select",
		"label",
		"textarea",
		"[role=\"dialog\"]",
		"[class*=\"modal\"]",
		"[class*=\"popup\"]",
		"[class*=\"overlay\"]",
		"[class*=\"banner\"]",
		"[class*=\"price\"]",
		"[class*=\"subscribe\"]",
		"[class*=\"newsletter\"]"
	].join(",");
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
	var PRICING_PATTERNS = [
		/was [\$£€S$]/i,
		/now [\$£€S$]/i,
		/[\$£€S$]\s?[\d,.]+[\s\S]{0,20}(was|before|compare|original|regular)/i,
		/(was|before|compare|original|regular)[\s\S]{0,20}[\$£€S$]\s?[\d,.]+/i,
		/save \d+\s*%/i,
		/\d+\s*%\s*off/i,
		/rrp|mrrp/i,
		/original price/i,
		/compare.?at/i,
		/regular price/i,
		/listed price/i,
		/\+ tax/i,
		/additional fees?/i,
		/starting at/i,
		/from [\$£€S$]/i,
		/[\$£€S$][\d,.]+\s*[\$£€S$][\d,.]+/
	];
	var PRICE_CONTAINER_SELECTORS = [
		"[class*=\"price\"]",
		"[class*=\"Price\"]",
		"[class*=\"compare\"]",
		"[class*=\"was-price\"]",
		"[class*=\"was_price\"]",
		"[class*=\"original\"]",
		"[class*=\"regular\"]",
		"[class*=\"sale-price\"]",
		"[class*=\"sale_price\"]",
		"[data-compare-price]",
		"[data-sale-price]",
		".price",
		".product-price"
	].join(",");
	var NAGGING_PATTERNS = [
		/subscribe/i,
		/sign up/i,
		/don't miss/i,
		/before you go/i,
		/wait!? don't leave/i,
		/enable notifications/i
	];
	var SNEAKING_PATTERNS = [
		/hidden fee/i,
		/auto.?renew/i,
		/free trial/i,
		/added to (cart|basket)/i,
		/pre.?selected add.?on/i
	];
	function isVisibleHighlightElement(element) {
		const style = window.getComputedStyle(element);
		if (style.display === "none" || style.visibility === "hidden") return false;
		if (Number.parseFloat(style.opacity) === 0) return false;
		const rect = element.getBoundingClientRect();
		if (rect.width < 2 || rect.height < 2) return false;
		if (typeof element.checkVisibility === "function") return element.checkVisibility({
			checkOpacity: true,
			checkVisibilityCSS: true
		});
		if (style.position === "fixed" || style.position === "sticky") return true;
		return element.offsetParent !== null;
	}
	function assignHighlightId(element) {
		const existing = element.getAttribute(HIGHLIGHT_ID_ATTR);
		if (existing) return existing;
		const id = crypto.randomUUID();
		element.setAttribute(HIGHLIGHT_ID_ATTR, id);
		return id;
	}
	function isInsideArticleBody(element) {
		if (!element.closest("article")) return false;
		if (element.closest("[role=\"dialog\"], [class*=\"modal\"], [class*=\"popup\"]")) return false;
		const tag = element.tagName.toLowerCase();
		return ![
			"input",
			"button",
			"select",
			"textarea",
			"form"
		].includes(tag);
	}
	function shouldSkipElement(element, pageType) {
		if (pageType === "editorial" && isInsideArticleBody(element)) return true;
		if (document.getElementById("dpd-highlight-root")?.contains(element)) return true;
		if (element instanceof HTMLElement && !isVisibleHighlightElement(element)) return true;
		return false;
	}
	function firstMatchingPattern(text, patterns) {
		for (const pattern of patterns) if (pattern.test(text)) return pattern;
		return null;
	}
	function highlightTarget(element) {
		const dialog = element.closest("[role=\"dialog\"], [class*=\"modal\"], [class*=\"popup\"]");
		if (dialog instanceof HTMLElement) return dialog;
		if (element instanceof HTMLInputElement) return element.closest("label") ?? element;
		if (element instanceof HTMLElement) {
			if ((element.innerText ?? "").trim().length < 120) {
				const container = element.closest("nav, header, footer, [role=\"banner\"], [role=\"navigation\"], form, [class*=\"countdown\"], [class*=\"timer\"]");
				if (container instanceof HTMLElement) return container;
			}
		}
		return element;
	}
	function isNestedStickyElement(element) {
		let parent = element.parentElement;
		while (parent) {
			const style = window.getComputedStyle(parent);
			if (style.position === "fixed" || style.position === "sticky") return true;
			parent = parent.parentElement;
		}
		return false;
	}
	function addCandidate(element, candidate, pageType, seen) {
		const target = highlightTarget(element);
		if (!(target instanceof HTMLElement)) return;
		if (shouldSkipElement(target, pageType)) return;
		const existing = seen.get(target);
		if (existing) {
			if (severityRank(candidate.severity) > severityRank(existing.severity)) seen.set(target, {
				...candidate,
				id: existing.id
			});
			return;
		}
		seen.set(target, {
			...candidate,
			id: assignHighlightId(target)
		});
	}
	function severityRank(severity) {
		switch (severity) {
			case "HIGH": return 3;
			case "MEDIUM": return 2;
			case "LOW": return 1;
			default: return severity;
		}
	}
	function collectCountdownHighlights(pageType, seen) {
		for (const element of document.querySelectorAll(COUNTDOWN_SELECTORS)) {
			if (!(element instanceof HTMLElement)) continue;
			addCandidate(element, {
				category: "URGENCY",
				patternType: "CountdownTimer",
				severity: "HIGH",
				label: "Countdown timer"
			}, pageType, seen);
		}
	}
	function collectPreselectionHighlights(pageType, seen) {
		for (const input of document.querySelectorAll("input[type=\"checkbox\"]:checked, input[type=\"radio\"]:checked")) addCandidate(input, {
			category: "PRESELECTION",
			patternType: "PreCheckedBox",
			severity: "MEDIUM",
			label: "Pre-selected option"
		}, pageType, seen);
	}
	function hasCurrencyText(text) {
		return /[\$£€]|S\$|\d[\d,.]*\s*(?:was|now|off|save)/i.test(text);
	}
	function pricingContainerFor(element) {
		const container = element.closest(PRICE_CONTAINER_SELECTORS);
		if (container instanceof HTMLElement) return container;
		if (element.parentElement instanceof HTMLElement) return element.parentElement;
		return element;
	}
	function collectPricingHighlights(pageType, seen) {
		for (const element of document.querySelectorAll("del, s")) {
			if (!isVisibleHighlightElement(element)) continue;
			const text = element.textContent ?? "";
			if (!hasCurrencyText(text) && !/[\d,.]+/.test(text)) continue;
			addCandidate(pricingContainerFor(element), {
				category: "PRICING_DECEPTION",
				patternType: "StrikethroughPrice",
				severity: "MEDIUM",
				label: "Pricing cue"
			}, pageType, seen);
		}
		for (const element of document.querySelectorAll(PRICE_CONTAINER_SELECTORS)) {
			const text = (element.innerText ?? "").trim();
			if (text.length < 3 || text.length > 200) continue;
			const combined = `${text}\n${element.outerHTML}`;
			const hasStrike = element.querySelector("del, s") !== null || /line-through/i.test(window.getComputedStyle(element).textDecoration);
			if (firstMatchingPattern(combined, PRICING_PATTERNS) || hasStrike && hasCurrencyText(text)) addCandidate(element, {
				category: "PRICING_DECEPTION",
				patternType: hasStrike ? "StrikethroughPrice" : "MisleadingPrice",
				severity: "MEDIUM",
				label: "Pricing cue"
			}, pageType, seen);
		}
		for (const element of document.querySelectorAll("*")) {
			if (!isVisibleHighlightElement(element)) continue;
			const text = (element.innerText ?? "").trim();
			if (text.length > 80) continue;
			if (window.getComputedStyle(element).textDecorationLine.includes("line-through") && hasCurrencyText(text)) addCandidate(pricingContainerFor(element), {
				category: "PRICING_DECEPTION",
				patternType: "StrikethroughPrice",
				severity: "MEDIUM",
				label: "Pricing cue"
			}, pageType, seen);
		}
	}
	function collectStickyHighlights(pageType, seen) {
		for (const element of document.querySelectorAll("*")) {
			const style = window.getComputedStyle(element);
			if (style.position !== "fixed" && style.position !== "sticky") continue;
			if (isNestedStickyElement(element)) continue;
			const text = element.innerText ?? "";
			if (text.length > 500) continue;
			const combined = `${text}\n${element.outerHTML}`;
			const urgency = firstMatchingPattern(combined, URGENCY_PATTERNS);
			const scarcity = firstMatchingPattern(combined, SCARCITY_PATTERNS);
			if (urgency) {
				addCandidate(element, {
					category: "URGENCY",
					patternType: /countdown|timer|ends in \d+/i.test(combined) ? "CountdownTimer" : "LimitedTimeMessage",
					severity: /countdown|timer|ends in \d+/i.test(combined) ? "HIGH" : "MEDIUM",
					label: "Urgency banner"
				}, pageType, seen);
				continue;
			}
			if (scarcity) {
				addCandidate(element, {
					category: "SCARCITY",
					patternType: /only \d+ left|low stock|almost sold out/i.test(text) ? "LowStockMessage" : "HighDemandMessage",
					severity: "MEDIUM",
					label: "Scarcity banner"
				}, pageType, seen);
				continue;
			}
			if (/class="[^"]*(modal|popup|overlay|sticky-banner)[^"]*"/i.test(element.outerHTML)) addCandidate(element, {
				category: "OBSTRUCTION",
				patternType: "StickyPressureBanner",
				severity: "MEDIUM",
				label: "Sticky overlay"
			}, pageType, seen);
		}
	}
	function collectTextHighlights(pageType, seen) {
		for (const element of document.querySelectorAll(INTERACTIVE_SELECTORS$1)) {
			const text = element.innerText ?? "";
			if (text.length < 4 || text.length > 400) continue;
			const combined = `${text}\n${element.outerHTML}`;
			if (firstMatchingPattern(combined, URGENCY_PATTERNS)) {
				addCandidate(element, {
					category: "URGENCY",
					patternType: /countdown|timer|ends in \d+/i.test(combined) ? "CountdownTimer" : "LimitedTimeMessage",
					severity: /countdown|timer|ends in \d+/i.test(combined) ? "HIGH" : "MEDIUM",
					label: "Urgency cue"
				}, pageType, seen);
				continue;
			}
			if (firstMatchingPattern(text, SCARCITY_PATTERNS)) {
				addCandidate(element, {
					category: "SCARCITY",
					patternType: /only \d+ left|low stock|almost sold out/i.test(text) ? "LowStockMessage" : "HighDemandMessage",
					severity: "MEDIUM",
					label: "Scarcity cue"
				}, pageType, seen);
				continue;
			}
			if (firstMatchingPattern(text, SOCIAL_PROOF_PATTERNS)) {
				addCandidate(element, {
					category: "SOCIAL_PROOF",
					patternType: "LiveActivityMessage",
					severity: "MEDIUM",
					label: "Social proof cue"
				}, pageType, seen);
				continue;
			}
			if (firstMatchingPattern(text, CONFIRMSHAMING_PATTERNS)) {
				addCandidate(element, {
					category: "FORCED_ACTION",
					patternType: "Confirmshaming",
					severity: "MEDIUM",
					label: "Pressure wording"
				}, pageType, seen);
				continue;
			}
			if (firstMatchingPattern(combined, PRICING_PATTERNS)) {
				addCandidate(element, {
					category: "PRICING_DECEPTION",
					patternType: "MisleadingPrice",
					severity: "MEDIUM",
					label: "Pricing cue"
				}, pageType, seen);
				continue;
			}
			if (firstMatchingPattern(text, NAGGING_PATTERNS)) {
				addCandidate(element, {
					category: "NAGGING",
					patternType: "RepeatedPrompt",
					severity: "MEDIUM",
					label: "Repeated prompt"
				}, pageType, seen);
				continue;
			}
			if (firstMatchingPattern(combined, SNEAKING_PATTERNS)) addCandidate(element, {
				category: "SNEAKING",
				patternType: "HiddenCost",
				severity: "MEDIUM",
				label: "Hidden cost cue"
			}, pageType, seen);
		}
	}
	function labelForDetection(detection) {
		switch (detection.category) {
			case "URGENCY": return /countdown|timer/i.test(detection.patternType) ? "Countdown timer" : "Urgency cue";
			case "SCARCITY": return "Scarcity cue";
			case "SOCIAL_PROOF": return "Social proof cue";
			case "PRESELECTION": return "Pre-selected option";
			case "OBSTRUCTION": return "Sticky overlay";
			case "FORCED_ACTION": return "Pressure wording";
			case "PRICING_DECEPTION": return "Pricing cue";
			case "NAGGING": return "Repeated prompt";
			case "MISDIRECTION": return "Misdirection cue";
			case "SNEAKING": return "Hidden cost cue";
			default: return "Pressure cue";
		}
	}
	function pricingEvidencePhrases(evidence) {
		const phrases = /* @__PURE__ */ new Set();
		const quoted = evidence.match(/["“](.+?)["”]/)?.[1];
		if (quoted && quoted.trim().length >= 3) phrases.add(quoted.trim());
		for (const match of evidence.matchAll(/(?:S\$|\$|£|€)\s?[\d,.]+/g)) {
			phrases.add(match[0].replace(/\s/g, ""));
			phrases.add(match[0].trim());
		}
		for (const match of evidence.matchAll(/[\d,.]+\s*(?:% off|%)/gi)) phrases.add(match[0].trim());
		for (const match of evidence.matchAll(/save\s+\d+\s*%/gi)) phrases.add(match[0].trim());
		return [...phrases].filter((phrase) => phrase.length >= 3);
	}
	function findElementContainingPhrase(phrase) {
		const phraseLower = phrase.toLowerCase();
		let best = null;
		let bestArea = Number.POSITIVE_INFINITY;
		for (const element of document.querySelectorAll("p, span, div, button, a, label, li, h1, h2, h3, h4, td, strong, em, small, del, s")) {
			if (!isVisibleHighlightElement(element)) continue;
			const text = (element.innerText ?? "").trim();
			if (text.length === 0 || text.length > 500) continue;
			if (!text.toLowerCase().includes(phraseLower)) continue;
			const rect = element.getBoundingClientRect();
			const area = rect.width * rect.height;
			if (area > 0 && area < bestArea) {
				best = element;
				bestArea = area;
			}
		}
		return best;
	}
	function findStructuralPricingElement() {
		for (const element of document.querySelectorAll("del, s")) {
			if (!isVisibleHighlightElement(element)) continue;
			const text = element.textContent ?? "";
			if (hasCurrencyText(text) || /[\d,.]+/.test(text)) return pricingContainerFor(element);
		}
		for (const element of document.querySelectorAll(PRICE_CONTAINER_SELECTORS)) {
			if (!isVisibleHighlightElement(element)) continue;
			const text = (element.innerText ?? "").trim();
			if (text.length < 3) continue;
			if (element.querySelector("del, s") !== null || firstMatchingPattern(`${text}\n${element.outerHTML}`, PRICING_PATTERNS)) return element;
		}
		return null;
	}
	function findElementByPricingEvidence(evidence) {
		for (const phrase of pricingEvidencePhrases(evidence)) {
			const element = findElementContainingPhrase(phrase);
			if (element) return pricingContainerFor(element);
		}
		return findStructuralPricingElement();
	}
	function scarcityEvidencePhrases(evidence) {
		const phrases = /* @__PURE__ */ new Set();
		const quoted = evidence.match(/["“'](.+?)["”']/)?.[1];
		if (quoted?.trim()) {
			const trimmed = quoted.trim();
			phrases.add(trimmed);
			for (const segment of trimmed.split("|")) {
				const part = segment.trim();
				if (part.length >= 3) phrases.add(part);
			}
		}
		for (const match of evidence.matchAll(/\b(in stock|low stock|only \d+ left|only \d+ remaining|almost sold out|selling fast|high demand|limited quantity|few left)\b/gi)) phrases.add(match[0].trim());
		return [...phrases].filter((phrase) => phrase.length >= 3);
	}
	function findStructuralScarcityElement() {
		for (const element of document.querySelectorAll("p, span, div, button, a, label, li, strong, em, small")) {
			if (!isVisibleHighlightElement(element)) continue;
			const text = (element.innerText ?? "").trim();
			if (text.length < 3 || text.length > 200) continue;
			if (firstMatchingPattern(text, SCARCITY_PATTERNS)) return element;
		}
		return null;
	}
	function findElementByScarcityEvidence(evidence) {
		for (const phrase of scarcityEvidencePhrases(evidence)) {
			const element = findElementContainingPhrase(phrase);
			if (element) return element;
		}
		return findStructuralScarcityElement();
	}
	function evidencePhrases(evidence) {
		const phrases = /* @__PURE__ */ new Set();
		const quoted = evidence.match(/["“'](.+?)["”']/)?.[1];
		if (quoted?.trim()) {
			const trimmed = quoted.trim();
			phrases.add(trimmed);
			for (const segment of trimmed.split("|")) {
				const part = segment.trim();
				if (part.length >= 3) phrases.add(part);
			}
		}
		const fallback = evidenceSearchPhrase(evidence);
		if (fallback) phrases.add(fallback);
		return [...phrases].filter((phrase) => phrase.length >= 3);
	}
	function evidenceSearchPhrase(evidence) {
		const quoted = evidence.match(/["“'](.+?)["”']/)?.[1];
		if (quoted && quoted.trim().length >= 4) return quoted.trim();
		const cleaned = evidence.replace(/\s+/g, " ").trim();
		if (cleaned.length < 4) return null;
		return cleaned.slice(0, Math.min(80, cleaned.length));
	}
	function findElementByEvidence(evidence) {
		for (const phrase of evidencePhrases(evidence)) {
			const element = findElementContainingPhrase(phrase);
			if (element) return element;
		}
		return null;
	}
	function findElementForDetection(detection) {
		if (detection.category === "PRICING_DECEPTION") return findElementByPricingEvidence(detection.evidence);
		if (detection.category === "SCARCITY") return findElementByScarcityEvidence(detection.evidence);
		return findElementByEvidence(detection.evidence);
	}
	function finalizeHighlights(seen) {
		const visible = Array.from(seen.values()).filter((highlight) => {
			const element = document.querySelector(`[${HIGHLIGHT_ID_ATTR}="${highlight.id}"]`);
			return element instanceof HTMLElement && isVisibleHighlightElement(element);
		}).sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
		const countdowns = visible.filter((highlight) => highlight.patternType === "CountdownTimer");
		const rest = visible.filter((highlight) => highlight.patternType !== "CountdownTimer");
		return [...countdowns, ...rest].slice(0, MAX_HIGHLIGHTS);
	}
	function enrichHighlightsFromDetections(existing, detections, pageType) {
		const seen = /* @__PURE__ */ new Map();
		for (const highlight of existing) {
			const element = document.querySelector(`[${HIGHLIGHT_ID_ATTR}="${highlight.id}"]`);
			if (element instanceof HTMLElement) seen.set(element, highlight);
		}
		const pricingDetections = detections.filter((detection) => detection.category === "PRICING_DECEPTION");
		const otherDetections = detections.filter((detection) => detection.category !== "PRICING_DECEPTION");
		for (const detection of [...pricingDetections, ...otherDetections]) {
			if (existing.some((highlight) => highlight.category === detection.category && highlight.patternType === detection.patternType)) continue;
			const element = findElementForDetection(detection);
			if (!element) continue;
			addCandidate(element, {
				category: detection.category,
				patternType: detection.patternType,
				severity: detection.severity,
				label: labelForDetection(detection)
			}, pageType, seen);
		}
		return finalizeHighlights(seen);
	}
	function collectPageHighlights(pageType) {
		const seen = /* @__PURE__ */ new Map();
		collectCountdownHighlights(pageType, seen);
		collectPreselectionHighlights(pageType, seen);
		collectPricingHighlights(pageType, seen);
		collectTextHighlights(pageType, seen);
		collectStickyHighlights(pageType, seen);
		return finalizeHighlights(seen);
	}
	function clearHighlightMarkers() {
		for (const element of document.querySelectorAll(`[${HIGHLIGHT_ID_ATTR}]`)) element.removeAttribute(HIGHLIGHT_ID_ATTR);
	}
	function clearHighlightBoxes() {
		for (const box of document.querySelectorAll(`[${HIGHLIGHT_BOX_ATTR}]`)) box.remove();
	}
	//#endregion
	//#region src/extract/page.ts
	var INTERACTIVE_SELECTORS = [
		"input",
		"button",
		"a",
		"[role=\"dialog\"]",
		"[class*=\"modal\"]",
		"[class*=\"popup\"]",
		"[class*=\"overlay\"]",
		"[class*=\"countdown\"]",
		"[class*=\"timer\"]",
		"[class*=\"sticky\"]",
		"[style*=\"position: fixed\"]",
		"[style*=\"position:fixed\"]"
	].join(",");
	var MAX_TEXT_LENGTH = 12e3;
	var MAX_HTML_LENGTH = 12e3;
	function extractPageContent() {
		const pageType = detectPageType(document);
		const visibleText = (document.body?.innerText ?? "").slice(0, MAX_TEXT_LENGTH);
		const interactiveHtml = buildInteractiveHtml();
		const highlights = collectPageHighlights(pageType);
		return {
			url: window.location.href,
			pageTitle: document.title.slice(0, 500),
			visibleText,
			interactiveHtml,
			pageType,
			highlights
		};
	}
	function buildInteractiveHtml() {
		const parts = [];
		for (const element of document.querySelectorAll(INTERACTIVE_SELECTORS)) {
			if (parts.join("\n").length >= MAX_HTML_LENGTH) break;
			const html = element.outerHTML.slice(0, 500);
			parts.push(html);
		}
		for (const element of document.querySelectorAll("*")) {
			if (parts.join("\n").length >= MAX_HTML_LENGTH) break;
			const style = window.getComputedStyle(element);
			if (style.position === "fixed" || style.position === "sticky") parts.push(`<div data-dpd-overlay="${style.position}">${element.outerHTML.slice(0, 300)}</div>`);
		}
		return parts.join("\n").slice(0, MAX_HTML_LENGTH);
	}
	function hookSpaNavigation(onNavigate) {
		const originalPushState = history.pushState.bind(history);
		const originalReplaceState = history.replaceState.bind(history);
		history.pushState = (...args) => {
			originalPushState(...args);
			onNavigate();
		};
		history.replaceState = (...args) => {
			originalReplaceState(...args);
			onNavigate();
		};
		window.addEventListener("popstate", onNavigate);
		return () => {
			history.pushState = originalPushState;
			history.replaceState = originalReplaceState;
			window.removeEventListener("popstate", onNavigate);
		};
	}
	//#endregion
	//#region src/extract/wait-for-page.ts
	var LOAD_TIMEOUT_MS = 15e3;
	var SETTLE_MS = 2e3;
	async function waitForPageReady(settleMs = SETTLE_MS) {
		await waitForDocumentLoad(LOAD_TIMEOUT_MS);
		if (settleMs > 0) await delay(settleMs);
	}
	function delay(ms) {
		return new Promise((resolve) => {
			window.setTimeout(resolve, ms);
		});
	}
	function waitForDocumentLoad(timeoutMs) {
		if (document.readyState === "complete") return Promise.resolve();
		return new Promise((resolve) => {
			const finish = () => {
				window.clearTimeout(timeout);
				resolve();
			};
			const timeout = window.setTimeout(finish, timeoutMs);
			window.addEventListener("load", finish, { once: true });
		});
	}
	//#endregion
	//#region src/highlight/overlay.ts
	var SEVERITY_COLORS = {
		HIGH: {
			border: "#DC2626",
			background: "rgba(220, 38, 38, 0.14)"
		},
		MEDIUM: {
			border: "#D97706",
			background: "rgba(217, 119, 6, 0.14)"
		},
		LOW: {
			border: "#2563EB",
			background: "rgba(37, 99, 235, 0.12)"
		}
	};
	var HighlightOverlay = class {
		highlights = [];
		visible = false;
		boundUpdate = null;
		activeHighlightId = null;
		rafId = null;
		show(highlights) {
			this.highlights = highlights;
			this.visible = highlights.length > 0;
			this.ensureBindings();
			this.render();
		}
		hide() {
			this.visible = false;
			this.activeHighlightId = null;
			clearHighlightBoxes();
			if (this.rafId !== null) {
				cancelAnimationFrame(this.rafId);
				this.rafId = null;
			}
		}
		scrollToHighlight(highlightId) {
			const element = document.querySelector(`[${HIGHLIGHT_ID_ATTR}="${highlightId}"]`);
			if (!(element instanceof HTMLElement)) return;
			this.activeHighlightId = highlightId;
			element.scrollIntoView({
				behavior: "smooth",
				block: "center"
			});
			window.setTimeout(() => {
				this.render();
			}, 350);
		}
		ensureBindings() {
			if (this.boundUpdate) return;
			this.boundUpdate = () => {
				if (!this.visible || this.rafId !== null) return;
				this.rafId = requestAnimationFrame(() => {
					this.rafId = null;
					this.render();
				});
			};
			document.addEventListener("scroll", this.boundUpdate, {
				capture: true,
				passive: true
			});
			window.addEventListener("resize", this.boundUpdate, { passive: true });
		}
		render() {
			if (!this.visible) return;
			clearHighlightBoxes();
			for (const highlight of this.highlights) {
				const element = document.querySelector(`[${HIGHLIGHT_ID_ATTR}="${highlight.id}"]`);
				if (!(element instanceof HTMLElement)) continue;
				if (!isVisibleHighlightElement(element)) continue;
				const rect = element.getBoundingClientRect();
				if (rect.width <= 0 || rect.height <= 0) continue;
				const colors = SEVERITY_COLORS[highlight.severity];
				const borderWidth = highlight.id === this.activeHighlightId ? 3 : 2;
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
					`background:${colors.background}`
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
					"text-overflow:ellipsis"
				].join(";");
				box.appendChild(label);
				document.body.appendChild(box);
			}
		}
	};
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
	function isAnalyzableUrl(url) {
		if (!url) return false;
		if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
		return !isExcludedUrl(url);
	}
	//#endregion
	//#region src/entrypoints/content.ts
	var DEBOUNCE_MS = 2e3;
	var content_default = defineContentScript({
		matches: ["http://*/*", "https://*/*"],
		runAt: "document_idle",
		main() {
			if (!isAnalyzableUrl(window.location.href)) return;
			const overlay = new HighlightOverlay();
			let debounceTimer = null;
			const analyze = (force = false) => {
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					debounceTimer = null;
					(async () => {
						if (!force) {
							if (!(await chrome.runtime.sendMessage({
								type: "SHOULD_ANALYZE",
								url: window.location.href
							}))?.shouldAnalyze) return;
						}
						overlay.hide();
						clearHighlightMarkers();
						await waitForPageReady();
						const page = extractPageContent();
						chrome.runtime.sendMessage({
							type: "PAGE_CONTENT",
							...page,
							force
						});
					})();
				}, force ? 0 : DEBOUNCE_MS);
			};
			chrome.runtime.onMessage.addListener((message) => {
				if (message?.type === "ANALYZE_PAGE") {
					analyze(Boolean(message.force));
					return;
				}
				if (message?.type === "SET_PAGE_HIGHLIGHTS") {
					(async () => {
						const pageType = detectPageType(document);
						const enriched = enrichHighlightsFromDetections(message.highlights ?? [], message.detections ?? [], pageType);
						if (message.visible) overlay.show(enriched);
						else overlay.hide();
						await chrome.runtime.sendMessage({
							type: "HIGHLIGHTS_UPDATED",
							highlights: enriched
						});
					})();
					return;
				}
				if (message?.type === "CLEAR_PAGE_HIGHLIGHTS") {
					overlay.hide();
					return;
				}
				if (message?.type === "SCROLL_TO_HIGHLIGHT") overlay.scrollToHighlight(message.highlightId);
			});
			hookSpaNavigation(() => {
				overlay.hide();
				clearHighlightMarkers();
				analyze(false);
			});
		}
	});
	//#endregion
	//#region ../node_modules/wxt/dist/utils/internal/logger.mjs
	function print$1(method, ...args) {
		if (typeof args[0] === "string") method(`[wxt] ${args.shift()}`, ...args);
		else method("[wxt]", ...args);
	}
	/** Wrapper around `console` with a "[wxt]" prefix */
	var logger$1 = {
		debug: (...args) => print$1(console.debug, ...args),
		log: (...args) => print$1(console.log, ...args),
		warn: (...args) => print$1(console.warn, ...args),
		error: (...args) => print$1(console.error, ...args)
	};
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
	//#region ../node_modules/wxt/dist/utils/internal/custom-events.mjs
	var WxtLocationChangeEvent = class WxtLocationChangeEvent extends Event {
		static EVENT_NAME = getUniqueEventName("wxt:locationchange");
		constructor(newUrl, oldUrl) {
			super(WxtLocationChangeEvent.EVENT_NAME, {});
			this.newUrl = newUrl;
			this.oldUrl = oldUrl;
		}
	};
	/**
	* Returns an event name unique to the extension and content script that's
	* running.
	*/
	function getUniqueEventName(eventName) {
		return `${browser?.runtime?.id}:content:${eventName}`;
	}
	//#endregion
	//#region ../node_modules/wxt/dist/utils/internal/location-watcher.mjs
	var supportsNavigationApi = typeof globalThis.navigation?.addEventListener === "function";
	/**
	* Create a util that watches for URL changes, dispatching the custom event when
	* detected. Stops watching when content script is invalidated. Uses Navigation
	* API when available, otherwise falls back to polling.
	*/
	function createLocationWatcher(ctx) {
		let lastUrl;
		let watching = false;
		return { run() {
			if (watching) return;
			watching = true;
			lastUrl = new URL(location.href);
			if (supportsNavigationApi) globalThis.navigation.addEventListener("navigate", (event) => {
				const newUrl = new URL(event.destination.url);
				if (newUrl.href === lastUrl.href) return;
				window.dispatchEvent(new WxtLocationChangeEvent(newUrl, lastUrl));
				lastUrl = newUrl;
			}, { signal: ctx.signal });
			else ctx.setInterval(() => {
				const newUrl = new URL(location.href);
				if (newUrl.href !== lastUrl.href) {
					window.dispatchEvent(new WxtLocationChangeEvent(newUrl, lastUrl));
					lastUrl = newUrl;
				}
			}, 1e3);
		} };
	}
	//#endregion
	//#region ../node_modules/wxt/dist/utils/content-script-context.mjs
	/**
	* Implements
	* [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).
	* Used to detect and stop content script code when the script is invalidated.
	*
	* It also provides several utilities like `ctx.setTimeout` and
	* `ctx.setInterval` that should be used in content scripts instead of
	* `window.setTimeout` or `window.setInterval`.
	*
	* To create context for testing, you can use the class's constructor:
	*
	* ```ts
	* import { ContentScriptContext } from 'wxt/utils/content-scripts-context';
	*
	* test('storage listener should be removed when context is invalidated', () => {
	*   const ctx = new ContentScriptContext('test');
	*   const item = storage.defineItem('local:count', { defaultValue: 0 });
	*   const watcher = vi.fn();
	*
	*   const unwatch = item.watch(watcher);
	*   ctx.onInvalidated(unwatch); // Listen for invalidate here
	*
	*   await item.setValue(1);
	*   expect(watcher).toBeCalledTimes(1);
	*   expect(watcher).toBeCalledWith(1, 0);
	*
	*   ctx.notifyInvalidated(); // Use this function to invalidate the context
	*   await item.setValue(2);
	*   expect(watcher).toBeCalledTimes(1);
	* });
	* ```
	*/
	var ContentScriptContext = class ContentScriptContext {
		static SCRIPT_STARTED_MESSAGE_TYPE = getUniqueEventName("wxt:content-script-started");
		id;
		abortController;
		locationWatcher = createLocationWatcher(this);
		constructor(contentScriptName, options) {
			this.contentScriptName = contentScriptName;
			this.options = options;
			this.id = Math.random().toString(36).slice(2);
			this.abortController = new AbortController();
			this.stopOldScripts();
			this.listenForNewerScripts();
		}
		get signal() {
			return this.abortController.signal;
		}
		abort(reason) {
			return this.abortController.abort(reason);
		}
		get isInvalid() {
			if (browser.runtime?.id == null) this.notifyInvalidated();
			return this.signal.aborted;
		}
		get isValid() {
			return !this.isInvalid;
		}
		/**
		* Add a listener that is called when the content script's context is
		* invalidated.
		*
		* @example
		*   browser.runtime.onMessage.addListener(cb);
		*   const removeInvalidatedListener = ctx.onInvalidated(() => {
		*     browser.runtime.onMessage.removeListener(cb);
		*   });
		*   // ...
		*   removeInvalidatedListener();
		*
		* @returns A function to remove the listener.
		*/
		onInvalidated(cb) {
			this.signal.addEventListener("abort", cb);
			return () => this.signal.removeEventListener("abort", cb);
		}
		/**
		* Return a promise that never resolves. Useful if you have an async function
		* that shouldn't run after the context is expired.
		*
		* @example
		*   const getValueFromStorage = async () => {
		*     if (ctx.isInvalid) return ctx.block();
		*
		*     // ...
		*   };
		*/
		block() {
			return new Promise(() => {});
		}
		/**
		* Wrapper around `window.setInterval` that automatically clears the interval
		* when invalidated.
		*
		* Intervals can be cleared by calling the normal `clearInterval` function.
		*/
		setInterval(handler, timeout) {
			const id = setInterval(() => {
				if (this.isValid) handler();
			}, timeout);
			this.onInvalidated(() => clearInterval(id));
			return id;
		}
		/**
		* Wrapper around `window.setTimeout` that automatically clears the interval
		* when invalidated.
		*
		* Timeouts can be cleared by calling the normal `setTimeout` function.
		*/
		setTimeout(handler, timeout) {
			const id = setTimeout(() => {
				if (this.isValid) handler();
			}, timeout);
			this.onInvalidated(() => clearTimeout(id));
			return id;
		}
		/**
		* Wrapper around `window.requestAnimationFrame` that automatically cancels
		* the request when invalidated.
		*
		* Callbacks can be canceled by calling the normal `cancelAnimationFrame`
		* function.
		*/
		requestAnimationFrame(callback) {
			const id = requestAnimationFrame((...args) => {
				if (this.isValid) callback(...args);
			});
			this.onInvalidated(() => cancelAnimationFrame(id));
			return id;
		}
		/**
		* Wrapper around `window.requestIdleCallback` that automatically cancels the
		* request when invalidated.
		*
		* Callbacks can be canceled by calling the normal `cancelIdleCallback`
		* function.
		*/
		requestIdleCallback(callback, options) {
			const id = requestIdleCallback((...args) => {
				if (!this.signal.aborted) callback(...args);
			}, options);
			this.onInvalidated(() => cancelIdleCallback(id));
			return id;
		}
		addEventListener(target, type, handler, options) {
			if (type === "wxt:locationchange") {
				if (this.isValid) this.locationWatcher.run();
			}
			target.addEventListener?.(type.startsWith("wxt:") ? getUniqueEventName(type) : type, handler, {
				...options,
				signal: this.signal
			});
		}
		/**
		* @internal
		* Abort the abort controller and execute all `onInvalidated` listeners.
		*/
		notifyInvalidated() {
			this.abort("Content script context invalidated");
			logger$1.debug(`Content script "${this.contentScriptName}" context invalidated`);
		}
		stopOldScripts() {
			document.dispatchEvent(new CustomEvent(ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE, { detail: {
				contentScriptName: this.contentScriptName,
				messageId: this.id
			} }));
			if (!this.options?.noScriptStartedPostMessage) window.postMessage({
				type: ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE,
				contentScriptName: this.contentScriptName,
				messageId: this.id
			}, "*");
		}
		verifyScriptStartedEvent(event) {
			const isSameContentScript = event.detail?.contentScriptName === this.contentScriptName;
			const isFromSelf = event.detail?.messageId === this.id;
			return isSameContentScript && !isFromSelf;
		}
		listenForNewerScripts() {
			const cb = (event) => {
				if (!(event instanceof CustomEvent) || !this.verifyScriptStartedEvent(event)) return;
				this.notifyInvalidated();
			};
			document.addEventListener(ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE, cb);
			this.onInvalidated(() => document.removeEventListener(ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE, cb));
		}
	};
	//#endregion
	//#region \0virtual:wxt-content-script-isolated-world-entrypoint?/home/lionheartsg/project/scamwebsitedetector/extension/src/entrypoints/content.ts
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
	//#endregion
	return (async () => {
		try {
			const { main, ...options } = content_default;
			return await main(new ContentScriptContext("content", options));
		} catch (err) {
			logger.error(`The content script "content" crashed on startup!`, err);
			throw err;
		}
	})();
})();

content;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsIm5hbWVzIjpbInByaW50IiwibG9nZ2VyIiwiYnJvd3NlciJdLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQubWpzIiwiLi4vLi4vLi4vLi4vc2hhcmVkL3BhZ2UtY29udGV4dC50cyIsIi4uLy4uLy4uL3NyYy9leHRyYWN0L2hpZ2hsaWdodHMudHMiLCIuLi8uLi8uLi9zcmMvZXh0cmFjdC9wYWdlLnRzIiwiLi4vLi4vLi4vc3JjL2V4dHJhY3Qvd2FpdC1mb3ItcGFnZS50cyIsIi4uLy4uLy4uL3NyYy9oaWdobGlnaHQvb3ZlcmxheS50cyIsIi4uLy4uLy4uL3NyYy9saWIvZXhjbHVkZWQtaG9zdHMudHMiLCIuLi8uLi8uLi9zcmMvbGliL3N0b3JhZ2UudHMiLCIuLi8uLi8uLi9zcmMvZW50cnlwb2ludHMvY29udGVudC50cyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0B3eHQtZGV2L2Jyb3dzZXIvc3JjL2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC50c1xuZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG5cdHJldHVybiBkZWZpbml0aW9uO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBkZWZpbmVDb250ZW50U2NyaXB0IH07XG4iLCJpbXBvcnQgdHlwZSB7IFBhZ2VUeXBlIH0gZnJvbSBcIi4vdHlwZXMvc2NhblwiO1xuXG5mdW5jdGlvbiBwYXJzZVN0cnVjdHVyZWREYXRhVHlwZShyYXc6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICB0cnkge1xuICAgIGNvbnN0IHBhcnNlZDogdW5rbm93biA9IEpTT04ucGFyc2UocmF3KTtcbiAgICBjb25zdCBpdGVtcyA9IEFycmF5LmlzQXJyYXkocGFyc2VkKSA/IHBhcnNlZCA6IFtwYXJzZWRdO1xuXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICBpZiAoIWl0ZW0gfHwgdHlwZW9mIGl0ZW0gIT09IFwib2JqZWN0XCIpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgcmVjb3JkID0gaXRlbSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgICAgIGNvbnN0IGdyYXBoID0gcmVjb3JkW1wiQGdyYXBoXCJdO1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZ3JhcGgpKSB7XG4gICAgICAgIGZvciAoY29uc3Qgbm9kZSBvZiBncmFwaCkge1xuICAgICAgICAgIGlmIChub2RlICYmIHR5cGVvZiBub2RlID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICBjb25zdCB0eXBlID0gKG5vZGUgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pW1wiQHR5cGVcIl07XG4gICAgICAgICAgICBpZiAodHlwZW9mIHR5cGUgPT09IFwic3RyaW5nXCIpIHJldHVybiB0eXBlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc3QgdHlwZSA9IHJlY29yZFtcIkB0eXBlXCJdO1xuICAgICAgaWYgKHR5cGVvZiB0eXBlID09PSBcInN0cmluZ1wiKSByZXR1cm4gdHlwZTtcbiAgICB9XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZXRlY3RQYWdlVHlwZShkb2M6IERvY3VtZW50KTogUGFnZVR5cGUge1xuICBjb25zdCBvZ1R5cGUgPSBkb2NcbiAgICAucXVlcnlTZWxlY3RvcignbWV0YVtwcm9wZXJ0eT1cIm9nOnR5cGVcIl0nKVxuICAgID8uZ2V0QXR0cmlidXRlKFwiY29udGVudFwiKVxuICAgID8udG9Mb3dlckNhc2UoKTtcblxuICBpZiAob2dUeXBlID09PSBcImFydGljbGVcIiB8fCBvZ1R5cGUgPT09IFwibmV3c2FydGljbGVcIikge1xuICAgIHJldHVybiBcImVkaXRvcmlhbFwiO1xuICB9XG5cbiAgZm9yIChjb25zdCBzY3JpcHQgb2YgZG9jLnF1ZXJ5U2VsZWN0b3JBbGwoXG4gICAgJ3NjcmlwdFt0eXBlPVwiYXBwbGljYXRpb24vbGQranNvblwiXScsXG4gICkpIHtcbiAgICBjb25zdCBzdHJ1Y3R1cmVkVHlwZSA9IHBhcnNlU3RydWN0dXJlZERhdGFUeXBlKHNjcmlwdC50ZXh0Q29udGVudCA/PyBcIlwiKTtcbiAgICBpZiAoXG4gICAgICBzdHJ1Y3R1cmVkVHlwZSA9PT0gXCJOZXdzQXJ0aWNsZVwiIHx8XG4gICAgICBzdHJ1Y3R1cmVkVHlwZSA9PT0gXCJBcnRpY2xlXCIgfHxcbiAgICAgIHN0cnVjdHVyZWRUeXBlID09PSBcIkJsb2dQb3N0aW5nXCJcbiAgICApIHtcbiAgICAgIHJldHVybiBcImVkaXRvcmlhbFwiO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGFydGljbGUgPSBkb2MucXVlcnlTZWxlY3RvcihcImFydGljbGVcIik7XG4gIGlmIChhcnRpY2xlKSB7XG4gICAgY29uc3QgYXJ0aWNsZUxlbmd0aCA9IChhcnRpY2xlLnRleHRDb250ZW50ID8/IFwiXCIpLnRyaW0oKS5sZW5ndGg7XG4gICAgY29uc3QgYm9keUxlbmd0aCA9IChkb2MuYm9keT8udGV4dENvbnRlbnQgPz8gXCJcIikudHJpbSgpLmxlbmd0aDtcbiAgICBpZiAoYXJ0aWNsZUxlbmd0aCA+IDQwMCAmJiBhcnRpY2xlTGVuZ3RoIC8gTWF0aC5tYXgoYm9keUxlbmd0aCwgMSkgPiAwLjM1KSB7XG4gICAgICByZXR1cm4gXCJlZGl0b3JpYWxcIjtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gXCJnZW5lcmFsXCI7XG59XG4iLCJpbXBvcnQgdHlwZSB7XG4gIERldGVjdGlvbkNhdGVnb3J5LFxuICBQYWdlSGlnaGxpZ2h0LFxuICBQYWdlVHlwZSxcbn0gZnJvbSBcIkBkYXJrcGF0dGVybnMvc2hhcmVkL3R5cGVzXCI7XG5cbmV4cG9ydCBjb25zdCBISUdITElHSFRfSURfQVRUUiA9IFwiZGF0YS1kcGQtaGlnaGxpZ2h0LWlkXCI7XG5leHBvcnQgY29uc3QgSElHSExJR0hUX0JPWF9BVFRSID0gXCJkYXRhLWRwZC1oaWdobGlnaHQtYm94XCI7XG5cbmNvbnN0IE1BWF9ISUdITElHSFRTID0gMTU7XG5cbmNvbnN0IENPVU5URE9XTl9TRUxFQ1RPUlMgPSBbXG4gICdbY2xhc3MqPVwiY291bnRkb3duXCJdJyxcbiAgJ1tjbGFzcyo9XCJ0aW1lclwiXScsXG4gICdbaWQqPVwiY291bnRkb3duXCJdJyxcbiAgJ1tpZCo9XCJ0aW1lclwiXScsXG4gICdbcm9sZT1cInRpbWVyXCJdJyxcbl0uam9pbihcIixcIik7XG5cbmNvbnN0IElOVEVSQUNUSVZFX1NFTEVDVE9SUyA9IFtcbiAgXCJidXR0b25cIixcbiAgXCJhXCIsXG4gIFwiaW5wdXRcIixcbiAgXCJzZWxlY3RcIixcbiAgXCJsYWJlbFwiLFxuICBcInRleHRhcmVhXCIsXG4gICdbcm9sZT1cImRpYWxvZ1wiXScsXG4gICdbY2xhc3MqPVwibW9kYWxcIl0nLFxuICAnW2NsYXNzKj1cInBvcHVwXCJdJyxcbiAgJ1tjbGFzcyo9XCJvdmVybGF5XCJdJyxcbiAgJ1tjbGFzcyo9XCJiYW5uZXJcIl0nLFxuICAnW2NsYXNzKj1cInByaWNlXCJdJyxcbiAgJ1tjbGFzcyo9XCJzdWJzY3JpYmVcIl0nLFxuICAnW2NsYXNzKj1cIm5ld3NsZXR0ZXJcIl0nLFxuXS5qb2luKFwiLFwiKTtcblxuY29uc3QgVVJHRU5DWV9QQVRURVJOUyA9IFtcbiAgL2NvdW50ZG93bi9pLFxuICAvZGVhbCBlbmRzIChpbnxzb29ufHRvZGF5KS9pLFxuICAvbGltaXRlZCB0aW1lIG9ubHkvaSxcbiAgL29mZmVyIGV4cGlyZXMvaSxcbiAgL2VuZHMgaW4gXFxkKy9pLFxuICAvc2FsZSBlbmRzL2ksXG4gIC9lbmRzIHRvZGF5L2ksXG4gIC9sYXN0IGNoYW5jZS9pLFxuICAvZmxhc2ggc2FsZS9pLFxuXTtcblxuY29uc3QgU0NBUkNJVFlfUEFUVEVSTlMgPSBbXG4gIC9pbiBzdG9jay9pLFxuICAvb25seSBcXGQrIGxlZnQvaSxcbiAgL29ubHkgXFxkKyByZW1haW5pbmcvaSxcbiAgL2xvdyBzdG9jay9pLFxuICAvc2VsbGluZyBmYXN0L2ksXG4gIC9oaWdoIGRlbWFuZC9pLFxuICAvcGVvcGxlIChhcmUgKT92aWV3aW5nL2ksXG4gIC9pbiBcXGQrIGNhcnRzPy9pLFxuICAvYWxtb3N0IHNvbGQgb3V0L2ksXG4gIC9saW1pdGVkIHF1YW50aXR5L2ksXG4gIC9mZXcgbGVmdC9pLFxuICAvbGVmdCBpbiBzdG9jay9pLFxuXTtcblxuY29uc3QgU09DSUFMX1BST09GX1BBVFRFUk5TID0gW1xuICAvcGVvcGxlIChhcmUgKT92aWV3aW5nL2ksXG4gIC9ib3VnaHQgaW4gdGhlIGxhc3QvaSxcbiAgL3NvbWVvbmUganVzdCBwdXJjaGFzZWQvaSxcbiAgL3JlY2VudChseSk/IHB1cmNoYXNlZC9pLFxuICAvXFxkKyAocGVvcGxlfHVzZXJzfGN1c3RvbWVycykgKGFyZSApPyh2aWV3aW5nfHdhdGNoaW5nKS9pLFxuXTtcblxuY29uc3QgQ09ORklSTVNIQU1JTkdfUEFUVEVSTlMgPSBbXG4gIC9ubyB0aGFua3MsPyBpIGhhdGUgc2F2aW5nL2ksXG4gIC9pIGRvblsnJ110IHdhbnQgYSBkaXNjb3VudC9pLFxuICAvbm8sPyBpWycnXWxsIHBheSBmdWxsIHByaWNlL2ksXG4gIC9jb250aW51ZSB3aXRob3V0L2ksXG5dO1xuXG5jb25zdCBQUklDSU5HX1BBVFRFUk5TID0gW1xuICAvd2FzIFtcXCTCo+KCrFMkXS9pLFxuICAvbm93IFtcXCTCo+KCrFMkXS9pLFxuICAvW1xcJMKj4oKsUyRdXFxzP1tcXGQsLl0rW1xcc1xcU117MCwyMH0od2FzfGJlZm9yZXxjb21wYXJlfG9yaWdpbmFsfHJlZ3VsYXIpL2ksXG4gIC8od2FzfGJlZm9yZXxjb21wYXJlfG9yaWdpbmFsfHJlZ3VsYXIpW1xcc1xcU117MCwyMH1bXFwkwqPigqxTJF1cXHM/W1xcZCwuXSsvaSxcbiAgL3NhdmUgXFxkK1xccyolL2ksXG4gIC9cXGQrXFxzKiVcXHMqb2ZmL2ksXG4gIC9ycnB8bXJycC9pLFxuICAvb3JpZ2luYWwgcHJpY2UvaSxcbiAgL2NvbXBhcmUuP2F0L2ksXG4gIC9yZWd1bGFyIHByaWNlL2ksXG4gIC9saXN0ZWQgcHJpY2UvaSxcbiAgL1xcKyB0YXgvaSxcbiAgL2FkZGl0aW9uYWwgZmVlcz8vaSxcbiAgL3N0YXJ0aW5nIGF0L2ksXG4gIC9mcm9tIFtcXCTCo+KCrFMkXS9pLFxuICAvW1xcJMKj4oKsUyRdW1xcZCwuXStcXHMqW1xcJMKj4oKsUyRdW1xcZCwuXSsvLFxuXTtcblxuY29uc3QgUFJJQ0VfQ09OVEFJTkVSX1NFTEVDVE9SUyA9IFtcbiAgJ1tjbGFzcyo9XCJwcmljZVwiXScsXG4gICdbY2xhc3MqPVwiUHJpY2VcIl0nLFxuICAnW2NsYXNzKj1cImNvbXBhcmVcIl0nLFxuICAnW2NsYXNzKj1cIndhcy1wcmljZVwiXScsXG4gICdbY2xhc3MqPVwid2FzX3ByaWNlXCJdJyxcbiAgJ1tjbGFzcyo9XCJvcmlnaW5hbFwiXScsXG4gICdbY2xhc3MqPVwicmVndWxhclwiXScsXG4gICdbY2xhc3MqPVwic2FsZS1wcmljZVwiXScsXG4gICdbY2xhc3MqPVwic2FsZV9wcmljZVwiXScsXG4gICdbZGF0YS1jb21wYXJlLXByaWNlXScsXG4gICdbZGF0YS1zYWxlLXByaWNlXScsXG4gIFwiLnByaWNlXCIsXG4gIFwiLnByb2R1Y3QtcHJpY2VcIixcbl0uam9pbihcIixcIik7XG5cbmNvbnN0IE5BR0dJTkdfUEFUVEVSTlMgPSBbXG4gIC9zdWJzY3JpYmUvaSxcbiAgL3NpZ24gdXAvaSxcbiAgL2Rvbid0IG1pc3MvaSxcbiAgL2JlZm9yZSB5b3UgZ28vaSxcbiAgL3dhaXQhPyBkb24ndCBsZWF2ZS9pLFxuICAvZW5hYmxlIG5vdGlmaWNhdGlvbnMvaSxcbl07XG5cbmNvbnN0IFNORUFLSU5HX1BBVFRFUk5TID0gW1xuICAvaGlkZGVuIGZlZS9pLFxuICAvYXV0by4/cmVuZXcvaSxcbiAgL2ZyZWUgdHJpYWwvaSxcbiAgL2FkZGVkIHRvIChjYXJ0fGJhc2tldCkvaSxcbiAgL3ByZS4/c2VsZWN0ZWQgYWRkLj9vbi9pLFxuXTtcblxudHlwZSBIaWdobGlnaHRDYW5kaWRhdGUgPSBPbWl0PFBhZ2VIaWdobGlnaHQsIFwiaWRcIj47XG5cbmV4cG9ydCB0eXBlIEhpZ2hsaWdodERldGVjdGlvbiA9IHtcbiAgY2F0ZWdvcnk6IHN0cmluZztcbiAgcGF0dGVyblR5cGU6IHN0cmluZztcbiAgc2V2ZXJpdHk6IFBhZ2VIaWdobGlnaHRbXCJzZXZlcml0eVwiXTtcbiAgZXZpZGVuY2U6IHN0cmluZztcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1Zpc2libGVIaWdobGlnaHRFbGVtZW50KGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG4gIGNvbnN0IHN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbWVudCk7XG4gIGlmIChzdHlsZS5kaXNwbGF5ID09PSBcIm5vbmVcIiB8fCBzdHlsZS52aXNpYmlsaXR5ID09PSBcImhpZGRlblwiKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChOdW1iZXIucGFyc2VGbG9hdChzdHlsZS5vcGFjaXR5KSA9PT0gMCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICBpZiAocmVjdC53aWR0aCA8IDIgfHwgcmVjdC5oZWlnaHQgPCAyKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBlbGVtZW50LmNoZWNrVmlzaWJpbGl0eSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgcmV0dXJuIGVsZW1lbnQuY2hlY2tWaXNpYmlsaXR5KHtcbiAgICAgIGNoZWNrT3BhY2l0eTogdHJ1ZSxcbiAgICAgIGNoZWNrVmlzaWJpbGl0eUNTUzogdHJ1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChzdHlsZS5wb3NpdGlvbiA9PT0gXCJmaXhlZFwiIHx8IHN0eWxlLnBvc2l0aW9uID09PSBcInN0aWNreVwiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gZWxlbWVudC5vZmZzZXRQYXJlbnQgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGFzc2lnbkhpZ2hsaWdodElkKGVsZW1lbnQ6IEVsZW1lbnQpOiBzdHJpbmcge1xuICBjb25zdCBleGlzdGluZyA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKEhJR0hMSUdIVF9JRF9BVFRSKTtcbiAgaWYgKGV4aXN0aW5nKSB7XG4gICAgcmV0dXJuIGV4aXN0aW5nO1xuICB9XG5cbiAgY29uc3QgaWQgPSBjcnlwdG8ucmFuZG9tVVVJRCgpO1xuICBlbGVtZW50LnNldEF0dHJpYnV0ZShISUdITElHSFRfSURfQVRUUiwgaWQpO1xuICByZXR1cm4gaWQ7XG59XG5cbmZ1bmN0aW9uIGlzSW5zaWRlQXJ0aWNsZUJvZHkoZWxlbWVudDogRWxlbWVudCk6IGJvb2xlYW4ge1xuICBjb25zdCBhcnRpY2xlID0gZWxlbWVudC5jbG9zZXN0KFwiYXJ0aWNsZVwiKTtcbiAgaWYgKCFhcnRpY2xlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGVsZW1lbnQuY2xvc2VzdCgnW3JvbGU9XCJkaWFsb2dcIl0sIFtjbGFzcyo9XCJtb2RhbFwiXSwgW2NsYXNzKj1cInBvcHVwXCJdJykpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCB0YWcgPSBlbGVtZW50LnRhZ05hbWUudG9Mb3dlckNhc2UoKTtcbiAgcmV0dXJuICFbXCJpbnB1dFwiLCBcImJ1dHRvblwiLCBcInNlbGVjdFwiLCBcInRleHRhcmVhXCIsIFwiZm9ybVwiXS5pbmNsdWRlcyh0YWcpO1xufVxuXG5mdW5jdGlvbiBzaG91bGRTa2lwRWxlbWVudChlbGVtZW50OiBFbGVtZW50LCBwYWdlVHlwZTogUGFnZVR5cGUpOiBib29sZWFuIHtcbiAgaWYgKHBhZ2VUeXBlID09PSBcImVkaXRvcmlhbFwiICYmIGlzSW5zaWRlQXJ0aWNsZUJvZHkoZWxlbWVudCkpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGNvbnN0IHJvb3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImRwZC1oaWdobGlnaHQtcm9vdFwiKTtcbiAgaWYgKHJvb3Q/LmNvbnRhaW5zKGVsZW1lbnQpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50ICYmICFpc1Zpc2libGVIaWdobGlnaHRFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKHRleHQ6IHN0cmluZywgcGF0dGVybnM6IFJlZ0V4cFtdKTogUmVnRXhwIHwgbnVsbCB7XG4gIGZvciAoY29uc3QgcGF0dGVybiBvZiBwYXR0ZXJucykge1xuICAgIGlmIChwYXR0ZXJuLnRlc3QodGV4dCkpIHtcbiAgICAgIHJldHVybiBwYXR0ZXJuO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gaGlnaGxpZ2h0VGFyZ2V0KGVsZW1lbnQ6IEVsZW1lbnQpOiBFbGVtZW50IHtcbiAgY29uc3QgZGlhbG9nID0gZWxlbWVudC5jbG9zZXN0KCdbcm9sZT1cImRpYWxvZ1wiXSwgW2NsYXNzKj1cIm1vZGFsXCJdLCBbY2xhc3MqPVwicG9wdXBcIl0nKTtcbiAgaWYgKGRpYWxvZyBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG4gICAgcmV0dXJuIGRpYWxvZztcbiAgfVxuXG4gIGlmIChlbGVtZW50IGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCkge1xuICAgIHJldHVybiBlbGVtZW50LmNsb3Nlc3QoXCJsYWJlbFwiKSA/PyBlbGVtZW50O1xuICB9XG5cbiAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgIGNvbnN0IHRleHQgPSAoZWxlbWVudC5pbm5lclRleHQgPz8gXCJcIikudHJpbSgpO1xuICAgIGlmICh0ZXh0Lmxlbmd0aCA8IDEyMCkge1xuICAgICAgY29uc3QgY29udGFpbmVyID0gZWxlbWVudC5jbG9zZXN0KFxuICAgICAgICAnbmF2LCBoZWFkZXIsIGZvb3RlciwgW3JvbGU9XCJiYW5uZXJcIl0sIFtyb2xlPVwibmF2aWdhdGlvblwiXSwgZm9ybSwgW2NsYXNzKj1cImNvdW50ZG93blwiXSwgW2NsYXNzKj1cInRpbWVyXCJdJyxcbiAgICAgICk7XG4gICAgICBpZiAoY29udGFpbmVyIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIGNvbnRhaW5lcjtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gZWxlbWVudDtcbn1cblxuZnVuY3Rpb24gaXNOZXN0ZWRTdGlja3lFbGVtZW50KGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG4gIGxldCBwYXJlbnQgPSBlbGVtZW50LnBhcmVudEVsZW1lbnQ7XG4gIHdoaWxlIChwYXJlbnQpIHtcbiAgICBjb25zdCBzdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHBhcmVudCk7XG4gICAgaWYgKHN0eWxlLnBvc2l0aW9uID09PSBcImZpeGVkXCIgfHwgc3R5bGUucG9zaXRpb24gPT09IFwic3RpY2t5XCIpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50RWxlbWVudDtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGFkZENhbmRpZGF0ZShcbiAgZWxlbWVudDogRWxlbWVudCxcbiAgY2FuZGlkYXRlOiBIaWdobGlnaHRDYW5kaWRhdGUsXG4gIHBhZ2VUeXBlOiBQYWdlVHlwZSxcbiAgc2VlbjogTWFwPEVsZW1lbnQsIFBhZ2VIaWdobGlnaHQ+LFxuKTogdm9pZCB7XG4gIGNvbnN0IHRhcmdldCA9IGhpZ2hsaWdodFRhcmdldChlbGVtZW50KTtcbiAgaWYgKCEodGFyZ2V0IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChzaG91bGRTa2lwRWxlbWVudCh0YXJnZXQsIHBhZ2VUeXBlKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGV4aXN0aW5nID0gc2Vlbi5nZXQodGFyZ2V0KTtcbiAgaWYgKGV4aXN0aW5nKSB7XG4gICAgaWYgKHNldmVyaXR5UmFuayhjYW5kaWRhdGUuc2V2ZXJpdHkpID4gc2V2ZXJpdHlSYW5rKGV4aXN0aW5nLnNldmVyaXR5KSkge1xuICAgICAgc2Vlbi5zZXQodGFyZ2V0LCB7IC4uLmNhbmRpZGF0ZSwgaWQ6IGV4aXN0aW5nLmlkIH0pO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cblxuICBzZWVuLnNldCh0YXJnZXQsIHtcbiAgICAuLi5jYW5kaWRhdGUsXG4gICAgaWQ6IGFzc2lnbkhpZ2hsaWdodElkKHRhcmdldCksXG4gIH0pO1xufVxuXG5mdW5jdGlvbiBzZXZlcml0eVJhbmsoc2V2ZXJpdHk6IFBhZ2VIaWdobGlnaHRbXCJzZXZlcml0eVwiXSk6IG51bWJlciB7XG4gIHN3aXRjaCAoc2V2ZXJpdHkpIHtcbiAgICBjYXNlIFwiSElHSFwiOlxuICAgICAgcmV0dXJuIDM7XG4gICAgY2FzZSBcIk1FRElVTVwiOlxuICAgICAgcmV0dXJuIDI7XG4gICAgY2FzZSBcIkxPV1wiOlxuICAgICAgcmV0dXJuIDE7XG4gICAgZGVmYXVsdDoge1xuICAgICAgY29uc3QgX2V4aGF1c3RpdmU6IG5ldmVyID0gc2V2ZXJpdHk7XG4gICAgICByZXR1cm4gX2V4aGF1c3RpdmU7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGNvbGxlY3RDb3VudGRvd25IaWdobGlnaHRzKFxuICBwYWdlVHlwZTogUGFnZVR5cGUsXG4gIHNlZW46IE1hcDxFbGVtZW50LCBQYWdlSGlnaGxpZ2h0Pixcbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChDT1VOVERPV05fU0VMRUNUT1JTKSkge1xuICAgIGlmICghKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIGNvbnRpbnVlO1xuXG4gICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgZWxlbWVudCxcbiAgICAgIHtcbiAgICAgICAgY2F0ZWdvcnk6IFwiVVJHRU5DWVwiLFxuICAgICAgICBwYXR0ZXJuVHlwZTogXCJDb3VudGRvd25UaW1lclwiLFxuICAgICAgICBzZXZlcml0eTogXCJISUdIXCIsXG4gICAgICAgIGxhYmVsOiBcIkNvdW50ZG93biB0aW1lclwiLFxuICAgICAgfSxcbiAgICAgIHBhZ2VUeXBlLFxuICAgICAgc2VlbixcbiAgICApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbGxlY3RQcmVzZWxlY3Rpb25IaWdobGlnaHRzKFxuICBwYWdlVHlwZTogUGFnZVR5cGUsXG4gIHNlZW46IE1hcDxFbGVtZW50LCBQYWdlSGlnaGxpZ2h0Pixcbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IGlucHV0IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTElucHV0RWxlbWVudD4oXG4gICAgJ2lucHV0W3R5cGU9XCJjaGVja2JveFwiXTpjaGVja2VkLCBpbnB1dFt0eXBlPVwicmFkaW9cIl06Y2hlY2tlZCcsXG4gICkpIHtcbiAgICBhZGRDYW5kaWRhdGUoXG4gICAgICBpbnB1dCxcbiAgICAgIHtcbiAgICAgICAgY2F0ZWdvcnk6IFwiUFJFU0VMRUNUSU9OXCIsXG4gICAgICAgIHBhdHRlcm5UeXBlOiBcIlByZUNoZWNrZWRCb3hcIixcbiAgICAgICAgc2V2ZXJpdHk6IFwiTUVESVVNXCIsXG4gICAgICAgIGxhYmVsOiBcIlByZS1zZWxlY3RlZCBvcHRpb25cIixcbiAgICAgIH0sXG4gICAgICBwYWdlVHlwZSxcbiAgICAgIHNlZW4sXG4gICAgKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBoYXNDdXJyZW5jeVRleHQodGV4dDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiAvW1xcJMKj4oKsXXxTXFwkfFxcZFtcXGQsLl0qXFxzKig/Ondhc3xub3d8b2ZmfHNhdmUpL2kudGVzdCh0ZXh0KTtcbn1cblxuZnVuY3Rpb24gcHJpY2luZ0NvbnRhaW5lckZvcihlbGVtZW50OiBFbGVtZW50KTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBjb250YWluZXIgPSBlbGVtZW50LmNsb3Nlc3QoUFJJQ0VfQ09OVEFJTkVSX1NFTEVDVE9SUyk7XG4gIGlmIChjb250YWluZXIgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgIHJldHVybiBjb250YWluZXI7XG4gIH1cbiAgaWYgKGVsZW1lbnQucGFyZW50RWxlbWVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG4gICAgcmV0dXJuIGVsZW1lbnQucGFyZW50RWxlbWVudDtcbiAgfVxuICByZXR1cm4gZWxlbWVudCBhcyBIVE1MRWxlbWVudDtcbn1cblxuZnVuY3Rpb24gY29sbGVjdFByaWNpbmdIaWdobGlnaHRzKFxuICBwYWdlVHlwZTogUGFnZVR5cGUsXG4gIHNlZW46IE1hcDxFbGVtZW50LCBQYWdlSGlnaGxpZ2h0Pixcbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCJkZWwsIHNcIikpIHtcbiAgICBpZiAoIWlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHRleHQgPSBlbGVtZW50LnRleHRDb250ZW50ID8/IFwiXCI7XG4gICAgaWYgKCFoYXNDdXJyZW5jeVRleHQodGV4dCkgJiYgIS9bXFxkLC5dKy8udGVzdCh0ZXh0KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgcHJpY2luZ0NvbnRhaW5lckZvcihlbGVtZW50KSxcbiAgICAgIHtcbiAgICAgICAgY2F0ZWdvcnk6IFwiUFJJQ0lOR19ERUNFUFRJT05cIixcbiAgICAgICAgcGF0dGVyblR5cGU6IFwiU3RyaWtldGhyb3VnaFByaWNlXCIsXG4gICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICBsYWJlbDogXCJQcmljaW5nIGN1ZVwiLFxuICAgICAgfSxcbiAgICAgIHBhZ2VUeXBlLFxuICAgICAgc2VlbixcbiAgICApO1xuICB9XG5cbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFxuICAgIFBSSUNFX0NPTlRBSU5FUl9TRUxFQ1RPUlMsXG4gICkpIHtcbiAgICBjb25zdCB0ZXh0ID0gKGVsZW1lbnQuaW5uZXJUZXh0ID8/IFwiXCIpLnRyaW0oKTtcbiAgICBpZiAodGV4dC5sZW5ndGggPCAzIHx8IHRleHQubGVuZ3RoID4gMjAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBodG1sID0gZWxlbWVudC5vdXRlckhUTUw7XG4gICAgY29uc3QgY29tYmluZWQgPSBgJHt0ZXh0fVxcbiR7aHRtbH1gO1xuICAgIGNvbnN0IGhhc1N0cmlrZSA9XG4gICAgICBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoXCJkZWwsIHNcIikgIT09IG51bGwgfHxcbiAgICAgIC9saW5lLXRocm91Z2gvaS50ZXN0KHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpLnRleHREZWNvcmF0aW9uKTtcblxuICAgIGlmIChcbiAgICAgIGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKGNvbWJpbmVkLCBQUklDSU5HX1BBVFRFUk5TKSB8fFxuICAgICAgKGhhc1N0cmlrZSAmJiBoYXNDdXJyZW5jeVRleHQodGV4dCkpXG4gICAgKSB7XG4gICAgICBhZGRDYW5kaWRhdGUoXG4gICAgICAgIGVsZW1lbnQsXG4gICAgICAgIHtcbiAgICAgICAgICBjYXRlZ29yeTogXCJQUklDSU5HX0RFQ0VQVElPTlwiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBoYXNTdHJpa2UgPyBcIlN0cmlrZXRocm91Z2hQcmljZVwiIDogXCJNaXNsZWFkaW5nUHJpY2VcIixcbiAgICAgICAgICBzZXZlcml0eTogXCJNRURJVU1cIixcbiAgICAgICAgICBsYWJlbDogXCJQcmljaW5nIGN1ZVwiLFxuICAgICAgICB9LFxuICAgICAgICBwYWdlVHlwZSxcbiAgICAgICAgc2VlbixcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiKlwiKSkge1xuICAgIGlmICghaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgdGV4dCA9IChlbGVtZW50LmlubmVyVGV4dCA/PyBcIlwiKS50cmltKCk7XG4gICAgaWYgKHRleHQubGVuZ3RoID4gODApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbWVudCk7XG4gICAgaWYgKHN0eWxlLnRleHREZWNvcmF0aW9uTGluZS5pbmNsdWRlcyhcImxpbmUtdGhyb3VnaFwiKSAmJiBoYXNDdXJyZW5jeVRleHQodGV4dCkpIHtcbiAgICAgIGFkZENhbmRpZGF0ZShcbiAgICAgICAgcHJpY2luZ0NvbnRhaW5lckZvcihlbGVtZW50KSxcbiAgICAgICAge1xuICAgICAgICAgIGNhdGVnb3J5OiBcIlBSSUNJTkdfREVDRVBUSU9OXCIsXG4gICAgICAgICAgcGF0dGVyblR5cGU6IFwiU3RyaWtldGhyb3VnaFByaWNlXCIsXG4gICAgICAgICAgc2V2ZXJpdHk6IFwiTUVESVVNXCIsXG4gICAgICAgICAgbGFiZWw6IFwiUHJpY2luZyBjdWVcIixcbiAgICAgICAgfSxcbiAgICAgICAgcGFnZVR5cGUsXG4gICAgICAgIHNlZW4sXG4gICAgICApO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBjb2xsZWN0U3RpY2t5SGlnaGxpZ2h0cyhcbiAgcGFnZVR5cGU6IFBhZ2VUeXBlLFxuICBzZWVuOiBNYXA8RWxlbWVudCwgUGFnZUhpZ2hsaWdodD4sXG4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiKlwiKSkge1xuICAgIGNvbnN0IHN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbWVudCk7XG4gICAgaWYgKHN0eWxlLnBvc2l0aW9uICE9PSBcImZpeGVkXCIgJiYgc3R5bGUucG9zaXRpb24gIT09IFwic3RpY2t5XCIpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChpc05lc3RlZFN0aWNreUVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHRleHQgPSBlbGVtZW50LmlubmVyVGV4dCA/PyBcIlwiO1xuICAgIGlmICh0ZXh0Lmxlbmd0aCA+IDUwMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgY29tYmluZWQgPSBgJHt0ZXh0fVxcbiR7ZWxlbWVudC5vdXRlckhUTUx9YDtcbiAgICBjb25zdCB1cmdlbmN5ID0gZmlyc3RNYXRjaGluZ1BhdHRlcm4oY29tYmluZWQsIFVSR0VOQ1lfUEFUVEVSTlMpO1xuICAgIGNvbnN0IHNjYXJjaXR5ID0gZmlyc3RNYXRjaGluZ1BhdHRlcm4oY29tYmluZWQsIFNDQVJDSVRZX1BBVFRFUk5TKTtcblxuICAgIGlmICh1cmdlbmN5KSB7XG4gICAgICBhZGRDYW5kaWRhdGUoXG4gICAgICAgIGVsZW1lbnQsXG4gICAgICAgIHtcbiAgICAgICAgICBjYXRlZ29yeTogXCJVUkdFTkNZXCIsXG4gICAgICAgICAgcGF0dGVyblR5cGU6IC9jb3VudGRvd258dGltZXJ8ZW5kcyBpbiBcXGQrL2kudGVzdChjb21iaW5lZClcbiAgICAgICAgICAgID8gXCJDb3VudGRvd25UaW1lclwiXG4gICAgICAgICAgICA6IFwiTGltaXRlZFRpbWVNZXNzYWdlXCIsXG4gICAgICAgICAgc2V2ZXJpdHk6IC9jb3VudGRvd258dGltZXJ8ZW5kcyBpbiBcXGQrL2kudGVzdChjb21iaW5lZClcbiAgICAgICAgICAgID8gXCJISUdIXCJcbiAgICAgICAgICAgIDogXCJNRURJVU1cIixcbiAgICAgICAgICBsYWJlbDogXCJVcmdlbmN5IGJhbm5lclwiLFxuICAgICAgICB9LFxuICAgICAgICBwYWdlVHlwZSxcbiAgICAgICAgc2VlbixcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoc2NhcmNpdHkpIHtcbiAgICAgIGFkZENhbmRpZGF0ZShcbiAgICAgICAgZWxlbWVudCxcbiAgICAgICAge1xuICAgICAgICAgIGNhdGVnb3J5OiBcIlNDQVJDSVRZXCIsXG4gICAgICAgICAgcGF0dGVyblR5cGU6IC9vbmx5IFxcZCsgbGVmdHxsb3cgc3RvY2t8YWxtb3N0IHNvbGQgb3V0L2kudGVzdCh0ZXh0KVxuICAgICAgICAgICAgPyBcIkxvd1N0b2NrTWVzc2FnZVwiXG4gICAgICAgICAgICA6IFwiSGlnaERlbWFuZE1lc3NhZ2VcIixcbiAgICAgICAgICBzZXZlcml0eTogXCJNRURJVU1cIixcbiAgICAgICAgICBsYWJlbDogXCJTY2FyY2l0eSBiYW5uZXJcIixcbiAgICAgICAgfSxcbiAgICAgICAgcGFnZVR5cGUsXG4gICAgICAgIHNlZW4sXG4gICAgICApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgL2NsYXNzPVwiW15cIl0qKG1vZGFsfHBvcHVwfG92ZXJsYXl8c3RpY2t5LWJhbm5lcilbXlwiXSpcIi9pLnRlc3QoXG4gICAgICAgIGVsZW1lbnQub3V0ZXJIVE1MLFxuICAgICAgKVxuICAgICkge1xuICAgICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB7XG4gICAgICAgICAgY2F0ZWdvcnk6IFwiT0JTVFJVQ1RJT05cIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogXCJTdGlja3lQcmVzc3VyZUJhbm5lclwiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlN0aWNreSBvdmVybGF5XCIsXG4gICAgICAgIH0sXG4gICAgICAgIHBhZ2VUeXBlLFxuICAgICAgICBzZWVuLFxuICAgICAgKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gY29sbGVjdFRleHRIaWdobGlnaHRzKFxuICBwYWdlVHlwZTogUGFnZVR5cGUsXG4gIHNlZW46IE1hcDxFbGVtZW50LCBQYWdlSGlnaGxpZ2h0Pixcbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXG4gICAgSU5URVJBQ1RJVkVfU0VMRUNUT1JTLFxuICApKSB7XG4gICAgY29uc3QgdGV4dCA9IGVsZW1lbnQuaW5uZXJUZXh0ID8/IFwiXCI7XG4gICAgaWYgKHRleHQubGVuZ3RoIDwgNCB8fCB0ZXh0Lmxlbmd0aCA+IDQwMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgaHRtbCA9IGVsZW1lbnQub3V0ZXJIVE1MO1xuICAgIGNvbnN0IGNvbWJpbmVkID0gYCR7dGV4dH1cXG4ke2h0bWx9YDtcblxuICAgIGNvbnN0IHVyZ2VuY3kgPSBmaXJzdE1hdGNoaW5nUGF0dGVybihjb21iaW5lZCwgVVJHRU5DWV9QQVRURVJOUyk7XG4gICAgaWYgKHVyZ2VuY3kpIHtcbiAgICAgIGFkZENhbmRpZGF0ZShcbiAgICAgICAgZWxlbWVudCxcbiAgICAgICAge1xuICAgICAgICAgIGNhdGVnb3J5OiBcIlVSR0VOQ1lcIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogL2NvdW50ZG93bnx0aW1lcnxlbmRzIGluIFxcZCsvaS50ZXN0KGNvbWJpbmVkKVxuICAgICAgICAgICAgPyBcIkNvdW50ZG93blRpbWVyXCJcbiAgICAgICAgICAgIDogXCJMaW1pdGVkVGltZU1lc3NhZ2VcIixcbiAgICAgICAgICBzZXZlcml0eTogL2NvdW50ZG93bnx0aW1lcnxlbmRzIGluIFxcZCsvaS50ZXN0KGNvbWJpbmVkKVxuICAgICAgICAgICAgPyBcIkhJR0hcIlxuICAgICAgICAgICAgOiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlVyZ2VuY3kgY3VlXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHBhZ2VUeXBlLFxuICAgICAgICBzZWVuLFxuICAgICAgKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHNjYXJjaXR5ID0gZmlyc3RNYXRjaGluZ1BhdHRlcm4odGV4dCwgU0NBUkNJVFlfUEFUVEVSTlMpO1xuICAgIGlmIChzY2FyY2l0eSkge1xuICAgICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB7XG4gICAgICAgICAgY2F0ZWdvcnk6IFwiU0NBUkNJVFlcIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogL29ubHkgXFxkKyBsZWZ0fGxvdyBzdG9ja3xhbG1vc3Qgc29sZCBvdXQvaS50ZXN0KHRleHQpXG4gICAgICAgICAgICA/IFwiTG93U3RvY2tNZXNzYWdlXCJcbiAgICAgICAgICAgIDogXCJIaWdoRGVtYW5kTWVzc2FnZVwiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlNjYXJjaXR5IGN1ZVwiLFxuICAgICAgICB9LFxuICAgICAgICBwYWdlVHlwZSxcbiAgICAgICAgc2VlbixcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBzb2NpYWwgPSBmaXJzdE1hdGNoaW5nUGF0dGVybih0ZXh0LCBTT0NJQUxfUFJPT0ZfUEFUVEVSTlMpO1xuICAgIGlmIChzb2NpYWwpIHtcbiAgICAgIGFkZENhbmRpZGF0ZShcbiAgICAgICAgZWxlbWVudCxcbiAgICAgICAge1xuICAgICAgICAgIGNhdGVnb3J5OiBcIlNPQ0lBTF9QUk9PRlwiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIkxpdmVBY3Rpdml0eU1lc3NhZ2VcIixcbiAgICAgICAgICBzZXZlcml0eTogXCJNRURJVU1cIixcbiAgICAgICAgICBsYWJlbDogXCJTb2NpYWwgcHJvb2YgY3VlXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHBhZ2VUeXBlLFxuICAgICAgICBzZWVuLFxuICAgICAgKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHNoYW1pbmcgPSBmaXJzdE1hdGNoaW5nUGF0dGVybih0ZXh0LCBDT05GSVJNU0hBTUlOR19QQVRURVJOUyk7XG4gICAgaWYgKHNoYW1pbmcpIHtcbiAgICAgIGFkZENhbmRpZGF0ZShcbiAgICAgICAgZWxlbWVudCxcbiAgICAgICAge1xuICAgICAgICAgIGNhdGVnb3J5OiBcIkZPUkNFRF9BQ1RJT05cIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogXCJDb25maXJtc2hhbWluZ1wiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlByZXNzdXJlIHdvcmRpbmdcIixcbiAgICAgICAgfSxcbiAgICAgICAgcGFnZVR5cGUsXG4gICAgICAgIHNlZW4sXG4gICAgICApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgcHJpY2luZyA9IGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKGNvbWJpbmVkLCBQUklDSU5HX1BBVFRFUk5TKTtcbiAgICBpZiAocHJpY2luZykge1xuICAgICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB7XG4gICAgICAgICAgY2F0ZWdvcnk6IFwiUFJJQ0lOR19ERUNFUFRJT05cIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogXCJNaXNsZWFkaW5nUHJpY2VcIixcbiAgICAgICAgICBzZXZlcml0eTogXCJNRURJVU1cIixcbiAgICAgICAgICBsYWJlbDogXCJQcmljaW5nIGN1ZVwiLFxuICAgICAgICB9LFxuICAgICAgICBwYWdlVHlwZSxcbiAgICAgICAgc2VlbixcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBuYWdnaW5nID0gZmlyc3RNYXRjaGluZ1BhdHRlcm4odGV4dCwgTkFHR0lOR19QQVRURVJOUyk7XG4gICAgaWYgKG5hZ2dpbmcpIHtcbiAgICAgIGFkZENhbmRpZGF0ZShcbiAgICAgICAgZWxlbWVudCxcbiAgICAgICAge1xuICAgICAgICAgIGNhdGVnb3J5OiBcIk5BR0dJTkdcIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogXCJSZXBlYXRlZFByb21wdFwiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlJlcGVhdGVkIHByb21wdFwiLFxuICAgICAgICB9LFxuICAgICAgICBwYWdlVHlwZSxcbiAgICAgICAgc2VlbixcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBzbmVha2luZyA9IGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKGNvbWJpbmVkLCBTTkVBS0lOR19QQVRURVJOUyk7XG4gICAgaWYgKHNuZWFraW5nKSB7XG4gICAgICBhZGRDYW5kaWRhdGUoXG4gICAgICAgIGVsZW1lbnQsXG4gICAgICAgIHtcbiAgICAgICAgICBjYXRlZ29yeTogXCJTTkVBS0lOR1wiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIkhpZGRlbkNvc3RcIixcbiAgICAgICAgICBzZXZlcml0eTogXCJNRURJVU1cIixcbiAgICAgICAgICBsYWJlbDogXCJIaWRkZW4gY29zdCBjdWVcIixcbiAgICAgICAgfSxcbiAgICAgICAgcGFnZVR5cGUsXG4gICAgICAgIHNlZW4sXG4gICAgICApO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBsYWJlbEZvckRldGVjdGlvbihkZXRlY3Rpb246IEhpZ2hsaWdodERldGVjdGlvbik6IHN0cmluZyB7XG4gIHN3aXRjaCAoZGV0ZWN0aW9uLmNhdGVnb3J5KSB7XG4gICAgY2FzZSBcIlVSR0VOQ1lcIjpcbiAgICAgIHJldHVybiAvY291bnRkb3dufHRpbWVyL2kudGVzdChkZXRlY3Rpb24ucGF0dGVyblR5cGUpXG4gICAgICAgID8gXCJDb3VudGRvd24gdGltZXJcIlxuICAgICAgICA6IFwiVXJnZW5jeSBjdWVcIjtcbiAgICBjYXNlIFwiU0NBUkNJVFlcIjpcbiAgICAgIHJldHVybiBcIlNjYXJjaXR5IGN1ZVwiO1xuICAgIGNhc2UgXCJTT0NJQUxfUFJPT0ZcIjpcbiAgICAgIHJldHVybiBcIlNvY2lhbCBwcm9vZiBjdWVcIjtcbiAgICBjYXNlIFwiUFJFU0VMRUNUSU9OXCI6XG4gICAgICByZXR1cm4gXCJQcmUtc2VsZWN0ZWQgb3B0aW9uXCI7XG4gICAgY2FzZSBcIk9CU1RSVUNUSU9OXCI6XG4gICAgICByZXR1cm4gXCJTdGlja3kgb3ZlcmxheVwiO1xuICAgIGNhc2UgXCJGT1JDRURfQUNUSU9OXCI6XG4gICAgICByZXR1cm4gXCJQcmVzc3VyZSB3b3JkaW5nXCI7XG4gICAgY2FzZSBcIlBSSUNJTkdfREVDRVBUSU9OXCI6XG4gICAgICByZXR1cm4gXCJQcmljaW5nIGN1ZVwiO1xuICAgIGNhc2UgXCJOQUdHSU5HXCI6XG4gICAgICByZXR1cm4gXCJSZXBlYXRlZCBwcm9tcHRcIjtcbiAgICBjYXNlIFwiTUlTRElSRUNUSU9OXCI6XG4gICAgICByZXR1cm4gXCJNaXNkaXJlY3Rpb24gY3VlXCI7XG4gICAgY2FzZSBcIlNORUFLSU5HXCI6XG4gICAgICByZXR1cm4gXCJIaWRkZW4gY29zdCBjdWVcIjtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFwiUHJlc3N1cmUgY3VlXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJpY2luZ0V2aWRlbmNlUGhyYXNlcyhldmlkZW5jZTogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBwaHJhc2VzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgY29uc3QgcXVvdGVkID0gZXZpZGVuY2UubWF0Y2goL1tcIuKAnF0oLis/KVtcIuKAnV0vKT8uWzFdO1xuICBpZiAocXVvdGVkICYmIHF1b3RlZC50cmltKCkubGVuZ3RoID49IDMpIHtcbiAgICBwaHJhc2VzLmFkZChxdW90ZWQudHJpbSgpKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgbWF0Y2ggb2YgZXZpZGVuY2UubWF0Y2hBbGwoLyg/OlNcXCR8XFwkfMKjfOKCrClcXHM/W1xcZCwuXSsvZykpIHtcbiAgICBwaHJhc2VzLmFkZChtYXRjaFswXS5yZXBsYWNlKC9cXHMvZywgXCJcIikpO1xuICAgIHBocmFzZXMuYWRkKG1hdGNoWzBdLnRyaW0oKSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IG1hdGNoIG9mIGV2aWRlbmNlLm1hdGNoQWxsKC9bXFxkLC5dK1xccyooPzolIG9mZnwlKS9naSkpIHtcbiAgICBwaHJhc2VzLmFkZChtYXRjaFswXS50cmltKCkpO1xuICB9XG5cbiAgZm9yIChjb25zdCBtYXRjaCBvZiBldmlkZW5jZS5tYXRjaEFsbCgvc2F2ZVxccytcXGQrXFxzKiUvZ2kpKSB7XG4gICAgcGhyYXNlcy5hZGQobWF0Y2hbMF0udHJpbSgpKTtcbiAgfVxuXG4gIHJldHVybiBbLi4ucGhyYXNlc10uZmlsdGVyKChwaHJhc2UpID0+IHBocmFzZS5sZW5ndGggPj0gMyk7XG59XG5cbmZ1bmN0aW9uIGZpbmRFbGVtZW50Q29udGFpbmluZ1BocmFzZShwaHJhc2U6IHN0cmluZyk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGNvbnN0IHBocmFzZUxvd2VyID0gcGhyYXNlLnRvTG93ZXJDYXNlKCk7XG4gIGxldCBiZXN0OiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBsZXQgYmVzdEFyZWEgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG5cbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFxuICAgIFwicCwgc3BhbiwgZGl2LCBidXR0b24sIGEsIGxhYmVsLCBsaSwgaDEsIGgyLCBoMywgaDQsIHRkLCBzdHJvbmcsIGVtLCBzbWFsbCwgZGVsLCBzXCIsXG4gICkpIHtcbiAgICBpZiAoIWlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHRleHQgPSAoZWxlbWVudC5pbm5lclRleHQgPz8gXCJcIikudHJpbSgpO1xuICAgIGlmICh0ZXh0Lmxlbmd0aCA9PT0gMCB8fCB0ZXh0Lmxlbmd0aCA+IDUwMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICghdGV4dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHBocmFzZUxvd2VyKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgcmVjdCA9IGVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgY29uc3QgYXJlYSA9IHJlY3Qud2lkdGggKiByZWN0LmhlaWdodDtcbiAgICBpZiAoYXJlYSA+IDAgJiYgYXJlYSA8IGJlc3RBcmVhKSB7XG4gICAgICBiZXN0ID0gZWxlbWVudDtcbiAgICAgIGJlc3RBcmVhID0gYXJlYTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYmVzdDtcbn1cblxuZnVuY3Rpb24gZmluZFN0cnVjdHVyYWxQcmljaW5nRWxlbWVudCgpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCJkZWwsIHNcIikpIHtcbiAgICBpZiAoIWlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCB0ZXh0ID0gZWxlbWVudC50ZXh0Q29udGVudCA/PyBcIlwiO1xuICAgIGlmIChoYXNDdXJyZW5jeVRleHQodGV4dCkgfHwgL1tcXGQsLl0rLy50ZXN0KHRleHQpKSB7XG4gICAgICByZXR1cm4gcHJpY2luZ0NvbnRhaW5lckZvcihlbGVtZW50KTtcbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXG4gICAgUFJJQ0VfQ09OVEFJTkVSX1NFTEVDVE9SUyxcbiAgKSkge1xuICAgIGlmICghaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgdGV4dCA9IChlbGVtZW50LmlubmVyVGV4dCA/PyBcIlwiKS50cmltKCk7XG4gICAgaWYgKHRleHQubGVuZ3RoIDwgMykge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgaGFzU3RyaWtlID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiZGVsLCBzXCIpICE9PSBudWxsO1xuICAgIGlmIChoYXNTdHJpa2UgfHwgZmlyc3RNYXRjaGluZ1BhdHRlcm4oYCR7dGV4dH1cXG4ke2VsZW1lbnQub3V0ZXJIVE1MfWAsIFBSSUNJTkdfUEFUVEVSTlMpKSB7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZmluZEVsZW1lbnRCeVByaWNpbmdFdmlkZW5jZShldmlkZW5jZTogc3RyaW5nKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgZm9yIChjb25zdCBwaHJhc2Ugb2YgcHJpY2luZ0V2aWRlbmNlUGhyYXNlcyhldmlkZW5jZSkpIHtcbiAgICBjb25zdCBlbGVtZW50ID0gZmluZEVsZW1lbnRDb250YWluaW5nUGhyYXNlKHBocmFzZSk7XG4gICAgaWYgKGVsZW1lbnQpIHtcbiAgICAgIHJldHVybiBwcmljaW5nQ29udGFpbmVyRm9yKGVsZW1lbnQpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmaW5kU3RydWN0dXJhbFByaWNpbmdFbGVtZW50KCk7XG59XG5cbmZ1bmN0aW9uIHNjYXJjaXR5RXZpZGVuY2VQaHJhc2VzKGV2aWRlbmNlOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHBocmFzZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBjb25zdCBxdW90ZWQgPSBldmlkZW5jZS5tYXRjaCgvW1wi4oCcJ10oLis/KVtcIuKAnSddLyk/LlsxXTtcbiAgaWYgKHF1b3RlZD8udHJpbSgpKSB7XG4gICAgY29uc3QgdHJpbW1lZCA9IHF1b3RlZC50cmltKCk7XG4gICAgcGhyYXNlcy5hZGQodHJpbW1lZCk7XG4gICAgZm9yIChjb25zdCBzZWdtZW50IG9mIHRyaW1tZWQuc3BsaXQoXCJ8XCIpKSB7XG4gICAgICBjb25zdCBwYXJ0ID0gc2VnbWVudC50cmltKCk7XG4gICAgICBpZiAocGFydC5sZW5ndGggPj0gMykge1xuICAgICAgICBwaHJhc2VzLmFkZChwYXJ0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IG1hdGNoIG9mIGV2aWRlbmNlLm1hdGNoQWxsKFxuICAgIC9cXGIoaW4gc3RvY2t8bG93IHN0b2NrfG9ubHkgXFxkKyBsZWZ0fG9ubHkgXFxkKyByZW1haW5pbmd8YWxtb3N0IHNvbGQgb3V0fHNlbGxpbmcgZmFzdHxoaWdoIGRlbWFuZHxsaW1pdGVkIHF1YW50aXR5fGZldyBsZWZ0KVxcYi9naSxcbiAgKSkge1xuICAgIHBocmFzZXMuYWRkKG1hdGNoWzBdLnRyaW0oKSk7XG4gIH1cblxuICByZXR1cm4gWy4uLnBocmFzZXNdLmZpbHRlcigocGhyYXNlKSA9PiBwaHJhc2UubGVuZ3RoID49IDMpO1xufVxuXG5mdW5jdGlvbiBmaW5kU3RydWN0dXJhbFNjYXJjaXR5RWxlbWVudCgpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXG4gICAgXCJwLCBzcGFuLCBkaXYsIGJ1dHRvbiwgYSwgbGFiZWwsIGxpLCBzdHJvbmcsIGVtLCBzbWFsbFwiLFxuICApKSB7XG4gICAgaWYgKCFpc1Zpc2libGVIaWdobGlnaHRFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0ZXh0ID0gKGVsZW1lbnQuaW5uZXJUZXh0ID8/IFwiXCIpLnRyaW0oKTtcbiAgICBpZiAodGV4dC5sZW5ndGggPCAzIHx8IHRleHQubGVuZ3RoID4gMjAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoZmlyc3RNYXRjaGluZ1BhdHRlcm4odGV4dCwgU0NBUkNJVFlfUEFUVEVSTlMpKSB7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZmluZEVsZW1lbnRCeVNjYXJjaXR5RXZpZGVuY2UoZXZpZGVuY2U6IHN0cmluZyk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGZvciAoY29uc3QgcGhyYXNlIG9mIHNjYXJjaXR5RXZpZGVuY2VQaHJhc2VzKGV2aWRlbmNlKSkge1xuICAgIGNvbnN0IGVsZW1lbnQgPSBmaW5kRWxlbWVudENvbnRhaW5pbmdQaHJhc2UocGhyYXNlKTtcbiAgICBpZiAoZWxlbWVudCkge1xuICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZpbmRTdHJ1Y3R1cmFsU2NhcmNpdHlFbGVtZW50KCk7XG59XG5cbmZ1bmN0aW9uIGV2aWRlbmNlUGhyYXNlcyhldmlkZW5jZTogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBwaHJhc2VzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgY29uc3QgcXVvdGVkID0gZXZpZGVuY2UubWF0Y2goL1tcIuKAnCddKC4rPylbXCLigJ0nXS8pPy5bMV07XG4gIGlmIChxdW90ZWQ/LnRyaW0oKSkge1xuICAgIGNvbnN0IHRyaW1tZWQgPSBxdW90ZWQudHJpbSgpO1xuICAgIHBocmFzZXMuYWRkKHRyaW1tZWQpO1xuICAgIGZvciAoY29uc3Qgc2VnbWVudCBvZiB0cmltbWVkLnNwbGl0KFwifFwiKSkge1xuICAgICAgY29uc3QgcGFydCA9IHNlZ21lbnQudHJpbSgpO1xuICAgICAgaWYgKHBhcnQubGVuZ3RoID49IDMpIHtcbiAgICAgICAgcGhyYXNlcy5hZGQocGFydCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZmFsbGJhY2sgPSBldmlkZW5jZVNlYXJjaFBocmFzZShldmlkZW5jZSk7XG4gIGlmIChmYWxsYmFjaykge1xuICAgIHBocmFzZXMuYWRkKGZhbGxiYWNrKTtcbiAgfVxuXG4gIHJldHVybiBbLi4ucGhyYXNlc10uZmlsdGVyKChwaHJhc2UpID0+IHBocmFzZS5sZW5ndGggPj0gMyk7XG59XG5cbmZ1bmN0aW9uIGV2aWRlbmNlU2VhcmNoUGhyYXNlKGV2aWRlbmNlOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgcXVvdGVkID0gZXZpZGVuY2UubWF0Y2goL1tcIuKAnCddKC4rPylbXCLigJ0nXS8pPy5bMV07XG4gIGlmIChxdW90ZWQgJiYgcXVvdGVkLnRyaW0oKS5sZW5ndGggPj0gNCkge1xuICAgIHJldHVybiBxdW90ZWQudHJpbSgpO1xuICB9XG5cbiAgY29uc3QgY2xlYW5lZCA9IGV2aWRlbmNlLnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnRyaW0oKTtcbiAgaWYgKGNsZWFuZWQubGVuZ3RoIDwgNCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIGNsZWFuZWQuc2xpY2UoMCwgTWF0aC5taW4oODAsIGNsZWFuZWQubGVuZ3RoKSk7XG59XG5cbmZ1bmN0aW9uIGZpbmRFbGVtZW50QnlFdmlkZW5jZShldmlkZW5jZTogc3RyaW5nKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgZm9yIChjb25zdCBwaHJhc2Ugb2YgZXZpZGVuY2VQaHJhc2VzKGV2aWRlbmNlKSkge1xuICAgIGNvbnN0IGVsZW1lbnQgPSBmaW5kRWxlbWVudENvbnRhaW5pbmdQaHJhc2UocGhyYXNlKTtcbiAgICBpZiAoZWxlbWVudCkge1xuICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGZpbmRFbGVtZW50Rm9yRGV0ZWN0aW9uKFxuICBkZXRlY3Rpb246IEhpZ2hsaWdodERldGVjdGlvbixcbik6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGlmIChkZXRlY3Rpb24uY2F0ZWdvcnkgPT09IFwiUFJJQ0lOR19ERUNFUFRJT05cIikge1xuICAgIHJldHVybiBmaW5kRWxlbWVudEJ5UHJpY2luZ0V2aWRlbmNlKGRldGVjdGlvbi5ldmlkZW5jZSk7XG4gIH1cblxuICBpZiAoZGV0ZWN0aW9uLmNhdGVnb3J5ID09PSBcIlNDQVJDSVRZXCIpIHtcbiAgICByZXR1cm4gZmluZEVsZW1lbnRCeVNjYXJjaXR5RXZpZGVuY2UoZGV0ZWN0aW9uLmV2aWRlbmNlKTtcbiAgfVxuXG4gIHJldHVybiBmaW5kRWxlbWVudEJ5RXZpZGVuY2UoZGV0ZWN0aW9uLmV2aWRlbmNlKTtcbn1cblxuZnVuY3Rpb24gZmluYWxpemVIaWdobGlnaHRzKHNlZW46IE1hcDxFbGVtZW50LCBQYWdlSGlnaGxpZ2h0Pik6IFBhZ2VIaWdobGlnaHRbXSB7XG4gIGNvbnN0IHZpc2libGUgPSBBcnJheS5mcm9tKHNlZW4udmFsdWVzKCkpXG4gICAgLmZpbHRlcigoaGlnaGxpZ2h0KSA9PiB7XG4gICAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgICAgYFske0hJR0hMSUdIVF9JRF9BVFRSfT1cIiR7aGlnaGxpZ2h0LmlkfVwiXWAsXG4gICAgICApO1xuICAgICAgcmV0dXJuIGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCAmJiBpc1Zpc2libGVIaWdobGlnaHRFbGVtZW50KGVsZW1lbnQpO1xuICAgIH0pXG4gICAgLnNvcnQoKGEsIGIpID0+IHNldmVyaXR5UmFuayhiLnNldmVyaXR5KSAtIHNldmVyaXR5UmFuayhhLnNldmVyaXR5KSk7XG5cbiAgY29uc3QgY291bnRkb3ducyA9IHZpc2libGUuZmlsdGVyKFxuICAgIChoaWdobGlnaHQpID0+IGhpZ2hsaWdodC5wYXR0ZXJuVHlwZSA9PT0gXCJDb3VudGRvd25UaW1lclwiLFxuICApO1xuICBjb25zdCByZXN0ID0gdmlzaWJsZS5maWx0ZXIoXG4gICAgKGhpZ2hsaWdodCkgPT4gaGlnaGxpZ2h0LnBhdHRlcm5UeXBlICE9PSBcIkNvdW50ZG93blRpbWVyXCIsXG4gICk7XG5cbiAgcmV0dXJuIFsuLi5jb3VudGRvd25zLCAuLi5yZXN0XS5zbGljZSgwLCBNQVhfSElHSExJR0hUUyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbnJpY2hIaWdobGlnaHRzRnJvbURldGVjdGlvbnMoXG4gIGV4aXN0aW5nOiBQYWdlSGlnaGxpZ2h0W10sXG4gIGRldGVjdGlvbnM6IEhpZ2hsaWdodERldGVjdGlvbltdLFxuICBwYWdlVHlwZTogUGFnZVR5cGUsXG4pOiBQYWdlSGlnaGxpZ2h0W10ge1xuICBjb25zdCBzZWVuID0gbmV3IE1hcDxFbGVtZW50LCBQYWdlSGlnaGxpZ2h0PigpO1xuXG4gIGZvciAoY29uc3QgaGlnaGxpZ2h0IG9mIGV4aXN0aW5nKSB7XG4gICAgY29uc3QgZWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXG4gICAgICBgWyR7SElHSExJR0hUX0lEX0FUVFJ9PVwiJHtoaWdobGlnaHQuaWR9XCJdYCxcbiAgICApO1xuICAgIGlmIChlbGVtZW50IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICAgIHNlZW4uc2V0KGVsZW1lbnQsIGhpZ2hsaWdodCk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgcHJpY2luZ0RldGVjdGlvbnMgPSBkZXRlY3Rpb25zLmZpbHRlcihcbiAgICAoZGV0ZWN0aW9uKSA9PiBkZXRlY3Rpb24uY2F0ZWdvcnkgPT09IFwiUFJJQ0lOR19ERUNFUFRJT05cIixcbiAgKTtcbiAgY29uc3Qgb3RoZXJEZXRlY3Rpb25zID0gZGV0ZWN0aW9ucy5maWx0ZXIoXG4gICAgKGRldGVjdGlvbikgPT4gZGV0ZWN0aW9uLmNhdGVnb3J5ICE9PSBcIlBSSUNJTkdfREVDRVBUSU9OXCIsXG4gICk7XG5cbiAgZm9yIChjb25zdCBkZXRlY3Rpb24gb2YgWy4uLnByaWNpbmdEZXRlY3Rpb25zLCAuLi5vdGhlckRldGVjdGlvbnNdKSB7XG4gICAgaWYgKFxuICAgICAgZXhpc3Rpbmcuc29tZShcbiAgICAgICAgKGhpZ2hsaWdodCkgPT5cbiAgICAgICAgICBoaWdobGlnaHQuY2F0ZWdvcnkgPT09IGRldGVjdGlvbi5jYXRlZ29yeSAmJlxuICAgICAgICAgIGhpZ2hsaWdodC5wYXR0ZXJuVHlwZSA9PT0gZGV0ZWN0aW9uLnBhdHRlcm5UeXBlLFxuICAgICAgKVxuICAgICkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgZWxlbWVudCA9IGZpbmRFbGVtZW50Rm9yRGV0ZWN0aW9uKGRldGVjdGlvbik7XG4gICAgaWYgKCFlbGVtZW50KSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBhZGRDYW5kaWRhdGUoXG4gICAgICBlbGVtZW50LFxuICAgICAge1xuICAgICAgICBjYXRlZ29yeTogZGV0ZWN0aW9uLmNhdGVnb3J5IGFzIERldGVjdGlvbkNhdGVnb3J5LFxuICAgICAgICBwYXR0ZXJuVHlwZTogZGV0ZWN0aW9uLnBhdHRlcm5UeXBlLFxuICAgICAgICBzZXZlcml0eTogZGV0ZWN0aW9uLnNldmVyaXR5LFxuICAgICAgICBsYWJlbDogbGFiZWxGb3JEZXRlY3Rpb24oZGV0ZWN0aW9uKSxcbiAgICAgIH0sXG4gICAgICBwYWdlVHlwZSxcbiAgICAgIHNlZW4sXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBmaW5hbGl6ZUhpZ2hsaWdodHMoc2Vlbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb2xsZWN0UGFnZUhpZ2hsaWdodHMocGFnZVR5cGU6IFBhZ2VUeXBlKTogUGFnZUhpZ2hsaWdodFtdIHtcbiAgY29uc3Qgc2VlbiA9IG5ldyBNYXA8RWxlbWVudCwgUGFnZUhpZ2hsaWdodD4oKTtcblxuICBjb2xsZWN0Q291bnRkb3duSGlnaGxpZ2h0cyhwYWdlVHlwZSwgc2Vlbik7XG4gIGNvbGxlY3RQcmVzZWxlY3Rpb25IaWdobGlnaHRzKHBhZ2VUeXBlLCBzZWVuKTtcbiAgY29sbGVjdFByaWNpbmdIaWdobGlnaHRzKHBhZ2VUeXBlLCBzZWVuKTtcbiAgY29sbGVjdFRleHRIaWdobGlnaHRzKHBhZ2VUeXBlLCBzZWVuKTtcbiAgY29sbGVjdFN0aWNreUhpZ2hsaWdodHMocGFnZVR5cGUsIHNlZW4pO1xuXG4gIHJldHVybiBmaW5hbGl6ZUhpZ2hsaWdodHMoc2Vlbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGVhckhpZ2hsaWdodE1hcmtlcnMoKTogdm9pZCB7XG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKGBbJHtISUdITElHSFRfSURfQVRUUn1dYCkpIHtcbiAgICBlbGVtZW50LnJlbW92ZUF0dHJpYnV0ZShISUdITElHSFRfSURfQVRUUik7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsZWFySGlnaGxpZ2h0Qm94ZXMoKTogdm9pZCB7XG4gIGZvciAoY29uc3QgYm94IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoYFske0hJR0hMSUdIVF9CT1hfQVRUUn1dYCkpIHtcbiAgICBib3gucmVtb3ZlKCk7XG4gIH1cbn1cbiIsImltcG9ydCB7IGRldGVjdFBhZ2VUeXBlIH0gZnJvbSBcIkBkYXJrcGF0dGVybnMvc2hhcmVkL3BhZ2UtY29udGV4dFwiO1xuaW1wb3J0IHR5cGUgeyBQYWdlSGlnaGxpZ2h0LCBQYWdlVHlwZSB9IGZyb20gXCJAZGFya3BhdHRlcm5zL3NoYXJlZC90eXBlc1wiO1xuaW1wb3J0IHsgY29sbGVjdFBhZ2VIaWdobGlnaHRzIH0gZnJvbSBcIi4vaGlnaGxpZ2h0c1wiO1xuXG5jb25zdCBJTlRFUkFDVElWRV9TRUxFQ1RPUlMgPSBbXG4gIFwiaW5wdXRcIixcbiAgXCJidXR0b25cIixcbiAgXCJhXCIsXG4gICdbcm9sZT1cImRpYWxvZ1wiXScsXG4gICdbY2xhc3MqPVwibW9kYWxcIl0nLFxuICAnW2NsYXNzKj1cInBvcHVwXCJdJyxcbiAgJ1tjbGFzcyo9XCJvdmVybGF5XCJdJyxcbiAgJ1tjbGFzcyo9XCJjb3VudGRvd25cIl0nLFxuICAnW2NsYXNzKj1cInRpbWVyXCJdJyxcbiAgJ1tjbGFzcyo9XCJzdGlja3lcIl0nLFxuICAnW3N0eWxlKj1cInBvc2l0aW9uOiBmaXhlZFwiXScsXG4gICdbc3R5bGUqPVwicG9zaXRpb246Zml4ZWRcIl0nLFxuXS5qb2luKFwiLFwiKTtcblxuY29uc3QgTUFYX1RFWFRfTEVOR1RIID0gMTJfMDAwO1xuY29uc3QgTUFYX0hUTUxfTEVOR1RIID0gMTJfMDAwO1xuXG5leHBvcnQgdHlwZSBFeHRyYWN0ZWRQYWdlID0ge1xuICB1cmw6IHN0cmluZztcbiAgcGFnZVRpdGxlOiBzdHJpbmc7XG4gIHZpc2libGVUZXh0OiBzdHJpbmc7XG4gIGludGVyYWN0aXZlSHRtbDogc3RyaW5nO1xuICBwYWdlVHlwZTogUGFnZVR5cGU7XG4gIGhpZ2hsaWdodHM6IFBhZ2VIaWdobGlnaHRbXTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0UGFnZUNvbnRlbnQoKTogRXh0cmFjdGVkUGFnZSB7XG4gIGNvbnN0IHBhZ2VUeXBlID0gZGV0ZWN0UGFnZVR5cGUoZG9jdW1lbnQpO1xuICBjb25zdCB2aXNpYmxlVGV4dCA9IChkb2N1bWVudC5ib2R5Py5pbm5lclRleHQgPz8gXCJcIikuc2xpY2UoXG4gICAgMCxcbiAgICBNQVhfVEVYVF9MRU5HVEgsXG4gICk7XG4gIGNvbnN0IGludGVyYWN0aXZlSHRtbCA9IGJ1aWxkSW50ZXJhY3RpdmVIdG1sKCk7XG4gIGNvbnN0IGhpZ2hsaWdodHMgPSBjb2xsZWN0UGFnZUhpZ2hsaWdodHMocGFnZVR5cGUpO1xuICByZXR1cm4ge1xuICAgIHVybDogd2luZG93LmxvY2F0aW9uLmhyZWYsXG4gICAgcGFnZVRpdGxlOiBkb2N1bWVudC50aXRsZS5zbGljZSgwLCA1MDApLFxuICAgIHZpc2libGVUZXh0LFxuICAgIGludGVyYWN0aXZlSHRtbCxcbiAgICBwYWdlVHlwZSxcbiAgICBoaWdobGlnaHRzLFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZEludGVyYWN0aXZlSHRtbCgpOiBzdHJpbmcge1xuICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcblxuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChJTlRFUkFDVElWRV9TRUxFQ1RPUlMpKSB7XG4gICAgaWYgKHBhcnRzLmpvaW4oXCJcXG5cIikubGVuZ3RoID49IE1BWF9IVE1MX0xFTkdUSCkgYnJlYWs7XG4gICAgY29uc3QgaHRtbCA9IGVsZW1lbnQub3V0ZXJIVE1MLnNsaWNlKDAsIDUwMCk7XG4gICAgcGFydHMucHVzaChodG1sKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIipcIikpIHtcbiAgICBpZiAocGFydHMuam9pbihcIlxcblwiKS5sZW5ndGggPj0gTUFYX0hUTUxfTEVOR1RIKSBicmVhaztcbiAgICBjb25zdCBzdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpO1xuICAgIGlmIChzdHlsZS5wb3NpdGlvbiA9PT0gXCJmaXhlZFwiIHx8IHN0eWxlLnBvc2l0aW9uID09PSBcInN0aWNreVwiKSB7XG4gICAgICBwYXJ0cy5wdXNoKFxuICAgICAgICBgPGRpdiBkYXRhLWRwZC1vdmVybGF5PVwiJHtzdHlsZS5wb3NpdGlvbn1cIj4ke2VsZW1lbnQub3V0ZXJIVE1MLnNsaWNlKDAsIDMwMCl9PC9kaXY+YCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHBhcnRzLmpvaW4oXCJcXG5cIikuc2xpY2UoMCwgTUFYX0hUTUxfTEVOR1RIKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhvb2tTcGFOYXZpZ2F0aW9uKG9uTmF2aWdhdGU6ICgpID0+IHZvaWQpOiAoKSA9PiB2b2lkIHtcbiAgY29uc3Qgb3JpZ2luYWxQdXNoU3RhdGUgPSBoaXN0b3J5LnB1c2hTdGF0ZS5iaW5kKGhpc3RvcnkpO1xuICBjb25zdCBvcmlnaW5hbFJlcGxhY2VTdGF0ZSA9IGhpc3RvcnkucmVwbGFjZVN0YXRlLmJpbmQoaGlzdG9yeSk7XG5cbiAgaGlzdG9yeS5wdXNoU3RhdGUgPSAoLi4uYXJncykgPT4ge1xuICAgIG9yaWdpbmFsUHVzaFN0YXRlKC4uLmFyZ3MpO1xuICAgIG9uTmF2aWdhdGUoKTtcbiAgfTtcblxuICBoaXN0b3J5LnJlcGxhY2VTdGF0ZSA9ICguLi5hcmdzKSA9PiB7XG4gICAgb3JpZ2luYWxSZXBsYWNlU3RhdGUoLi4uYXJncyk7XG4gICAgb25OYXZpZ2F0ZSgpO1xuICB9O1xuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwicG9wc3RhdGVcIiwgb25OYXZpZ2F0ZSk7XG5cbiAgcmV0dXJuICgpID0+IHtcbiAgICBoaXN0b3J5LnB1c2hTdGF0ZSA9IG9yaWdpbmFsUHVzaFN0YXRlO1xuICAgIGhpc3RvcnkucmVwbGFjZVN0YXRlID0gb3JpZ2luYWxSZXBsYWNlU3RhdGU7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJwb3BzdGF0ZVwiLCBvbk5hdmlnYXRlKTtcbiAgfTtcbn1cbiIsImNvbnN0IExPQURfVElNRU9VVF9NUyA9IDE1XzAwMDtcbmNvbnN0IFNFVFRMRV9NUyA9IDJfMDAwO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2FpdEZvclBhZ2VSZWFkeShcbiAgc2V0dGxlTXMgPSBTRVRUTEVfTVMsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgd2FpdEZvckRvY3VtZW50TG9hZChMT0FEX1RJTUVPVVRfTVMpO1xuXG4gIGlmIChzZXR0bGVNcyA+IDApIHtcbiAgICBhd2FpdCBkZWxheShzZXR0bGVNcyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVsYXkobXM6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICB3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCBtcyk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiB3YWl0Rm9yRG9jdW1lbnRMb2FkKHRpbWVvdXRNczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImNvbXBsZXRlXCIpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cblxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICBjb25zdCBmaW5pc2ggPSAoKSA9PiB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgcmVzb2x2ZSgpO1xuICAgIH07XG5cbiAgICBjb25zdCB0aW1lb3V0ID0gd2luZG93LnNldFRpbWVvdXQoZmluaXNoLCB0aW1lb3V0TXMpO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmaW5pc2gsIHsgb25jZTogdHJ1ZSB9KTtcbiAgfSk7XG59XG4iLCJpbXBvcnQgdHlwZSB7IFBhZ2VIaWdobGlnaHQgfSBmcm9tIFwiQGRhcmtwYXR0ZXJucy9zaGFyZWQvdHlwZXNcIjtcbmltcG9ydCB7XG4gIGNsZWFySGlnaGxpZ2h0Qm94ZXMsXG4gIEhJR0hMSUdIVF9CT1hfQVRUUixcbiAgSElHSExJR0hUX0lEX0FUVFIsXG4gIGlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQsXG59IGZyb20gXCIuLi9leHRyYWN0L2hpZ2hsaWdodHNcIjtcblxuY29uc3QgU0VWRVJJVFlfQ09MT1JTOiBSZWNvcmQ8XG4gIFBhZ2VIaWdobGlnaHRbXCJzZXZlcml0eVwiXSxcbiAgeyBib3JkZXI6IHN0cmluZzsgYmFja2dyb3VuZDogc3RyaW5nIH1cbj4gPSB7XG4gIEhJR0g6IHsgYm9yZGVyOiBcIiNEQzI2MjZcIiwgYmFja2dyb3VuZDogXCJyZ2JhKDIyMCwgMzgsIDM4LCAwLjE0KVwiIH0sXG4gIE1FRElVTTogeyBib3JkZXI6IFwiI0Q5NzcwNlwiLCBiYWNrZ3JvdW5kOiBcInJnYmEoMjE3LCAxMTksIDYsIDAuMTQpXCIgfSxcbiAgTE9XOiB7IGJvcmRlcjogXCIjMjU2M0VCXCIsIGJhY2tncm91bmQ6IFwicmdiYSgzNywgOTksIDIzNSwgMC4xMilcIiB9LFxufTtcblxuZXhwb3J0IGNsYXNzIEhpZ2hsaWdodE92ZXJsYXkge1xuICBwcml2YXRlIGhpZ2hsaWdodHM6IFBhZ2VIaWdobGlnaHRbXSA9IFtdO1xuICBwcml2YXRlIHZpc2libGUgPSBmYWxzZTtcbiAgcHJpdmF0ZSBib3VuZFVwZGF0ZTogKCgpID0+IHZvaWQpIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgYWN0aXZlSGlnaGxpZ2h0SWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHJhZklkOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICBzaG93KGhpZ2hsaWdodHM6IFBhZ2VIaWdobGlnaHRbXSk6IHZvaWQge1xuICAgIHRoaXMuaGlnaGxpZ2h0cyA9IGhpZ2hsaWdodHM7XG4gICAgdGhpcy52aXNpYmxlID0gaGlnaGxpZ2h0cy5sZW5ndGggPiAwO1xuICAgIHRoaXMuZW5zdXJlQmluZGluZ3MoKTtcbiAgICB0aGlzLnJlbmRlcigpO1xuICB9XG5cbiAgaGlkZSgpOiB2b2lkIHtcbiAgICB0aGlzLnZpc2libGUgPSBmYWxzZTtcbiAgICB0aGlzLmFjdGl2ZUhpZ2hsaWdodElkID0gbnVsbDtcbiAgICBjbGVhckhpZ2hsaWdodEJveGVzKCk7XG4gICAgaWYgKHRoaXMucmFmSWQgIT09IG51bGwpIHtcbiAgICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRoaXMucmFmSWQpO1xuICAgICAgdGhpcy5yYWZJZCA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgc2Nyb2xsVG9IaWdobGlnaHQoaGlnaGxpZ2h0SWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFxuICAgICAgYFske0hJR0hMSUdIVF9JRF9BVFRSfT1cIiR7aGlnaGxpZ2h0SWR9XCJdYCxcbiAgICApO1xuICAgIGlmICghKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmFjdGl2ZUhpZ2hsaWdodElkID0gaGlnaGxpZ2h0SWQ7XG4gICAgZWxlbWVudC5zY3JvbGxJbnRvVmlldyh7IGJlaGF2aW9yOiBcInNtb290aFwiLCBibG9jazogXCJjZW50ZXJcIiB9KTtcbiAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLnJlbmRlcigpO1xuICAgIH0sIDM1MCk7XG4gIH1cblxuICBwcml2YXRlIGVuc3VyZUJpbmRpbmdzKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmJvdW5kVXBkYXRlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5ib3VuZFVwZGF0ZSA9ICgpID0+IHtcbiAgICAgIGlmICghdGhpcy52aXNpYmxlIHx8IHRoaXMucmFmSWQgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnJhZklkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICAgICAgdGhpcy5yYWZJZCA9IG51bGw7XG4gICAgICAgIHRoaXMucmVuZGVyKCk7XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcInNjcm9sbFwiLCB0aGlzLmJvdW5kVXBkYXRlLCB7XG4gICAgICBjYXB0dXJlOiB0cnVlLFxuICAgICAgcGFzc2l2ZTogdHJ1ZSxcbiAgICB9KTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLCB0aGlzLmJvdW5kVXBkYXRlLCB7IHBhc3NpdmU6IHRydWUgfSk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlcigpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMudmlzaWJsZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNsZWFySGlnaGxpZ2h0Qm94ZXMoKTtcblxuICAgIGZvciAoY29uc3QgaGlnaGxpZ2h0IG9mIHRoaXMuaGlnaGxpZ2h0cykge1xuICAgICAgY29uc3QgZWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXG4gICAgICAgIGBbJHtISUdITElHSFRfSURfQVRUUn09XCIke2hpZ2hsaWdodC5pZH1cIl1gLFxuICAgICAgKTtcbiAgICAgIGlmICghKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAoIWlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgaWYgKHJlY3Qud2lkdGggPD0gMCB8fCByZWN0LmhlaWdodCA8PSAwKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb2xvcnMgPSBTRVZFUklUWV9DT0xPUlNbaGlnaGxpZ2h0LnNldmVyaXR5XTtcbiAgICAgIGNvbnN0IGlzQWN0aXZlID0gaGlnaGxpZ2h0LmlkID09PSB0aGlzLmFjdGl2ZUhpZ2hsaWdodElkO1xuICAgICAgY29uc3QgYm9yZGVyV2lkdGggPSBpc0FjdGl2ZSA/IDMgOiAyO1xuICAgICAgY29uc3QgaW5zZXQgPSBib3JkZXJXaWR0aCArIDE7XG5cbiAgICAgIGNvbnN0IGJveCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICBib3guc2V0QXR0cmlidXRlKEhJR0hMSUdIVF9CT1hfQVRUUiwgaGlnaGxpZ2h0LmlkKTtcbiAgICAgIGJveC5zdHlsZS5jc3NUZXh0ID0gW1xuICAgICAgICBcInBvc2l0aW9uOmZpeGVkXCIsXG4gICAgICAgIFwicG9pbnRlci1ldmVudHM6bm9uZVwiLFxuICAgICAgICBcImJveC1zaXppbmc6Ym9yZGVyLWJveFwiLFxuICAgICAgICBcImJvcmRlci1yYWRpdXM6NnB4XCIsXG4gICAgICAgIGB6LWluZGV4OjIxNDc0ODM2NDZgLFxuICAgICAgICBgbGVmdDoke3JlY3QubGVmdCAtIGluc2V0fXB4YCxcbiAgICAgICAgYHRvcDoke3JlY3QudG9wIC0gaW5zZXR9cHhgLFxuICAgICAgICBgd2lkdGg6JHtyZWN0LndpZHRoICsgaW5zZXQgKiAyfXB4YCxcbiAgICAgICAgYGhlaWdodDoke3JlY3QuaGVpZ2h0ICsgaW5zZXQgKiAyfXB4YCxcbiAgICAgICAgYGJvcmRlcjoke2JvcmRlcldpZHRofXB4IHNvbGlkICR7Y29sb3JzLmJvcmRlcn1gLFxuICAgICAgICBgYmFja2dyb3VuZDoke2NvbG9ycy5iYWNrZ3JvdW5kfWAsXG4gICAgICBdLmpvaW4oXCI7XCIpO1xuXG4gICAgICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICBsYWJlbC50ZXh0Q29udGVudCA9IGhpZ2hsaWdodC5sYWJlbDtcbiAgICAgIGxhYmVsLnN0eWxlLmNzc1RleHQgPSBbXG4gICAgICAgIFwicG9zaXRpb246YWJzb2x1dGVcIixcbiAgICAgICAgXCJ0b3A6LTI0cHhcIixcbiAgICAgICAgXCJsZWZ0OjBcIixcbiAgICAgICAgYGJhY2tncm91bmQ6JHtjb2xvcnMuYm9yZGVyfWAsXG4gICAgICAgIFwiY29sb3I6I2ZmZlwiLFxuICAgICAgICBcImZvbnQ6NjAwIDExcHgvMS4yIHN5c3RlbS11aSxzYW5zLXNlcmlmXCIsXG4gICAgICAgIFwicGFkZGluZzo0cHggOHB4XCIsXG4gICAgICAgIFwiYm9yZGVyLXJhZGl1czo0cHhcIixcbiAgICAgICAgXCJ3aGl0ZS1zcGFjZTpub3dyYXBcIixcbiAgICAgICAgXCJtYXgtd2lkdGg6MjQwcHhcIixcbiAgICAgICAgXCJvdmVyZmxvdzpoaWRkZW5cIixcbiAgICAgICAgXCJ0ZXh0LW92ZXJmbG93OmVsbGlwc2lzXCIsXG4gICAgICBdLmpvaW4oXCI7XCIpO1xuXG4gICAgICBib3guYXBwZW5kQ2hpbGQobGFiZWwpO1xuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChib3gpO1xuICAgIH1cbiAgfVxufVxuIiwiLyoqIEJyb3dzZXItaW50ZXJuYWwgcGFnZXMgdGhhdCBhcmUgbmV2ZXIgc2Nhbm5lZC4gKi9cbmV4cG9ydCBjb25zdCBFWENMVURFRF9VUkxfUFJFRklYRVMgPSBbXG4gIFwiY2hyb21lOi8vXCIsXG4gIFwiY2hyb21lLXVudHJ1c3RlZDovL1wiLFxuICBcImNocm9tZS1leHRlbnNpb246Ly9cIixcbiAgXCJhYm91dDpcIixcbiAgXCJlZGdlOi8vXCIsXG4gIFwiYnJhdmU6Ly9cIixcbl0gYXMgY29uc3Q7XG5cbi8qKiBQb3B1bGFyIHNpdGVzIHNraXBwZWQgYnkgYXV0by1zY2FuIChlbWFpbCwgY2hhdCwgc29jaWFsLCBzdHJlYW1pbmcsIGV0Yy4pLiAqL1xuZXhwb3J0IGNvbnN0IEVYQ0xVREVEX0hPU1RTID0gW1xuICAvLyBHb29nbGVcbiAgXCJnb29nbGUuY29tXCIsXG4gIFwiZ21haWwuY29tXCIsXG4gIFwieW91dHViZS5jb21cIixcbiAgLy8gTWV0YVxuICBcImZhY2Vib29rLmNvbVwiLFxuICBcImluc3RhZ3JhbS5jb21cIixcbiAgXCJtZXRhLmNvbVwiLFxuICBcIm1lc3Nlbmdlci5jb21cIixcbiAgXCJ0aHJlYWRzLm5ldFwiLFxuICBcIndoYXRzYXBwLmNvbVwiLFxuICAvLyBNaWNyb3NvZnRcbiAgXCJtaWNyb3NvZnQuY29tXCIsXG4gIFwib3V0bG9vay5jb21cIixcbiAgXCJsaXZlLmNvbVwiLFxuICBcImhvdG1haWwuY29tXCIsXG4gIFwib2ZmaWNlLmNvbVwiLFxuICBcIm9mZmljZTM2NS5jb21cIixcbiAgLy8gQXBwbGVcbiAgXCJhcHBsZS5jb21cIixcbiAgXCJpY2xvdWQuY29tXCIsXG4gIC8vIFNvY2lhbCAmIG1lc3NhZ2luZ1xuICBcInR3aXR0ZXIuY29tXCIsXG4gIFwieC5jb21cIixcbiAgXCJsaW5rZWRpbi5jb21cIixcbiAgXCJ0aWt0b2suY29tXCIsXG4gIFwicmVkZGl0LmNvbVwiLFxuICBcInBpbnRlcmVzdC5jb21cIixcbiAgXCJzbmFwY2hhdC5jb21cIixcbiAgXCJkaXNjb3JkLmNvbVwiLFxuICBcInNsYWNrLmNvbVwiLFxuICBcInRlbGVncmFtLm9yZ1wiLFxuICBcInQubWVcIixcbiAgXCJ6b29tLnVzXCIsXG4gIFwiem9vbS5jb21cIixcbiAgLy8gRW1haWxcbiAgXCJ5YWhvby5jb21cIixcbiAgXCJwcm90b24ubWVcIixcbiAgXCJwcm90b25tYWlsLmNvbVwiLFxuICAvLyBTdHJlYW1pbmcgJiBjb21tZXJjZVxuICBcIm5ldGZsaXguY29tXCIsXG4gIFwic3BvdGlmeS5jb21cIixcbiAgXCJhbWF6b24uY29tXCIsXG4gIFwiYmluZy5jb21cIixcbl0gYXMgY29uc3Q7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0V4Y2x1ZGVkVXJsKHVybDogc3RyaW5nIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG4gIGlmICghdXJsKSByZXR1cm4gdHJ1ZTtcblxuICBjb25zdCBsb3dlciA9IHVybC50b0xvd2VyQ2FzZSgpO1xuICBmb3IgKGNvbnN0IHByZWZpeCBvZiBFWENMVURFRF9VUkxfUFJFRklYRVMpIHtcbiAgICBpZiAobG93ZXIuc3RhcnRzV2l0aChwcmVmaXgpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICB0cnkge1xuICAgIHJldHVybiBpc0V4Y2x1ZGVkSG9zdChuZXcgVVJMKHVybCkuaG9zdG5hbWUpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNFeGNsdWRlZEhvc3QoaG9zdG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCBob3N0ID0gaG9zdG5hbWUudG9Mb3dlckNhc2UoKTtcbiAgZm9yIChjb25zdCBleGNsdWRlZCBvZiBFWENMVURFRF9IT1NUUykge1xuICAgIGlmIChob3N0ID09PSBleGNsdWRlZCB8fCBob3N0LmVuZHNXaXRoKGAuJHtleGNsdWRlZH1gKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cbiIsImltcG9ydCB0eXBlIHsgRXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlIH0gZnJvbSBcIkBkYXJrcGF0dGVybnMvc2hhcmVkL3R5cGVzXCI7XG5pbXBvcnQgeyBpc0V4Y2x1ZGVkVXJsIH0gZnJvbSBcIi4vZXhjbHVkZWQtaG9zdHNcIjtcblxuZXhwb3J0IHR5cGUgRXh0ZW5zaW9uU2V0dGluZ3MgPSB7XG4gIHRlcm1zQWNjZXB0ZWRBdDogc3RyaW5nIHwgbnVsbDtcbiAgYXV0b1NjYW5FbmFibGVkOiBib29sZWFuO1xuICBhcGlCYXNlVXJsOiBzdHJpbmc7XG4gIGFwaUtleTogc3RyaW5nO1xufTtcblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogRXh0ZW5zaW9uU2V0dGluZ3MgPSB7XG4gIHRlcm1zQWNjZXB0ZWRBdDogbnVsbCxcbiAgYXV0b1NjYW5FbmFibGVkOiB0cnVlLFxuICBhcGlCYXNlVXJsOiBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMFwiLFxuICBhcGlLZXk6IFwiXCIsXG59O1xuXG50eXBlIFVybFJlcG9ydENhY2hlID0ge1xuICBub3JtYWxpemVkVXJsOiBzdHJpbmc7XG4gIHJlcG9ydDogRXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlW1wic2NhblwiXTtcbiAgY2FjaGVkQXQ6IG51bWJlcjtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVVcmxGb3JDYWNoZSh1cmw6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHBhcnNlZCA9IG5ldyBVUkwodXJsKTtcbiAgcGFyc2VkLmhhc2ggPSBcIlwiO1xuICBwYXJzZWQuaG9zdG5hbWUgPSBwYXJzZWQuaG9zdG5hbWUudG9Mb3dlckNhc2UoKTtcbiAgcmV0dXJuIHBhcnNlZC50b1N0cmluZygpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXJsc01hdGNoRm9yQ2FjaGUoYTogc3RyaW5nLCBiOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gbm9ybWFsaXplVXJsRm9yQ2FjaGUoYSkgPT09IG5vcm1hbGl6ZVVybEZvckNhY2hlKGIpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gYSA9PT0gYjtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0U2V0dGluZ3MoKTogUHJvbWlzZTxFeHRlbnNpb25TZXR0aW5ncz4ge1xuICBjb25zdCBzdG9yZWQgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoT2JqZWN0LmtleXMoREVGQVVMVF9TRVRUSU5HUykpO1xuICByZXR1cm4geyAuLi5ERUZBVUxUX1NFVFRJTkdTLCAuLi5zdG9yZWQgfSBhcyBFeHRlbnNpb25TZXR0aW5ncztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNhdmVTZXR0aW5ncyhcbiAgcGFydGlhbDogUGFydGlhbDxFeHRlbnNpb25TZXR0aW5ncz4sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHBhcnRpYWwpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0VGFiUmVwb3J0KFxuICB0YWJJZDogbnVtYmVyLFxuKTogUHJvbWlzZTxpbXBvcnQoXCIuL21lc3NhZ2VzXCIpLlRhYlJlcG9ydFN0YXRlIHwgbnVsbD4ge1xuICBjb25zdCBrZXkgPSBgdGFiUmVwb3J0OiR7dGFiSWR9YDtcbiAgY29uc3Qgc3RvcmVkID0gYXdhaXQgY2hyb21lLnN0b3JhZ2Uuc2Vzc2lvbi5nZXQoa2V5KTtcbiAgcmV0dXJuIChcbiAgICAoc3RvcmVkW2tleV0gYXMgaW1wb3J0KFwiLi9tZXNzYWdlc1wiKS5UYWJSZXBvcnRTdGF0ZSB8IHVuZGVmaW5lZCkgPz8gbnVsbFxuICApO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0VGFiUmVwb3J0KFxuICB0YWJJZDogbnVtYmVyLFxuICBzdGF0ZTogaW1wb3J0KFwiLi9tZXNzYWdlc1wiKS5UYWJSZXBvcnRTdGF0ZSxcbik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBrZXkgPSBgdGFiUmVwb3J0OiR7dGFiSWR9YDtcbiAgYXdhaXQgY2hyb21lLnN0b3JhZ2Uuc2Vzc2lvbi5zZXQoeyBba2V5XTogc3RhdGUgfSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRVcmxSZXBvcnRDYWNoZShcbiAgdXJsOiBzdHJpbmcsXG4pOiBQcm9taXNlPEV4dGVuc2lvbkFuYWx5emVSZXNwb25zZVtcInNjYW5cIl0gfCBudWxsPiB7XG4gIGNvbnN0IG5vcm1hbGl6ZWRVcmwgPSBub3JtYWxpemVVcmxGb3JDYWNoZSh1cmwpO1xuICBjb25zdCBrZXkgPSBgdXJsUmVwb3J0OiR7bm9ybWFsaXplZFVybH1gO1xuICBjb25zdCBzdG9yZWQgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoa2V5KTtcbiAgY29uc3QgY2FjaGUgPSBzdG9yZWRba2V5XSBhcyBVcmxSZXBvcnRDYWNoZSB8IHVuZGVmaW5lZDtcbiAgcmV0dXJuIGNhY2hlPy5yZXBvcnQgPz8gbnVsbDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldFVybFJlcG9ydENhY2hlKFxuICB1cmw6IHN0cmluZyxcbiAgcmVwb3J0OiBFeHRlbnNpb25BbmFseXplUmVzcG9uc2VbXCJzY2FuXCJdLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IG5vcm1hbGl6ZWRVcmwgPSBub3JtYWxpemVVcmxGb3JDYWNoZSh1cmwpO1xuICBjb25zdCBrZXkgPSBgdXJsUmVwb3J0OiR7bm9ybWFsaXplZFVybH1gO1xuICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoe1xuICAgIFtrZXldOiB7XG4gICAgICBub3JtYWxpemVkVXJsLFxuICAgICAgcmVwb3J0LFxuICAgICAgY2FjaGVkQXQ6IERhdGUubm93KCksXG4gICAgfSBzYXRpc2ZpZXMgVXJsUmVwb3J0Q2FjaGUsXG4gIH0pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2xlYXJVcmxSZXBvcnRDYWNoZSh1cmw6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBub3JtYWxpemVkVXJsID0gbm9ybWFsaXplVXJsRm9yQ2FjaGUodXJsKTtcbiAgYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwucmVtb3ZlKGB1cmxSZXBvcnQ6JHtub3JtYWxpemVkVXJsfWApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNBbmFseXphYmxlVXJsKHVybDogc3RyaW5nIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG4gIGlmICghdXJsKSByZXR1cm4gZmFsc2U7XG4gIGlmICghdXJsLnN0YXJ0c1dpdGgoXCJodHRwOi8vXCIpICYmICF1cmwuc3RhcnRzV2l0aChcImh0dHBzOi8vXCIpKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiAhaXNFeGNsdWRlZFVybCh1cmwpO1xufVxuIiwiLy8vIDxyZWZlcmVuY2UgdHlwZXM9XCJ3eHQvY2xpZW50LXR5cGVzXCIgLz5cblxuaW1wb3J0IHsgZGV0ZWN0UGFnZVR5cGUgfSBmcm9tIFwiQGRhcmtwYXR0ZXJucy9zaGFyZWQvcGFnZS1jb250ZXh0XCI7XG5pbXBvcnQge1xuICBjbGVhckhpZ2hsaWdodE1hcmtlcnMsXG4gIGVucmljaEhpZ2hsaWdodHNGcm9tRGV0ZWN0aW9ucyxcbiAgdHlwZSBIaWdobGlnaHREZXRlY3Rpb24sXG59IGZyb20gXCIuLi9leHRyYWN0L2hpZ2hsaWdodHNcIjtcbmltcG9ydCB7IGV4dHJhY3RQYWdlQ29udGVudCwgaG9va1NwYU5hdmlnYXRpb24gfSBmcm9tIFwiLi4vZXh0cmFjdC9wYWdlXCI7XG5pbXBvcnQgeyB3YWl0Rm9yUGFnZVJlYWR5IH0gZnJvbSBcIi4uL2V4dHJhY3Qvd2FpdC1mb3ItcGFnZVwiO1xuaW1wb3J0IHsgSGlnaGxpZ2h0T3ZlcmxheSB9IGZyb20gXCIuLi9oaWdobGlnaHQvb3ZlcmxheVwiO1xuaW1wb3J0IHR5cGUgeyBQYWdlSGlnaGxpZ2h0IH0gZnJvbSBcIkBkYXJrcGF0dGVybnMvc2hhcmVkL3R5cGVzXCI7XG5pbXBvcnQgeyBpc0FuYWx5emFibGVVcmwgfSBmcm9tIFwiLi4vbGliL3N0b3JhZ2VcIjtcblxuY29uc3QgREVCT1VOQ0VfTVMgPSAyMDAwO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogW1wiaHR0cDovLyovKlwiLCBcImh0dHBzOi8vKi8qXCJdLFxuICBydW5BdDogXCJkb2N1bWVudF9pZGxlXCIsXG4gIG1haW4oKSB7XG4gICAgaWYgKCFpc0FuYWx5emFibGVVcmwod2luZG93LmxvY2F0aW9uLmhyZWYpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgb3ZlcmxheSA9IG5ldyBIaWdobGlnaHRPdmVybGF5KCk7XG4gICAgbGV0IGRlYm91bmNlVGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbCA9IG51bGw7XG5cbiAgICBjb25zdCBhbmFseXplID0gKGZvcmNlID0gZmFsc2UpID0+IHtcbiAgICAgIGlmIChkZWJvdW5jZVRpbWVyKSB7XG4gICAgICAgIGNsZWFyVGltZW91dChkZWJvdW5jZVRpbWVyKTtcbiAgICAgIH1cblxuICAgICAgZGVib3VuY2VUaW1lciA9IHNldFRpbWVvdXQoXG4gICAgICAgICgpID0+IHtcbiAgICAgICAgICBkZWJvdW5jZVRpbWVyID0gbnVsbDtcblxuICAgICAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGlmICghZm9yY2UpIHtcbiAgICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSAoYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiU0hPVUxEX0FOQUxZWkVcIixcbiAgICAgICAgICAgICAgICB1cmw6IHdpbmRvdy5sb2NhdGlvbi5ocmVmLFxuICAgICAgICAgICAgICB9KSkgYXMgeyBzaG91bGRBbmFseXplPzogYm9vbGVhbiB9IHwgdW5kZWZpbmVkO1xuXG4gICAgICAgICAgICAgIGlmICghcmVzcG9uc2U/LnNob3VsZEFuYWx5emUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb3ZlcmxheS5oaWRlKCk7XG4gICAgICAgICAgICBjbGVhckhpZ2hsaWdodE1hcmtlcnMoKTtcblxuICAgICAgICAgICAgYXdhaXQgd2FpdEZvclBhZ2VSZWFkeSgpO1xuXG4gICAgICAgICAgICBjb25zdCBwYWdlID0gZXh0cmFjdFBhZ2VDb250ZW50KCk7XG4gICAgICAgICAgICB2b2lkIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgICAgdHlwZTogXCJQQUdFX0NPTlRFTlRcIixcbiAgICAgICAgICAgICAgLi4ucGFnZSxcbiAgICAgICAgICAgICAgZm9yY2UsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KSgpO1xuICAgICAgICB9LFxuICAgICAgICBmb3JjZSA/IDAgOiBERUJPVU5DRV9NUyxcbiAgICAgICk7XG4gICAgfTtcblxuICAgIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSkgPT4ge1xuICAgICAgaWYgKG1lc3NhZ2U/LnR5cGUgPT09IFwiQU5BTFlaRV9QQUdFXCIpIHtcbiAgICAgICAgYW5hbHl6ZShCb29sZWFuKG1lc3NhZ2UuZm9yY2UpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAobWVzc2FnZT8udHlwZSA9PT0gXCJTRVRfUEFHRV9ISUdITElHSFRTXCIpIHtcbiAgICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHBhZ2VUeXBlID0gZGV0ZWN0UGFnZVR5cGUoZG9jdW1lbnQpO1xuICAgICAgICAgIGNvbnN0IGVucmljaGVkID0gZW5yaWNoSGlnaGxpZ2h0c0Zyb21EZXRlY3Rpb25zKFxuICAgICAgICAgICAgKG1lc3NhZ2UuaGlnaGxpZ2h0cyBhcyBQYWdlSGlnaGxpZ2h0W10pID8/IFtdLFxuICAgICAgICAgICAgKG1lc3NhZ2UuZGV0ZWN0aW9ucyBhcyBIaWdobGlnaHREZXRlY3Rpb25bXSB8IHVuZGVmaW5lZCkgPz8gW10sXG4gICAgICAgICAgICBwYWdlVHlwZSxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgaWYgKG1lc3NhZ2UudmlzaWJsZSkge1xuICAgICAgICAgICAgb3ZlcmxheS5zaG93KGVucmljaGVkKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3ZlcmxheS5oaWRlKCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgdHlwZTogXCJISUdITElHSFRTX1VQREFURURcIixcbiAgICAgICAgICAgIGhpZ2hsaWdodHM6IGVucmljaGVkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KSgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChtZXNzYWdlPy50eXBlID09PSBcIkNMRUFSX1BBR0VfSElHSExJR0hUU1wiKSB7XG4gICAgICAgIG92ZXJsYXkuaGlkZSgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChtZXNzYWdlPy50eXBlID09PSBcIlNDUk9MTF9UT19ISUdITElHSFRcIikge1xuICAgICAgICBvdmVybGF5LnNjcm9sbFRvSGlnaGxpZ2h0KG1lc3NhZ2UuaGlnaGxpZ2h0SWQgYXMgc3RyaW5nKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGhvb2tTcGFOYXZpZ2F0aW9uKCgpID0+IHtcbiAgICAgIG92ZXJsYXkuaGlkZSgpO1xuICAgICAgY2xlYXJIaWdobGlnaHRNYXJrZXJzKCk7XG4gICAgICBhbmFseXplKGZhbHNlKTtcbiAgICB9KTtcbiAgfSxcbn0pO1xuIiwiLy8jcmVnaW9uIHNyYy91dGlscy9pbnRlcm5hbC9sb2dnZXIudHNcbmZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuXHRpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG5cdGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikgbWV0aG9kKGBbd3h0XSAke2FyZ3Muc2hpZnQoKX1gLCAuLi5hcmdzKTtcblx0ZWxzZSBtZXRob2QoXCJbd3h0XVwiLCAuLi5hcmdzKTtcbn1cbi8qKiBXcmFwcGVyIGFyb3VuZCBgY29uc29sZWAgd2l0aCBhIFwiW3d4dF1cIiBwcmVmaXggKi9cbmNvbnN0IGxvZ2dlciA9IHtcblx0ZGVidWc6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmRlYnVnLCAuLi5hcmdzKSxcblx0bG9nOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5sb2csIC4uLmFyZ3MpLFxuXHR3YXJuOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS53YXJuLCAuLi5hcmdzKSxcblx0ZXJyb3I6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmVycm9yLCAuLi5hcmdzKVxufTtcbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgbG9nZ2VyIH07XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIGJyb3dzZXIkMSB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG4vLyNyZWdpb24gc3JjL2Jyb3dzZXIudHNcbi8qKlxuKiBDb250YWlucyB0aGUgYGJyb3dzZXJgIGV4cG9ydCB3aGljaCB5b3Ugc2hvdWxkIHVzZSB0byBhY2Nlc3MgdGhlIGV4dGVuc2lvblxuKiBBUElzIGluIHlvdXIgcHJvamVjdDpcbipcbiogYGBgdHNcbiogaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gJ3d4dC9icm93c2VyJztcbipcbiogYnJvd3Nlci5ydW50aW1lLm9uSW5zdGFsbGVkLmFkZExpc3RlbmVyKCgpID0+IHtcbiogICAvLyAuLi5cbiogfSk7XG4qIGBgYFxuKlxuKiBAbW9kdWxlIHd4dC9icm93c2VyXG4qL1xuY29uc3QgYnJvd3NlciA9IGJyb3dzZXIkMTtcbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgYnJvd3NlciB9O1xuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuLy8jcmVnaW9uIHNyYy91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLnRzXG52YXIgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCA9IGNsYXNzIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG5cdHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xuXHRjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuXHRcdHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuXHRcdHRoaXMubmV3VXJsID0gbmV3VXJsO1xuXHRcdHRoaXMub2xkVXJsID0gb2xkVXJsO1xuXHR9XG59O1xuLyoqXG4qIFJldHVybnMgYW4gZXZlbnQgbmFtZSB1bmlxdWUgdG8gdGhlIGV4dGVuc2lvbiBhbmQgY29udGVudCBzY3JpcHQgdGhhdCdzXG4qIHJ1bm5pbmcuXG4qL1xuZnVuY3Rpb24gZ2V0VW5pcXVlRXZlbnROYW1lKGV2ZW50TmFtZSkge1xuXHRyZXR1cm4gYCR7YnJvd3Nlcj8ucnVudGltZT8uaWR9OiR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9OiR7ZXZlbnROYW1lfWA7XG59XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQsIGdldFVuaXF1ZUV2ZW50TmFtZSB9O1xuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG4vLyNyZWdpb24gc3JjL3V0aWxzL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIudHNcbmNvbnN0IHN1cHBvcnRzTmF2aWdhdGlvbkFwaSA9IHR5cGVvZiBnbG9iYWxUaGlzLm5hdmlnYXRpb24/LmFkZEV2ZW50TGlzdGVuZXIgPT09IFwiZnVuY3Rpb25cIjtcbi8qKlxuKiBDcmVhdGUgYSB1dGlsIHRoYXQgd2F0Y2hlcyBmb3IgVVJMIGNoYW5nZXMsIGRpc3BhdGNoaW5nIHRoZSBjdXN0b20gZXZlbnQgd2hlblxuKiBkZXRlY3RlZC4gU3RvcHMgd2F0Y2hpbmcgd2hlbiBjb250ZW50IHNjcmlwdCBpcyBpbnZhbGlkYXRlZC4gVXNlcyBOYXZpZ2F0aW9uXG4qIEFQSSB3aGVuIGF2YWlsYWJsZSwgb3RoZXJ3aXNlIGZhbGxzIGJhY2sgdG8gcG9sbGluZy5cbiovXG5mdW5jdGlvbiBjcmVhdGVMb2NhdGlvbldhdGNoZXIoY3R4KSB7XG5cdGxldCBsYXN0VXJsO1xuXHRsZXQgd2F0Y2hpbmcgPSBmYWxzZTtcblx0cmV0dXJuIHsgcnVuKCkge1xuXHRcdGlmICh3YXRjaGluZykgcmV0dXJuO1xuXHRcdHdhdGNoaW5nID0gdHJ1ZTtcblx0XHRsYXN0VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcblx0XHRpZiAoc3VwcG9ydHNOYXZpZ2F0aW9uQXBpKSBnbG9iYWxUaGlzLm5hdmlnYXRpb24uYWRkRXZlbnRMaXN0ZW5lcihcIm5hdmlnYXRlXCIsIChldmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgbmV3VXJsID0gbmV3IFVSTChldmVudC5kZXN0aW5hdGlvbi51cmwpO1xuXHRcdFx0aWYgKG5ld1VybC5ocmVmID09PSBsYXN0VXJsLmhyZWYpIHJldHVybjtcblx0XHRcdHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgbGFzdFVybCkpO1xuXHRcdFx0bGFzdFVybCA9IG5ld1VybDtcblx0XHR9LCB7IHNpZ25hbDogY3R4LnNpZ25hbCB9KTtcblx0XHRlbHNlIGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHRjb25zdCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuXHRcdFx0aWYgKG5ld1VybC5ocmVmICE9PSBsYXN0VXJsLmhyZWYpIHtcblx0XHRcdFx0d2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBsYXN0VXJsKSk7XG5cdFx0XHRcdGxhc3RVcmwgPSBuZXdVcmw7XG5cdFx0XHR9XG5cdFx0fSwgMWUzKTtcblx0fSB9O1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBjcmVhdGVMb2NhdGlvbldhdGNoZXIgfTtcbiIsImltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7IGdldFVuaXF1ZUV2ZW50TmFtZSB9IGZyb20gXCIuL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzXCI7XG5pbXBvcnQgeyBjcmVhdGVMb2NhdGlvbldhdGNoZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qc1wiO1xuaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuLy8jcmVnaW9uIHNyYy91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0LnRzXG4vKipcbiogSW1wbGVtZW50c1xuKiBbYEFib3J0Q29udHJvbGxlcmBdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9BYm9ydENvbnRyb2xsZXIpLlxuKiBVc2VkIHRvIGRldGVjdCBhbmQgc3RvcCBjb250ZW50IHNjcmlwdCBjb2RlIHdoZW4gdGhlIHNjcmlwdCBpcyBpbnZhbGlkYXRlZC5cbipcbiogSXQgYWxzbyBwcm92aWRlcyBzZXZlcmFsIHV0aWxpdGllcyBsaWtlIGBjdHguc2V0VGltZW91dGAgYW5kXG4qIGBjdHguc2V0SW50ZXJ2YWxgIHRoYXQgc2hvdWxkIGJlIHVzZWQgaW4gY29udGVudCBzY3JpcHRzIGluc3RlYWQgb2ZcbiogYHdpbmRvdy5zZXRUaW1lb3V0YCBvciBgd2luZG93LnNldEludGVydmFsYC5cbipcbiogVG8gY3JlYXRlIGNvbnRleHQgZm9yIHRlc3RpbmcsIHlvdSBjYW4gdXNlIHRoZSBjbGFzcydzIGNvbnN0cnVjdG9yOlxuKlxuKiBgYGB0c1xuKiBpbXBvcnQgeyBDb250ZW50U2NyaXB0Q29udGV4dCB9IGZyb20gJ3d4dC91dGlscy9jb250ZW50LXNjcmlwdHMtY29udGV4dCc7XG4qXG4qIHRlc3QoJ3N0b3JhZ2UgbGlzdGVuZXIgc2hvdWxkIGJlIHJlbW92ZWQgd2hlbiBjb250ZXh0IGlzIGludmFsaWRhdGVkJywgKCkgPT4ge1xuKiAgIGNvbnN0IGN0eCA9IG5ldyBDb250ZW50U2NyaXB0Q29udGV4dCgndGVzdCcpO1xuKiAgIGNvbnN0IGl0ZW0gPSBzdG9yYWdlLmRlZmluZUl0ZW0oJ2xvY2FsOmNvdW50JywgeyBkZWZhdWx0VmFsdWU6IDAgfSk7XG4qICAgY29uc3Qgd2F0Y2hlciA9IHZpLmZuKCk7XG4qXG4qICAgY29uc3QgdW53YXRjaCA9IGl0ZW0ud2F0Y2god2F0Y2hlcik7XG4qICAgY3R4Lm9uSW52YWxpZGF0ZWQodW53YXRjaCk7IC8vIExpc3RlbiBmb3IgaW52YWxpZGF0ZSBoZXJlXG4qXG4qICAgYXdhaXQgaXRlbS5zZXRWYWx1ZSgxKTtcbiogICBleHBlY3Qod2F0Y2hlcikudG9CZUNhbGxlZFRpbWVzKDEpO1xuKiAgIGV4cGVjdCh3YXRjaGVyKS50b0JlQ2FsbGVkV2l0aCgxLCAwKTtcbipcbiogICBjdHgubm90aWZ5SW52YWxpZGF0ZWQoKTsgLy8gVXNlIHRoaXMgZnVuY3Rpb24gdG8gaW52YWxpZGF0ZSB0aGUgY29udGV4dFxuKiAgIGF3YWl0IGl0ZW0uc2V0VmFsdWUoMik7XG4qICAgZXhwZWN0KHdhdGNoZXIpLnRvQmVDYWxsZWRUaW1lcygxKTtcbiogfSk7XG4qIGBgYFxuKi9cbnZhciBDb250ZW50U2NyaXB0Q29udGV4dCA9IGNsYXNzIENvbnRlbnRTY3JpcHRDb250ZXh0IHtcblx0c3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCIpO1xuXHRpZDtcblx0YWJvcnRDb250cm9sbGVyO1xuXHRsb2NhdGlvbldhdGNoZXIgPSBjcmVhdGVMb2NhdGlvbldhdGNoZXIodGhpcyk7XG5cdGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG5cdFx0dGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuXHRcdHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0dGhpcy5pZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpO1xuXHRcdHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuXHRcdHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcblx0XHR0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuXHR9XG5cdGdldCBzaWduYWwoKSB7XG5cdFx0cmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbDtcblx0fVxuXHRhYm9ydChyZWFzb24pIHtcblx0XHRyZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuYWJvcnQocmVhc29uKTtcblx0fVxuXHRnZXQgaXNJbnZhbGlkKCkge1xuXHRcdGlmIChicm93c2VyLnJ1bnRpbWU/LmlkID09IG51bGwpIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcblx0XHRyZXR1cm4gdGhpcy5zaWduYWwuYWJvcnRlZDtcblx0fVxuXHRnZXQgaXNWYWxpZCgpIHtcblx0XHRyZXR1cm4gIXRoaXMuaXNJbnZhbGlkO1xuXHR9XG5cdC8qKlxuXHQqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpc1xuXHQqIGludmFsaWRhdGVkLlxuXHQqXG5cdCogQGV4YW1wbGVcblx0KiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuXHQqICAgY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcblx0KiAgICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihjYik7XG5cdCogICB9KTtcblx0KiAgIC8vIC4uLlxuXHQqICAgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuXHQqXG5cdCogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuXHQqL1xuXHRvbkludmFsaWRhdGVkKGNiKSB7XG5cdFx0dGhpcy5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcblx0XHRyZXR1cm4gKCkgPT4gdGhpcy5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcblx0fVxuXHQvKipcblx0KiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvblxuXHQqIHRoYXQgc2hvdWxkbid0IHJ1biBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuXHQqXG5cdCogQGV4YW1wbGVcblx0KiAgIGNvbnN0IGdldFZhbHVlRnJvbVN0b3JhZ2UgPSBhc3luYyAoKSA9PiB7XG5cdCogICAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG5cdCpcblx0KiAgICAgLy8gLi4uXG5cdCogICB9O1xuXHQqL1xuXHRibG9jaygpIHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge30pO1xuXHR9XG5cdC8qKlxuXHQqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsXG5cdCogd2hlbiBpbnZhbGlkYXRlZC5cblx0KlxuXHQqIEludGVydmFscyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNsZWFySW50ZXJ2YWxgIGZ1bmN0aW9uLlxuXHQqL1xuXHRzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG5cdFx0Y29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG5cdFx0fSwgdGltZW91dCk7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcblx0XHRyZXR1cm4gaWQ7XG5cdH1cblx0LyoqXG5cdCogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbFxuXHQqIHdoZW4gaW52YWxpZGF0ZWQuXG5cdCpcblx0KiBUaW1lb3V0cyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYHNldFRpbWVvdXRgIGZ1bmN0aW9uLlxuXHQqL1xuXHRzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcblx0XHRjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuXHRcdH0sIHRpbWVvdXQpO1xuXHRcdHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcblx0XHRyZXR1cm4gaWQ7XG5cdH1cblx0LyoqXG5cdCogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzXG5cdCogdGhlIHJlcXVlc3Qgd2hlbiBpbnZhbGlkYXRlZC5cblx0KlxuXHQqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxBbmltYXRpb25GcmFtZWBcblx0KiBmdW5jdGlvbi5cblx0Ki9cblx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG5cdFx0Y29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuXHRcdH0pO1xuXHRcdHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuXHRcdHJldHVybiBpZDtcblx0fVxuXHQvKipcblx0KiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZVxuXHQqIHJlcXVlc3Qgd2hlbiBpbnZhbGlkYXRlZC5cblx0KlxuXHQqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxJZGxlQ2FsbGJhY2tgXG5cdCogZnVuY3Rpb24uXG5cdCovXG5cdHJlcXVlc3RJZGxlQ2FsbGJhY2soY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRjb25zdCBpZCA9IHJlcXVlc3RJZGxlQ2FsbGJhY2soKC4uLmFyZ3MpID0+IHtcblx0XHRcdGlmICghdGhpcy5zaWduYWwuYWJvcnRlZCkgY2FsbGJhY2soLi4uYXJncyk7XG5cdFx0fSwgb3B0aW9ucyk7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbElkbGVDYWxsYmFjayhpZCkpO1xuXHRcdHJldHVybiBpZDtcblx0fVxuXHRhZGRFdmVudExpc3RlbmVyKHRhcmdldCwgdHlwZSwgaGFuZGxlciwgb3B0aW9ucykge1xuXHRcdGlmICh0eXBlID09PSBcInd4dDpsb2NhdGlvbmNoYW5nZVwiKSB7XG5cdFx0XHRpZiAodGhpcy5pc1ZhbGlkKSB0aGlzLmxvY2F0aW9uV2F0Y2hlci5ydW4oKTtcblx0XHR9XG5cdFx0dGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXI/Lih0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSwgaGFuZGxlciwge1xuXHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdHNpZ25hbDogdGhpcy5zaWduYWxcblx0XHR9KTtcblx0fVxuXHQvKipcblx0KiBAaW50ZXJuYWxcblx0KiBBYm9ydCB0aGUgYWJvcnQgY29udHJvbGxlciBhbmQgZXhlY3V0ZSBhbGwgYG9uSW52YWxpZGF0ZWRgIGxpc3RlbmVycy5cblx0Ki9cblx0bm90aWZ5SW52YWxpZGF0ZWQoKSB7XG5cdFx0dGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG5cdFx0bG9nZ2VyLmRlYnVnKGBDb250ZW50IHNjcmlwdCBcIiR7dGhpcy5jb250ZW50U2NyaXB0TmFtZX1cIiBjb250ZXh0IGludmFsaWRhdGVkYCk7XG5cdH1cblx0c3RvcE9sZFNjcmlwdHMoKSB7XG5cdFx0ZG9jdW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLCB7IGRldGFpbDoge1xuXHRcdFx0Y29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG5cdFx0XHRtZXNzYWdlSWQ6IHRoaXMuaWRcblx0XHR9IH0pKTtcblx0XHRpZiAoIXRoaXMub3B0aW9ucz8ubm9TY3JpcHRTdGFydGVkUG9zdE1lc3NhZ2UpIHdpbmRvdy5wb3N0TWVzc2FnZSh7XG5cdFx0XHR0eXBlOiBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsXG5cdFx0XHRjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcblx0XHRcdG1lc3NhZ2VJZDogdGhpcy5pZFxuXHRcdH0sIFwiKlwiKTtcblx0fVxuXHR2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcblx0XHRjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGV0YWlsPy5jb250ZW50U2NyaXB0TmFtZSA9PT0gdGhpcy5jb250ZW50U2NyaXB0TmFtZTtcblx0XHRjb25zdCBpc0Zyb21TZWxmID0gZXZlbnQuZGV0YWlsPy5tZXNzYWdlSWQgPT09IHRoaXMuaWQ7XG5cdFx0cmV0dXJuIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgIWlzRnJvbVNlbGY7XG5cdH1cblx0bGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCkge1xuXHRcdGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG5cdFx0XHRpZiAoIShldmVudCBpbnN0YW5jZW9mIEN1c3RvbUV2ZW50KSB8fCAhdGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSByZXR1cm47XG5cdFx0XHR0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG5cdFx0fTtcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSwgY2IpO1xuXHRcdHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSwgY2IpKTtcblx0fVxufTtcbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgQ29udGVudFNjcmlwdENvbnRleHQgfTtcbiJdLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCw5LDEwLDExLDEyLDEzLDE0XSwibWFwcGluZ3MiOiI7O0NBQ0EsU0FBUyxvQkFBb0IsWUFBWTtFQUN4QyxPQUFPO0NBQ1I7OztDQ0RBLFNBQVMsd0JBQXdCLEtBQTRCO0VBQzNELElBQUk7R0FDRixNQUFNLFNBQWtCLEtBQUssTUFBTSxHQUFHO0dBQ3RDLE1BQU0sUUFBUSxNQUFNLFFBQVEsTUFBTSxJQUFJLFNBQVMsQ0FBQyxNQUFNO0dBRXRELEtBQUssTUFBTSxRQUFRLE9BQU87SUFDeEIsSUFBSSxDQUFDLFFBQVEsT0FBTyxTQUFTLFVBQVU7SUFDdkMsTUFBTSxTQUFTO0lBQ2YsTUFBTSxRQUFRLE9BQU87SUFDckIsSUFBSSxNQUFNLFFBQVEsS0FBSztVQUNoQixNQUFNLFFBQVEsT0FDakIsSUFBSSxRQUFRLE9BQU8sU0FBUyxVQUFVO01BQ3BDLE1BQU0sT0FBUSxLQUFpQztNQUMvQyxJQUFJLE9BQU8sU0FBUyxVQUFVLE9BQU87S0FDdkM7O0lBR0osTUFBTSxPQUFPLE9BQU87SUFDcEIsSUFBSSxPQUFPLFNBQVMsVUFBVSxPQUFPO0dBQ3ZDO0VBQ0YsUUFBUTtHQUNOLE9BQU87RUFDVDtFQUVBLE9BQU87Q0FDVDtDQUVBLFNBQWdCLGVBQWUsS0FBeUI7RUFDdEQsTUFBTSxTQUFTLElBQ1osY0FBYyw0QkFBMEIsQ0FBQyxFQUN4QyxhQUFhLFNBQVMsQ0FBQyxFQUN2QixZQUFZO0VBRWhCLElBQUksV0FBVyxhQUFhLFdBQVcsZUFDckMsT0FBTztFQUdULEtBQUssTUFBTSxVQUFVLElBQUksaUJBQ3ZCLHNDQUNGLEdBQUc7R0FDRCxN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