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
	//#region ../shared/highlight-matching.ts
	var PATTERN_TYPE_GROUPS = [
		[
			"RepeatedPopupOrStickyBanner",
			"RepeatedPrompt",
			"StickyPressureBanner"
		],
		[
			"ActivityNotifications",
			"ActivityNotification",
			"LiveActivityMessage"
		],
		["RequiredEnrollment", "Confirmshaming"],
		[
			"LimitedTimeMessage",
			"LimitedTimeOffer",
			"LimitedTimePromotion"
		],
		[
			"MisleadingPrice",
			"DripPricing",
			"UnclearDiscount"
		]
	];
	function patternTypesMatch(a, b) {
		if (a === b) return true;
		for (const group of PATTERN_TYPE_GROUPS) if (group.includes(a) && group.includes(b)) return true;
		return false;
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
		/flash sale/i,
		/shop now before/i,
		/before it['']?s gone/i,
		/act now/i,
		/hurry/i,
		/don['']?t miss out/i,
		/get \d+\s*%\s*off/i,
		/\boff now\b/i,
		/\d+\s*%\s*off now/i
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
		/\d+ (people|users|customers) (are )?(viewing|watching)/i,
		/sign up for .* (updates|newsletter)/i,
		/\bspecials\b/i
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
		/enable notifications/i,
		/popup/i,
		/modal/i,
		/sticky (bar|banner|footer)/i
	];
	var ENROLLMENT_PATTERNS = [
		/sign in/i,
		/log in/i,
		/register/i,
		/create account/i,
		/my orders/i,
		/my favorites/i,
		/join now/i
	];
	var REVIEW_PATTERNS = [
		/review/i,
		/testimonial/i,
		/customer said/i,
		/★|⭐/,
		/rated \d/i,
		/\d out of 5/i
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
			if (/class="[^"]*(modal|popup|popover|overlay|widget|sticky-banner)[^"]*"/i.test(element.outerHTML) || element.matches("sticky-header, [class*='sticky-header']")) addCandidate(element, {
				category: "NAGGING",
				patternType: "RepeatedPopupOrStickyBanner",
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
					patternType: "ActivityNotifications",
					severity: "MEDIUM",
					label: "Social proof cue"
				}, pageType, seen);
				continue;
			}
			if (firstMatchingPattern(text, REVIEW_PATTERNS)) {
				addCandidate(element, {
					category: "SOCIAL_PROOF",
					patternType: "ActivityNotifications",
					severity: "MEDIUM",
					label: "Review or testimonial"
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
					patternType: "RepeatedPopupOrStickyBanner",
					severity: "MEDIUM",
					label: "Repeated prompt"
				}, pageType, seen);
				continue;
			}
			if (firstMatchingPattern(text, ENROLLMENT_PATTERNS)) {
				addCandidate(element, {
					category: "FORCED_ACTION",
					patternType: "RequiredEnrollment",
					severity: "MEDIUM",
					label: "Sign-in prompt"
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
			case "FORCED_ACTION": return detection.patternType === "RequiredEnrollment" ? "Sign-in prompt" : "Pressure wording";
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
		for (const element of document.querySelectorAll(TEXT_SEARCH_SELECTORS)) {
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
		for (const match of evidence.matchAll(/["“'](.+?)["”']/g)) {
			const trimmed = match[1].trim();
			if (trimmed.length >= 3) {
				phrases.add(trimmed);
				for (const segment of trimmed.split("|")) {
					const part = segment.trim();
					if (part.length >= 3) phrases.add(part);
				}
			}
		}
		for (const match of evidence.matchAll(/`([^`]+)`/g)) {
			const trimmed = match[1].trim();
			if (trimmed.length >= 3) phrases.add(trimmed);
		}
		const visibleText = evidence.match(/Visible text:\s*["“']?([^"”'\n.]+?)["”']?(?:\.|$|\n)/i)?.[1];
		if (visibleText?.trim()) phrases.add(visibleText.trim());
		const snippet = evidence.match(/Snippet:\s*(`[^`]+`|<[^>\n]+>)/i)?.[1];
		if (snippet?.trim()) phrases.add(snippet.trim().replace(/^`|`$/g, ""));
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
	var POPUP_SELECTORS = [
		"[role=\"dialog\"]",
		"[class*=\"modal\"]",
		"[class*=\"Modal\"]",
		"[class*=\"popup\"]",
		"[class*=\"Popup\"]",
		"[class*=\"popover\"]",
		"[class*=\"Popover\"]",
		"[class*=\"overlay\"]",
		"[class*=\"Overlay\"]",
		"[class*=\"widget\"]",
		"[class*=\"Widget\"]",
		"[class*=\"newsletter\"]",
		"[class*=\"sticky-banner\"]",
		"[class*=\"announcement\"]",
		"sticky-header",
		"[class*=\"sticky-header\"]"
	].join(",");
	var STICKY_PROMO_SELECTORS = [
		"sticky-header",
		"[class*=\"sticky-header\"]",
		"[class*=\"announcement-bar\"]",
		"[class*=\"promo-bar\"]",
		"[class*=\"promo-ticker\"]",
		"[class*=\"ticker\"]",
		"header[class*='sticky']",
		"[class*=\"header--sticky\"]"
	].join(",");
	var TEXT_SEARCH_SELECTORS = "p, span, div, button, a, label, li, h1, h2, h3, h4, td, strong, em, small, del, s, sticky-header, header, nav, section, [class*='banner'], [class*='ticker'], [class*='popover'], [class*='widget']";
	var OVERLAY_CLASS_HINT = /modal|popup|popover|overlay|widget|banner|sticky|newsletter|close|ticker|announcement/i;
	function extractClassFragmentsFromSnippet(snippet) {
		const fragments = /* @__PURE__ */ new Set();
		for (const match of snippet.matchAll(/class="([^"]+)"/gi)) for (const token of match[1].split(/\s+/)) {
			const trimmed = token.trim();
			if (trimmed.length < 4) continue;
			fragments.add(trimmed);
			for (const part of trimmed.split("__")) if (part.length >= 4) fragments.add(part);
		}
		return [...fragments];
	}
	function findElementByClassFragment(fragment) {
		const needle = fragment.toLowerCase();
		if (needle.length < 4) return null;
		let best = null;
		let bestArea = Number.POSITIVE_INFINITY;
		for (const element of document.querySelectorAll("[class]")) {
			if (!element.className.toLowerCase().includes(needle)) continue;
			if (!isVisibleHighlightElement(element)) continue;
			const rect = element.getBoundingClientRect();
			const area = rect.width * rect.height;
			if (area > 0 && area < bestArea) {
				best = element;
				bestArea = area;
			}
		}
		return best;
	}
	function findElementFromHtmlSnippet(snippet) {
		for (const fragment of extractClassFragmentsFromSnippet(snippet)) {
			const element = findElementByClassFragment(fragment);
			if (element) return element;
		}
		const tagMatch = snippet.match(/^<\s*([a-z][a-z0-9-]*)/i);
		if (tagMatch) {
			for (const element of document.querySelectorAll(tagMatch[1])) if (isVisibleHighlightElement(element)) return element;
		}
		return null;
	}
	function isOverlayLikeElement(element) {
		const className = element.className.toLowerCase();
		const html = element.outerHTML.toLowerCase();
		return OVERLAY_CLASS_HINT.test(className) || OVERLAY_CLASS_HINT.test(html) || element.matches("sticky-header, [class*='sticky-header'], [role='dialog'], [class*='popover'], [class*='widget']");
	}
	function findStructuralStickyPromoElement() {
		for (const element of document.querySelectorAll(STICKY_PROMO_SELECTORS)) if (isVisibleHighlightElement(element)) return element;
		return null;
	}
	function findStructuralPopupElement() {
		for (const element of document.querySelectorAll(POPUP_SELECTORS)) if (isVisibleHighlightElement(element)) return element;
		let bestOverlay = null;
		let bestOverlayArea = Number.POSITIVE_INFINITY;
		for (const element of document.querySelectorAll("*")) {
			const style = window.getComputedStyle(element);
			if (style.position !== "fixed" && style.position !== "sticky") continue;
			if (isNestedStickyElement(element)) continue;
			if ((element.innerText ?? "").trim().length > 500) continue;
			if (!isVisibleHighlightElement(element)) continue;
			if (isOverlayLikeElement(element)) {
				const rect = element.getBoundingClientRect();
				const area = rect.width * rect.height;
				if (area > 0 && area < bestOverlayArea) {
					bestOverlay = element;
					bestOverlayArea = area;
				}
				continue;
			}
			if (!bestOverlay) return element;
		}
		return bestOverlay;
	}
	function isStickyOverlayDetection(detection) {
		return detection.category === "OBSTRUCTION" || detection.category === "NAGGING" || patternTypesMatch(detection.patternType, "StickyPressureBanner") || patternTypesMatch(detection.patternType, "RepeatedPopupOrStickyBanner");
	}
	function isStickyPromoDetection(detection) {
		return detection.category === "FORCED_ACTION" && (/sticky|ticker|promo|banner|header/i.test(detection.evidence) || /sticky|promo|ticker|banner/i.test(detection.patternType));
	}
	function findStructuralEnrollmentElement() {
		for (const element of document.querySelectorAll("a, button, nav, header, [class*='account'], [class*='signin'], [class*='login']")) {
			if (!isVisibleHighlightElement(element)) continue;
			const text = (element.innerText ?? "").trim();
			if (text.length < 3 || text.length > 200) continue;
			if (firstMatchingPattern(text, ENROLLMENT_PATTERNS)) return element;
		}
		return null;
	}
	function findStructuralReviewElement() {
		for (const element of document.querySelectorAll("[class*=\"review\"], [class*=\"testimonial\"], blockquote, [itemprop=\"review\"]")) if (isVisibleHighlightElement(element)) return element;
		for (const element of document.querySelectorAll("p, span, div, section, article")) {
			if (!isVisibleHighlightElement(element)) continue;
			const text = (element.innerText ?? "").trim();
			if (text.length < 20 || text.length > 600) continue;
			if (firstMatchingPattern(text, REVIEW_PATTERNS)) return element;
		}
		return null;
	}
	function findStructuralSocialProofElement() {
		for (const element of document.querySelectorAll("p, span, div, button, a, label, li, strong, em, small")) {
			if (!isVisibleHighlightElement(element)) continue;
			const text = (element.innerText ?? "").trim();
			if (text.length < 3 || text.length > 200) continue;
			if (firstMatchingPattern(text, SOCIAL_PROOF_PATTERNS)) return element;
		}
		return null;
	}
	function findElementForDetection(detection) {
		const snippetMatch = detection.evidence.match(/Snippet:\s*`([^`]+)`/i) ?? detection.evidence.match(/Snippet:\s*(<[^>\n]+>)/i);
		if (snippetMatch) {
			const fromSnippet = findElementFromHtmlSnippet(snippetMatch[1]);
			if (fromSnippet) return fromSnippet;
		}
		if (detection.category === "PRICING_DECEPTION") return findElementByPricingEvidence(detection.evidence) ?? findStructuralPricingElement();
		if (detection.category === "SCARCITY") return findElementByScarcityEvidence(detection.evidence) ?? findStructuralScarcityElement();
		if (isStickyOverlayDetection(detection)) return findElementByEvidence(detection.evidence) ?? findStructuralPopupElement();
		if (isStickyPromoDetection(detection)) return findElementByEvidence(detection.evidence) ?? findStructuralStickyPromoElement();
		const byEvidence = findElementByEvidence(detection.evidence);
		if (byEvidence) return byEvidence;
		if (detection.category === "NAGGING" || patternTypesMatch(detection.patternType, "RepeatedPopupOrStickyBanner")) return findStructuralPopupElement();
		if (detection.category === "FORCED_ACTION" && patternTypesMatch(detection.patternType, "RequiredEnrollment")) return findStructuralEnrollmentElement();
		if (detection.category === "SOCIAL_PROOF") return findElementByEvidence(detection.evidence) ?? findStructuralReviewElement() ?? findStructuralSocialProofElement();
		if (detection.category === "URGENCY") {
			for (const element of document.querySelectorAll(INTERACTIVE_SELECTORS$1)) {
				const text = element.innerText ?? "";
				if (text.length < 4 || text.length > 400) continue;
				if (firstMatchingPattern(`${text}\n${element.outerHTML}`, URGENCY_PATTERNS)) return element;
			}
			return findElementByEvidence(detection.evidence);
		}
		return null;
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
			const element = findElementForDetection(detection);
			if (!element) continue;
			const target = highlightTarget(element);
			if (!(target instanceof HTMLElement)) continue;
			const existingForTarget = seen.get(target);
			if (existingForTarget) {
				seen.set(target, {
					...existingForTarget,
					patternType: detection.patternType,
					evidence: detection.evidence || existingForTarget.evidence,
					severity: severityRank(detection.severity) > severityRank(existingForTarget.severity) ? detection.severity : existingForTarget.severity,
					label: labelForDetection(detection)
				});
				continue;
			}
			addCandidate(element, {
				category: detection.category,
				patternType: detection.patternType,
				severity: detection.severity,
				label: labelForDetection(detection),
				evidence: detection.evidence
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
	function resolveHighlightElementForScroll(highlight, detection) {
		const marked = document.querySelector(`[${HIGHLIGHT_ID_ATTR}="${highlight.id}"]`);
		if (marked instanceof HTMLElement) return marked;
		const evidence = highlight.evidence ?? detection?.evidence ?? "";
		const found = findElementForDetection({
			category: detection?.category ?? highlight.category,
			patternType: detection?.patternType ?? highlight.patternType,
			severity: detection?.severity ?? highlight.severity,
			evidence
		});
		if (!(found instanceof HTMLElement)) return null;
		const target = highlightTarget(found);
		if (!(target instanceof HTMLElement)) return null;
		assignHighlightId(target);
		return target;
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
	var SCROLL_MARGIN_PX = 72;
	function scrollElementIntoView(element) {
		if (element.matches("a, button, input, textarea, select, [tabindex]")) try {
			element.focus({ preventScroll: true });
		} catch {}
		let parent = element.parentElement;
		while (parent) {
			if (parent === document.body || parent === document.documentElement) break;
			if (!(parent instanceof HTMLElement)) {
				parent = parent.parentElement;
				continue;
			}
			const overflowY = window.getComputedStyle(parent).overflowY;
			if ((overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") && parent.scrollHeight > parent.clientHeight + 1) {
				const parentRect = parent.getBoundingClientRect();
				const elementRect = element.getBoundingClientRect();
				const offset = elementRect.top - parentRect.top - parent.clientHeight / 2 + elementRect.height / 2;
				if (Math.abs(offset) > 4) parent.scrollTo({
					top: parent.scrollTop + offset,
					behavior: "smooth"
				});
			}
			parent = parent.parentElement;
		}
		try {
			element.scrollIntoView({
				behavior: "smooth",
				block: "center",
				inline: "nearest"
			});
		} catch {
			element.scrollIntoView();
		}
		const rect = element.getBoundingClientRect();
		const targetTop = rect.top + window.scrollY - window.innerHeight / 2 + rect.height / 2 - SCROLL_MARGIN_PX / 2;
		window.scrollTo({
			top: Math.max(0, targetTop),
			behavior: "smooth"
		});
	}
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
		scrollToHighlight(highlightId, highlight, detection) {
			this.visible = true;
			this.ensureBindings();
			const record = highlight ?? this.highlights.find((item) => item.id === highlightId) ?? null;
			let element = null;
			let activeId = highlightId;
			const marked = document.querySelector(`[${HIGHLIGHT_ID_ATTR}="${highlightId}"]`);
			if (marked instanceof HTMLElement) element = marked;
			if (!element && record) {
				element = resolveHighlightElementForScroll(record, detection);
				if (element) activeId = element.getAttribute("data-dpd-highlight-id") ?? highlightId;
			}
			if (!element && detection) {
				element = resolveHighlightElementForScroll({
					id: highlightId,
					category: detection.category,
					patternType: detection.patternType,
					severity: detection.severity,
					label: "Pressure cue",
					evidence: detection.evidence
				}, detection);
				if (element) activeId = element.getAttribute("data-dpd-highlight-id") ?? highlightId;
			}
			if (!element) return false;
			this.activeHighlightId = activeId;
			if (record) {
				if (activeId !== record.id) this.highlights = this.highlights.map((item) => item.id === record.id ? {
					...item,
					id: activeId
				} : item);
				if (!this.highlights.some((item) => item.id === activeId)) this.highlights = [...this.highlights, {
					...record,
					id: activeId
				}];
			}
			scrollElementIntoView(element);
			this.render();
			window.setTimeout(() => this.render(), 50);
			window.setTimeout(() => this.render(), 350);
			window.setTimeout(() => this.render(), 700);
			return true;
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
			chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
							highlights: enriched,
							reportId: message.reportId
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
					const highlight = message.highlight;
					const detection = message.detection;
					overlay.scrollToHighlight(message.highlightId, highlight, detection);
				}
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsIm5hbWVzIjpbInByaW50IiwibG9nZ2VyIiwiYnJvd3NlciJdLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQubWpzIiwiLi4vLi4vLi4vLi4vc2hhcmVkL3BhZ2UtY29udGV4dC50cyIsIi4uLy4uLy4uLy4uL3NoYXJlZC9oaWdobGlnaHQtbWF0Y2hpbmcudHMiLCIuLi8uLi8uLi9zcmMvZXh0cmFjdC9oaWdobGlnaHRzLnRzIiwiLi4vLi4vLi4vc3JjL2V4dHJhY3QvcGFnZS50cyIsIi4uLy4uLy4uL3NyYy9leHRyYWN0L3dhaXQtZm9yLXBhZ2UudHMiLCIuLi8uLi8uLi9zcmMvaGlnaGxpZ2h0L292ZXJsYXkudHMiLCIuLi8uLi8uLi9zcmMvbGliL2V4Y2x1ZGVkLWhvc3RzLnRzIiwiLi4vLi4vLi4vc3JjL2xpYi9zdG9yYWdlLnRzIiwiLi4vLi4vLi4vc3JjL2VudHJ5cG9pbnRzL2NvbnRlbnQudHMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvY29udGVudC1zY3JpcHQtY29udGV4dC5tanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8jcmVnaW9uIHNyYy91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQudHNcbmZ1bmN0aW9uIGRlZmluZUNvbnRlbnRTY3JpcHQoZGVmaW5pdGlvbikge1xuXHRyZXR1cm4gZGVmaW5pdGlvbjtcbn1cbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgZGVmaW5lQ29udGVudFNjcmlwdCB9O1xuIiwiaW1wb3J0IHR5cGUgeyBQYWdlVHlwZSB9IGZyb20gXCIuL3R5cGVzL3NjYW5cIjtcblxuZnVuY3Rpb24gcGFyc2VTdHJ1Y3R1cmVkRGF0YVR5cGUocmF3OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJzZWQ6IHVua25vd24gPSBKU09OLnBhcnNlKHJhdyk7XG4gICAgY29uc3QgaXRlbXMgPSBBcnJheS5pc0FycmF5KHBhcnNlZCkgPyBwYXJzZWQgOiBbcGFyc2VkXTtcblxuICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuICAgICAgaWYgKCFpdGVtIHx8IHR5cGVvZiBpdGVtICE9PSBcIm9iamVjdFwiKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHJlY29yZCA9IGl0ZW0gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgICBjb25zdCBncmFwaCA9IHJlY29yZFtcIkBncmFwaFwiXTtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGdyYXBoKSkge1xuICAgICAgICBmb3IgKGNvbnN0IG5vZGUgb2YgZ3JhcGgpIHtcbiAgICAgICAgICBpZiAobm9kZSAmJiB0eXBlb2Ygbm9kZSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgY29uc3QgdHlwZSA9IChub2RlIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtcIkB0eXBlXCJdO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0eXBlID09PSBcInN0cmluZ1wiKSByZXR1cm4gdHlwZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnN0IHR5cGUgPSByZWNvcmRbXCJAdHlwZVwiXTtcbiAgICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIHR5cGU7XG4gICAgfVxuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0UGFnZVR5cGUoZG9jOiBEb2N1bWVudCk6IFBhZ2VUeXBlIHtcbiAgY29uc3Qgb2dUeXBlID0gZG9jXG4gICAgLnF1ZXJ5U2VsZWN0b3IoJ21ldGFbcHJvcGVydHk9XCJvZzp0eXBlXCJdJylcbiAgICA/LmdldEF0dHJpYnV0ZShcImNvbnRlbnRcIilcbiAgICA/LnRvTG93ZXJDYXNlKCk7XG5cbiAgaWYgKG9nVHlwZSA9PT0gXCJhcnRpY2xlXCIgfHwgb2dUeXBlID09PSBcIm5ld3NhcnRpY2xlXCIpIHtcbiAgICByZXR1cm4gXCJlZGl0b3JpYWxcIjtcbiAgfVxuXG4gIGZvciAoY29uc3Qgc2NyaXB0IG9mIGRvYy5xdWVyeVNlbGVjdG9yQWxsKFxuICAgICdzY3JpcHRbdHlwZT1cImFwcGxpY2F0aW9uL2xkK2pzb25cIl0nLFxuICApKSB7XG4gICAgY29uc3Qgc3RydWN0dXJlZFR5cGUgPSBwYXJzZVN0cnVjdHVyZWREYXRhVHlwZShzY3JpcHQudGV4dENvbnRlbnQgPz8gXCJcIik7XG4gICAgaWYgKFxuICAgICAgc3RydWN0dXJlZFR5cGUgPT09IFwiTmV3c0FydGljbGVcIiB8fFxuICAgICAgc3RydWN0dXJlZFR5cGUgPT09IFwiQXJ0aWNsZVwiIHx8XG4gICAgICBzdHJ1Y3R1cmVkVHlwZSA9PT0gXCJCbG9nUG9zdGluZ1wiXG4gICAgKSB7XG4gICAgICByZXR1cm4gXCJlZGl0b3JpYWxcIjtcbiAgICB9XG4gIH1cblxuICBjb25zdCBhcnRpY2xlID0gZG9jLnF1ZXJ5U2VsZWN0b3IoXCJhcnRpY2xlXCIpO1xuICBpZiAoYXJ0aWNsZSkge1xuICAgIGNvbnN0IGFydGljbGVMZW5ndGggPSAoYXJ0aWNsZS50ZXh0Q29udGVudCA/PyBcIlwiKS50cmltKCkubGVuZ3RoO1xuICAgIGNvbnN0IGJvZHlMZW5ndGggPSAoZG9jLmJvZHk/LnRleHRDb250ZW50ID8/IFwiXCIpLnRyaW0oKS5sZW5ndGg7XG4gICAgaWYgKGFydGljbGVMZW5ndGggPiA0MDAgJiYgYXJ0aWNsZUxlbmd0aCAvIE1hdGgubWF4KGJvZHlMZW5ndGgsIDEpID4gMC4zNSkge1xuICAgICAgcmV0dXJuIFwiZWRpdG9yaWFsXCI7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIFwiZ2VuZXJhbFwiO1xufVxuIiwiaW1wb3J0IHR5cGUgeyBQYWdlSGlnaGxpZ2h0IH0gZnJvbSBcIi4vdHlwZXMvc2NhblwiO1xuXG5jb25zdCBQQVRURVJOX1RZUEVfR1JPVVBTOiByZWFkb25seSBzdHJpbmdbXVtdID0gW1xuICBbXCJSZXBlYXRlZFBvcHVwT3JTdGlja3lCYW5uZXJcIiwgXCJSZXBlYXRlZFByb21wdFwiLCBcIlN0aWNreVByZXNzdXJlQmFubmVyXCJdLFxuICBbXCJBY3Rpdml0eU5vdGlmaWNhdGlvbnNcIiwgXCJBY3Rpdml0eU5vdGlmaWNhdGlvblwiLCBcIkxpdmVBY3Rpdml0eU1lc3NhZ2VcIl0sXG4gIFtcIlJlcXVpcmVkRW5yb2xsbWVudFwiLCBcIkNvbmZpcm1zaGFtaW5nXCJdLFxuICBbXCJMaW1pdGVkVGltZU1lc3NhZ2VcIiwgXCJMaW1pdGVkVGltZU9mZmVyXCIsIFwiTGltaXRlZFRpbWVQcm9tb3Rpb25cIl0sXG4gIFtcIk1pc2xlYWRpbmdQcmljZVwiLCBcIkRyaXBQcmljaW5nXCIsIFwiVW5jbGVhckRpc2NvdW50XCJdLFxuXTtcblxuY29uc3QgU1RJQ0tZX09WRVJMQVlfQ0FURUdPUklFUyA9IG5ldyBTZXQoW1wiT0JTVFJVQ1RJT05cIiwgXCJOQUdHSU5HXCJdKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBhdHRlcm5UeXBlc01hdGNoKGE6IHN0cmluZywgYjogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGlmIChhID09PSBiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmb3IgKGNvbnN0IGdyb3VwIG9mIFBBVFRFUk5fVFlQRV9HUk9VUFMpIHtcbiAgICBpZiAoZ3JvdXAuaW5jbHVkZXMoYSkgJiYgZ3JvdXAuaW5jbHVkZXMoYikpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplRXZpZGVuY2UodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnRyaW0oKTtcbn1cblxuZnVuY3Rpb24gZXZpZGVuY2VQaHJhc2VzKGV2aWRlbmNlOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHBocmFzZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBjb25zdCBxdW90ZWQgPSBldmlkZW5jZS5tYXRjaEFsbCgvW1wi4oCcJ10oLis/KVtcIuKAnSddL2cpO1xuICBmb3IgKGNvbnN0IG1hdGNoIG9mIHF1b3RlZCkge1xuICAgIGNvbnN0IGlubmVyID0gbWF0Y2hbMV0udHJpbSgpO1xuICAgIGlmIChpbm5lci5sZW5ndGggPj0gMykge1xuICAgICAgcGhyYXNlcy5hZGQoaW5uZXIpO1xuICAgICAgZm9yIChjb25zdCBzZWdtZW50IG9mIGlubmVyLnNwbGl0KFwifFwiKSkge1xuICAgICAgICBjb25zdCBwYXJ0ID0gc2VnbWVudC50cmltKCk7XG4gICAgICAgIGlmIChwYXJ0Lmxlbmd0aCA+PSAzKSB7XG4gICAgICAgICAgcGhyYXNlcy5hZGQocGFydCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IG1hdGNoIG9mIGV2aWRlbmNlLm1hdGNoQWxsKC9gKFteYF0rKWAvZykpIHtcbiAgICBjb25zdCBpbm5lciA9IG1hdGNoWzFdLnRyaW0oKTtcbiAgICBpZiAoaW5uZXIubGVuZ3RoID49IDMpIHtcbiAgICAgIHBocmFzZXMuYWRkKGlubmVyKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCB2aXNpYmxlVGV4dCA9IGV2aWRlbmNlLm1hdGNoKFxuICAgIC9WaXNpYmxlIHRleHQ6XFxzKltcIuKAnCddPyhbXlwi4oCdJ1xcbi5dKz8pW1wi4oCdJ10/KD86XFwufCR8XFxuKS9pLFxuICApPy5bMV07XG4gIGlmICh2aXNpYmxlVGV4dD8udHJpbSgpKSB7XG4gICAgcGhyYXNlcy5hZGQodmlzaWJsZVRleHQudHJpbSgpKTtcbiAgfVxuXG4gIGNvbnN0IGNsZWFuZWQgPSBldmlkZW5jZS5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gIGlmIChjbGVhbmVkLmxlbmd0aCA+PSA0KSB7XG4gICAgcGhyYXNlcy5hZGQoY2xlYW5lZC5zbGljZSgwLCBNYXRoLm1pbig4MCwgY2xlYW5lZC5sZW5ndGgpKSk7XG4gIH1cblxuICByZXR1cm4gWy4uLnBocmFzZXNdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXZpZGVuY2VPdmVybGFwcyhhOiBzdHJpbmcsIGI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCBsZWZ0ID0gbm9ybWFsaXplRXZpZGVuY2UoYSk7XG4gIGNvbnN0IHJpZ2h0ID0gbm9ybWFsaXplRXZpZGVuY2UoYik7XG5cbiAgaWYgKGxlZnQuaW5jbHVkZXMocmlnaHQpIHx8IHJpZ2h0LmluY2x1ZGVzKGxlZnQpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmb3IgKGNvbnN0IHBocmFzZSBvZiBldmlkZW5jZVBocmFzZXMoYSkpIHtcbiAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplRXZpZGVuY2UocGhyYXNlKTtcbiAgICBpZiAobm9ybWFsaXplZC5sZW5ndGggPj0gNCAmJiByaWdodC5pbmNsdWRlcyhub3JtYWxpemVkKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCBwaHJhc2Ugb2YgZXZpZGVuY2VQaHJhc2VzKGIpKSB7XG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZUV2aWRlbmNlKHBocmFzZSk7XG4gICAgaWYgKG5vcm1hbGl6ZWQubGVuZ3RoID49IDQgJiYgbGVmdC5pbmNsdWRlcyhub3JtYWxpemVkKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2hIaWdobGlnaHRUb0RldGVjdGlvbihcbiAgaGlnaGxpZ2h0czogUGFnZUhpZ2hsaWdodFtdLFxuICBkZXRlY3Rpb246IHtcbiAgICBjYXRlZ29yeTogc3RyaW5nO1xuICAgIHBhdHRlcm5UeXBlOiBzdHJpbmc7XG4gICAgZXZpZGVuY2U6IHN0cmluZztcbiAgfSxcbik6IFBhZ2VIaWdobGlnaHQgfCB1bmRlZmluZWQge1xuICBjb25zdCBieVBhdHRlcm4gPSBoaWdobGlnaHRzLmZpbHRlcihcbiAgICAoaGlnaGxpZ2h0KSA9PlxuICAgICAgaGlnaGxpZ2h0LmNhdGVnb3J5ID09PSBkZXRlY3Rpb24uY2F0ZWdvcnkgJiZcbiAgICAgIHBhdHRlcm5UeXBlc01hdGNoKGhpZ2hsaWdodC5wYXR0ZXJuVHlwZSwgZGV0ZWN0aW9uLnBhdHRlcm5UeXBlKSxcbiAgKTtcblxuICBpZiAoYnlQYXR0ZXJuLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBieVBhdHRlcm5bMF07XG4gIH1cblxuICBpZiAoYnlQYXR0ZXJuLmxlbmd0aCA+IDEpIHtcbiAgICBjb25zdCBieUV2aWRlbmNlID0gYnlQYXR0ZXJuLmZpbmQoXG4gICAgICAoaGlnaGxpZ2h0KSA9PlxuICAgICAgICBoaWdobGlnaHQuZXZpZGVuY2UgJiZcbiAgICAgICAgZXZpZGVuY2VPdmVybGFwcyhoaWdobGlnaHQuZXZpZGVuY2UsIGRldGVjdGlvbi5ldmlkZW5jZSksXG4gICAgKTtcbiAgICBpZiAoYnlFdmlkZW5jZSkge1xuICAgICAgcmV0dXJuIGJ5RXZpZGVuY2U7XG4gICAgfVxuICAgIHJldHVybiBieVBhdHRlcm5bMF07XG4gIH1cblxuICBjb25zdCBieUNhdGVnb3J5ID0gaGlnaGxpZ2h0cy5maWx0ZXIoXG4gICAgKGhpZ2hsaWdodCkgPT4gaGlnaGxpZ2h0LmNhdGVnb3J5ID09PSBkZXRlY3Rpb24uY2F0ZWdvcnksXG4gICk7XG5cbiAgaWYgKGJ5Q2F0ZWdvcnkubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGJ5Q2F0ZWdvcnlbMF07XG4gIH1cblxuICBpZiAoYnlDYXRlZ29yeS5sZW5ndGggPiAxKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGJ5Q2F0ZWdvcnkuZmluZChcbiAgICAgICAgKGhpZ2hsaWdodCkgPT5cbiAgICAgICAgICBoaWdobGlnaHQuZXZpZGVuY2UgJiZcbiAgICAgICAgICBldmlkZW5jZU92ZXJsYXBzKGhpZ2hsaWdodC5ldmlkZW5jZSwgZGV0ZWN0aW9uLmV2aWRlbmNlKSxcbiAgICAgICkgPz8gYnlDYXRlZ29yeVswXVxuICAgICk7XG4gIH1cblxuICBpZiAoU1RJQ0tZX09WRVJMQVlfQ0FURUdPUklFUy5oYXMoZGV0ZWN0aW9uLmNhdGVnb3J5KSkge1xuICAgIGNvbnN0IHN0aWNreUhpZ2hsaWdodCA9IGhpZ2hsaWdodHMuZmluZChcbiAgICAgIChoaWdobGlnaHQpID0+XG4gICAgICAgIFNUSUNLWV9PVkVSTEFZX0NBVEVHT1JJRVMuaGFzKGhpZ2hsaWdodC5jYXRlZ29yeSkgfHxcbiAgICAgICAgcGF0dGVyblR5cGVzTWF0Y2goaGlnaGxpZ2h0LnBhdHRlcm5UeXBlLCBcIlN0aWNreVByZXNzdXJlQmFubmVyXCIpIHx8XG4gICAgICAgIHBhdHRlcm5UeXBlc01hdGNoKGhpZ2hsaWdodC5wYXR0ZXJuVHlwZSwgXCJSZXBlYXRlZFBvcHVwT3JTdGlja3lCYW5uZXJcIiksXG4gICAgKTtcbiAgICBpZiAoc3RpY2t5SGlnaGxpZ2h0KSB7XG4gICAgICByZXR1cm4gc3RpY2t5SGlnaGxpZ2h0O1xuICAgIH1cbiAgfVxuXG4gIGlmIChkZXRlY3Rpb24uY2F0ZWdvcnkgPT09IFwiRk9SQ0VEX0FDVElPTlwiKSB7XG4gICAgY29uc3QgcHJvbW9IaWdobGlnaHQgPSBoaWdobGlnaHRzLmZpbmQoXG4gICAgICAoaGlnaGxpZ2h0KSA9PlxuICAgICAgICBoaWdobGlnaHQuY2F0ZWdvcnkgPT09IFwiRk9SQ0VEX0FDVElPTlwiIHx8XG4gICAgICAgIGhpZ2hsaWdodC5jYXRlZ29yeSA9PT0gXCJOQUdHSU5HXCIgfHxcbiAgICAgICAgL3N0aWNreXxwcm9tb3xiYW5uZXJ8dGlja2VyL2kudGVzdChoaWdobGlnaHQubGFiZWwpLFxuICAgICk7XG4gICAgaWYgKHByb21vSGlnaGxpZ2h0KSB7XG4gICAgICByZXR1cm4gcHJvbW9IaWdobGlnaHQ7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgYnlFdmlkZW5jZU9ubHkgPSBoaWdobGlnaHRzLmZpbmQoXG4gICAgKGhpZ2hsaWdodCkgPT5cbiAgICAgIGhpZ2hsaWdodC5ldmlkZW5jZSAmJlxuICAgICAgZXZpZGVuY2VPdmVybGFwcyhoaWdobGlnaHQuZXZpZGVuY2UsIGRldGVjdGlvbi5ldmlkZW5jZSksXG4gICk7XG4gIGlmIChieUV2aWRlbmNlT25seSkge1xuICAgIHJldHVybiBieUV2aWRlbmNlT25seTtcbiAgfVxuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG4iLCJpbXBvcnQgdHlwZSB7XG4gIERldGVjdGlvbkNhdGVnb3J5LFxuICBQYWdlSGlnaGxpZ2h0LFxuICBQYWdlVHlwZSxcbn0gZnJvbSBcIkBkYXJrcGF0dGVybnMvc2hhcmVkL3R5cGVzXCI7XG5pbXBvcnQgeyBwYXR0ZXJuVHlwZXNNYXRjaCB9IGZyb20gXCJAZGFya3BhdHRlcm5zL3NoYXJlZC9oaWdobGlnaHQtbWF0Y2hpbmdcIjtcblxuZXhwb3J0IGNvbnN0IEhJR0hMSUdIVF9JRF9BVFRSID0gXCJkYXRhLWRwZC1oaWdobGlnaHQtaWRcIjtcbmV4cG9ydCBjb25zdCBISUdITElHSFRfQk9YX0FUVFIgPSBcImRhdGEtZHBkLWhpZ2hsaWdodC1ib3hcIjtcblxuY29uc3QgTUFYX0hJR0hMSUdIVFMgPSAxNTtcblxuY29uc3QgQ09VTlRET1dOX1NFTEVDVE9SUyA9IFtcbiAgJ1tjbGFzcyo9XCJjb3VudGRvd25cIl0nLFxuICAnW2NsYXNzKj1cInRpbWVyXCJdJyxcbiAgJ1tpZCo9XCJjb3VudGRvd25cIl0nLFxuICAnW2lkKj1cInRpbWVyXCJdJyxcbiAgJ1tyb2xlPVwidGltZXJcIl0nLFxuXS5qb2luKFwiLFwiKTtcblxuY29uc3QgSU5URVJBQ1RJVkVfU0VMRUNUT1JTID0gW1xuICBcImJ1dHRvblwiLFxuICBcImFcIixcbiAgXCJpbnB1dFwiLFxuICBcInNlbGVjdFwiLFxuICBcImxhYmVsXCIsXG4gIFwidGV4dGFyZWFcIixcbiAgJ1tyb2xlPVwiZGlhbG9nXCJdJyxcbiAgJ1tjbGFzcyo9XCJtb2RhbFwiXScsXG4gICdbY2xhc3MqPVwicG9wdXBcIl0nLFxuICAnW2NsYXNzKj1cIm92ZXJsYXlcIl0nLFxuICAnW2NsYXNzKj1cImJhbm5lclwiXScsXG4gICdbY2xhc3MqPVwicHJpY2VcIl0nLFxuICAnW2NsYXNzKj1cInN1YnNjcmliZVwiXScsXG4gICdbY2xhc3MqPVwibmV3c2xldHRlclwiXScsXG5dLmpvaW4oXCIsXCIpO1xuXG5jb25zdCBVUkdFTkNZX1BBVFRFUk5TID0gW1xuICAvY291bnRkb3duL2ksXG4gIC9kZWFsIGVuZHMgKGlufHNvb258dG9kYXkpL2ksXG4gIC9saW1pdGVkIHRpbWUgb25seS9pLFxuICAvb2ZmZXIgZXhwaXJlcy9pLFxuICAvZW5kcyBpbiBcXGQrL2ksXG4gIC9zYWxlIGVuZHMvaSxcbiAgL2VuZHMgdG9kYXkvaSxcbiAgL2xhc3QgY2hhbmNlL2ksXG4gIC9mbGFzaCBzYWxlL2ksXG4gIC9zaG9wIG5vdyBiZWZvcmUvaSxcbiAgL2JlZm9yZSBpdFsnJ10/cyBnb25lL2ksXG4gIC9hY3Qgbm93L2ksXG4gIC9odXJyeS9pLFxuICAvZG9uWycnXT90IG1pc3Mgb3V0L2ksXG4gIC9nZXQgXFxkK1xccyolXFxzKm9mZi9pLFxuICAvXFxib2ZmIG5vd1xcYi9pLFxuICAvXFxkK1xccyolXFxzKm9mZiBub3cvaSxcbl07XG5cbmNvbnN0IFNDQVJDSVRZX1BBVFRFUk5TID0gW1xuICAvaW4gc3RvY2svaSxcbiAgL29ubHkgXFxkKyBsZWZ0L2ksXG4gIC9vbmx5IFxcZCsgcmVtYWluaW5nL2ksXG4gIC9sb3cgc3RvY2svaSxcbiAgL3NlbGxpbmcgZmFzdC9pLFxuICAvaGlnaCBkZW1hbmQvaSxcbiAgL3Blb3BsZSAoYXJlICk/dmlld2luZy9pLFxuICAvaW4gXFxkKyBjYXJ0cz8vaSxcbiAgL2FsbW9zdCBzb2xkIG91dC9pLFxuICAvbGltaXRlZCBxdWFudGl0eS9pLFxuICAvZmV3IGxlZnQvaSxcbiAgL2xlZnQgaW4gc3RvY2svaSxcbl07XG5cbmNvbnN0IFNPQ0lBTF9QUk9PRl9QQVRURVJOUyA9IFtcbiAgL3Blb3BsZSAoYXJlICk/dmlld2luZy9pLFxuICAvYm91Z2h0IGluIHRoZSBsYXN0L2ksXG4gIC9zb21lb25lIGp1c3QgcHVyY2hhc2VkL2ksXG4gIC9yZWNlbnQobHkpPyBwdXJjaGFzZWQvaSxcbiAgL1xcZCsgKHBlb3BsZXx1c2Vyc3xjdXN0b21lcnMpIChhcmUgKT8odmlld2luZ3x3YXRjaGluZykvaSxcbiAgL3NpZ24gdXAgZm9yIC4qICh1cGRhdGVzfG5ld3NsZXR0ZXIpL2ksXG4gIC9cXGJzcGVjaWFsc1xcYi9pLFxuXTtcblxuY29uc3QgQ09ORklSTVNIQU1JTkdfUEFUVEVSTlMgPSBbXG4gIC9ubyB0aGFua3MsPyBpIGhhdGUgc2F2aW5nL2ksXG4gIC9pIGRvblsnJ110IHdhbnQgYSBkaXNjb3VudC9pLFxuICAvbm8sPyBpWycnXWxsIHBheSBmdWxsIHByaWNlL2ksXG4gIC9jb250aW51ZSB3aXRob3V0L2ksXG5dO1xuXG5jb25zdCBQUklDSU5HX1BBVFRFUk5TID0gW1xuICAvd2FzIFtcXCTCo+KCrFMkXS9pLFxuICAvbm93IFtcXCTCo+KCrFMkXS9pLFxuICAvW1xcJMKj4oKsUyRdXFxzP1tcXGQsLl0rW1xcc1xcU117MCwyMH0od2FzfGJlZm9yZXxjb21wYXJlfG9yaWdpbmFsfHJlZ3VsYXIpL2ksXG4gIC8od2FzfGJlZm9yZXxjb21wYXJlfG9yaWdpbmFsfHJlZ3VsYXIpW1xcc1xcU117MCwyMH1bXFwkwqPigqxTJF1cXHM/W1xcZCwuXSsvaSxcbiAgL3NhdmUgXFxkK1xccyolL2ksXG4gIC9cXGQrXFxzKiVcXHMqb2ZmL2ksXG4gIC9ycnB8bXJycC9pLFxuICAvb3JpZ2luYWwgcHJpY2UvaSxcbiAgL2NvbXBhcmUuP2F0L2ksXG4gIC9yZWd1bGFyIHByaWNlL2ksXG4gIC9saXN0ZWQgcHJpY2UvaSxcbiAgL1xcKyB0YXgvaSxcbiAgL2FkZGl0aW9uYWwgZmVlcz8vaSxcbiAgL3N0YXJ0aW5nIGF0L2ksXG4gIC9mcm9tIFtcXCTCo+KCrFMkXS9pLFxuICAvW1xcJMKj4oKsUyRdW1xcZCwuXStcXHMqW1xcJMKj4oKsUyRdW1xcZCwuXSsvLFxuXTtcblxuY29uc3QgUFJJQ0VfQ09OVEFJTkVSX1NFTEVDVE9SUyA9IFtcbiAgJ1tjbGFzcyo9XCJwcmljZVwiXScsXG4gICdbY2xhc3MqPVwiUHJpY2VcIl0nLFxuICAnW2NsYXNzKj1cImNvbXBhcmVcIl0nLFxuICAnW2NsYXNzKj1cIndhcy1wcmljZVwiXScsXG4gICdbY2xhc3MqPVwid2FzX3ByaWNlXCJdJyxcbiAgJ1tjbGFzcyo9XCJvcmlnaW5hbFwiXScsXG4gICdbY2xhc3MqPVwicmVndWxhclwiXScsXG4gICdbY2xhc3MqPVwic2FsZS1wcmljZVwiXScsXG4gICdbY2xhc3MqPVwic2FsZV9wcmljZVwiXScsXG4gICdbZGF0YS1jb21wYXJlLXByaWNlXScsXG4gICdbZGF0YS1zYWxlLXByaWNlXScsXG4gIFwiLnByaWNlXCIsXG4gIFwiLnByb2R1Y3QtcHJpY2VcIixcbl0uam9pbihcIixcIik7XG5cbmNvbnN0IE5BR0dJTkdfUEFUVEVSTlMgPSBbXG4gIC9zdWJzY3JpYmUvaSxcbiAgL3NpZ24gdXAvaSxcbiAgL2Rvbid0IG1pc3MvaSxcbiAgL2JlZm9yZSB5b3UgZ28vaSxcbiAgL3dhaXQhPyBkb24ndCBsZWF2ZS9pLFxuICAvZW5hYmxlIG5vdGlmaWNhdGlvbnMvaSxcbiAgL3BvcHVwL2ksXG4gIC9tb2RhbC9pLFxuICAvc3RpY2t5IChiYXJ8YmFubmVyfGZvb3RlcikvaSxcbl07XG5cbmNvbnN0IEVOUk9MTE1FTlRfUEFUVEVSTlMgPSBbXG4gIC9zaWduIGluL2ksXG4gIC9sb2cgaW4vaSxcbiAgL3JlZ2lzdGVyL2ksXG4gIC9jcmVhdGUgYWNjb3VudC9pLFxuICAvbXkgb3JkZXJzL2ksXG4gIC9teSBmYXZvcml0ZXMvaSxcbiAgL2pvaW4gbm93L2ksXG5dO1xuXG5jb25zdCBSRVZJRVdfUEFUVEVSTlMgPSBbXG4gIC9yZXZpZXcvaSxcbiAgL3Rlc3RpbW9uaWFsL2ksXG4gIC9jdXN0b21lciBzYWlkL2ksXG4gIC/imIV84q2QLyxcbiAgL3JhdGVkIFxcZC9pLFxuICAvXFxkIG91dCBvZiA1L2ksXG5dO1xuXG5jb25zdCBTTkVBS0lOR19QQVRURVJOUyA9IFtcbiAgL2hpZGRlbiBmZWUvaSxcbiAgL2F1dG8uP3JlbmV3L2ksXG4gIC9mcmVlIHRyaWFsL2ksXG4gIC9hZGRlZCB0byAoY2FydHxiYXNrZXQpL2ksXG4gIC9wcmUuP3NlbGVjdGVkIGFkZC4/b24vaSxcbl07XG5cbnR5cGUgSGlnaGxpZ2h0Q2FuZGlkYXRlID0gT21pdDxQYWdlSGlnaGxpZ2h0LCBcImlkXCI+O1xuXG5leHBvcnQgdHlwZSBIaWdobGlnaHREZXRlY3Rpb24gPSB7XG4gIGNhdGVnb3J5OiBzdHJpbmc7XG4gIHBhdHRlcm5UeXBlOiBzdHJpbmc7XG4gIHNldmVyaXR5OiBQYWdlSGlnaGxpZ2h0W1wic2V2ZXJpdHlcIl07XG4gIGV2aWRlbmNlOiBzdHJpbmc7XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuICBjb25zdCBzdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpO1xuICBpZiAoc3R5bGUuZGlzcGxheSA9PT0gXCJub25lXCIgfHwgc3R5bGUudmlzaWJpbGl0eSA9PT0gXCJoaWRkZW5cIikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoTnVtYmVyLnBhcnNlRmxvYXQoc3R5bGUub3BhY2l0eSkgPT09IDApIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCByZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgaWYgKHJlY3Qud2lkdGggPCAyIHx8IHJlY3QuaGVpZ2h0IDwgMikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgZWxlbWVudC5jaGVja1Zpc2liaWxpdHkgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIHJldHVybiBlbGVtZW50LmNoZWNrVmlzaWJpbGl0eSh7XG4gICAgICBjaGVja09wYWNpdHk6IHRydWUsXG4gICAgICBjaGVja1Zpc2liaWxpdHlDU1M6IHRydWUsXG4gICAgfSk7XG4gIH1cblxuICBpZiAoc3R5bGUucG9zaXRpb24gPT09IFwiZml4ZWRcIiB8fCBzdHlsZS5wb3NpdGlvbiA9PT0gXCJzdGlja3lcIikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGVsZW1lbnQub2Zmc2V0UGFyZW50ICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBhc3NpZ25IaWdobGlnaHRJZChlbGVtZW50OiBFbGVtZW50KTogc3RyaW5nIHtcbiAgY29uc3QgZXhpc3RpbmcgPSBlbGVtZW50LmdldEF0dHJpYnV0ZShISUdITElHSFRfSURfQVRUUik7XG4gIGlmIChleGlzdGluZykge1xuICAgIHJldHVybiBleGlzdGluZztcbiAgfVxuXG4gIGNvbnN0IGlkID0gY3J5cHRvLnJhbmRvbVVVSUQoKTtcbiAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoSElHSExJR0hUX0lEX0FUVFIsIGlkKTtcbiAgcmV0dXJuIGlkO1xufVxuXG5mdW5jdGlvbiBpc0luc2lkZUFydGljbGVCb2R5KGVsZW1lbnQ6IEVsZW1lbnQpOiBib29sZWFuIHtcbiAgY29uc3QgYXJ0aWNsZSA9IGVsZW1lbnQuY2xvc2VzdChcImFydGljbGVcIik7XG4gIGlmICghYXJ0aWNsZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChlbGVtZW50LmNsb3Nlc3QoJ1tyb2xlPVwiZGlhbG9nXCJdLCBbY2xhc3MqPVwibW9kYWxcIl0sIFtjbGFzcyo9XCJwb3B1cFwiXScpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgdGFnID0gZWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCk7XG4gIHJldHVybiAhW1wiaW5wdXRcIiwgXCJidXR0b25cIiwgXCJzZWxlY3RcIiwgXCJ0ZXh0YXJlYVwiLCBcImZvcm1cIl0uaW5jbHVkZXModGFnKTtcbn1cblxuZnVuY3Rpb24gc2hvdWxkU2tpcEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCwgcGFnZVR5cGU6IFBhZ2VUeXBlKTogYm9vbGVhbiB7XG4gIGlmIChwYWdlVHlwZSA9PT0gXCJlZGl0b3JpYWxcIiAmJiBpc0luc2lkZUFydGljbGVCb2R5KGVsZW1lbnQpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBjb25zdCByb290ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJkcGQtaGlnaGxpZ2h0LXJvb3RcIik7XG4gIGlmIChyb290Py5jb250YWlucyhlbGVtZW50KSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCAmJiAhaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBmaXJzdE1hdGNoaW5nUGF0dGVybih0ZXh0OiBzdHJpbmcsIHBhdHRlcm5zOiBSZWdFeHBbXSk6IFJlZ0V4cCB8IG51bGwge1xuICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgcGF0dGVybnMpIHtcbiAgICBpZiAocGF0dGVybi50ZXN0KHRleHQpKSB7XG4gICAgICByZXR1cm4gcGF0dGVybjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGhpZ2hsaWdodFRhcmdldChlbGVtZW50OiBFbGVtZW50KTogRWxlbWVudCB7XG4gIGNvbnN0IGRpYWxvZyA9IGVsZW1lbnQuY2xvc2VzdCgnW3JvbGU9XCJkaWFsb2dcIl0sIFtjbGFzcyo9XCJtb2RhbFwiXSwgW2NsYXNzKj1cInBvcHVwXCJdJyk7XG4gIGlmIChkaWFsb2cgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgIHJldHVybiBkaWFsb2c7XG4gIH1cblxuICBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxJbnB1dEVsZW1lbnQpIHtcbiAgICByZXR1cm4gZWxlbWVudC5jbG9zZXN0KFwibGFiZWxcIikgPz8gZWxlbWVudDtcbiAgfVxuXG4gIGlmIChlbGVtZW50IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICBjb25zdCB0ZXh0ID0gKGVsZW1lbnQuaW5uZXJUZXh0ID8/IFwiXCIpLnRyaW0oKTtcbiAgICBpZiAodGV4dC5sZW5ndGggPCAxMjApIHtcbiAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGVsZW1lbnQuY2xvc2VzdChcbiAgICAgICAgJ25hdiwgaGVhZGVyLCBmb290ZXIsIFtyb2xlPVwiYmFubmVyXCJdLCBbcm9sZT1cIm5hdmlnYXRpb25cIl0sIGZvcm0sIFtjbGFzcyo9XCJjb3VudGRvd25cIl0sIFtjbGFzcyo9XCJ0aW1lclwiXScsXG4gICAgICApO1xuICAgICAgaWYgKGNvbnRhaW5lciBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG4gICAgICAgIHJldHVybiBjb250YWluZXI7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGVsZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIGlzTmVzdGVkU3RpY2t5RWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuICBsZXQgcGFyZW50ID0gZWxlbWVudC5wYXJlbnRFbGVtZW50O1xuICB3aGlsZSAocGFyZW50KSB7XG4gICAgY29uc3Qgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShwYXJlbnQpO1xuICAgIGlmIChzdHlsZS5wb3NpdGlvbiA9PT0gXCJmaXhlZFwiIHx8IHN0eWxlLnBvc2l0aW9uID09PSBcInN0aWNreVwiKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcGFyZW50ID0gcGFyZW50LnBhcmVudEVsZW1lbnQ7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBhZGRDYW5kaWRhdGUoXG4gIGVsZW1lbnQ6IEVsZW1lbnQsXG4gIGNhbmRpZGF0ZTogSGlnaGxpZ2h0Q2FuZGlkYXRlLFxuICBwYWdlVHlwZTogUGFnZVR5cGUsXG4gIHNlZW46IE1hcDxFbGVtZW50LCBQYWdlSGlnaGxpZ2h0Pixcbik6IHZvaWQge1xuICBjb25zdCB0YXJnZXQgPSBoaWdobGlnaHRUYXJnZXQoZWxlbWVudCk7XG4gIGlmICghKHRhcmdldCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoc2hvdWxkU2tpcEVsZW1lbnQodGFyZ2V0LCBwYWdlVHlwZSkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBleGlzdGluZyA9IHNlZW4uZ2V0KHRhcmdldCk7XG4gIGlmIChleGlzdGluZykge1xuICAgIGlmIChzZXZlcml0eVJhbmsoY2FuZGlkYXRlLnNldmVyaXR5KSA+IHNldmVyaXR5UmFuayhleGlzdGluZy5zZXZlcml0eSkpIHtcbiAgICAgIHNlZW4uc2V0KHRhcmdldCwgeyAuLi5jYW5kaWRhdGUsIGlkOiBleGlzdGluZy5pZCB9KTtcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgc2Vlbi5zZXQodGFyZ2V0LCB7XG4gICAgLi4uY2FuZGlkYXRlLFxuICAgIGlkOiBhc3NpZ25IaWdobGlnaHRJZCh0YXJnZXQpLFxuICB9KTtcbn1cblxuZnVuY3Rpb24gc2V2ZXJpdHlSYW5rKHNldmVyaXR5OiBQYWdlSGlnaGxpZ2h0W1wic2V2ZXJpdHlcIl0pOiBudW1iZXIge1xuICBzd2l0Y2ggKHNldmVyaXR5KSB7XG4gICAgY2FzZSBcIkhJR0hcIjpcbiAgICAgIHJldHVybiAzO1xuICAgIGNhc2UgXCJNRURJVU1cIjpcbiAgICAgIHJldHVybiAyO1xuICAgIGNhc2UgXCJMT1dcIjpcbiAgICAgIHJldHVybiAxO1xuICAgIGRlZmF1bHQ6IHtcbiAgICAgIGNvbnN0IF9leGhhdXN0aXZlOiBuZXZlciA9IHNldmVyaXR5O1xuICAgICAgcmV0dXJuIF9leGhhdXN0aXZlO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBjb2xsZWN0Q291bnRkb3duSGlnaGxpZ2h0cyhcbiAgcGFnZVR5cGU6IFBhZ2VUeXBlLFxuICBzZWVuOiBNYXA8RWxlbWVudCwgUGFnZUhpZ2hsaWdodD4sXG4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoQ09VTlRET1dOX1NFTEVDVE9SUykpIHtcbiAgICBpZiAoIShlbGVtZW50IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSBjb250aW51ZTtcblxuICAgIGFkZENhbmRpZGF0ZShcbiAgICAgIGVsZW1lbnQsXG4gICAgICB7XG4gICAgICAgIGNhdGVnb3J5OiBcIlVSR0VOQ1lcIixcbiAgICAgICAgcGF0dGVyblR5cGU6IFwiQ291bnRkb3duVGltZXJcIixcbiAgICAgICAgc2V2ZXJpdHk6IFwiSElHSFwiLFxuICAgICAgICBsYWJlbDogXCJDb3VudGRvd24gdGltZXJcIixcbiAgICAgIH0sXG4gICAgICBwYWdlVHlwZSxcbiAgICAgIHNlZW4sXG4gICAgKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb2xsZWN0UHJlc2VsZWN0aW9uSGlnaGxpZ2h0cyhcbiAgcGFnZVR5cGU6IFBhZ2VUeXBlLFxuICBzZWVuOiBNYXA8RWxlbWVudCwgUGFnZUhpZ2hsaWdodD4sXG4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBpbnB1dCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxJbnB1dEVsZW1lbnQ+KFxuICAgICdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl06Y2hlY2tlZCwgaW5wdXRbdHlwZT1cInJhZGlvXCJdOmNoZWNrZWQnLFxuICApKSB7XG4gICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgaW5wdXQsXG4gICAgICB7XG4gICAgICAgIGNhdGVnb3J5OiBcIlBSRVNFTEVDVElPTlwiLFxuICAgICAgICBwYXR0ZXJuVHlwZTogXCJQcmVDaGVja2VkQm94XCIsXG4gICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICBsYWJlbDogXCJQcmUtc2VsZWN0ZWQgb3B0aW9uXCIsXG4gICAgICB9LFxuICAgICAgcGFnZVR5cGUsXG4gICAgICBzZWVuLFxuICAgICk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaGFzQ3VycmVuY3lUZXh0KHRleHQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gL1tcXCTCo+KCrF18U1xcJHxcXGRbXFxkLC5dKlxccyooPzp3YXN8bm93fG9mZnxzYXZlKS9pLnRlc3QodGV4dCk7XG59XG5cbmZ1bmN0aW9uIHByaWNpbmdDb250YWluZXJGb3IoZWxlbWVudDogRWxlbWVudCk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgY29udGFpbmVyID0gZWxlbWVudC5jbG9zZXN0KFBSSUNFX0NPTlRBSU5FUl9TRUxFQ1RPUlMpO1xuICBpZiAoY29udGFpbmVyIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICByZXR1cm4gY29udGFpbmVyO1xuICB9XG4gIGlmIChlbGVtZW50LnBhcmVudEVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgIHJldHVybiBlbGVtZW50LnBhcmVudEVsZW1lbnQ7XG4gIH1cbiAgcmV0dXJuIGVsZW1lbnQgYXMgSFRNTEVsZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIGNvbGxlY3RQcmljaW5nSGlnaGxpZ2h0cyhcbiAgcGFnZVR5cGU6IFBhZ2VUeXBlLFxuICBzZWVuOiBNYXA8RWxlbWVudCwgUGFnZUhpZ2hsaWdodD4sXG4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiZGVsLCBzXCIpKSB7XG4gICAgaWYgKCFpc1Zpc2libGVIaWdobGlnaHRFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0ZXh0ID0gZWxlbWVudC50ZXh0Q29udGVudCA/PyBcIlwiO1xuICAgIGlmICghaGFzQ3VycmVuY3lUZXh0KHRleHQpICYmICEvW1xcZCwuXSsvLnRlc3QodGV4dCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGFkZENhbmRpZGF0ZShcbiAgICAgIHByaWNpbmdDb250YWluZXJGb3IoZWxlbWVudCksXG4gICAgICB7XG4gICAgICAgIGNhdGVnb3J5OiBcIlBSSUNJTkdfREVDRVBUSU9OXCIsXG4gICAgICAgIHBhdHRlcm5UeXBlOiBcIlN0cmlrZXRocm91Z2hQcmljZVwiLFxuICAgICAgICBzZXZlcml0eTogXCJNRURJVU1cIixcbiAgICAgICAgbGFiZWw6IFwiUHJpY2luZyBjdWVcIixcbiAgICAgIH0sXG4gICAgICBwYWdlVHlwZSxcbiAgICAgIHNlZW4sXG4gICAgKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICBQUklDRV9DT05UQUlORVJfU0VMRUNUT1JTLFxuICApKSB7XG4gICAgY29uc3QgdGV4dCA9IChlbGVtZW50LmlubmVyVGV4dCA/PyBcIlwiKS50cmltKCk7XG4gICAgaWYgKHRleHQubGVuZ3RoIDwgMyB8fCB0ZXh0Lmxlbmd0aCA+IDIwMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgaHRtbCA9IGVsZW1lbnQub3V0ZXJIVE1MO1xuICAgIGNvbnN0IGNvbWJpbmVkID0gYCR7dGV4dH1cXG4ke2h0bWx9YDtcbiAgICBjb25zdCBoYXNTdHJpa2UgPVxuICAgICAgZWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiZGVsLCBzXCIpICE9PSBudWxsIHx8XG4gICAgICAvbGluZS10aHJvdWdoL2kudGVzdCh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KS50ZXh0RGVjb3JhdGlvbik7XG5cbiAgICBpZiAoXG4gICAgICBmaXJzdE1hdGNoaW5nUGF0dGVybihjb21iaW5lZCwgUFJJQ0lOR19QQVRURVJOUykgfHxcbiAgICAgIChoYXNTdHJpa2UgJiYgaGFzQ3VycmVuY3lUZXh0KHRleHQpKVxuICAgICkge1xuICAgICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB7XG4gICAgICAgICAgY2F0ZWdvcnk6IFwiUFJJQ0lOR19ERUNFUFRJT05cIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogaGFzU3RyaWtlID8gXCJTdHJpa2V0aHJvdWdoUHJpY2VcIiA6IFwiTWlzbGVhZGluZ1ByaWNlXCIsXG4gICAgICAgICAgc2V2ZXJpdHk6IFwiTUVESVVNXCIsXG4gICAgICAgICAgbGFiZWw6IFwiUHJpY2luZyBjdWVcIixcbiAgICAgICAgfSxcbiAgICAgICAgcGFnZVR5cGUsXG4gICAgICAgIHNlZW4sXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIipcIikpIHtcbiAgICBpZiAoIWlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHRleHQgPSAoZWxlbWVudC5pbm5lclRleHQgPz8gXCJcIikudHJpbSgpO1xuICAgIGlmICh0ZXh0Lmxlbmd0aCA+IDgwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBzdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpO1xuICAgIGlmIChzdHlsZS50ZXh0RGVjb3JhdGlvbkxpbmUuaW5jbHVkZXMoXCJsaW5lLXRocm91Z2hcIikgJiYgaGFzQ3VycmVuY3lUZXh0KHRleHQpKSB7XG4gICAgICBhZGRDYW5kaWRhdGUoXG4gICAgICAgIHByaWNpbmdDb250YWluZXJGb3IoZWxlbWVudCksXG4gICAgICAgIHtcbiAgICAgICAgICBjYXRlZ29yeTogXCJQUklDSU5HX0RFQ0VQVElPTlwiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIlN0cmlrZXRocm91Z2hQcmljZVwiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlByaWNpbmcgY3VlXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHBhZ2VUeXBlLFxuICAgICAgICBzZWVuLFxuICAgICAgKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gY29sbGVjdFN0aWNreUhpZ2hsaWdodHMoXG4gIHBhZ2VUeXBlOiBQYWdlVHlwZSxcbiAgc2VlbjogTWFwPEVsZW1lbnQsIFBhZ2VIaWdobGlnaHQ+LFxuKTogdm9pZCB7XG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIipcIikpIHtcbiAgICBjb25zdCBzdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpO1xuICAgIGlmIChzdHlsZS5wb3NpdGlvbiAhPT0gXCJmaXhlZFwiICYmIHN0eWxlLnBvc2l0aW9uICE9PSBcInN0aWNreVwiKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoaXNOZXN0ZWRTdGlja3lFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0ZXh0ID0gZWxlbWVudC5pbm5lclRleHQgPz8gXCJcIjtcbiAgICBpZiAodGV4dC5sZW5ndGggPiA1MDApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbWJpbmVkID0gYCR7dGV4dH1cXG4ke2VsZW1lbnQub3V0ZXJIVE1MfWA7XG4gICAgY29uc3QgdXJnZW5jeSA9IGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKGNvbWJpbmVkLCBVUkdFTkNZX1BBVFRFUk5TKTtcbiAgICBjb25zdCBzY2FyY2l0eSA9IGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKGNvbWJpbmVkLCBTQ0FSQ0lUWV9QQVRURVJOUyk7XG5cbiAgICBpZiAodXJnZW5jeSkge1xuICAgICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB7XG4gICAgICAgICAgY2F0ZWdvcnk6IFwiVVJHRU5DWVwiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiAvY291bnRkb3dufHRpbWVyfGVuZHMgaW4gXFxkKy9pLnRlc3QoY29tYmluZWQpXG4gICAgICAgICAgICA/IFwiQ291bnRkb3duVGltZXJcIlxuICAgICAgICAgICAgOiBcIkxpbWl0ZWRUaW1lTWVzc2FnZVwiLFxuICAgICAgICAgIHNldmVyaXR5OiAvY291bnRkb3dufHRpbWVyfGVuZHMgaW4gXFxkKy9pLnRlc3QoY29tYmluZWQpXG4gICAgICAgICAgICA/IFwiSElHSFwiXG4gICAgICAgICAgICA6IFwiTUVESVVNXCIsXG4gICAgICAgICAgbGFiZWw6IFwiVXJnZW5jeSBiYW5uZXJcIixcbiAgICAgICAgfSxcbiAgICAgICAgcGFnZVR5cGUsXG4gICAgICAgIHNlZW4sXG4gICAgICApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKHNjYXJjaXR5KSB7XG4gICAgICBhZGRDYW5kaWRhdGUoXG4gICAgICAgIGVsZW1lbnQsXG4gICAgICAgIHtcbiAgICAgICAgICBjYXRlZ29yeTogXCJTQ0FSQ0lUWVwiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiAvb25seSBcXGQrIGxlZnR8bG93IHN0b2NrfGFsbW9zdCBzb2xkIG91dC9pLnRlc3QodGV4dClcbiAgICAgICAgICAgID8gXCJMb3dTdG9ja01lc3NhZ2VcIlxuICAgICAgICAgICAgOiBcIkhpZ2hEZW1hbmRNZXNzYWdlXCIsXG4gICAgICAgICAgc2V2ZXJpdHk6IFwiTUVESVVNXCIsXG4gICAgICAgICAgbGFiZWw6IFwiU2NhcmNpdHkgYmFubmVyXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHBhZ2VUeXBlLFxuICAgICAgICBzZWVuLFxuICAgICAgKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIC9jbGFzcz1cIlteXCJdKihtb2RhbHxwb3B1cHxwb3BvdmVyfG92ZXJsYXl8d2lkZ2V0fHN0aWNreS1iYW5uZXIpW15cIl0qXCIvaS50ZXN0KFxuICAgICAgICBlbGVtZW50Lm91dGVySFRNTCxcbiAgICAgICkgfHxcbiAgICAgIGVsZW1lbnQubWF0Y2hlcyhcInN0aWNreS1oZWFkZXIsIFtjbGFzcyo9J3N0aWNreS1oZWFkZXInXVwiKVxuICAgICkge1xuICAgICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB7XG4gICAgICAgICAgY2F0ZWdvcnk6IFwiTkFHR0lOR1wiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIlJlcGVhdGVkUG9wdXBPclN0aWNreUJhbm5lclwiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlN0aWNreSBvdmVybGF5XCIsXG4gICAgICAgIH0sXG4gICAgICAgIHBhZ2VUeXBlLFxuICAgICAgICBzZWVuLFxuICAgICAgKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gY29sbGVjdFRleHRIaWdobGlnaHRzKFxuICBwYWdlVHlwZTogUGFnZVR5cGUsXG4gIHNlZW46IE1hcDxFbGVtZW50LCBQYWdlSGlnaGxpZ2h0Pixcbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXG4gICAgSU5URVJBQ1RJVkVfU0VMRUNUT1JTLFxuICApKSB7XG4gICAgY29uc3QgdGV4dCA9IGVsZW1lbnQuaW5uZXJUZXh0ID8/IFwiXCI7XG4gICAgaWYgKHRleHQubGVuZ3RoIDwgNCB8fCB0ZXh0Lmxlbmd0aCA+IDQwMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgaHRtbCA9IGVsZW1lbnQub3V0ZXJIVE1MO1xuICAgIGNvbnN0IGNvbWJpbmVkID0gYCR7dGV4dH1cXG4ke2h0bWx9YDtcblxuICAgIGNvbnN0IHVyZ2VuY3kgPSBmaXJzdE1hdGNoaW5nUGF0dGVybihjb21iaW5lZCwgVVJHRU5DWV9QQVRURVJOUyk7XG4gICAgaWYgKHVyZ2VuY3kpIHtcbiAgICAgIGFkZENhbmRpZGF0ZShcbiAgICAgICAgZWxlbWVudCxcbiAgICAgICAge1xuICAgICAgICAgIGNhdGVnb3J5OiBcIlVSR0VOQ1lcIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogL2NvdW50ZG93bnx0aW1lcnxlbmRzIGluIFxcZCsvaS50ZXN0KGNvbWJpbmVkKVxuICAgICAgICAgICAgPyBcIkNvdW50ZG93blRpbWVyXCJcbiAgICAgICAgICAgIDogXCJMaW1pdGVkVGltZU1lc3NhZ2VcIixcbiAgICAgICAgICBzZXZlcml0eTogL2NvdW50ZG93bnx0aW1lcnxlbmRzIGluIFxcZCsvaS50ZXN0KGNvbWJpbmVkKVxuICAgICAgICAgICAgPyBcIkhJR0hcIlxuICAgICAgICAgICAgOiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlVyZ2VuY3kgY3VlXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHBhZ2VUeXBlLFxuICAgICAgICBzZWVuLFxuICAgICAgKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHNjYXJjaXR5ID0gZmlyc3RNYXRjaGluZ1BhdHRlcm4odGV4dCwgU0NBUkNJVFlfUEFUVEVSTlMpO1xuICAgIGlmIChzY2FyY2l0eSkge1xuICAgICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB7XG4gICAgICAgICAgY2F0ZWdvcnk6IFwiU0NBUkNJVFlcIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogL29ubHkgXFxkKyBsZWZ0fGxvdyBzdG9ja3xhbG1vc3Qgc29sZCBvdXQvaS50ZXN0KHRleHQpXG4gICAgICAgICAgICA/IFwiTG93U3RvY2tNZXNzYWdlXCJcbiAgICAgICAgICAgIDogXCJIaWdoRGVtYW5kTWVzc2FnZVwiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlNjYXJjaXR5IGN1ZVwiLFxuICAgICAgICB9LFxuICAgICAgICBwYWdlVHlwZSxcbiAgICAgICAgc2VlbixcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBzb2NpYWwgPSBmaXJzdE1hdGNoaW5nUGF0dGVybih0ZXh0LCBTT0NJQUxfUFJPT0ZfUEFUVEVSTlMpO1xuICAgIGlmIChzb2NpYWwpIHtcbiAgICAgIGFkZENhbmRpZGF0ZShcbiAgICAgICAgZWxlbWVudCxcbiAgICAgICAge1xuICAgICAgICAgIGNhdGVnb3J5OiBcIlNPQ0lBTF9QUk9PRlwiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIkFjdGl2aXR5Tm90aWZpY2F0aW9uc1wiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlNvY2lhbCBwcm9vZiBjdWVcIixcbiAgICAgICAgfSxcbiAgICAgICAgcGFnZVR5cGUsXG4gICAgICAgIHNlZW4sXG4gICAgICApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgcmV2aWV3ID0gZmlyc3RNYXRjaGluZ1BhdHRlcm4odGV4dCwgUkVWSUVXX1BBVFRFUk5TKTtcbiAgICBpZiAocmV2aWV3KSB7XG4gICAgICBhZGRDYW5kaWRhdGUoXG4gICAgICAgIGVsZW1lbnQsXG4gICAgICAgIHtcbiAgICAgICAgICBjYXRlZ29yeTogXCJTT0NJQUxfUFJPT0ZcIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogXCJBY3Rpdml0eU5vdGlmaWNhdGlvbnNcIixcbiAgICAgICAgICBzZXZlcml0eTogXCJNRURJVU1cIixcbiAgICAgICAgICBsYWJlbDogXCJSZXZpZXcgb3IgdGVzdGltb25pYWxcIixcbiAgICAgICAgfSxcbiAgICAgICAgcGFnZVR5cGUsXG4gICAgICAgIHNlZW4sXG4gICAgICApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3Qgc2hhbWluZyA9IGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKHRleHQsIENPTkZJUk1TSEFNSU5HX1BBVFRFUk5TKTtcbiAgICBpZiAoc2hhbWluZykge1xuICAgICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB7XG4gICAgICAgICAgY2F0ZWdvcnk6IFwiRk9SQ0VEX0FDVElPTlwiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIkNvbmZpcm1zaGFtaW5nXCIsXG4gICAgICAgICAgc2V2ZXJpdHk6IFwiTUVESVVNXCIsXG4gICAgICAgICAgbGFiZWw6IFwiUHJlc3N1cmUgd29yZGluZ1wiLFxuICAgICAgICB9LFxuICAgICAgICBwYWdlVHlwZSxcbiAgICAgICAgc2VlbixcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmljaW5nID0gZmlyc3RNYXRjaGluZ1BhdHRlcm4oY29tYmluZWQsIFBSSUNJTkdfUEFUVEVSTlMpO1xuICAgIGlmIChwcmljaW5nKSB7XG4gICAgICBhZGRDYW5kaWRhdGUoXG4gICAgICAgIGVsZW1lbnQsXG4gICAgICAgIHtcbiAgICAgICAgICBjYXRlZ29yeTogXCJQUklDSU5HX0RFQ0VQVElPTlwiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIk1pc2xlYWRpbmdQcmljZVwiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlByaWNpbmcgY3VlXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHBhZ2VUeXBlLFxuICAgICAgICBzZWVuLFxuICAgICAgKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IG5hZ2dpbmcgPSBmaXJzdE1hdGNoaW5nUGF0dGVybih0ZXh0LCBOQUdHSU5HX1BBVFRFUk5TKTtcbiAgICBpZiAobmFnZ2luZykge1xuICAgICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB7XG4gICAgICAgICAgY2F0ZWdvcnk6IFwiTkFHR0lOR1wiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIlJlcGVhdGVkUG9wdXBPclN0aWNreUJhbm5lclwiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlJlcGVhdGVkIHByb21wdFwiLFxuICAgICAgICB9LFxuICAgICAgICBwYWdlVHlwZSxcbiAgICAgICAgc2VlbixcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBlbnJvbGxtZW50ID0gZmlyc3RNYXRjaGluZ1BhdHRlcm4odGV4dCwgRU5ST0xMTUVOVF9QQVRURVJOUyk7XG4gICAgaWYgKGVucm9sbG1lbnQpIHtcbiAgICAgIGFkZENhbmRpZGF0ZShcbiAgICAgICAgZWxlbWVudCxcbiAgICAgICAge1xuICAgICAgICAgIGNhdGVnb3J5OiBcIkZPUkNFRF9BQ1RJT05cIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogXCJSZXF1aXJlZEVucm9sbG1lbnRcIixcbiAgICAgICAgICBzZXZlcml0eTogXCJNRURJVU1cIixcbiAgICAgICAgICBsYWJlbDogXCJTaWduLWluIHByb21wdFwiLFxuICAgICAgICB9LFxuICAgICAgICBwYWdlVHlwZSxcbiAgICAgICAgc2VlbixcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBzbmVha2luZyA9IGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKGNvbWJpbmVkLCBTTkVBS0lOR19QQVRURVJOUyk7XG4gICAgaWYgKHNuZWFraW5nKSB7XG4gICAgICBhZGRDYW5kaWRhdGUoXG4gICAgICAgIGVsZW1lbnQsXG4gICAgICAgIHtcbiAgICAgICAgICBjYXRlZ29yeTogXCJTTkVBS0lOR1wiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIkhpZGRlbkNvc3RcIixcbiAgICAgICAgICBzZXZlcml0eTogXCJNRURJVU1cIixcbiAgICAgICAgICBsYWJlbDogXCJIaWRkZW4gY29zdCBjdWVcIixcbiAgICAgICAgfSxcbiAgICAgICAgcGFnZVR5cGUsXG4gICAgICAgIHNlZW4sXG4gICAgICApO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBsYWJlbEZvckRldGVjdGlvbihkZXRlY3Rpb246IEhpZ2hsaWdodERldGVjdGlvbik6IHN0cmluZyB7XG4gIHN3aXRjaCAoZGV0ZWN0aW9uLmNhdGVnb3J5KSB7XG4gICAgY2FzZSBcIlVSR0VOQ1lcIjpcbiAgICAgIHJldHVybiAvY291bnRkb3dufHRpbWVyL2kudGVzdChkZXRlY3Rpb24ucGF0dGVyblR5cGUpXG4gICAgICAgID8gXCJDb3VudGRvd24gdGltZXJcIlxuICAgICAgICA6IFwiVXJnZW5jeSBjdWVcIjtcbiAgICBjYXNlIFwiU0NBUkNJVFlcIjpcbiAgICAgIHJldHVybiBcIlNjYXJjaXR5IGN1ZVwiO1xuICAgIGNhc2UgXCJTT0NJQUxfUFJPT0ZcIjpcbiAgICAgIHJldHVybiBcIlNvY2lhbCBwcm9vZiBjdWVcIjtcbiAgICBjYXNlIFwiUFJFU0VMRUNUSU9OXCI6XG4gICAgICByZXR1cm4gXCJQcmUtc2VsZWN0ZWQgb3B0aW9uXCI7XG4gICAgY2FzZSBcIk9CU1RSVUNUSU9OXCI6XG4gICAgICByZXR1cm4gXCJTdGlja3kgb3ZlcmxheVwiO1xuICAgIGNhc2UgXCJGT1JDRURfQUNUSU9OXCI6XG4gICAgICByZXR1cm4gZGV0ZWN0aW9uLnBhdHRlcm5UeXBlID09PSBcIlJlcXVpcmVkRW5yb2xsbWVudFwiXG4gICAgICAgID8gXCJTaWduLWluIHByb21wdFwiXG4gICAgICAgIDogXCJQcmVzc3VyZSB3b3JkaW5nXCI7XG4gICAgY2FzZSBcIlBSSUNJTkdfREVDRVBUSU9OXCI6XG4gICAgICByZXR1cm4gXCJQcmljaW5nIGN1ZVwiO1xuICAgIGNhc2UgXCJOQUdHSU5HXCI6XG4gICAgICByZXR1cm4gXCJSZXBlYXRlZCBwcm9tcHRcIjtcbiAgICBjYXNlIFwiTUlTRElSRUNUSU9OXCI6XG4gICAgICByZXR1cm4gXCJNaXNkaXJlY3Rpb24gY3VlXCI7XG4gICAgY2FzZSBcIlNORUFLSU5HXCI6XG4gICAgICByZXR1cm4gXCJIaWRkZW4gY29zdCBjdWVcIjtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFwiUHJlc3N1cmUgY3VlXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJpY2luZ0V2aWRlbmNlUGhyYXNlcyhldmlkZW5jZTogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBwaHJhc2VzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgY29uc3QgcXVvdGVkID0gZXZpZGVuY2UubWF0Y2goL1tcIuKAnF0oLis/KVtcIuKAnV0vKT8uWzFdO1xuICBpZiAocXVvdGVkICYmIHF1b3RlZC50cmltKCkubGVuZ3RoID49IDMpIHtcbiAgICBwaHJhc2VzLmFkZChxdW90ZWQudHJpbSgpKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgbWF0Y2ggb2YgZXZpZGVuY2UubWF0Y2hBbGwoLyg/OlNcXCR8XFwkfMKjfOKCrClcXHM/W1xcZCwuXSsvZykpIHtcbiAgICBwaHJhc2VzLmFkZChtYXRjaFswXS5yZXBsYWNlKC9cXHMvZywgXCJcIikpO1xuICAgIHBocmFzZXMuYWRkKG1hdGNoWzBdLnRyaW0oKSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IG1hdGNoIG9mIGV2aWRlbmNlLm1hdGNoQWxsKC9bXFxkLC5dK1xccyooPzolIG9mZnwlKS9naSkpIHtcbiAgICBwaHJhc2VzLmFkZChtYXRjaFswXS50cmltKCkpO1xuICB9XG5cbiAgZm9yIChjb25zdCBtYXRjaCBvZiBldmlkZW5jZS5tYXRjaEFsbCgvc2F2ZVxccytcXGQrXFxzKiUvZ2kpKSB7XG4gICAgcGhyYXNlcy5hZGQobWF0Y2hbMF0udHJpbSgpKTtcbiAgfVxuXG4gIHJldHVybiBbLi4ucGhyYXNlc10uZmlsdGVyKChwaHJhc2UpID0+IHBocmFzZS5sZW5ndGggPj0gMyk7XG59XG5cbmZ1bmN0aW9uIGZpbmRFbGVtZW50Q29udGFpbmluZ1BocmFzZShwaHJhc2U6IHN0cmluZyk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGNvbnN0IHBocmFzZUxvd2VyID0gcGhyYXNlLnRvTG93ZXJDYXNlKCk7XG4gIGxldCBiZXN0OiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBsZXQgYmVzdEFyZWEgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG5cbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFxuICAgIFRFWFRfU0VBUkNIX1NFTEVDVE9SUyxcbiAgKSkge1xuICAgIGlmICghaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgdGV4dCA9IChlbGVtZW50LmlubmVyVGV4dCA/PyBcIlwiKS50cmltKCk7XG4gICAgaWYgKHRleHQubGVuZ3RoID09PSAwIHx8IHRleHQubGVuZ3RoID4gNTAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKCF0ZXh0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocGhyYXNlTG93ZXIpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCByZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICBjb25zdCBhcmVhID0gcmVjdC53aWR0aCAqIHJlY3QuaGVpZ2h0O1xuICAgIGlmIChhcmVhID4gMCAmJiBhcmVhIDwgYmVzdEFyZWEpIHtcbiAgICAgIGJlc3QgPSBlbGVtZW50O1xuICAgICAgYmVzdEFyZWEgPSBhcmVhO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBiZXN0O1xufVxuXG5mdW5jdGlvbiBmaW5kU3RydWN0dXJhbFByaWNpbmdFbGVtZW50KCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcImRlbCwgc1wiKSkge1xuICAgIGlmICghaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHRleHQgPSBlbGVtZW50LnRleHRDb250ZW50ID8/IFwiXCI7XG4gICAgaWYgKGhhc0N1cnJlbmN5VGV4dCh0ZXh0KSB8fCAvW1xcZCwuXSsvLnRlc3QodGV4dCkpIHtcbiAgICAgIHJldHVybiBwcmljaW5nQ29udGFpbmVyRm9yKGVsZW1lbnQpO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICBQUklDRV9DT05UQUlORVJfU0VMRUNUT1JTLFxuICApKSB7XG4gICAgaWYgKCFpc1Zpc2libGVIaWdobGlnaHRFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0ZXh0ID0gKGVsZW1lbnQuaW5uZXJUZXh0ID8/IFwiXCIpLnRyaW0oKTtcbiAgICBpZiAodGV4dC5sZW5ndGggPCAzKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBoYXNTdHJpa2UgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoXCJkZWwsIHNcIikgIT09IG51bGw7XG4gICAgaWYgKGhhc1N0cmlrZSB8fCBmaXJzdE1hdGNoaW5nUGF0dGVybihgJHt0ZXh0fVxcbiR7ZWxlbWVudC5vdXRlckhUTUx9YCwgUFJJQ0lOR19QQVRURVJOUykpIHtcbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBmaW5kRWxlbWVudEJ5UHJpY2luZ0V2aWRlbmNlKGV2aWRlbmNlOiBzdHJpbmcpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICBmb3IgKGNvbnN0IHBocmFzZSBvZiBwcmljaW5nRXZpZGVuY2VQaHJhc2VzKGV2aWRlbmNlKSkge1xuICAgIGNvbnN0IGVsZW1lbnQgPSBmaW5kRWxlbWVudENvbnRhaW5pbmdQaHJhc2UocGhyYXNlKTtcbiAgICBpZiAoZWxlbWVudCkge1xuICAgICAgcmV0dXJuIHByaWNpbmdDb250YWluZXJGb3IoZWxlbWVudCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZpbmRTdHJ1Y3R1cmFsUHJpY2luZ0VsZW1lbnQoKTtcbn1cblxuZnVuY3Rpb24gc2NhcmNpdHlFdmlkZW5jZVBocmFzZXMoZXZpZGVuY2U6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3QgcGhyYXNlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIGNvbnN0IHF1b3RlZCA9IGV2aWRlbmNlLm1hdGNoKC9bXCLigJwnXSguKz8pW1wi4oCdJ10vKT8uWzFdO1xuICBpZiAocXVvdGVkPy50cmltKCkpIHtcbiAgICBjb25zdCB0cmltbWVkID0gcXVvdGVkLnRyaW0oKTtcbiAgICBwaHJhc2VzLmFkZCh0cmltbWVkKTtcbiAgICBmb3IgKGNvbnN0IHNlZ21lbnQgb2YgdHJpbW1lZC5zcGxpdChcInxcIikpIHtcbiAgICAgIGNvbnN0IHBhcnQgPSBzZWdtZW50LnRyaW0oKTtcbiAgICAgIGlmIChwYXJ0Lmxlbmd0aCA+PSAzKSB7XG4gICAgICAgIHBocmFzZXMuYWRkKHBhcnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgbWF0Y2ggb2YgZXZpZGVuY2UubWF0Y2hBbGwoXG4gICAgL1xcYihpbiBzdG9ja3xsb3cgc3RvY2t8b25seSBcXGQrIGxlZnR8b25seSBcXGQrIHJlbWFpbmluZ3xhbG1vc3Qgc29sZCBvdXR8c2VsbGluZyBmYXN0fGhpZ2ggZGVtYW5kfGxpbWl0ZWQgcXVhbnRpdHl8ZmV3IGxlZnQpXFxiL2dpLFxuICApKSB7XG4gICAgcGhyYXNlcy5hZGQobWF0Y2hbMF0udHJpbSgpKTtcbiAgfVxuXG4gIHJldHVybiBbLi4ucGhyYXNlc10uZmlsdGVyKChwaHJhc2UpID0+IHBocmFzZS5sZW5ndGggPj0gMyk7XG59XG5cbmZ1bmN0aW9uIGZpbmRTdHJ1Y3R1cmFsU2NhcmNpdHlFbGVtZW50KCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICBcInAsIHNwYW4sIGRpdiwgYnV0dG9uLCBhLCBsYWJlbCwgbGksIHN0cm9uZywgZW0sIHNtYWxsXCIsXG4gICkpIHtcbiAgICBpZiAoIWlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHRleHQgPSAoZWxlbWVudC5pbm5lclRleHQgPz8gXCJcIikudHJpbSgpO1xuICAgIGlmICh0ZXh0Lmxlbmd0aCA8IDMgfHwgdGV4dC5sZW5ndGggPiAyMDApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChmaXJzdE1hdGNoaW5nUGF0dGVybih0ZXh0LCBTQ0FSQ0lUWV9QQVRURVJOUykpIHtcbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBmaW5kRWxlbWVudEJ5U2NhcmNpdHlFdmlkZW5jZShldmlkZW5jZTogc3RyaW5nKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgZm9yIChjb25zdCBwaHJhc2Ugb2Ygc2NhcmNpdHlFdmlkZW5jZVBocmFzZXMoZXZpZGVuY2UpKSB7XG4gICAgY29uc3QgZWxlbWVudCA9IGZpbmRFbGVtZW50Q29udGFpbmluZ1BocmFzZShwaHJhc2UpO1xuICAgIGlmIChlbGVtZW50KSB7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmluZFN0cnVjdHVyYWxTY2FyY2l0eUVsZW1lbnQoKTtcbn1cblxuZnVuY3Rpb24gZXZpZGVuY2VQaHJhc2VzKGV2aWRlbmNlOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHBocmFzZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBmb3IgKGNvbnN0IG1hdGNoIG9mIGV2aWRlbmNlLm1hdGNoQWxsKC9bXCLigJwnXSguKz8pW1wi4oCdJ10vZykpIHtcbiAgICBjb25zdCB0cmltbWVkID0gbWF0Y2hbMV0udHJpbSgpO1xuICAgIGlmICh0cmltbWVkLmxlbmd0aCA+PSAzKSB7XG4gICAgICBwaHJhc2VzLmFkZCh0cmltbWVkKTtcbiAgICAgIGZvciAoY29uc3Qgc2VnbWVudCBvZiB0cmltbWVkLnNwbGl0KFwifFwiKSkge1xuICAgICAgICBjb25zdCBwYXJ0ID0gc2VnbWVudC50cmltKCk7XG4gICAgICAgIGlmIChwYXJ0Lmxlbmd0aCA+PSAzKSB7XG4gICAgICAgICAgcGhyYXNlcy5hZGQocGFydCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IG1hdGNoIG9mIGV2aWRlbmNlLm1hdGNoQWxsKC9gKFteYF0rKWAvZykpIHtcbiAgICBjb25zdCB0cmltbWVkID0gbWF0Y2hbMV0udHJpbSgpO1xuICAgIGlmICh0cmltbWVkLmxlbmd0aCA+PSAzKSB7XG4gICAgICBwaHJhc2VzLmFkZCh0cmltbWVkKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCB2aXNpYmxlVGV4dCA9IGV2aWRlbmNlLm1hdGNoKFxuICAgIC9WaXNpYmxlIHRleHQ6XFxzKltcIuKAnCddPyhbXlwi4oCdJ1xcbi5dKz8pW1wi4oCdJ10/KD86XFwufCR8XFxuKS9pLFxuICApPy5bMV07XG4gIGlmICh2aXNpYmxlVGV4dD8udHJpbSgpKSB7XG4gICAgcGhyYXNlcy5hZGQodmlzaWJsZVRleHQudHJpbSgpKTtcbiAgfVxuXG4gIGNvbnN0IHNuaXBwZXQgPSBldmlkZW5jZS5tYXRjaCgvU25pcHBldDpcXHMqKGBbXmBdK2B8PFtePlxcbl0rPikvaSk/LlsxXTtcbiAgaWYgKHNuaXBwZXQ/LnRyaW0oKSkge1xuICAgIHBocmFzZXMuYWRkKHNuaXBwZXQudHJpbSgpLnJlcGxhY2UoL15gfGAkL2csIFwiXCIpKTtcbiAgfVxuXG4gIGNvbnN0IGZhbGxiYWNrID0gZXZpZGVuY2VTZWFyY2hQaHJhc2UoZXZpZGVuY2UpO1xuICBpZiAoZmFsbGJhY2spIHtcbiAgICBwaHJhc2VzLmFkZChmYWxsYmFjayk7XG4gIH1cblxuICByZXR1cm4gWy4uLnBocmFzZXNdLmZpbHRlcigocGhyYXNlKSA9PiBwaHJhc2UubGVuZ3RoID49IDMpO1xufVxuXG5mdW5jdGlvbiBldmlkZW5jZVNlYXJjaFBocmFzZShldmlkZW5jZTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gIGNvbnN0IHF1b3RlZCA9IGV2aWRlbmNlLm1hdGNoKC9bXCLigJwnXSguKz8pW1wi4oCdJ10vKT8uWzFdO1xuICBpZiAocXVvdGVkICYmIHF1b3RlZC50cmltKCkubGVuZ3RoID49IDQpIHtcbiAgICByZXR1cm4gcXVvdGVkLnRyaW0oKTtcbiAgfVxuXG4gIGNvbnN0IGNsZWFuZWQgPSBldmlkZW5jZS5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gIGlmIChjbGVhbmVkLmxlbmd0aCA8IDQpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBjbGVhbmVkLnNsaWNlKDAsIE1hdGgubWluKDgwLCBjbGVhbmVkLmxlbmd0aCkpO1xufVxuXG5mdW5jdGlvbiBmaW5kRWxlbWVudEJ5RXZpZGVuY2UoZXZpZGVuY2U6IHN0cmluZyk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGZvciAoY29uc3QgcGhyYXNlIG9mIGV2aWRlbmNlUGhyYXNlcyhldmlkZW5jZSkpIHtcbiAgICBjb25zdCBlbGVtZW50ID0gZmluZEVsZW1lbnRDb250YWluaW5nUGhyYXNlKHBocmFzZSk7XG4gICAgaWYgKGVsZW1lbnQpIHtcbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5jb25zdCBQT1BVUF9TRUxFQ1RPUlMgPSBbXG4gICdbcm9sZT1cImRpYWxvZ1wiXScsXG4gICdbY2xhc3MqPVwibW9kYWxcIl0nLFxuICAnW2NsYXNzKj1cIk1vZGFsXCJdJyxcbiAgJ1tjbGFzcyo9XCJwb3B1cFwiXScsXG4gICdbY2xhc3MqPVwiUG9wdXBcIl0nLFxuICAnW2NsYXNzKj1cInBvcG92ZXJcIl0nLFxuICAnW2NsYXNzKj1cIlBvcG92ZXJcIl0nLFxuICAnW2NsYXNzKj1cIm92ZXJsYXlcIl0nLFxuICAnW2NsYXNzKj1cIk92ZXJsYXlcIl0nLFxuICAnW2NsYXNzKj1cIndpZGdldFwiXScsXG4gICdbY2xhc3MqPVwiV2lkZ2V0XCJdJyxcbiAgJ1tjbGFzcyo9XCJuZXdzbGV0dGVyXCJdJyxcbiAgJ1tjbGFzcyo9XCJzdGlja3ktYmFubmVyXCJdJyxcbiAgJ1tjbGFzcyo9XCJhbm5vdW5jZW1lbnRcIl0nLFxuICBcInN0aWNreS1oZWFkZXJcIixcbiAgJ1tjbGFzcyo9XCJzdGlja3ktaGVhZGVyXCJdJyxcbl0uam9pbihcIixcIik7XG5cbmNvbnN0IFNUSUNLWV9QUk9NT19TRUxFQ1RPUlMgPSBbXG4gIFwic3RpY2t5LWhlYWRlclwiLFxuICAnW2NsYXNzKj1cInN0aWNreS1oZWFkZXJcIl0nLFxuICAnW2NsYXNzKj1cImFubm91bmNlbWVudC1iYXJcIl0nLFxuICAnW2NsYXNzKj1cInByb21vLWJhclwiXScsXG4gICdbY2xhc3MqPVwicHJvbW8tdGlja2VyXCJdJyxcbiAgJ1tjbGFzcyo9XCJ0aWNrZXJcIl0nLFxuICBcImhlYWRlcltjbGFzcyo9J3N0aWNreSddXCIsXG4gICdbY2xhc3MqPVwiaGVhZGVyLS1zdGlja3lcIl0nLFxuXS5qb2luKFwiLFwiKTtcblxuY29uc3QgVEVYVF9TRUFSQ0hfU0VMRUNUT1JTID1cbiAgXCJwLCBzcGFuLCBkaXYsIGJ1dHRvbiwgYSwgbGFiZWwsIGxpLCBoMSwgaDIsIGgzLCBoNCwgdGQsIHN0cm9uZywgZW0sIHNtYWxsLCBkZWwsIHMsIHN0aWNreS1oZWFkZXIsIGhlYWRlciwgbmF2LCBzZWN0aW9uLCBbY2xhc3MqPSdiYW5uZXInXSwgW2NsYXNzKj0ndGlja2VyJ10sIFtjbGFzcyo9J3BvcG92ZXInXSwgW2NsYXNzKj0nd2lkZ2V0J11cIjtcblxuY29uc3QgT1ZFUkxBWV9DTEFTU19ISU5UID1cbiAgL21vZGFsfHBvcHVwfHBvcG92ZXJ8b3ZlcmxheXx3aWRnZXR8YmFubmVyfHN0aWNreXxuZXdzbGV0dGVyfGNsb3NlfHRpY2tlcnxhbm5vdW5jZW1lbnQvaTtcblxuZnVuY3Rpb24gZXh0cmFjdENsYXNzRnJhZ21lbnRzRnJvbVNuaXBwZXQoc25pcHBldDogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBmcmFnbWVudHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBmb3IgKGNvbnN0IG1hdGNoIG9mIHNuaXBwZXQubWF0Y2hBbGwoL2NsYXNzPVwiKFteXCJdKylcIi9naSkpIHtcbiAgICBmb3IgKGNvbnN0IHRva2VuIG9mIG1hdGNoWzFdLnNwbGl0KC9cXHMrLykpIHtcbiAgICAgIGNvbnN0IHRyaW1tZWQgPSB0b2tlbi50cmltKCk7XG4gICAgICBpZiAodHJpbW1lZC5sZW5ndGggPCA0KSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgZnJhZ21lbnRzLmFkZCh0cmltbWVkKTtcbiAgICAgIGZvciAoY29uc3QgcGFydCBvZiB0cmltbWVkLnNwbGl0KFwiX19cIikpIHtcbiAgICAgICAgaWYgKHBhcnQubGVuZ3RoID49IDQpIHtcbiAgICAgICAgICBmcmFnbWVudHMuYWRkKHBhcnQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIFsuLi5mcmFnbWVudHNdO1xufVxuXG5mdW5jdGlvbiBmaW5kRWxlbWVudEJ5Q2xhc3NGcmFnbWVudChmcmFnbWVudDogc3RyaW5nKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgY29uc3QgbmVlZGxlID0gZnJhZ21lbnQudG9Mb3dlckNhc2UoKTtcbiAgaWYgKG5lZWRsZS5sZW5ndGggPCA0KSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBsZXQgYmVzdDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgbGV0IGJlc3RBcmVhID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuXG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIltjbGFzc11cIikpIHtcbiAgICBjb25zdCBjbGFzc05hbWUgPSBlbGVtZW50LmNsYXNzTmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmICghY2xhc3NOYW1lLmluY2x1ZGVzKG5lZWRsZSkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoIWlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIGNvbnN0IGFyZWEgPSByZWN0LndpZHRoICogcmVjdC5oZWlnaHQ7XG4gICAgaWYgKGFyZWEgPiAwICYmIGFyZWEgPCBiZXN0QXJlYSkge1xuICAgICAgYmVzdCA9IGVsZW1lbnQ7XG4gICAgICBiZXN0QXJlYSA9IGFyZWE7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJlc3Q7XG59XG5cbmZ1bmN0aW9uIGZpbmRFbGVtZW50RnJvbUh0bWxTbmlwcGV0KHNuaXBwZXQ6IHN0cmluZyk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGZvciAoY29uc3QgZnJhZ21lbnQgb2YgZXh0cmFjdENsYXNzRnJhZ21lbnRzRnJvbVNuaXBwZXQoc25pcHBldCkpIHtcbiAgICBjb25zdCBlbGVtZW50ID0gZmluZEVsZW1lbnRCeUNsYXNzRnJhZ21lbnQoZnJhZ21lbnQpO1xuICAgIGlmIChlbGVtZW50KSB7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9XG4gIH1cblxuICBjb25zdCB0YWdNYXRjaCA9IHNuaXBwZXQubWF0Y2goL148XFxzKihbYS16XVthLXowLTktXSopL2kpO1xuICBpZiAodGFnTWF0Y2gpIHtcbiAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4odGFnTWF0Y2hbMV0pKSB7XG4gICAgICBpZiAoaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgICAgICByZXR1cm4gZWxlbWVudDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNPdmVybGF5TGlrZUVsZW1lbnQoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBib29sZWFuIHtcbiAgY29uc3QgY2xhc3NOYW1lID0gZWxlbWVudC5jbGFzc05hbWUudG9Mb3dlckNhc2UoKTtcbiAgY29uc3QgaHRtbCA9IGVsZW1lbnQub3V0ZXJIVE1MLnRvTG93ZXJDYXNlKCk7XG4gIHJldHVybiAoXG4gICAgT1ZFUkxBWV9DTEFTU19ISU5ULnRlc3QoY2xhc3NOYW1lKSB8fFxuICAgIE9WRVJMQVlfQ0xBU1NfSElOVC50ZXN0KGh0bWwpIHx8XG4gICAgZWxlbWVudC5tYXRjaGVzKFxuICAgICAgXCJzdGlja3ktaGVhZGVyLCBbY2xhc3MqPSdzdGlja3ktaGVhZGVyJ10sIFtyb2xlPSdkaWFsb2cnXSwgW2NsYXNzKj0ncG9wb3ZlciddLCBbY2xhc3MqPSd3aWRnZXQnXVwiLFxuICAgIClcbiAgKTtcbn1cblxuZnVuY3Rpb24gZmluZFN0cnVjdHVyYWxTdGlja3lQcm9tb0VsZW1lbnQoKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFxuICAgIFNUSUNLWV9QUk9NT19TRUxFQ1RPUlMsXG4gICkpIHtcbiAgICBpZiAoaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGZpbmRTdHJ1Y3R1cmFsUG9wdXBFbGVtZW50KCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihQT1BVUF9TRUxFQ1RPUlMpKSB7XG4gICAgaWYgKGlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH1cbiAgfVxuXG4gIGxldCBiZXN0T3ZlcmxheTogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgbGV0IGJlc3RPdmVybGF5QXJlYSA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcblxuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCIqXCIpKSB7XG4gICAgY29uc3Qgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KTtcbiAgICBpZiAoc3R5bGUucG9zaXRpb24gIT09IFwiZml4ZWRcIiAmJiBzdHlsZS5wb3NpdGlvbiAhPT0gXCJzdGlja3lcIikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChpc05lc3RlZFN0aWNreUVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHRleHQgPSAoZWxlbWVudC5pbm5lclRleHQgPz8gXCJcIikudHJpbSgpO1xuICAgIGlmICh0ZXh0Lmxlbmd0aCA+IDUwMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICghaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGlzT3ZlcmxheUxpa2VFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICBjb25zdCByZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIGNvbnN0IGFyZWEgPSByZWN0LndpZHRoICogcmVjdC5oZWlnaHQ7XG4gICAgICBpZiAoYXJlYSA+IDAgJiYgYXJlYSA8IGJlc3RPdmVybGF5QXJlYSkge1xuICAgICAgICBiZXN0T3ZlcmxheSA9IGVsZW1lbnQ7XG4gICAgICAgIGJlc3RPdmVybGF5QXJlYSA9IGFyZWE7XG4gICAgICB9XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoIWJlc3RPdmVybGF5KSB7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYmVzdE92ZXJsYXk7XG59XG5cbmZ1bmN0aW9uIGlzU3RpY2t5T3ZlcmxheURldGVjdGlvbihkZXRlY3Rpb246IEhpZ2hsaWdodERldGVjdGlvbik6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIGRldGVjdGlvbi5jYXRlZ29yeSA9PT0gXCJPQlNUUlVDVElPTlwiIHx8XG4gICAgZGV0ZWN0aW9uLmNhdGVnb3J5ID09PSBcIk5BR0dJTkdcIiB8fFxuICAgIHBhdHRlcm5UeXBlc01hdGNoKGRldGVjdGlvbi5wYXR0ZXJuVHlwZSwgXCJTdGlja3lQcmVzc3VyZUJhbm5lclwiKSB8fFxuICAgIHBhdHRlcm5UeXBlc01hdGNoKGRldGVjdGlvbi5wYXR0ZXJuVHlwZSwgXCJSZXBlYXRlZFBvcHVwT3JTdGlja3lCYW5uZXJcIilcbiAgKTtcbn1cblxuZnVuY3Rpb24gaXNTdGlja3lQcm9tb0RldGVjdGlvbihkZXRlY3Rpb246IEhpZ2hsaWdodERldGVjdGlvbik6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIGRldGVjdGlvbi5jYXRlZ29yeSA9PT0gXCJGT1JDRURfQUNUSU9OXCIgJiZcbiAgICAoL3N0aWNreXx0aWNrZXJ8cHJvbW98YmFubmVyfGhlYWRlci9pLnRlc3QoZGV0ZWN0aW9uLmV2aWRlbmNlKSB8fFxuICAgICAgL3N0aWNreXxwcm9tb3x0aWNrZXJ8YmFubmVyL2kudGVzdChkZXRlY3Rpb24ucGF0dGVyblR5cGUpKVxuICApO1xufVxuXG5mdW5jdGlvbiBmaW5kU3RydWN0dXJhbEVucm9sbG1lbnRFbGVtZW50KCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICBcImEsIGJ1dHRvbiwgbmF2LCBoZWFkZXIsIFtjbGFzcyo9J2FjY291bnQnXSwgW2NsYXNzKj0nc2lnbmluJ10sIFtjbGFzcyo9J2xvZ2luJ11cIixcbiAgKSkge1xuICAgIGlmICghaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgdGV4dCA9IChlbGVtZW50LmlubmVyVGV4dCA/PyBcIlwiKS50cmltKCk7XG4gICAgaWYgKHRleHQubGVuZ3RoIDwgMyB8fCB0ZXh0Lmxlbmd0aCA+IDIwMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKHRleHQsIEVOUk9MTE1FTlRfUEFUVEVSTlMpKSB7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZmluZFN0cnVjdHVyYWxSZXZpZXdFbGVtZW50KCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICAnW2NsYXNzKj1cInJldmlld1wiXSwgW2NsYXNzKj1cInRlc3RpbW9uaWFsXCJdLCBibG9ja3F1b3RlLCBbaXRlbXByb3A9XCJyZXZpZXdcIl0nLFxuICApKSB7XG4gICAgaWYgKGlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICBcInAsIHNwYW4sIGRpdiwgc2VjdGlvbiwgYXJ0aWNsZVwiLFxuICApKSB7XG4gICAgaWYgKCFpc1Zpc2libGVIaWdobGlnaHRFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0ZXh0ID0gKGVsZW1lbnQuaW5uZXJUZXh0ID8/IFwiXCIpLnRyaW0oKTtcbiAgICBpZiAodGV4dC5sZW5ndGggPCAyMCB8fCB0ZXh0Lmxlbmd0aCA+IDYwMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKHRleHQsIFJFVklFV19QQVRURVJOUykpIHtcbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBmaW5kU3RydWN0dXJhbFNvY2lhbFByb29mRWxlbWVudCgpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXG4gICAgXCJwLCBzcGFuLCBkaXYsIGJ1dHRvbiwgYSwgbGFiZWwsIGxpLCBzdHJvbmcsIGVtLCBzbWFsbFwiLFxuICApKSB7XG4gICAgaWYgKCFpc1Zpc2libGVIaWdobGlnaHRFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0ZXh0ID0gKGVsZW1lbnQuaW5uZXJUZXh0ID8/IFwiXCIpLnRyaW0oKTtcbiAgICBpZiAodGV4dC5sZW5ndGggPCAzIHx8IHRleHQubGVuZ3RoID4gMjAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoZmlyc3RNYXRjaGluZ1BhdHRlcm4odGV4dCwgU09DSUFMX1BST09GX1BBVFRFUk5TKSkge1xuICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGZpbmRFbGVtZW50Rm9yRGV0ZWN0aW9uKFxuICBkZXRlY3Rpb246IEhpZ2hsaWdodERldGVjdGlvbixcbik6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGNvbnN0IHNuaXBwZXRNYXRjaCA9XG4gICAgZGV0ZWN0aW9uLmV2aWRlbmNlLm1hdGNoKC9TbmlwcGV0OlxccypgKFteYF0rKWAvaSkgPz9cbiAgICBkZXRlY3Rpb24uZXZpZGVuY2UubWF0Y2goL1NuaXBwZXQ6XFxzKig8W14+XFxuXSs+KS9pKTtcbiAgaWYgKHNuaXBwZXRNYXRjaCkge1xuICAgIGNvbnN0IGZyb21TbmlwcGV0ID0gZmluZEVsZW1lbnRGcm9tSHRtbFNuaXBwZXQoc25pcHBldE1hdGNoWzFdKTtcbiAgICBpZiAoZnJvbVNuaXBwZXQpIHtcbiAgICAgIHJldHVybiBmcm9tU25pcHBldDtcbiAgICB9XG4gIH1cblxuICBpZiAoZGV0ZWN0aW9uLmNhdGVnb3J5ID09PSBcIlBSSUNJTkdfREVDRVBUSU9OXCIpIHtcbiAgICByZXR1cm4gKFxuICAgICAgZmluZEVsZW1lbnRCeVByaWNpbmdFdmlkZW5jZShkZXRlY3Rpb24uZXZpZGVuY2UpID8/XG4gICAgICBmaW5kU3RydWN0dXJhbFByaWNpbmdFbGVtZW50KClcbiAgICApO1xuICB9XG5cbiAgaWYgKGRldGVjdGlvbi5jYXRlZ29yeSA9PT0gXCJTQ0FSQ0lUWVwiKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGZpbmRFbGVtZW50QnlTY2FyY2l0eUV2aWRlbmNlKGRldGVjdGlvbi5ldmlkZW5jZSkgPz9cbiAgICAgIGZpbmRTdHJ1Y3R1cmFsU2NhcmNpdHlFbGVtZW50KClcbiAgICApO1xuICB9XG5cbiAgaWYgKGlzU3RpY2t5T3ZlcmxheURldGVjdGlvbihkZXRlY3Rpb24pKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGZpbmRFbGVtZW50QnlFdmlkZW5jZShkZXRlY3Rpb24uZXZpZGVuY2UpID8/XG4gICAgICBmaW5kU3RydWN0dXJhbFBvcHVwRWxlbWVudCgpXG4gICAgKTtcbiAgfVxuXG4gIGlmIChpc1N0aWNreVByb21vRGV0ZWN0aW9uKGRldGVjdGlvbikpIHtcbiAgICByZXR1cm4gKFxuICAgICAgZmluZEVsZW1lbnRCeUV2aWRlbmNlKGRldGVjdGlvbi5ldmlkZW5jZSkgPz9cbiAgICAgIGZpbmRTdHJ1Y3R1cmFsU3RpY2t5UHJvbW9FbGVtZW50KClcbiAgICApO1xuICB9XG5cbiAgY29uc3QgYnlFdmlkZW5jZSA9IGZpbmRFbGVtZW50QnlFdmlkZW5jZShkZXRlY3Rpb24uZXZpZGVuY2UpO1xuICBpZiAoYnlFdmlkZW5jZSkge1xuICAgIHJldHVybiBieUV2aWRlbmNlO1xuICB9XG5cbiAgaWYgKFxuICAgIGRldGVjdGlvbi5jYXRlZ29yeSA9PT0gXCJOQUdHSU5HXCIgfHxcbiAgICBwYXR0ZXJuVHlwZXNNYXRjaChkZXRlY3Rpb24ucGF0dGVyblR5cGUsIFwiUmVwZWF0ZWRQb3B1cE9yU3RpY2t5QmFubmVyXCIpXG4gICkge1xuICAgIHJldHVybiBmaW5kU3RydWN0dXJhbFBvcHVwRWxlbWVudCgpO1xuICB9XG5cbiAgaWYgKFxuICAgIGRldGVjdGlvbi5jYXRlZ29yeSA9PT0gXCJGT1JDRURfQUNUSU9OXCIgJiZcbiAgICBwYXR0ZXJuVHlwZXNNYXRjaChkZXRlY3Rpb24ucGF0dGVyblR5cGUsIFwiUmVxdWlyZWRFbnJvbGxtZW50XCIpXG4gICkge1xuICAgIHJldHVybiBmaW5kU3RydWN0dXJhbEVucm9sbG1lbnRFbGVtZW50KCk7XG4gIH1cblxuICBpZiAoZGV0ZWN0aW9uLmNhdGVnb3J5ID09PSBcIlNPQ0lBTF9QUk9PRlwiKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGZpbmRFbGVtZW50QnlFdmlkZW5jZShkZXRlY3Rpb24uZXZpZGVuY2UpID8/XG4gICAgICBmaW5kU3RydWN0dXJhbFJldmlld0VsZW1lbnQoKSA/P1xuICAgICAgZmluZFN0cnVjdHVyYWxTb2NpYWxQcm9vZkVsZW1lbnQoKVxuICAgICk7XG4gIH1cblxuICBpZiAoZGV0ZWN0aW9uLmNhdGVnb3J5ID09PSBcIlVSR0VOQ1lcIikge1xuICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICAgIElOVEVSQUNUSVZFX1NFTEVDVE9SUyxcbiAgICApKSB7XG4gICAgICBjb25zdCB0ZXh0ID0gZWxlbWVudC5pbm5lclRleHQgPz8gXCJcIjtcbiAgICAgIGlmICh0ZXh0Lmxlbmd0aCA8IDQgfHwgdGV4dC5sZW5ndGggPiA0MDApIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAoZmlyc3RNYXRjaGluZ1BhdHRlcm4oYCR7dGV4dH1cXG4ke2VsZW1lbnQub3V0ZXJIVE1MfWAsIFVSR0VOQ1lfUEFUVEVSTlMpKSB7XG4gICAgICAgIHJldHVybiBlbGVtZW50O1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmaW5kRWxlbWVudEJ5RXZpZGVuY2UoZGV0ZWN0aW9uLmV2aWRlbmNlKTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBmaW5hbGl6ZUhpZ2hsaWdodHMoc2VlbjogTWFwPEVsZW1lbnQsIFBhZ2VIaWdobGlnaHQ+KTogUGFnZUhpZ2hsaWdodFtdIHtcbiAgY29uc3QgdmlzaWJsZSA9IEFycmF5LmZyb20oc2Vlbi52YWx1ZXMoKSlcbiAgICAuZmlsdGVyKChoaWdobGlnaHQpID0+IHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFxuICAgICAgICBgWyR7SElHSExJR0hUX0lEX0FUVFJ9PVwiJHtoaWdobGlnaHQuaWR9XCJdYCxcbiAgICAgICk7XG4gICAgICByZXR1cm4gZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50ICYmIGlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCk7XG4gICAgfSlcbiAgICAuc29ydCgoYSwgYikgPT4gc2V2ZXJpdHlSYW5rKGIuc2V2ZXJpdHkpIC0gc2V2ZXJpdHlSYW5rKGEuc2V2ZXJpdHkpKTtcblxuICBjb25zdCBjb3VudGRvd25zID0gdmlzaWJsZS5maWx0ZXIoXG4gICAgKGhpZ2hsaWdodCkgPT4gaGlnaGxpZ2h0LnBhdHRlcm5UeXBlID09PSBcIkNvdW50ZG93blRpbWVyXCIsXG4gICk7XG4gIGNvbnN0IHJlc3QgPSB2aXNpYmxlLmZpbHRlcihcbiAgICAoaGlnaGxpZ2h0KSA9PiBoaWdobGlnaHQucGF0dGVyblR5cGUgIT09IFwiQ291bnRkb3duVGltZXJcIixcbiAgKTtcblxuICByZXR1cm4gWy4uLmNvdW50ZG93bnMsIC4uLnJlc3RdLnNsaWNlKDAsIE1BWF9ISUdITElHSFRTKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVucmljaEhpZ2hsaWdodHNGcm9tRGV0ZWN0aW9ucyhcbiAgZXhpc3Rpbmc6IFBhZ2VIaWdobGlnaHRbXSxcbiAgZGV0ZWN0aW9uczogSGlnaGxpZ2h0RGV0ZWN0aW9uW10sXG4gIHBhZ2VUeXBlOiBQYWdlVHlwZSxcbik6IFBhZ2VIaWdobGlnaHRbXSB7XG4gIGNvbnN0IHNlZW4gPSBuZXcgTWFwPEVsZW1lbnQsIFBhZ2VIaWdobGlnaHQ+KCk7XG5cbiAgZm9yIChjb25zdCBoaWdobGlnaHQgb2YgZXhpc3RpbmcpIHtcbiAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgIGBbJHtISUdITElHSFRfSURfQVRUUn09XCIke2hpZ2hsaWdodC5pZH1cIl1gLFxuICAgICk7XG4gICAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgICAgc2Vlbi5zZXQoZWxlbWVudCwgaGlnaGxpZ2h0KTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBwcmljaW5nRGV0ZWN0aW9ucyA9IGRldGVjdGlvbnMuZmlsdGVyKFxuICAgIChkZXRlY3Rpb24pID0+IGRldGVjdGlvbi5jYXRlZ29yeSA9PT0gXCJQUklDSU5HX0RFQ0VQVElPTlwiLFxuICApO1xuICBjb25zdCBvdGhlckRldGVjdGlvbnMgPSBkZXRlY3Rpb25zLmZpbHRlcihcbiAgICAoZGV0ZWN0aW9uKSA9PiBkZXRlY3Rpb24uY2F0ZWdvcnkgIT09IFwiUFJJQ0lOR19ERUNFUFRJT05cIixcbiAgKTtcblxuICBmb3IgKGNvbnN0IGRldGVjdGlvbiBvZiBbLi4ucHJpY2luZ0RldGVjdGlvbnMsIC4uLm90aGVyRGV0ZWN0aW9uc10pIHtcbiAgICBjb25zdCBlbGVtZW50ID0gZmluZEVsZW1lbnRGb3JEZXRlY3Rpb24oZGV0ZWN0aW9uKTtcbiAgICBpZiAoIWVsZW1lbnQpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHRhcmdldCA9IGhpZ2hsaWdodFRhcmdldChlbGVtZW50KTtcbiAgICBpZiAoISh0YXJnZXQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGV4aXN0aW5nRm9yVGFyZ2V0ID0gc2Vlbi5nZXQodGFyZ2V0KTtcbiAgICBpZiAoZXhpc3RpbmdGb3JUYXJnZXQpIHtcbiAgICAgIHNlZW4uc2V0KHRhcmdldCwge1xuICAgICAgICAuLi5leGlzdGluZ0ZvclRhcmdldCxcbiAgICAgICAgcGF0dGVyblR5cGU6IGRldGVjdGlvbi5wYXR0ZXJuVHlwZSxcbiAgICAgICAgZXZpZGVuY2U6IGRldGVjdGlvbi5ldmlkZW5jZSB8fCBleGlzdGluZ0ZvclRhcmdldC5ldmlkZW5jZSxcbiAgICAgICAgc2V2ZXJpdHk6XG4gICAgICAgICAgc2V2ZXJpdHlSYW5rKGRldGVjdGlvbi5zZXZlcml0eSkgPlxuICAgICAgICAgIHNldmVyaXR5UmFuayhleGlzdGluZ0ZvclRhcmdldC5zZXZlcml0eSlcbiAgICAgICAgICAgID8gZGV0ZWN0aW9uLnNldmVyaXR5XG4gICAgICAgICAgICA6IGV4aXN0aW5nRm9yVGFyZ2V0LnNldmVyaXR5LFxuICAgICAgICBsYWJlbDogbGFiZWxGb3JEZXRlY3Rpb24oZGV0ZWN0aW9uKSxcbiAgICAgIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgZWxlbWVudCxcbiAgICAgIHtcbiAgICAgICAgY2F0ZWdvcnk6IGRldGVjdGlvbi5jYXRlZ29yeSBhcyBEZXRlY3Rpb25DYXRlZ29yeSxcbiAgICAgICAgcGF0dGVyblR5cGU6IGRldGVjdGlvbi5wYXR0ZXJuVHlwZSxcbiAgICAgICAgc2V2ZXJpdHk6IGRldGVjdGlvbi5zZXZlcml0eSxcbiAgICAgICAgbGFiZWw6IGxhYmVsRm9yRGV0ZWN0aW9uKGRldGVjdGlvbiksXG4gICAgICAgIGV2aWRlbmNlOiBkZXRlY3Rpb24uZXZpZGVuY2UsXG4gICAgICB9LFxuICAgICAgcGFnZVR5cGUsXG4gICAgICBzZWVuLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gZmluYWxpemVIaWdobGlnaHRzKHNlZW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29sbGVjdFBhZ2VIaWdobGlnaHRzKHBhZ2VUeXBlOiBQYWdlVHlwZSk6IFBhZ2VIaWdobGlnaHRbXSB7XG4gIGNvbnN0IHNlZW4gPSBuZXcgTWFwPEVsZW1lbnQsIFBhZ2VIaWdobGlnaHQ+KCk7XG5cbiAgY29sbGVjdENvdW50ZG93bkhpZ2hsaWdodHMocGFnZVR5cGUsIHNlZW4pO1xuICBjb2xsZWN0UHJlc2VsZWN0aW9uSGlnaGxpZ2h0cyhwYWdlVHlwZSwgc2Vlbik7XG4gIGNvbGxlY3RQcmljaW5nSGlnaGxpZ2h0cyhwYWdlVHlwZSwgc2Vlbik7XG4gIGNvbGxlY3RUZXh0SGlnaGxpZ2h0cyhwYWdlVHlwZSwgc2Vlbik7XG4gIGNvbGxlY3RTdGlja3lIaWdobGlnaHRzKHBhZ2VUeXBlLCBzZWVuKTtcblxuICByZXR1cm4gZmluYWxpemVIaWdobGlnaHRzKHNlZW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xlYXJIaWdobGlnaHRNYXJrZXJzKCk6IHZvaWQge1xuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChgWyR7SElHSExJR0hUX0lEX0FUVFJ9XWApKSB7XG4gICAgZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoSElHSExJR0hUX0lEX0FUVFIpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlSGlnaGxpZ2h0RWxlbWVudChcbiAgaGlnaGxpZ2h0OiBQYWdlSGlnaGxpZ2h0LFxuKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgY29uc3QgbWFya2VkID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICBgWyR7SElHSExJR0hUX0lEX0FUVFJ9PVwiJHtoaWdobGlnaHQuaWR9XCJdYCxcbiAgKTtcbiAgaWYgKG1hcmtlZCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50ICYmIGlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQobWFya2VkKSkge1xuICAgIHJldHVybiBtYXJrZWQ7XG4gIH1cblxuICByZXR1cm4gcmVzb2x2ZUhpZ2hsaWdodEVsZW1lbnRGb3JTY3JvbGwoaGlnaGxpZ2h0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVIaWdobGlnaHRFbGVtZW50Rm9yU2Nyb2xsKFxuICBoaWdobGlnaHQ6IFBhZ2VIaWdobGlnaHQsXG4gIGRldGVjdGlvbj86IEhpZ2hsaWdodERldGVjdGlvbixcbik6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGNvbnN0IG1hcmtlZCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXG4gICAgYFske0hJR0hMSUdIVF9JRF9BVFRSfT1cIiR7aGlnaGxpZ2h0LmlkfVwiXWAsXG4gICk7XG4gIGlmIChtYXJrZWQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgIHJldHVybiBtYXJrZWQ7XG4gIH1cblxuICBjb25zdCBldmlkZW5jZSA9IGhpZ2hsaWdodC5ldmlkZW5jZSA/PyBkZXRlY3Rpb24/LmV2aWRlbmNlID8/IFwiXCI7XG4gIGNvbnN0IGRldGVjdGlvblBheWxvYWQ6IEhpZ2hsaWdodERldGVjdGlvbiA9IHtcbiAgICBjYXRlZ29yeTogZGV0ZWN0aW9uPy5jYXRlZ29yeSA/PyBoaWdobGlnaHQuY2F0ZWdvcnksXG4gICAgcGF0dGVyblR5cGU6IGRldGVjdGlvbj8ucGF0dGVyblR5cGUgPz8gaGlnaGxpZ2h0LnBhdHRlcm5UeXBlLFxuICAgIHNldmVyaXR5OiBkZXRlY3Rpb24/LnNldmVyaXR5ID8/IGhpZ2hsaWdodC5zZXZlcml0eSxcbiAgICBldmlkZW5jZSxcbiAgfTtcblxuICBjb25zdCBmb3VuZCA9IGZpbmRFbGVtZW50Rm9yRGV0ZWN0aW9uKGRldGVjdGlvblBheWxvYWQpO1xuICBpZiAoIShmb3VuZCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgdGFyZ2V0ID0gaGlnaGxpZ2h0VGFyZ2V0KGZvdW5kKTtcbiAgaWYgKCEodGFyZ2V0IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBhc3NpZ25IaWdobGlnaHRJZCh0YXJnZXQpO1xuICByZXR1cm4gdGFyZ2V0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xlYXJIaWdobGlnaHRCb3hlcygpOiB2b2lkIHtcbiAgZm9yIChjb25zdCBib3ggb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChgWyR7SElHSExJR0hUX0JPWF9BVFRSfV1gKSkge1xuICAgIGJveC5yZW1vdmUoKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgZGV0ZWN0UGFnZVR5cGUgfSBmcm9tIFwiQGRhcmtwYXR0ZXJucy9zaGFyZWQvcGFnZS1jb250ZXh0XCI7XG5pbXBvcnQgdHlwZSB7IFBhZ2VIaWdobGlnaHQsIFBhZ2VUeXBlIH0gZnJvbSBcIkBkYXJrcGF0dGVybnMvc2hhcmVkL3R5cGVzXCI7XG5pbXBvcnQgeyBjb2xsZWN0UGFnZUhpZ2hsaWdodHMgfSBmcm9tIFwiLi9oaWdobGlnaHRzXCI7XG5cbmNvbnN0IElOVEVSQUNUSVZFX1NFTEVDVE9SUyA9IFtcbiAgXCJpbnB1dFwiLFxuICBcImJ1dHRvblwiLFxuICBcImFcIixcbiAgJ1tyb2xlPVwiZGlhbG9nXCJdJyxcbiAgJ1tjbGFzcyo9XCJtb2RhbFwiXScsXG4gICdbY2xhc3MqPVwicG9wdXBcIl0nLFxuICAnW2NsYXNzKj1cIm92ZXJsYXlcIl0nLFxuICAnW2NsYXNzKj1cImNvdW50ZG93blwiXScsXG4gICdbY2xhc3MqPVwidGltZXJcIl0nLFxuICAnW2NsYXNzKj1cInN0aWNreVwiXScsXG4gICdbc3R5bGUqPVwicG9zaXRpb246IGZpeGVkXCJdJyxcbiAgJ1tzdHlsZSo9XCJwb3NpdGlvbjpmaXhlZFwiXScsXG5dLmpvaW4oXCIsXCIpO1xuXG5jb25zdCBNQVhfVEVYVF9MRU5HVEggPSAxMl8wMDA7XG5jb25zdCBNQVhfSFRNTF9MRU5HVEggPSAxMl8wMDA7XG5cbmV4cG9ydCB0eXBlIEV4dHJhY3RlZFBhZ2UgPSB7XG4gIHVybDogc3RyaW5nO1xuICBwYWdlVGl0bGU6IHN0cmluZztcbiAgdmlzaWJsZVRleHQ6IHN0cmluZztcbiAgaW50ZXJhY3RpdmVIdG1sOiBzdHJpbmc7XG4gIHBhZ2VUeXBlOiBQYWdlVHlwZTtcbiAgaGlnaGxpZ2h0czogUGFnZUhpZ2hsaWdodFtdO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RQYWdlQ29udGVudCgpOiBFeHRyYWN0ZWRQYWdlIHtcbiAgY29uc3QgcGFnZVR5cGUgPSBkZXRlY3RQYWdlVHlwZShkb2N1bWVudCk7XG4gIGNvbnN0IHZpc2libGVUZXh0ID0gKGRvY3VtZW50LmJvZHk/LmlubmVyVGV4dCA/PyBcIlwiKS5zbGljZShcbiAgICAwLFxuICAgIE1BWF9URVhUX0xFTkdUSCxcbiAgKTtcbiAgY29uc3QgaW50ZXJhY3RpdmVIdG1sID0gYnVpbGRJbnRlcmFjdGl2ZUh0bWwoKTtcbiAgY29uc3QgaGlnaGxpZ2h0cyA9IGNvbGxlY3RQYWdlSGlnaGxpZ2h0cyhwYWdlVHlwZSk7XG4gIHJldHVybiB7XG4gICAgdXJsOiB3aW5kb3cubG9jYXRpb24uaHJlZixcbiAgICBwYWdlVGl0bGU6IGRvY3VtZW50LnRpdGxlLnNsaWNlKDAsIDUwMCksXG4gICAgdmlzaWJsZVRleHQsXG4gICAgaW50ZXJhY3RpdmVIdG1sLFxuICAgIHBhZ2VUeXBlLFxuICAgIGhpZ2hsaWdodHMsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkSW50ZXJhY3RpdmVIdG1sKCk6IHN0cmluZyB7XG4gIGNvbnN0IHBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKElOVEVSQUNUSVZFX1NFTEVDVE9SUykpIHtcbiAgICBpZiAocGFydHMuam9pbihcIlxcblwiKS5sZW5ndGggPj0gTUFYX0hUTUxfTEVOR1RIKSBicmVhaztcbiAgICBjb25zdCBodG1sID0gZWxlbWVudC5vdXRlckhUTUwuc2xpY2UoMCwgNTAwKTtcbiAgICBwYXJ0cy5wdXNoKGh0bWwpO1xuICB9XG5cbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiKlwiKSkge1xuICAgIGlmIChwYXJ0cy5qb2luKFwiXFxuXCIpLmxlbmd0aCA+PSBNQVhfSFRNTF9MRU5HVEgpIGJyZWFrO1xuICAgIGNvbnN0IHN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbWVudCk7XG4gICAgaWYgKHN0eWxlLnBvc2l0aW9uID09PSBcImZpeGVkXCIgfHwgc3R5bGUucG9zaXRpb24gPT09IFwic3RpY2t5XCIpIHtcbiAgICAgIHBhcnRzLnB1c2goXG4gICAgICAgIGA8ZGl2IGRhdGEtZHBkLW92ZXJsYXk9XCIke3N0eWxlLnBvc2l0aW9ufVwiPiR7ZWxlbWVudC5vdXRlckhUTUwuc2xpY2UoMCwgMzAwKX08L2Rpdj5gLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcGFydHMuam9pbihcIlxcblwiKS5zbGljZSgwLCBNQVhfSFRNTF9MRU5HVEgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaG9va1NwYU5hdmlnYXRpb24ob25OYXZpZ2F0ZTogKCkgPT4gdm9pZCk6ICgpID0+IHZvaWQge1xuICBjb25zdCBvcmlnaW5hbFB1c2hTdGF0ZSA9IGhpc3RvcnkucHVzaFN0YXRlLmJpbmQoaGlzdG9yeSk7XG4gIGNvbnN0IG9yaWdpbmFsUmVwbGFjZVN0YXRlID0gaGlzdG9yeS5yZXBsYWNlU3RhdGUuYmluZChoaXN0b3J5KTtcblxuICBoaXN0b3J5LnB1c2hTdGF0ZSA9ICguLi5hcmdzKSA9PiB7XG4gICAgb3JpZ2luYWxQdXNoU3RhdGUoLi4uYXJncyk7XG4gICAgb25OYXZpZ2F0ZSgpO1xuICB9O1xuXG4gIGhpc3RvcnkucmVwbGFjZVN0YXRlID0gKC4uLmFyZ3MpID0+IHtcbiAgICBvcmlnaW5hbFJlcGxhY2VTdGF0ZSguLi5hcmdzKTtcbiAgICBvbk5hdmlnYXRlKCk7XG4gIH07XG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJwb3BzdGF0ZVwiLCBvbk5hdmlnYXRlKTtcblxuICByZXR1cm4gKCkgPT4ge1xuICAgIGhpc3RvcnkucHVzaFN0YXRlID0gb3JpZ2luYWxQdXNoU3RhdGU7XG4gICAgaGlzdG9yeS5yZXBsYWNlU3RhdGUgPSBvcmlnaW5hbFJlcGxhY2VTdGF0ZTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInBvcHN0YXRlXCIsIG9uTmF2aWdhdGUpO1xuICB9O1xufVxuIiwiY29uc3QgTE9BRF9USU1FT1VUX01TID0gMTVfMDAwO1xuY29uc3QgU0VUVExFX01TID0gMl8wMDA7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3YWl0Rm9yUGFnZVJlYWR5KFxuICBzZXR0bGVNcyA9IFNFVFRMRV9NUyxcbik6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCB3YWl0Rm9yRG9jdW1lbnRMb2FkKExPQURfVElNRU9VVF9NUyk7XG5cbiAgaWYgKHNldHRsZU1zID4gMCkge1xuICAgIGF3YWl0IGRlbGF5KHNldHRsZU1zKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBkZWxheShtczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgIHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIG1zKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHdhaXRGb3JEb2N1bWVudExvYWQodGltZW91dE1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09IFwiY29tcGxldGVcIikge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgIGNvbnN0IGZpbmlzaCA9ICgpID0+IHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICByZXNvbHZlKCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRpbWVvdXQgPSB3aW5kb3cuc2V0VGltZW91dChmaW5pc2gsIHRpbWVvdXRNcyk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsIGZpbmlzaCwgeyBvbmNlOiB0cnVlIH0pO1xuICB9KTtcbn1cbiIsImltcG9ydCB0eXBlIHsgUGFnZUhpZ2hsaWdodCB9IGZyb20gXCJAZGFya3BhdHRlcm5zL3NoYXJlZC90eXBlc1wiO1xuaW1wb3J0IHtcbiAgY2xlYXJIaWdobGlnaHRCb3hlcyxcbiAgSElHSExJR0hUX0JPWF9BVFRSLFxuICBISUdITElHSFRfSURfQVRUUixcbiAgdHlwZSBIaWdobGlnaHREZXRlY3Rpb24sXG4gIGlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQsXG4gIHJlc29sdmVIaWdobGlnaHRFbGVtZW50Rm9yU2Nyb2xsLFxufSBmcm9tIFwiLi4vZXh0cmFjdC9oaWdobGlnaHRzXCI7XG5cbmNvbnN0IFNFVkVSSVRZX0NPTE9SUzogUmVjb3JkPFxuICBQYWdlSGlnaGxpZ2h0W1wic2V2ZXJpdHlcIl0sXG4gIHsgYm9yZGVyOiBzdHJpbmc7IGJhY2tncm91bmQ6IHN0cmluZyB9XG4+ID0ge1xuICBISUdIOiB7IGJvcmRlcjogXCIjREMyNjI2XCIsIGJhY2tncm91bmQ6IFwicmdiYSgyMjAsIDM4LCAzOCwgMC4xNClcIiB9LFxuICBNRURJVU06IHsgYm9yZGVyOiBcIiNEOTc3MDZcIiwgYmFja2dyb3VuZDogXCJyZ2JhKDIxNywgMTE5LCA2LCAwLjE0KVwiIH0sXG4gIExPVzogeyBib3JkZXI6IFwiIzI1NjNFQlwiLCBiYWNrZ3JvdW5kOiBcInJnYmEoMzcsIDk5LCAyMzUsIDAuMTIpXCIgfSxcbn07XG5cbmNvbnN0IFNDUk9MTF9NQVJHSU5fUFggPSA3MjtcblxuZnVuY3Rpb24gc2Nyb2xsRWxlbWVudEludG9WaWV3KGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gIGlmIChlbGVtZW50Lm1hdGNoZXMoXCJhLCBidXR0b24sIGlucHV0LCB0ZXh0YXJlYSwgc2VsZWN0LCBbdGFiaW5kZXhdXCIpKSB7XG4gICAgdHJ5IHtcbiAgICAgIGVsZW1lbnQuZm9jdXMoeyBwcmV2ZW50U2Nyb2xsOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gU29tZSBlbGVtZW50cyBjYW5ub3QgYmUgZm9jdXNlZC5cbiAgICB9XG4gIH1cblxuICBsZXQgcGFyZW50OiBFbGVtZW50IHwgbnVsbCA9IGVsZW1lbnQucGFyZW50RWxlbWVudDtcbiAgd2hpbGUgKHBhcmVudCkge1xuICAgIGlmIChwYXJlbnQgPT09IGRvY3VtZW50LmJvZHkgfHwgcGFyZW50ID09PSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGlmICghKHBhcmVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkge1xuICAgICAgcGFyZW50ID0gcGFyZW50LnBhcmVudEVsZW1lbnQ7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBzdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHBhcmVudCk7XG4gICAgY29uc3Qgb3ZlcmZsb3dZID0gc3R5bGUub3ZlcmZsb3dZO1xuICAgIGNvbnN0IGNhblNjcm9sbFkgPVxuICAgICAgb3ZlcmZsb3dZID09PSBcImF1dG9cIiB8fFxuICAgICAgb3ZlcmZsb3dZID09PSBcInNjcm9sbFwiIHx8XG4gICAgICBvdmVyZmxvd1kgPT09IFwib3ZlcmxheVwiO1xuXG4gICAgaWYgKGNhblNjcm9sbFkgJiYgcGFyZW50LnNjcm9sbEhlaWdodCA+IHBhcmVudC5jbGllbnRIZWlnaHQgKyAxKSB7XG4gICAgICBjb25zdCBwYXJlbnRSZWN0ID0gcGFyZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgY29uc3QgZWxlbWVudFJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgY29uc3Qgb2Zmc2V0ID1cbiAgICAgICAgZWxlbWVudFJlY3QudG9wIC1cbiAgICAgICAgcGFyZW50UmVjdC50b3AgLVxuICAgICAgICBwYXJlbnQuY2xpZW50SGVpZ2h0IC8gMiArXG4gICAgICAgIGVsZW1lbnRSZWN0LmhlaWdodCAvIDI7XG5cbiAgICAgIGlmIChNYXRoLmFicyhvZmZzZXQpID4gNCkge1xuICAgICAgICBwYXJlbnQuc2Nyb2xsVG8oe1xuICAgICAgICAgIHRvcDogcGFyZW50LnNjcm9sbFRvcCArIG9mZnNldCxcbiAgICAgICAgICBiZWhhdmlvcjogXCJzbW9vdGhcIixcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcGFyZW50ID0gcGFyZW50LnBhcmVudEVsZW1lbnQ7XG4gIH1cblxuICB0cnkge1xuICAgIGVsZW1lbnQuc2Nyb2xsSW50b1ZpZXcoe1xuICAgICAgYmVoYXZpb3I6IFwic21vb3RoXCIsXG4gICAgICBibG9jazogXCJjZW50ZXJcIixcbiAgICAgIGlubGluZTogXCJuZWFyZXN0XCIsXG4gICAgfSk7XG4gIH0gY2F0Y2gge1xuICAgIGVsZW1lbnQuc2Nyb2xsSW50b1ZpZXcoKTtcbiAgfVxuXG4gIGNvbnN0IHJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICBjb25zdCB0YXJnZXRUb3AgPVxuICAgIHJlY3QudG9wICtcbiAgICB3aW5kb3cuc2Nyb2xsWSAtXG4gICAgd2luZG93LmlubmVySGVpZ2h0IC8gMiArXG4gICAgcmVjdC5oZWlnaHQgLyAyIC1cbiAgICBTQ1JPTExfTUFSR0lOX1BYIC8gMjtcblxuICB3aW5kb3cuc2Nyb2xsVG8oe1xuICAgIHRvcDogTWF0aC5tYXgoMCwgdGFyZ2V0VG9wKSxcbiAgICBiZWhhdmlvcjogXCJzbW9vdGhcIixcbiAgfSk7XG59XG5cbmV4cG9ydCBjbGFzcyBIaWdobGlnaHRPdmVybGF5IHtcbiAgcHJpdmF0ZSBoaWdobGlnaHRzOiBQYWdlSGlnaGxpZ2h0W10gPSBbXTtcbiAgcHJpdmF0ZSB2aXNpYmxlID0gZmFsc2U7XG4gIHByaXZhdGUgYm91bmRVcGRhdGU6ICgoKSA9PiB2b2lkKSB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGFjdGl2ZUhpZ2hsaWdodElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSByYWZJZDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgc2hvdyhoaWdobGlnaHRzOiBQYWdlSGlnaGxpZ2h0W10pOiB2b2lkIHtcbiAgICB0aGlzLmhpZ2hsaWdodHMgPSBoaWdobGlnaHRzO1xuICAgIHRoaXMudmlzaWJsZSA9IGhpZ2hsaWdodHMubGVuZ3RoID4gMDtcbiAgICB0aGlzLmVuc3VyZUJpbmRpbmdzKCk7XG4gICAgdGhpcy5yZW5kZXIoKTtcbiAgfVxuXG4gIGhpZGUoKTogdm9pZCB7XG4gICAgdGhpcy52aXNpYmxlID0gZmFsc2U7XG4gICAgdGhpcy5hY3RpdmVIaWdobGlnaHRJZCA9IG51bGw7XG4gICAgY2xlYXJIaWdobGlnaHRCb3hlcygpO1xuICAgIGlmICh0aGlzLnJhZklkICE9PSBudWxsKSB7XG4gICAgICBjYW5jZWxBbmltYXRpb25GcmFtZSh0aGlzLnJhZklkKTtcbiAgICAgIHRoaXMucmFmSWQgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHNjcm9sbFRvSGlnaGxpZ2h0KFxuICAgIGhpZ2hsaWdodElkOiBzdHJpbmcsXG4gICAgaGlnaGxpZ2h0PzogUGFnZUhpZ2hsaWdodCxcbiAgICBkZXRlY3Rpb24/OiBIaWdobGlnaHREZXRlY3Rpb24sXG4gICk6IGJvb2xlYW4ge1xuICAgIHRoaXMudmlzaWJsZSA9IHRydWU7XG4gICAgdGhpcy5lbnN1cmVCaW5kaW5ncygpO1xuXG4gICAgY29uc3QgcmVjb3JkID1cbiAgICAgIGhpZ2hsaWdodCA/P1xuICAgICAgdGhpcy5oaWdobGlnaHRzLmZpbmQoKGl0ZW0pID0+IGl0ZW0uaWQgPT09IGhpZ2hsaWdodElkKSA/P1xuICAgICAgbnVsbDtcblxuICAgIGxldCBlbGVtZW50OiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICAgIGxldCBhY3RpdmVJZCA9IGhpZ2hsaWdodElkO1xuXG4gICAgY29uc3QgbWFya2VkID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgIGBbJHtISUdITElHSFRfSURfQVRUUn09XCIke2hpZ2hsaWdodElkfVwiXWAsXG4gICAgKTtcbiAgICBpZiAobWFya2VkIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICAgIGVsZW1lbnQgPSBtYXJrZWQ7XG4gICAgfVxuXG4gICAgaWYgKCFlbGVtZW50ICYmIHJlY29yZCkge1xuICAgICAgZWxlbWVudCA9IHJlc29sdmVIaWdobGlnaHRFbGVtZW50Rm9yU2Nyb2xsKHJlY29yZCwgZGV0ZWN0aW9uKTtcbiAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgIGFjdGl2ZUlkID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoSElHSExJR0hUX0lEX0FUVFIpID8/IGhpZ2hsaWdodElkO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghZWxlbWVudCAmJiBkZXRlY3Rpb24pIHtcbiAgICAgIGVsZW1lbnQgPSByZXNvbHZlSGlnaGxpZ2h0RWxlbWVudEZvclNjcm9sbChcbiAgICAgICAge1xuICAgICAgICAgIGlkOiBoaWdobGlnaHRJZCxcbiAgICAgICAgICBjYXRlZ29yeTogZGV0ZWN0aW9uLmNhdGVnb3J5IGFzIFBhZ2VIaWdobGlnaHRbXCJjYXRlZ29yeVwiXSxcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogZGV0ZWN0aW9uLnBhdHRlcm5UeXBlLFxuICAgICAgICAgIHNldmVyaXR5OiBkZXRlY3Rpb24uc2V2ZXJpdHksXG4gICAgICAgICAgbGFiZWw6IFwiUHJlc3N1cmUgY3VlXCIsXG4gICAgICAgICAgZXZpZGVuY2U6IGRldGVjdGlvbi5ldmlkZW5jZSxcbiAgICAgICAgfSxcbiAgICAgICAgZGV0ZWN0aW9uLFxuICAgICAgKTtcbiAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgIGFjdGl2ZUlkID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoSElHSExJR0hUX0lEX0FUVFIpID8/IGhpZ2hsaWdodElkO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghZWxlbWVudCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRoaXMuYWN0aXZlSGlnaGxpZ2h0SWQgPSBhY3RpdmVJZDtcblxuICAgIGlmIChyZWNvcmQpIHtcbiAgICAgIGlmIChhY3RpdmVJZCAhPT0gcmVjb3JkLmlkKSB7XG4gICAgICAgIHRoaXMuaGlnaGxpZ2h0cyA9IHRoaXMuaGlnaGxpZ2h0cy5tYXAoKGl0ZW0pID0+XG4gICAgICAgICAgaXRlbS5pZCA9PT0gcmVjb3JkLmlkID8geyAuLi5pdGVtLCBpZDogYWN0aXZlSWQgfSA6IGl0ZW0sXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBpZiAoIXRoaXMuaGlnaGxpZ2h0cy5zb21lKChpdGVtKSA9PiBpdGVtLmlkID09PSBhY3RpdmVJZCkpIHtcbiAgICAgICAgdGhpcy5oaWdobGlnaHRzID0gWy4uLnRoaXMuaGlnaGxpZ2h0cywgeyAuLi5yZWNvcmQsIGlkOiBhY3RpdmVJZCB9XTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzY3JvbGxFbGVtZW50SW50b1ZpZXcoZWxlbWVudCk7XG5cbiAgICB0aGlzLnJlbmRlcigpO1xuICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRoaXMucmVuZGVyKCksIDUwKTtcbiAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB0aGlzLnJlbmRlcigpLCAzNTApO1xuICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRoaXMucmVuZGVyKCksIDcwMCk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgZW5zdXJlQmluZGluZ3MoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuYm91bmRVcGRhdGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJvdW5kVXBkYXRlID0gKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLnZpc2libGUgfHwgdGhpcy5yYWZJZCAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHRoaXMucmFmSWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgICAgICB0aGlzLnJhZklkID0gbnVsbDtcbiAgICAgICAgdGhpcy5yZW5kZXIoKTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwic2Nyb2xsXCIsIHRoaXMuYm91bmRVcGRhdGUsIHtcbiAgICAgIGNhcHR1cmU6IHRydWUsXG4gICAgICBwYXNzaXZlOiB0cnVlLFxuICAgIH0pO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwicmVzaXplXCIsIHRoaXMuYm91bmRVcGRhdGUsIHsgcGFzc2l2ZTogdHJ1ZSB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy52aXNpYmxlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY2xlYXJIaWdobGlnaHRCb3hlcygpO1xuXG4gICAgZm9yIChjb25zdCBoaWdobGlnaHQgb2YgdGhpcy5oaWdobGlnaHRzKSB7XG4gICAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgICAgYFske0hJR0hMSUdIVF9JRF9BVFRSfT1cIiR7aGlnaGxpZ2h0LmlkfVwiXWAsXG4gICAgICApO1xuICAgICAgaWYgKCEoZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmICghaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVjdCA9IGVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICBpZiAocmVjdC53aWR0aCA8PSAwIHx8IHJlY3QuaGVpZ2h0IDw9IDApIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNvbG9ycyA9IFNFVkVSSVRZX0NPTE9SU1toaWdobGlnaHQuc2V2ZXJpdHldO1xuICAgICAgY29uc3QgaXNBY3RpdmUgPSBoaWdobGlnaHQuaWQgPT09IHRoaXMuYWN0aXZlSGlnaGxpZ2h0SWQ7XG4gICAgICBjb25zdCBib3JkZXJXaWR0aCA9IGlzQWN0aXZlID8gMyA6IDI7XG4gICAgICBjb25zdCBpbnNldCA9IGJvcmRlcldpZHRoICsgMTtcblxuICAgICAgY29uc3QgYm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgIGJveC5zZXRBdHRyaWJ1dGUoSElHSExJR0hUX0JPWF9BVFRSLCBoaWdobGlnaHQuaWQpO1xuICAgICAgYm94LnN0eWxlLmNzc1RleHQgPSBbXG4gICAgICAgIFwicG9zaXRpb246Zml4ZWRcIixcbiAgICAgICAgXCJwb2ludGVyLWV2ZW50czpub25lXCIsXG4gICAgICAgIFwiYm94LXNpemluZzpib3JkZXItYm94XCIsXG4gICAgICAgIFwiYm9yZGVyLXJhZGl1czo2cHhcIixcbiAgICAgICAgYHotaW5kZXg6MjE0NzQ4MzY0NmAsXG4gICAgICAgIGBsZWZ0OiR7cmVjdC5sZWZ0IC0gaW5zZXR9cHhgLFxuICAgICAgICBgdG9wOiR7cmVjdC50b3AgLSBpbnNldH1weGAsXG4gICAgICAgIGB3aWR0aDoke3JlY3Qud2lkdGggKyBpbnNldCAqIDJ9cHhgLFxuICAgICAgICBgaGVpZ2h0OiR7cmVjdC5oZWlnaHQgKyBpbnNldCAqIDJ9cHhgLFxuICAgICAgICBgYm9yZGVyOiR7Ym9yZGVyV2lkdGh9cHggc29saWQgJHtjb2xvcnMuYm9yZGVyfWAsXG4gICAgICAgIGBiYWNrZ3JvdW5kOiR7Y29sb3JzLmJhY2tncm91bmR9YCxcbiAgICAgIF0uam9pbihcIjtcIik7XG5cbiAgICAgIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgIGxhYmVsLnRleHRDb250ZW50ID0gaGlnaGxpZ2h0LmxhYmVsO1xuICAgICAgbGFiZWwuc3R5bGUuY3NzVGV4dCA9IFtcbiAgICAgICAgXCJwb3NpdGlvbjphYnNvbHV0ZVwiLFxuICAgICAgICBcInRvcDotMjRweFwiLFxuICAgICAgICBcImxlZnQ6MFwiLFxuICAgICAgICBgYmFja2dyb3VuZDoke2NvbG9ycy5ib3JkZXJ9YCxcbiAgICAgICAgXCJjb2xvcjojZmZmXCIsXG4gICAgICAgIFwiZm9udDo2MDAgMTFweC8xLjIgc3lzdGVtLXVpLHNhbnMtc2VyaWZcIixcbiAgICAgICAgXCJwYWRkaW5nOjRweCA4cHhcIixcbiAgICAgICAgXCJib3JkZXItcmFkaXVzOjRweFwiLFxuICAgICAgICBcIndoaXRlLXNwYWNlOm5vd3JhcFwiLFxuICAgICAgICBcIm1heC13aWR0aDoyNDBweFwiLFxuICAgICAgICBcIm92ZXJmbG93OmhpZGRlblwiLFxuICAgICAgICBcInRleHQtb3ZlcmZsb3c6ZWxsaXBzaXNcIixcbiAgICAgIF0uam9pbihcIjtcIik7XG5cbiAgICAgIGJveC5hcHBlbmRDaGlsZChsYWJlbCk7XG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGJveCk7XG4gICAgfVxuICB9XG59XG4iLCIvKiogQnJvd3Nlci1pbnRlcm5hbCBwYWdlcyB0aGF0IGFyZSBuZXZlciBzY2FubmVkLiAqL1xuZXhwb3J0IGNvbnN0IEVYQ0xVREVEX1VSTF9QUkVGSVhFUyA9IFtcbiAgXCJjaHJvbWU6Ly9cIixcbiAgXCJjaHJvbWUtdW50cnVzdGVkOi8vXCIsXG4gIFwiY2hyb21lLWV4dGVuc2lvbjovL1wiLFxuICBcImFib3V0OlwiLFxuICBcImVkZ2U6Ly9cIixcbiAgXCJicmF2ZTovL1wiLFxuXSBhcyBjb25zdDtcblxuLyoqIFBvcHVsYXIgc2l0ZXMgc2tpcHBlZCBieSBhdXRvLXNjYW4gKGVtYWlsLCBjaGF0LCBzb2NpYWwsIHN0cmVhbWluZywgZXRjLikuICovXG5leHBvcnQgY29uc3QgRVhDTFVERURfSE9TVFMgPSBbXG4gIC8vIEdvb2dsZVxuICBcImdvb2dsZS5jb21cIixcbiAgXCJnbWFpbC5jb21cIixcbiAgXCJ5b3V0dWJlLmNvbVwiLFxuICAvLyBNZXRhXG4gIFwiZmFjZWJvb2suY29tXCIsXG4gIFwiaW5zdGFncmFtLmNvbVwiLFxuICBcIm1ldGEuY29tXCIsXG4gIFwibWVzc2VuZ2VyLmNvbVwiLFxuICBcInRocmVhZHMubmV0XCIsXG4gIFwid2hhdHNhcHAuY29tXCIsXG4gIC8vIE1pY3Jvc29mdFxuICBcIm1pY3Jvc29mdC5jb21cIixcbiAgXCJvdXRsb29rLmNvbVwiLFxuICBcImxpdmUuY29tXCIsXG4gIFwiaG90bWFpbC5jb21cIixcbiAgXCJvZmZpY2UuY29tXCIsXG4gIFwib2ZmaWNlMzY1LmNvbVwiLFxuICAvLyBBcHBsZVxuICBcImFwcGxlLmNvbVwiLFxuICBcImljbG91ZC5jb21cIixcbiAgLy8gU29jaWFsICYgbWVzc2FnaW5nXG4gIFwidHdpdHRlci5jb21cIixcbiAgXCJ4LmNvbVwiLFxuICBcImxpbmtlZGluLmNvbVwiLFxuICBcInRpa3Rvay5jb21cIixcbiAgXCJyZWRkaXQuY29tXCIsXG4gIFwicGludGVyZXN0LmNvbVwiLFxuICBcInNuYXBjaGF0LmNvbVwiLFxuICBcImRpc2NvcmQuY29tXCIsXG4gIFwic2xhY2suY29tXCIsXG4gIFwidGVsZWdyYW0ub3JnXCIsXG4gIFwidC5tZVwiLFxuICBcInpvb20udXNcIixcbiAgXCJ6b29tLmNvbVwiLFxuICAvLyBFbWFpbFxuICBcInlhaG9vLmNvbVwiLFxuICBcInByb3Rvbi5tZVwiLFxuICBcInByb3Rvbm1haWwuY29tXCIsXG4gIC8vIFN0cmVhbWluZyAmIGNvbW1lcmNlXG4gIFwibmV0ZmxpeC5jb21cIixcbiAgXCJzcG90aWZ5LmNvbVwiLFxuICBcImFtYXpvbi5jb21cIixcbiAgXCJiaW5nLmNvbVwiLFxuXSBhcyBjb25zdDtcblxuZXhwb3J0IGZ1bmN0aW9uIGlzRXhjbHVkZWRVcmwodXJsOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcbiAgaWYgKCF1cmwpIHJldHVybiB0cnVlO1xuXG4gIGNvbnN0IGxvd2VyID0gdXJsLnRvTG93ZXJDYXNlKCk7XG4gIGZvciAoY29uc3QgcHJlZml4IG9mIEVYQ0xVREVEX1VSTF9QUkVGSVhFUykge1xuICAgIGlmIChsb3dlci5zdGFydHNXaXRoKHByZWZpeCkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHRyeSB7XG4gICAgcmV0dXJuIGlzRXhjbHVkZWRIb3N0KG5ldyBVUkwodXJsKS5ob3N0bmFtZSk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0V4Y2x1ZGVkSG9zdChob3N0bmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IGhvc3QgPSBob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICBmb3IgKGNvbnN0IGV4Y2x1ZGVkIG9mIEVYQ0xVREVEX0hPU1RTKSB7XG4gICAgaWYgKGhvc3QgPT09IGV4Y2x1ZGVkIHx8IGhvc3QuZW5kc1dpdGgoYC4ke2V4Y2x1ZGVkfWApKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuIiwiaW1wb3J0IHR5cGUgeyBFeHRlbnNpb25BbmFseXplUmVzcG9uc2UgfSBmcm9tIFwiQGRhcmtwYXR0ZXJucy9zaGFyZWQvdHlwZXNcIjtcbmltcG9ydCB7IGlzRXhjbHVkZWRVcmwgfSBmcm9tIFwiLi9leGNsdWRlZC1ob3N0c1wiO1xuXG5leHBvcnQgdHlwZSBFeHRlbnNpb25TZXR0aW5ncyA9IHtcbiAgdGVybXNBY2NlcHRlZEF0OiBzdHJpbmcgfCBudWxsO1xuICBhdXRvU2NhbkVuYWJsZWQ6IGJvb2xlYW47XG4gIGFwaUJhc2VVcmw6IHN0cmluZztcbiAgYXBpS2V5OiBzdHJpbmc7XG59O1xuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBFeHRlbnNpb25TZXR0aW5ncyA9IHtcbiAgdGVybXNBY2NlcHRlZEF0OiBudWxsLFxuICBhdXRvU2NhbkVuYWJsZWQ6IHRydWUsXG4gIGFwaUJhc2VVcmw6IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gIGFwaUtleTogXCJcIixcbn07XG5cbnR5cGUgVXJsUmVwb3J0Q2FjaGUgPSB7XG4gIG5vcm1hbGl6ZWRVcmw6IHN0cmluZztcbiAgcmVwb3J0OiBFeHRlbnNpb25BbmFseXplUmVzcG9uc2VbXCJzY2FuXCJdO1xuICBjYWNoZWRBdDogbnVtYmVyO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVVybEZvckNhY2hlKHVybDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgcGFyc2VkID0gbmV3IFVSTCh1cmwpO1xuICBwYXJzZWQuaGFzaCA9IFwiXCI7XG4gIHBhcnNlZC5ob3N0bmFtZSA9IHBhcnNlZC5ob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICByZXR1cm4gcGFyc2VkLnRvU3RyaW5nKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1cmxzTWF0Y2hGb3JDYWNoZShhOiBzdHJpbmcsIGI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICB0cnkge1xuICAgIHJldHVybiBub3JtYWxpemVVcmxGb3JDYWNoZShhKSA9PT0gbm9ybWFsaXplVXJsRm9yQ2FjaGUoYik7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBhID09PSBiO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRTZXR0aW5ncygpOiBQcm9taXNlPEV4dGVuc2lvblNldHRpbmdzPiB7XG4gIGNvbnN0IHN0b3JlZCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChPYmplY3Qua2V5cyhERUZBVUxUX1NFVFRJTkdTKSk7XG4gIHJldHVybiB7IC4uLkRFRkFVTFRfU0VUVElOR1MsIC4uLnN0b3JlZCB9IGFzIEV4dGVuc2lvblNldHRpbmdzO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2F2ZVNldHRpbmdzKFxuICBwYXJ0aWFsOiBQYXJ0aWFsPEV4dGVuc2lvblNldHRpbmdzPixcbik6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQocGFydGlhbCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRUYWJSZXBvcnQoXG4gIHRhYklkOiBudW1iZXIsXG4pOiBQcm9taXNlPGltcG9ydChcIi4vbWVzc2FnZXNcIikuVGFiUmVwb3J0U3RhdGUgfCBudWxsPiB7XG4gIGNvbnN0IGtleSA9IGB0YWJSZXBvcnQ6JHt0YWJJZH1gO1xuICBjb25zdCBzdG9yZWQgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5zZXNzaW9uLmdldChrZXkpO1xuICByZXR1cm4gKFxuICAgIChzdG9yZWRba2V5XSBhcyBpbXBvcnQoXCIuL21lc3NhZ2VzXCIpLlRhYlJlcG9ydFN0YXRlIHwgdW5kZWZpbmVkKSA/PyBudWxsXG4gICk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXRUYWJSZXBvcnQoXG4gIHRhYklkOiBudW1iZXIsXG4gIHN0YXRlOiBpbXBvcnQoXCIuL21lc3NhZ2VzXCIpLlRhYlJlcG9ydFN0YXRlLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGtleSA9IGB0YWJSZXBvcnQ6JHt0YWJJZH1gO1xuICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5zZXNzaW9uLnNldCh7IFtrZXldOiBzdGF0ZSB9KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFVybFJlcG9ydENhY2hlKFxuICB1cmw6IHN0cmluZyxcbik6IFByb21pc2U8RXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlW1wic2NhblwiXSB8IG51bGw+IHtcbiAgY29uc3Qgbm9ybWFsaXplZFVybCA9IG5vcm1hbGl6ZVVybEZvckNhY2hlKHVybCk7XG4gIGNvbnN0IGtleSA9IGB1cmxSZXBvcnQ6JHtub3JtYWxpemVkVXJsfWA7XG4gIGNvbnN0IHN0b3JlZCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChrZXkpO1xuICBjb25zdCBjYWNoZSA9IHN0b3JlZFtrZXldIGFzIFVybFJlcG9ydENhY2hlIHwgdW5kZWZpbmVkO1xuICByZXR1cm4gY2FjaGU/LnJlcG9ydCA/PyBudWxsO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0VXJsUmVwb3J0Q2FjaGUoXG4gIHVybDogc3RyaW5nLFxuICByZXBvcnQ6IEV4dGVuc2lvbkFuYWx5emVSZXNwb25zZVtcInNjYW5cIl0sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgbm9ybWFsaXplZFVybCA9IG5vcm1hbGl6ZVVybEZvckNhY2hlKHVybCk7XG4gIGNvbnN0IGtleSA9IGB1cmxSZXBvcnQ6JHtub3JtYWxpemVkVXJsfWA7XG4gIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7XG4gICAgW2tleV06IHtcbiAgICAgIG5vcm1hbGl6ZWRVcmwsXG4gICAgICByZXBvcnQsXG4gICAgICBjYWNoZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9IHNhdGlzZmllcyBVcmxSZXBvcnRDYWNoZSxcbiAgfSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjbGVhclVybFJlcG9ydENhY2hlKHVybDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IG5vcm1hbGl6ZWRVcmwgPSBub3JtYWxpemVVcmxGb3JDYWNoZSh1cmwpO1xuICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5yZW1vdmUoYHVybFJlcG9ydDoke25vcm1hbGl6ZWRVcmx9YCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0FuYWx5emFibGVVcmwodXJsOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcbiAgaWYgKCF1cmwpIHJldHVybiBmYWxzZTtcbiAgaWYgKCF1cmwuc3RhcnRzV2l0aChcImh0dHA6Ly9cIikgJiYgIXVybC5zdGFydHNXaXRoKFwiaHR0cHM6Ly9cIikpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuICFpc0V4Y2x1ZGVkVXJsKHVybCk7XG59XG4iLCIvLy8gPHJlZmVyZW5jZSB0eXBlcz1cInd4dC9jbGllbnQtdHlwZXNcIiAvPlxuXG5pbXBvcnQgeyBkZXRlY3RQYWdlVHlwZSB9IGZyb20gXCJAZGFya3BhdHRlcm5zL3NoYXJlZC9wYWdlLWNvbnRleHRcIjtcbmltcG9ydCB7XG4gIGNsZWFySGlnaGxpZ2h0TWFya2VycyxcbiAgZW5yaWNoSGlnaGxpZ2h0c0Zyb21EZXRlY3Rpb25zLFxuICB0eXBlIEhpZ2hsaWdodERldGVjdGlvbixcbn0gZnJvbSBcIi4uL2V4dHJhY3QvaGlnaGxpZ2h0c1wiO1xuaW1wb3J0IHsgZXh0cmFjdFBhZ2VDb250ZW50LCBob29rU3BhTmF2aWdhdGlvbiB9IGZyb20gXCIuLi9leHRyYWN0L3BhZ2VcIjtcbmltcG9ydCB7IHdhaXRGb3JQYWdlUmVhZHkgfSBmcm9tIFwiLi4vZXh0cmFjdC93YWl0LWZvci1wYWdlXCI7XG5pbXBvcnQgeyBIaWdobGlnaHRPdmVybGF5IH0gZnJvbSBcIi4uL2hpZ2hsaWdodC9vdmVybGF5XCI7XG5pbXBvcnQgdHlwZSB7IFBhZ2VIaWdobGlnaHQgfSBmcm9tIFwiQGRhcmtwYXR0ZXJucy9zaGFyZWQvdHlwZXNcIjtcbmltcG9ydCB7IGlzQW5hbHl6YWJsZVVybCB9IGZyb20gXCIuLi9saWIvc3RvcmFnZVwiO1xuXG5jb25zdCBERUJPVU5DRV9NUyA9IDIwMDA7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbnRlbnRTY3JpcHQoe1xuICBtYXRjaGVzOiBbXCJodHRwOi8vKi8qXCIsIFwiaHR0cHM6Ly8qLypcIl0sXG4gIHJ1bkF0OiBcImRvY3VtZW50X2lkbGVcIixcbiAgbWFpbigpIHtcbiAgICBpZiAoIWlzQW5hbHl6YWJsZVVybCh3aW5kb3cubG9jYXRpb24uaHJlZikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBvdmVybGF5ID0gbmV3IEhpZ2hsaWdodE92ZXJsYXkoKTtcbiAgICBsZXQgZGVib3VuY2VUaW1lcjogUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCBudWxsID0gbnVsbDtcblxuICAgIGNvbnN0IGFuYWx5emUgPSAoZm9yY2UgPSBmYWxzZSkgPT4ge1xuICAgICAgaWYgKGRlYm91bmNlVGltZXIpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KGRlYm91bmNlVGltZXIpO1xuICAgICAgfVxuXG4gICAgICBkZWJvdW5jZVRpbWVyID0gc2V0VGltZW91dChcbiAgICAgICAgKCkgPT4ge1xuICAgICAgICAgIGRlYm91bmNlVGltZXIgPSBudWxsO1xuXG4gICAgICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKCFmb3JjZSkge1xuICAgICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IChhd2FpdCBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJTSE9VTERfQU5BTFlaRVwiLFxuICAgICAgICAgICAgICAgIHVybDogd2luZG93LmxvY2F0aW9uLmhyZWYsXG4gICAgICAgICAgICAgIH0pKSBhcyB7IHNob3VsZEFuYWx5emU/OiBib29sZWFuIH0gfCB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAgICAgaWYgKCFyZXNwb25zZT8uc2hvdWxkQW5hbHl6ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBvdmVybGF5LmhpZGUoKTtcbiAgICAgICAgICAgIGNsZWFySGlnaGxpZ2h0TWFya2VycygpO1xuXG4gICAgICAgICAgICBhd2FpdCB3YWl0Rm9yUGFnZVJlYWR5KCk7XG5cbiAgICAgICAgICAgIGNvbnN0IHBhZ2UgPSBleHRyYWN0UGFnZUNvbnRlbnQoKTtcbiAgICAgICAgICAgIHZvaWQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICB0eXBlOiBcIlBBR0VfQ09OVEVOVFwiLFxuICAgICAgICAgICAgICAuLi5wYWdlLFxuICAgICAgICAgICAgICBmb3JjZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pKCk7XG4gICAgICAgIH0sXG4gICAgICAgIGZvcmNlID8gMCA6IERFQk9VTkNFX01TLFxuICAgICAgKTtcbiAgICB9O1xuXG4gICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBfc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICAgIGlmIChtZXNzYWdlPy50eXBlID09PSBcIkFOQUxZWkVfUEFHRVwiKSB7XG4gICAgICAgIGFuYWx5emUoQm9vbGVhbihtZXNzYWdlLmZvcmNlKSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKG1lc3NhZ2U/LnR5cGUgPT09IFwiU0VUX1BBR0VfSElHSExJR0hUU1wiKSB7XG4gICAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjb25zdCBwYWdlVHlwZSA9IGRldGVjdFBhZ2VUeXBlKGRvY3VtZW50KTtcbiAgICAgICAgICBjb25zdCBlbnJpY2hlZCA9IGVucmljaEhpZ2hsaWdodHNGcm9tRGV0ZWN0aW9ucyhcbiAgICAgICAgICAgIChtZXNzYWdlLmhpZ2hsaWdodHMgYXMgUGFnZUhpZ2hsaWdodFtdKSA/PyBbXSxcbiAgICAgICAgICAgIChtZXNzYWdlLmRldGVjdGlvbnMgYXMgSGlnaGxpZ2h0RGV0ZWN0aW9uW10gfCB1bmRlZmluZWQpID8/IFtdLFxuICAgICAgICAgICAgcGFnZVR5cGUsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGlmIChtZXNzYWdlLnZpc2libGUpIHtcbiAgICAgICAgICAgIG92ZXJsYXkuc2hvdyhlbnJpY2hlZCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG92ZXJsYXkuaGlkZSgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgIHR5cGU6IFwiSElHSExJR0hUU19VUERBVEVEXCIsXG4gICAgICAgICAgICBoaWdobGlnaHRzOiBlbnJpY2hlZCxcbiAgICAgICAgICAgIHJlcG9ydElkOiBtZXNzYWdlLnJlcG9ydElkIGFzIHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHNlbmRSZXNwb25zZSh7IGhpZ2hsaWdodHM6IGVucmljaGVkIH0pO1xuICAgICAgICB9KSgpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1lc3NhZ2U/LnR5cGUgPT09IFwiQ0xFQVJfUEFHRV9ISUdITElHSFRTXCIpIHtcbiAgICAgICAgb3ZlcmxheS5oaWRlKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKG1lc3NhZ2U/LnR5cGUgPT09IFwiU0NST0xMX1RPX0hJR0hMSUdIVFwiKSB7XG4gICAgICAgIGNvbnN0IGhpZ2hsaWdodCA9IG1lc3NhZ2UuaGlnaGxpZ2h0IGFzIFBhZ2VIaWdobGlnaHQgfCB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnN0IGRldGVjdGlvbiA9IG1lc3NhZ2UuZGV0ZWN0aW9uIGFzIEhpZ2hsaWdodERldGVjdGlvbiB8IHVuZGVmaW5lZDtcbiAgICAgICAgb3ZlcmxheS5zY3JvbGxUb0hpZ2hsaWdodChcbiAgICAgICAgICBtZXNzYWdlLmhpZ2hsaWdodElkIGFzIHN0cmluZyxcbiAgICAgICAgICBoaWdobGlnaHQsXG4gICAgICAgICAgZGV0ZWN0aW9uLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaG9va1NwYU5hdmlnYXRpb24oKCkgPT4ge1xuICAgICAgb3ZlcmxheS5oaWRlKCk7XG4gICAgICBjbGVhckhpZ2hsaWdodE1hcmtlcnMoKTtcbiAgICAgIGFuYWx5emUoZmFsc2UpO1xuICAgIH0pO1xuICB9LFxufSk7XG4iLCIvLyNyZWdpb24gc3JjL3V0aWxzL2ludGVybmFsL2xvZ2dlci50c1xuZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG5cdGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcblx0aWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSBtZXRob2QoYFt3eHRdICR7YXJncy5zaGlmdCgpfWAsIC4uLmFyZ3MpO1xuXHRlbHNlIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xufVxuLyoqIFdyYXBwZXIgYXJvdW5kIGBjb25zb2xlYCB3aXRoIGEgXCJbd3h0XVwiIHByZWZpeCAqL1xuY29uc3QgbG9nZ2VyID0ge1xuXHRkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuXHRsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG5cdHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuXHRlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBsb2dnZXIgfTtcbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgYnJvd3NlciQxIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbi8vI3JlZ2lvbiBzcmMvYnJvd3Nlci50c1xuLyoqXG4qIENvbnRhaW5zIHRoZSBgYnJvd3NlcmAgZXhwb3J0IHdoaWNoIHlvdSBzaG91bGQgdXNlIHRvIGFjY2VzcyB0aGUgZXh0ZW5zaW9uXG4qIEFQSXMgaW4geW91ciBwcm9qZWN0OlxuKlxuKiBgYGB0c1xuKiBpbXBvcnQgeyBicm93c2VyIH0gZnJvbSAnd3h0L2Jyb3dzZXInO1xuKlxuKiBicm93c2VyLnJ1bnRpbWUub25JbnN0YWxsZWQuYWRkTGlzdGVuZXIoKCkgPT4ge1xuKiAgIC8vIC4uLlxuKiB9KTtcbiogYGBgXG4qXG4qIEBtb2R1bGUgd3h0L2Jyb3dzZXJcbiovXG5jb25zdCBicm93c2VyID0gYnJvd3NlciQxO1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBicm93c2VyIH07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG4vLyNyZWdpb24gc3JjL3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMudHNcbnZhciBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50ID0gY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcblx0c3RhdGljIEVWRU5UX05BTUUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIik7XG5cdGNvbnN0cnVjdG9yKG5ld1VybCwgb2xkVXJsKSB7XG5cdFx0c3VwZXIoV3h0TG9jYXRpb25DaGFuZ2VFdmVudC5FVkVOVF9OQU1FLCB7fSk7XG5cdFx0dGhpcy5uZXdVcmwgPSBuZXdVcmw7XG5cdFx0dGhpcy5vbGRVcmwgPSBvbGRVcmw7XG5cdH1cbn07XG4vKipcbiogUmV0dXJucyBhbiBldmVudCBuYW1lIHVuaXF1ZSB0byB0aGUgZXh0ZW5zaW9uIGFuZCBjb250ZW50IHNjcmlwdCB0aGF0J3NcbiogcnVubmluZy5cbiovXG5mdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG5cdHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCwgZ2V0VW5pcXVlRXZlbnROYW1lIH07XG4iLCJpbXBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSBcIi4vY3VzdG9tLWV2ZW50cy5tanNcIjtcbi8vI3JlZ2lvbiBzcmMvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci50c1xuY29uc3Qgc3VwcG9ydHNOYXZpZ2F0aW9uQXBpID0gdHlwZW9mIGdsb2JhbFRoaXMubmF2aWdhdGlvbj8uYWRkRXZlbnRMaXN0ZW5lciA9PT0gXCJmdW5jdGlvblwiO1xuLyoqXG4qIENyZWF0ZSBhIHV0aWwgdGhhdCB3YXRjaGVzIGZvciBVUkwgY2hhbmdlcywgZGlzcGF0Y2hpbmcgdGhlIGN1c3RvbSBldmVudCB3aGVuXG4qIGRldGVjdGVkLiBTdG9wcyB3YXRjaGluZyB3aGVuIGNvbnRlbnQgc2NyaXB0IGlzIGludmFsaWRhdGVkLiBVc2VzIE5hdmlnYXRpb25cbiogQVBJIHdoZW4gYXZhaWxhYmxlLCBvdGhlcndpc2UgZmFsbHMgYmFjayB0byBwb2xsaW5nLlxuKi9cbmZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcblx0bGV0IGxhc3RVcmw7XG5cdGxldCB3YXRjaGluZyA9IGZhbHNlO1xuXHRyZXR1cm4geyBydW4oKSB7XG5cdFx0aWYgKHdhdGNoaW5nKSByZXR1cm47XG5cdFx0d2F0Y2hpbmcgPSB0cnVlO1xuXHRcdGxhc3RVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuXHRcdGlmIChzdXBwb3J0c05hdmlnYXRpb25BcGkpIGdsb2JhbFRoaXMubmF2aWdhdGlvbi5hZGRFdmVudExpc3RlbmVyKFwibmF2aWdhdGVcIiwgKGV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBuZXdVcmwgPSBuZXcgVVJMKGV2ZW50LmRlc3RpbmF0aW9uLnVybCk7XG5cdFx0XHRpZiAobmV3VXJsLmhyZWYgPT09IGxhc3RVcmwuaHJlZikgcmV0dXJuO1xuXHRcdFx0d2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBsYXN0VXJsKSk7XG5cdFx0XHRsYXN0VXJsID0gbmV3VXJsO1xuXHRcdH0sIHsgc2lnbmFsOiBjdHguc2lnbmFsIH0pO1xuXHRcdGVsc2UgY3R4LnNldEludGVydmFsKCgpID0+IHtcblx0XHRcdGNvbnN0IG5ld1VybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG5cdFx0XHRpZiAobmV3VXJsLmhyZWYgIT09IGxhc3RVcmwuaHJlZikge1xuXHRcdFx0XHR3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIGxhc3RVcmwpKTtcblx0XHRcdFx0bGFzdFVybCA9IG5ld1VybDtcblx0XHRcdH1cblx0XHR9LCAxZTMpO1xuXHR9IH07XG59XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9O1xuIiwiaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHsgZ2V0VW5pcXVlRXZlbnROYW1lIH0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5pbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG4vLyNyZWdpb24gc3JjL3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQudHNcbi8qKlxuKiBJbXBsZW1lbnRzXG4qIFtgQWJvcnRDb250cm9sbGVyYF0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0Fib3J0Q29udHJvbGxlcikuXG4qIFVzZWQgdG8gZGV0ZWN0IGFuZCBzdG9wIGNvbnRlbnQgc2NyaXB0IGNvZGUgd2hlbiB0aGUgc2NyaXB0IGlzIGludmFsaWRhdGVkLlxuKlxuKiBJdCBhbHNvIHByb3ZpZGVzIHNldmVyYWwgdXRpbGl0aWVzIGxpa2UgYGN0eC5zZXRUaW1lb3V0YCBhbmRcbiogYGN0eC5zZXRJbnRlcnZhbGAgdGhhdCBzaG91bGQgYmUgdXNlZCBpbiBjb250ZW50IHNjcmlwdHMgaW5zdGVhZCBvZlxuKiBgd2luZG93LnNldFRpbWVvdXRgIG9yIGB3aW5kb3cuc2V0SW50ZXJ2YWxgLlxuKlxuKiBUbyBjcmVhdGUgY29udGV4dCBmb3IgdGVzdGluZywgeW91IGNhbiB1c2UgdGhlIGNsYXNzJ3MgY29uc3RydWN0b3I6XG4qXG4qIGBgYHRzXG4qIGltcG9ydCB7IENvbnRlbnRTY3JpcHRDb250ZXh0IH0gZnJvbSAnd3h0L3V0aWxzL2NvbnRlbnQtc2NyaXB0cy1jb250ZXh0JztcbipcbiogdGVzdCgnc3RvcmFnZSBsaXN0ZW5lciBzaG91bGQgYmUgcmVtb3ZlZCB3aGVuIGNvbnRleHQgaXMgaW52YWxpZGF0ZWQnLCAoKSA9PiB7XG4qICAgY29uc3QgY3R4ID0gbmV3IENvbnRlbnRTY3JpcHRDb250ZXh0KCd0ZXN0Jyk7XG4qICAgY29uc3QgaXRlbSA9IHN0b3JhZ2UuZGVmaW5lSXRlbSgnbG9jYWw6Y291bnQnLCB7IGRlZmF1bHRWYWx1ZTogMCB9KTtcbiogICBjb25zdCB3YXRjaGVyID0gdmkuZm4oKTtcbipcbiogICBjb25zdCB1bndhdGNoID0gaXRlbS53YXRjaCh3YXRjaGVyKTtcbiogICBjdHgub25JbnZhbGlkYXRlZCh1bndhdGNoKTsgLy8gTGlzdGVuIGZvciBpbnZhbGlkYXRlIGhlcmVcbipcbiogICBhd2FpdCBpdGVtLnNldFZhbHVlKDEpO1xuKiAgIGV4cGVjdCh3YXRjaGVyKS50b0JlQ2FsbGVkVGltZXMoMSk7XG4qICAgZXhwZWN0KHdhdGNoZXIpLnRvQmVDYWxsZWRXaXRoKDEsIDApO1xuKlxuKiAgIGN0eC5ub3RpZnlJbnZhbGlkYXRlZCgpOyAvLyBVc2UgdGhpcyBmdW5jdGlvbiB0byBpbnZhbGlkYXRlIHRoZSBjb250ZXh0XG4qICAgYXdhaXQgaXRlbS5zZXRWYWx1ZSgyKTtcbiogICBleHBlY3Qod2F0Y2hlcikudG9CZUNhbGxlZFRpbWVzKDEpO1xuKiB9KTtcbiogYGBgXG4qL1xudmFyIENvbnRlbnRTY3JpcHRDb250ZXh0ID0gY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuXHRzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIik7XG5cdGlkO1xuXHRhYm9ydENvbnRyb2xsZXI7XG5cdGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcblx0Y29uc3RydWN0b3IoY29udGVudFNjcmlwdE5hbWUsIG9wdGlvbnMpIHtcblx0XHR0aGlzLmNvbnRlbnRTY3JpcHROYW1lID0gY29udGVudFNjcmlwdE5hbWU7XG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0XHR0aGlzLmlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMik7XG5cdFx0dGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG5cdFx0dGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuXHRcdHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCk7XG5cdH1cblx0Z2V0IHNpZ25hbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuXHR9XG5cdGFib3J0KHJlYXNvbikge1xuXHRcdHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuXHR9XG5cdGdldCBpc0ludmFsaWQoKSB7XG5cdFx0aWYgKGJyb3dzZXIucnVudGltZT8uaWQgPT0gbnVsbCkgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuXHRcdHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuXHR9XG5cdGdldCBpc1ZhbGlkKCkge1xuXHRcdHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG5cdH1cblx0LyoqXG5cdCogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzXG5cdCogaW52YWxpZGF0ZWQuXG5cdCpcblx0KiBAZXhhbXBsZVxuXHQqICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihjYik7XG5cdCogICBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuXHQqICAgICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcblx0KiAgIH0pO1xuXHQqICAgLy8gLi4uXG5cdCogICByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyKCk7XG5cdCpcblx0KiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG5cdCovXG5cdG9uSW52YWxpZGF0ZWQoY2IpIHtcblx0XHR0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuXHRcdHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuXHR9XG5cdC8qKlxuXHQqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uXG5cdCogdGhhdCBzaG91bGRuJ3QgcnVuIGFmdGVyIHRoZSBjb250ZXh0IGlzIGV4cGlyZWQuXG5cdCpcblx0KiBAZXhhbXBsZVxuXHQqICAgY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcblx0KiAgICAgaWYgKGN0eC5pc0ludmFsaWQpIHJldHVybiBjdHguYmxvY2soKTtcblx0KlxuXHQqICAgICAvLyAuLi5cblx0KiAgIH07XG5cdCovXG5cdGJsb2NrKCkge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7fSk7XG5cdH1cblx0LyoqXG5cdCogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRJbnRlcnZhbGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWxcblx0KiB3aGVuIGludmFsaWRhdGVkLlxuXHQqXG5cdCogSW50ZXJ2YWxzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2xlYXJJbnRlcnZhbGAgZnVuY3Rpb24uXG5cdCovXG5cdHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcblx0XHRjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcblx0XHR9LCB0aW1lb3V0KTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuXHRcdHJldHVybiBpZDtcblx0fVxuXHQvKipcblx0KiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsXG5cdCogd2hlbiBpbnZhbGlkYXRlZC5cblx0KlxuXHQqIFRpbWVvdXRzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgc2V0VGltZW91dGAgZnVuY3Rpb24uXG5cdCovXG5cdHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuXHRcdGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG5cdFx0fSwgdGltZW91dCk7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuXHRcdHJldHVybiBpZDtcblx0fVxuXHQvKipcblx0KiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHNcblx0KiB0aGUgcmVxdWVzdCB3aGVuIGludmFsaWRhdGVkLlxuXHQqXG5cdCogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYFxuXHQqIGZ1bmN0aW9uLlxuXHQqL1xuXHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcblx0XHRjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuXHRcdFx0aWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG5cdFx0fSk7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cdC8qKlxuXHQqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlXG5cdCogcmVxdWVzdCB3aGVuIGludmFsaWRhdGVkLlxuXHQqXG5cdCogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2Bcblx0KiBmdW5jdGlvbi5cblx0Ki9cblx0cmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcblx0XHR9LCBvcHRpb25zKTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cdGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG5cdFx0aWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcblx0XHRcdGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuXHRcdH1cblx0XHR0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKHR5cGUuc3RhcnRzV2l0aChcInd4dDpcIikgPyBnZXRVbmlxdWVFdmVudE5hbWUodHlwZSkgOiB0eXBlLCBoYW5kbGVyLCB7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0c2lnbmFsOiB0aGlzLnNpZ25hbFxuXHRcdH0pO1xuXHR9XG5cdC8qKlxuXHQqIEBpbnRlcm5hbFxuXHQqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuXHQqL1xuXHRub3RpZnlJbnZhbGlkYXRlZCgpIHtcblx0XHR0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcblx0XHRsb2dnZXIuZGVidWcoYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgKTtcblx0fVxuXHRzdG9wT2xkU2NyaXB0cygpIHtcblx0XHRkb2N1bWVudC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudChDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsIHsgZGV0YWlsOiB7XG5cdFx0XHRjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcblx0XHRcdG1lc3NhZ2VJZDogdGhpcy5pZFxuXHRcdH0gfSkpO1xuXHRcdGlmICghdGhpcy5vcHRpb25zPy5ub1NjcmlwdFN0YXJ0ZWRQb3N0TWVzc2FnZSkgd2luZG93LnBvc3RNZXNzYWdlKHtcblx0XHRcdHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcblx0XHRcdGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuXHRcdFx0bWVzc2FnZUlkOiB0aGlzLmlkXG5cdFx0fSwgXCIqXCIpO1xuXHR9XG5cdHZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkge1xuXHRcdGNvbnN0IGlzU2FtZUNvbnRlbnRTY3JpcHQgPSBldmVudC5kZXRhaWw/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuXHRcdGNvbnN0IGlzRnJvbVNlbGYgPSBldmVudC5kZXRhaWw/Lm1lc3NhZ2VJZCA9PT0gdGhpcy5pZDtcblx0XHRyZXR1cm4gaXNTYW1lQ29udGVudFNjcmlwdCAmJiAhaXNGcm9tU2VsZjtcblx0fVxuXHRsaXN0ZW5Gb3JOZXdlclNjcmlwdHMoKSB7XG5cdFx0Y29uc3QgY2IgPSAoZXZlbnQpID0+IHtcblx0XHRcdGlmICghKGV2ZW50IGluc3RhbmNlb2YgQ3VzdG9tRXZlbnQpIHx8ICF0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHJldHVybjtcblx0XHRcdHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcblx0XHR9O1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLCBjYik7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLCBjYikpO1xuXHR9XG59O1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBDb250ZW50U2NyaXB0Q29udGV4dCB9O1xuIl0sInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDEwLDExLDEyLDEzLDE0LDE1XSwibWFwcGluZ3MiOiI7O0NBQ0EsU0FBUyxvQkFBb0IsWUFBWTtFQUN4QyxPQUFPO0NBQ1I7OztDQ0RBLFNBQVMsd0JBQXdCLEtBQTRCO0VBQzNELElBQUk7R0FDRixNQUFNLFNBQWtCLEtBQUssTUFBTSxHQUFHO0dBQ3RDLE1BQU0sUUFBUSxNQUFNLFFBQVEsTUFBTSxJQUFJLFNBQVMsQ0FBQyxNQUFNO0dBRXRELEtBQUssTUFBTSxRQUFRLE9BQU87SUFDeEIsSUFBSSxDQUFDLFFBQVEsT0FBTyxTQUFTLFVBQVU7SUFDdkMsTUFBTSxTQUFTO0lBQ2YsTUFBTSxRQUFRLE9BQU87SUFDckIsSUFBSSxNQUFNLFFBQVEsS0FBSztVQUNoQixNQUFNLFFBQVEsT0FDakIsSUFBSSxRQUFRLE9BQU8sU0FBUyxVQUFVO01BQ3BDLE1BQU0sT0FBUSxLQUFpQztNQUMvQyxJQUFJLE9BQU8sU0FBUyxVQUFVLE9BQU87S0FDdkM7O0lBR0osTUFBTSxPQUFPLE9BQU87SUFDcEIsSUFBSSxPQUFPLFNBQVMsVUFBVSxPQUFPO0dBQ3ZDO0VBQ0YsUUFBUTtHQUNOLE9BQU87RUFDVDtFQUVBLE9BQU87Q0FDVDtDQUVBLFNBQWdCLGVBQWUsS0FB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