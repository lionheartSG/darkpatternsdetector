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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsIm5hbWVzIjpbInByaW50IiwibG9nZ2VyIiwiYnJvd3NlciJdLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQubWpzIiwiLi4vLi4vLi4vLi4vc2hhcmVkL3BhZ2UtY29udGV4dC50cyIsIi4uLy4uLy4uLy4uL3NoYXJlZC9oaWdobGlnaHQtbWF0Y2hpbmcudHMiLCIuLi8uLi8uLi9zcmMvZXh0cmFjdC9oaWdobGlnaHRzLnRzIiwiLi4vLi4vLi4vc3JjL2V4dHJhY3QvcGFnZS50cyIsIi4uLy4uLy4uL3NyYy9leHRyYWN0L3dhaXQtZm9yLXBhZ2UudHMiLCIuLi8uLi8uLi9zcmMvaGlnaGxpZ2h0L292ZXJsYXkudHMiLCIuLi8uLi8uLi9zcmMvbGliL2V4Y2x1ZGVkLWhvc3RzLnRzIiwiLi4vLi4vLi4vc3JjL2xpYi9zdG9yYWdlLnRzIiwiLi4vLi4vLi4vc3JjL2VudHJ5cG9pbnRzL2NvbnRlbnQudHMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvY29udGVudC1zY3JpcHQtY29udGV4dC5tanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8jcmVnaW9uIHNyYy91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQudHNcbmZ1bmN0aW9uIGRlZmluZUNvbnRlbnRTY3JpcHQoZGVmaW5pdGlvbikge1xuXHRyZXR1cm4gZGVmaW5pdGlvbjtcbn1cbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgZGVmaW5lQ29udGVudFNjcmlwdCB9O1xuIiwiaW1wb3J0IHR5cGUgeyBQYWdlVHlwZSB9IGZyb20gXCIuL3R5cGVzL3NjYW5cIjtcblxuZnVuY3Rpb24gcGFyc2VTdHJ1Y3R1cmVkRGF0YVR5cGUocmF3OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJzZWQ6IHVua25vd24gPSBKU09OLnBhcnNlKHJhdyk7XG4gICAgY29uc3QgaXRlbXMgPSBBcnJheS5pc0FycmF5KHBhcnNlZCkgPyBwYXJzZWQgOiBbcGFyc2VkXTtcblxuICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuICAgICAgaWYgKCFpdGVtIHx8IHR5cGVvZiBpdGVtICE9PSBcIm9iamVjdFwiKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHJlY29yZCA9IGl0ZW0gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgICBjb25zdCBncmFwaCA9IHJlY29yZFtcIkBncmFwaFwiXTtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGdyYXBoKSkge1xuICAgICAgICBmb3IgKGNvbnN0IG5vZGUgb2YgZ3JhcGgpIHtcbiAgICAgICAgICBpZiAobm9kZSAmJiB0eXBlb2Ygbm9kZSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgY29uc3QgdHlwZSA9IChub2RlIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtcIkB0eXBlXCJdO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0eXBlID09PSBcInN0cmluZ1wiKSByZXR1cm4gdHlwZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnN0IHR5cGUgPSByZWNvcmRbXCJAdHlwZVwiXTtcbiAgICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIHR5cGU7XG4gICAgfVxuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0UGFnZVR5cGUoZG9jOiBEb2N1bWVudCk6IFBhZ2VUeXBlIHtcbiAgY29uc3Qgb2dUeXBlID0gZG9jXG4gICAgLnF1ZXJ5U2VsZWN0b3IoJ21ldGFbcHJvcGVydHk9XCJvZzp0eXBlXCJdJylcbiAgICA/LmdldEF0dHJpYnV0ZShcImNvbnRlbnRcIilcbiAgICA/LnRvTG93ZXJDYXNlKCk7XG5cbiAgaWYgKG9nVHlwZSA9PT0gXCJhcnRpY2xlXCIgfHwgb2dUeXBlID09PSBcIm5ld3NhcnRpY2xlXCIpIHtcbiAgICByZXR1cm4gXCJlZGl0b3JpYWxcIjtcbiAgfVxuXG4gIGZvciAoY29uc3Qgc2NyaXB0IG9mIGRvYy5xdWVyeVNlbGVjdG9yQWxsKFxuICAgICdzY3JpcHRbdHlwZT1cImFwcGxpY2F0aW9uL2xkK2pzb25cIl0nLFxuICApKSB7XG4gICAgY29uc3Qgc3RydWN0dXJlZFR5cGUgPSBwYXJzZVN0cnVjdHVyZWREYXRhVHlwZShzY3JpcHQudGV4dENvbnRlbnQgPz8gXCJcIik7XG4gICAgaWYgKFxuICAgICAgc3RydWN0dXJlZFR5cGUgPT09IFwiTmV3c0FydGljbGVcIiB8fFxuICAgICAgc3RydWN0dXJlZFR5cGUgPT09IFwiQXJ0aWNsZVwiIHx8XG4gICAgICBzdHJ1Y3R1cmVkVHlwZSA9PT0gXCJCbG9nUG9zdGluZ1wiXG4gICAgKSB7XG4gICAgICByZXR1cm4gXCJlZGl0b3JpYWxcIjtcbiAgICB9XG4gIH1cblxuICBjb25zdCBhcnRpY2xlID0gZG9jLnF1ZXJ5U2VsZWN0b3IoXCJhcnRpY2xlXCIpO1xuICBpZiAoYXJ0aWNsZSkge1xuICAgIGNvbnN0IGFydGljbGVMZW5ndGggPSAoYXJ0aWNsZS50ZXh0Q29udGVudCA/PyBcIlwiKS50cmltKCkubGVuZ3RoO1xuICAgIGNvbnN0IGJvZHlMZW5ndGggPSAoZG9jLmJvZHk/LnRleHRDb250ZW50ID8/IFwiXCIpLnRyaW0oKS5sZW5ndGg7XG4gICAgaWYgKGFydGljbGVMZW5ndGggPiA0MDAgJiYgYXJ0aWNsZUxlbmd0aCAvIE1hdGgubWF4KGJvZHlMZW5ndGgsIDEpID4gMC4zNSkge1xuICAgICAgcmV0dXJuIFwiZWRpdG9yaWFsXCI7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIFwiZ2VuZXJhbFwiO1xufVxuIiwiaW1wb3J0IHR5cGUgeyBQYWdlSGlnaGxpZ2h0IH0gZnJvbSBcIi4vdHlwZXMvc2NhblwiO1xuXG5jb25zdCBQQVRURVJOX1RZUEVfR1JPVVBTOiByZWFkb25seSBzdHJpbmdbXVtdID0gW1xuICBbXCJSZXBlYXRlZFBvcHVwT3JTdGlja3lCYW5uZXJcIiwgXCJSZXBlYXRlZFByb21wdFwiLCBcIlN0aWNreVByZXNzdXJlQmFubmVyXCJdLFxuICBbXCJBY3Rpdml0eU5vdGlmaWNhdGlvbnNcIiwgXCJBY3Rpdml0eU5vdGlmaWNhdGlvblwiLCBcIkxpdmVBY3Rpdml0eU1lc3NhZ2VcIl0sXG4gIFtcIlJlcXVpcmVkRW5yb2xsbWVudFwiLCBcIkNvbmZpcm1zaGFtaW5nXCJdLFxuICBbXCJMaW1pdGVkVGltZU1lc3NhZ2VcIiwgXCJMaW1pdGVkVGltZU9mZmVyXCIsIFwiTGltaXRlZFRpbWVQcm9tb3Rpb25cIl0sXG4gIFtcIk1pc2xlYWRpbmdQcmljZVwiLCBcIkRyaXBQcmljaW5nXCIsIFwiVW5jbGVhckRpc2NvdW50XCJdLFxuXTtcblxuY29uc3QgU1RJQ0tZX09WRVJMQVlfQ0FURUdPUklFUyA9IG5ldyBTZXQoW1wiT0JTVFJVQ1RJT05cIiwgXCJOQUdHSU5HXCJdKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBhdHRlcm5UeXBlc01hdGNoKGE6IHN0cmluZywgYjogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGlmIChhID09PSBiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmb3IgKGNvbnN0IGdyb3VwIG9mIFBBVFRFUk5fVFlQRV9HUk9VUFMpIHtcbiAgICBpZiAoZ3JvdXAuaW5jbHVkZXMoYSkgJiYgZ3JvdXAuaW5jbHVkZXMoYikpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplRXZpZGVuY2UodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnRyaW0oKTtcbn1cblxuZnVuY3Rpb24gZXZpZGVuY2VQaHJhc2VzKGV2aWRlbmNlOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHBocmFzZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBjb25zdCBxdW90ZWQgPSBldmlkZW5jZS5tYXRjaEFsbCgvW1wi4oCcJ10oLis/KVtcIuKAnSddL2cpO1xuICBmb3IgKGNvbnN0IG1hdGNoIG9mIHF1b3RlZCkge1xuICAgIGNvbnN0IGlubmVyID0gbWF0Y2hbMV0udHJpbSgpO1xuICAgIGlmIChpbm5lci5sZW5ndGggPj0gMykge1xuICAgICAgcGhyYXNlcy5hZGQoaW5uZXIpO1xuICAgICAgZm9yIChjb25zdCBzZWdtZW50IG9mIGlubmVyLnNwbGl0KFwifFwiKSkge1xuICAgICAgICBjb25zdCBwYXJ0ID0gc2VnbWVudC50cmltKCk7XG4gICAgICAgIGlmIChwYXJ0Lmxlbmd0aCA+PSAzKSB7XG4gICAgICAgICAgcGhyYXNlcy5hZGQocGFydCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IG1hdGNoIG9mIGV2aWRlbmNlLm1hdGNoQWxsKC9gKFteYF0rKWAvZykpIHtcbiAgICBjb25zdCBpbm5lciA9IG1hdGNoWzFdLnRyaW0oKTtcbiAgICBpZiAoaW5uZXIubGVuZ3RoID49IDMpIHtcbiAgICAgIHBocmFzZXMuYWRkKGlubmVyKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCB2aXNpYmxlVGV4dCA9IGV2aWRlbmNlLm1hdGNoKFxuICAgIC9WaXNpYmxlIHRleHQ6XFxzKltcIuKAnCddPyhbXlwi4oCdJ1xcbi5dKz8pW1wi4oCdJ10/KD86XFwufCR8XFxuKS9pLFxuICApPy5bMV07XG4gIGlmICh2aXNpYmxlVGV4dD8udHJpbSgpKSB7XG4gICAgcGhyYXNlcy5hZGQodmlzaWJsZVRleHQudHJpbSgpKTtcbiAgfVxuXG4gIGNvbnN0IGNsZWFuZWQgPSBldmlkZW5jZS5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gIGlmIChjbGVhbmVkLmxlbmd0aCA+PSA0KSB7XG4gICAgcGhyYXNlcy5hZGQoY2xlYW5lZC5zbGljZSgwLCBNYXRoLm1pbig4MCwgY2xlYW5lZC5sZW5ndGgpKSk7XG4gIH1cblxuICByZXR1cm4gWy4uLnBocmFzZXNdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXZpZGVuY2VPdmVybGFwcyhhOiBzdHJpbmcsIGI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCBsZWZ0ID0gbm9ybWFsaXplRXZpZGVuY2UoYSk7XG4gIGNvbnN0IHJpZ2h0ID0gbm9ybWFsaXplRXZpZGVuY2UoYik7XG5cbiAgaWYgKGxlZnQuaW5jbHVkZXMocmlnaHQpIHx8IHJpZ2h0LmluY2x1ZGVzKGxlZnQpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmb3IgKGNvbnN0IHBocmFzZSBvZiBldmlkZW5jZVBocmFzZXMoYSkpIHtcbiAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplRXZpZGVuY2UocGhyYXNlKTtcbiAgICBpZiAobm9ybWFsaXplZC5sZW5ndGggPj0gNCAmJiByaWdodC5pbmNsdWRlcyhub3JtYWxpemVkKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCBwaHJhc2Ugb2YgZXZpZGVuY2VQaHJhc2VzKGIpKSB7XG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZUV2aWRlbmNlKHBocmFzZSk7XG4gICAgaWYgKG5vcm1hbGl6ZWQubGVuZ3RoID49IDQgJiYgbGVmdC5pbmNsdWRlcyhub3JtYWxpemVkKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2hIaWdobGlnaHRUb0RldGVjdGlvbihcbiAgaGlnaGxpZ2h0czogUGFnZUhpZ2hsaWdodFtdLFxuICBkZXRlY3Rpb246IHtcbiAgICBjYXRlZ29yeTogc3RyaW5nO1xuICAgIHBhdHRlcm5UeXBlOiBzdHJpbmc7XG4gICAgZXZpZGVuY2U6IHN0cmluZztcbiAgfSxcbik6IFBhZ2VIaWdobGlnaHQgfCB1bmRlZmluZWQge1xuICBjb25zdCBieVBhdHRlcm4gPSBoaWdobGlnaHRzLmZpbHRlcihcbiAgICAoaGlnaGxpZ2h0KSA9PlxuICAgICAgaGlnaGxpZ2h0LmNhdGVnb3J5ID09PSBkZXRlY3Rpb24uY2F0ZWdvcnkgJiZcbiAgICAgIHBhdHRlcm5UeXBlc01hdGNoKGhpZ2hsaWdodC5wYXR0ZXJuVHlwZSwgZGV0ZWN0aW9uLnBhdHRlcm5UeXBlKSxcbiAgKTtcblxuICBpZiAoYnlQYXR0ZXJuLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBieVBhdHRlcm5bMF07XG4gIH1cblxuICBpZiAoYnlQYXR0ZXJuLmxlbmd0aCA+IDEpIHtcbiAgICBjb25zdCBieUV2aWRlbmNlID0gYnlQYXR0ZXJuLmZpbmQoXG4gICAgICAoaGlnaGxpZ2h0KSA9PlxuICAgICAgICBoaWdobGlnaHQuZXZpZGVuY2UgJiZcbiAgICAgICAgZXZpZGVuY2VPdmVybGFwcyhoaWdobGlnaHQuZXZpZGVuY2UsIGRldGVjdGlvbi5ldmlkZW5jZSksXG4gICAgKTtcbiAgICBpZiAoYnlFdmlkZW5jZSkge1xuICAgICAgcmV0dXJuIGJ5RXZpZGVuY2U7XG4gICAgfVxuICAgIHJldHVybiBieVBhdHRlcm5bMF07XG4gIH1cblxuICBjb25zdCBieUNhdGVnb3J5ID0gaGlnaGxpZ2h0cy5maWx0ZXIoXG4gICAgKGhpZ2hsaWdodCkgPT4gaGlnaGxpZ2h0LmNhdGVnb3J5ID09PSBkZXRlY3Rpb24uY2F0ZWdvcnksXG4gICk7XG5cbiAgaWYgKGJ5Q2F0ZWdvcnkubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGJ5Q2F0ZWdvcnlbMF07XG4gIH1cblxuICBpZiAoYnlDYXRlZ29yeS5sZW5ndGggPiAxKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGJ5Q2F0ZWdvcnkuZmluZChcbiAgICAgICAgKGhpZ2hsaWdodCkgPT5cbiAgICAgICAgICBoaWdobGlnaHQuZXZpZGVuY2UgJiZcbiAgICAgICAgICBldmlkZW5jZU92ZXJsYXBzKGhpZ2hsaWdodC5ldmlkZW5jZSwgZGV0ZWN0aW9uLmV2aWRlbmNlKSxcbiAgICAgICkgPz8gYnlDYXRlZ29yeVswXVxuICAgICk7XG4gIH1cblxuICBpZiAoU1RJQ0tZX09WRVJMQVlfQ0FURUdPUklFUy5oYXMoZGV0ZWN0aW9uLmNhdGVnb3J5KSkge1xuICAgIGNvbnN0IHN0aWNreUhpZ2hsaWdodCA9IGhpZ2hsaWdodHMuZmluZChcbiAgICAgIChoaWdobGlnaHQpID0+XG4gICAgICAgIFNUSUNLWV9PVkVSTEFZX0NBVEVHT1JJRVMuaGFzKGhpZ2hsaWdodC5jYXRlZ29yeSkgfHxcbiAgICAgICAgcGF0dGVyblR5cGVzTWF0Y2goaGlnaGxpZ2h0LnBhdHRlcm5UeXBlLCBcIlN0aWNreVByZXNzdXJlQmFubmVyXCIpIHx8XG4gICAgICAgIHBhdHRlcm5UeXBlc01hdGNoKGhpZ2hsaWdodC5wYXR0ZXJuVHlwZSwgXCJSZXBlYXRlZFBvcHVwT3JTdGlja3lCYW5uZXJcIiksXG4gICAgKTtcbiAgICBpZiAoc3RpY2t5SGlnaGxpZ2h0KSB7XG4gICAgICByZXR1cm4gc3RpY2t5SGlnaGxpZ2h0O1xuICAgIH1cbiAgfVxuXG4gIGlmIChkZXRlY3Rpb24uY2F0ZWdvcnkgPT09IFwiRk9SQ0VEX0FDVElPTlwiKSB7XG4gICAgY29uc3QgcHJvbW9IaWdobGlnaHQgPSBoaWdobGlnaHRzLmZpbmQoXG4gICAgICAoaGlnaGxpZ2h0KSA9PlxuICAgICAgICBoaWdobGlnaHQuY2F0ZWdvcnkgPT09IFwiRk9SQ0VEX0FDVElPTlwiIHx8XG4gICAgICAgIGhpZ2hsaWdodC5jYXRlZ29yeSA9PT0gXCJOQUdHSU5HXCIgfHxcbiAgICAgICAgL3N0aWNreXxwcm9tb3xiYW5uZXJ8dGlja2VyL2kudGVzdChoaWdobGlnaHQubGFiZWwpLFxuICAgICk7XG4gICAgaWYgKHByb21vSGlnaGxpZ2h0KSB7XG4gICAgICByZXR1cm4gcHJvbW9IaWdobGlnaHQ7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgYnlFdmlkZW5jZU9ubHkgPSBoaWdobGlnaHRzLmZpbmQoXG4gICAgKGhpZ2hsaWdodCkgPT5cbiAgICAgIGhpZ2hsaWdodC5ldmlkZW5jZSAmJlxuICAgICAgZXZpZGVuY2VPdmVybGFwcyhoaWdobGlnaHQuZXZpZGVuY2UsIGRldGVjdGlvbi5ldmlkZW5jZSksXG4gICk7XG4gIGlmIChieUV2aWRlbmNlT25seSkge1xuICAgIHJldHVybiBieUV2aWRlbmNlT25seTtcbiAgfVxuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG4iLCJpbXBvcnQgdHlwZSB7XG4gIERldGVjdGlvbkNhdGVnb3J5LFxuICBQYWdlSGlnaGxpZ2h0LFxuICBQYWdlVHlwZSxcbn0gZnJvbSBcIkBkYXJrcGF0dGVybnMvc2hhcmVkL3R5cGVzXCI7XG5pbXBvcnQgeyBwYXR0ZXJuVHlwZXNNYXRjaCB9IGZyb20gXCJAZGFya3BhdHRlcm5zL3NoYXJlZC9oaWdobGlnaHQtbWF0Y2hpbmdcIjtcblxuZXhwb3J0IGNvbnN0IEhJR0hMSUdIVF9JRF9BVFRSID0gXCJkYXRhLWRwZC1oaWdobGlnaHQtaWRcIjtcbmV4cG9ydCBjb25zdCBISUdITElHSFRfQk9YX0FUVFIgPSBcImRhdGEtZHBkLWhpZ2hsaWdodC1ib3hcIjtcblxuY29uc3QgTUFYX0hJR0hMSUdIVFMgPSAxNTtcblxuY29uc3QgQ09VTlRET1dOX1NFTEVDVE9SUyA9IFtcbiAgJ1tjbGFzcyo9XCJjb3VudGRvd25cIl0nLFxuICAnW2NsYXNzKj1cInRpbWVyXCJdJyxcbiAgJ1tpZCo9XCJjb3VudGRvd25cIl0nLFxuICAnW2lkKj1cInRpbWVyXCJdJyxcbiAgJ1tyb2xlPVwidGltZXJcIl0nLFxuXS5qb2luKFwiLFwiKTtcblxuY29uc3QgSU5URVJBQ1RJVkVfU0VMRUNUT1JTID0gW1xuICBcImJ1dHRvblwiLFxuICBcImFcIixcbiAgXCJpbnB1dFwiLFxuICBcInNlbGVjdFwiLFxuICBcImxhYmVsXCIsXG4gIFwidGV4dGFyZWFcIixcbiAgJ1tyb2xlPVwiZGlhbG9nXCJdJyxcbiAgJ1tjbGFzcyo9XCJtb2RhbFwiXScsXG4gICdbY2xhc3MqPVwicG9wdXBcIl0nLFxuICAnW2NsYXNzKj1cIm92ZXJsYXlcIl0nLFxuICAnW2NsYXNzKj1cImJhbm5lclwiXScsXG4gICdbY2xhc3MqPVwicHJpY2VcIl0nLFxuICAnW2NsYXNzKj1cInN1YnNjcmliZVwiXScsXG4gICdbY2xhc3MqPVwibmV3c2xldHRlclwiXScsXG5dLmpvaW4oXCIsXCIpO1xuXG5jb25zdCBVUkdFTkNZX1BBVFRFUk5TID0gW1xuICAvY291bnRkb3duL2ksXG4gIC9kZWFsIGVuZHMgKGlufHNvb258dG9kYXkpL2ksXG4gIC9saW1pdGVkIHRpbWUgb25seS9pLFxuICAvb2ZmZXIgZXhwaXJlcy9pLFxuICAvZW5kcyBpbiBcXGQrL2ksXG4gIC9zYWxlIGVuZHMvaSxcbiAgL2VuZHMgdG9kYXkvaSxcbiAgL2xhc3QgY2hhbmNlL2ksXG4gIC9mbGFzaCBzYWxlL2ksXG4gIC9zaG9wIG5vdyBiZWZvcmUvaSxcbiAgL2JlZm9yZSBpdFsnJ10/cyBnb25lL2ksXG4gIC9hY3Qgbm93L2ksXG4gIC9odXJyeS9pLFxuICAvZG9uWycnXT90IG1pc3Mgb3V0L2ksXG4gIC9nZXQgXFxkK1xccyolXFxzKm9mZi9pLFxuICAvXFxib2ZmIG5vd1xcYi9pLFxuICAvXFxkK1xccyolXFxzKm9mZiBub3cvaSxcbl07XG5cbmNvbnN0IFNDQVJDSVRZX1BBVFRFUk5TID0gW1xuICAvaW4gc3RvY2svaSxcbiAgL29ubHkgXFxkKyBsZWZ0L2ksXG4gIC9vbmx5IFxcZCsgcmVtYWluaW5nL2ksXG4gIC9sb3cgc3RvY2svaSxcbiAgL3NlbGxpbmcgZmFzdC9pLFxuICAvaGlnaCBkZW1hbmQvaSxcbiAgL3Blb3BsZSAoYXJlICk/dmlld2luZy9pLFxuICAvaW4gXFxkKyBjYXJ0cz8vaSxcbiAgL2FsbW9zdCBzb2xkIG91dC9pLFxuICAvbGltaXRlZCBxdWFudGl0eS9pLFxuICAvZmV3IGxlZnQvaSxcbiAgL2xlZnQgaW4gc3RvY2svaSxcbl07XG5cbmNvbnN0IFNPQ0lBTF9QUk9PRl9QQVRURVJOUyA9IFtcbiAgL3Blb3BsZSAoYXJlICk/dmlld2luZy9pLFxuICAvYm91Z2h0IGluIHRoZSBsYXN0L2ksXG4gIC9zb21lb25lIGp1c3QgcHVyY2hhc2VkL2ksXG4gIC9yZWNlbnQobHkpPyBwdXJjaGFzZWQvaSxcbiAgL1xcZCsgKHBlb3BsZXx1c2Vyc3xjdXN0b21lcnMpIChhcmUgKT8odmlld2luZ3x3YXRjaGluZykvaSxcbiAgL3NpZ24gdXAgZm9yIC4qICh1cGRhdGVzfG5ld3NsZXR0ZXIpL2ksXG4gIC9cXGJzcGVjaWFsc1xcYi9pLFxuXTtcblxuY29uc3QgQ09ORklSTVNIQU1JTkdfUEFUVEVSTlMgPSBbXG4gIC9ubyB0aGFua3MsPyBpIGhhdGUgc2F2aW5nL2ksXG4gIC9pIGRvblsnJ110IHdhbnQgYSBkaXNjb3VudC9pLFxuICAvbm8sPyBpWycnXWxsIHBheSBmdWxsIHByaWNlL2ksXG4gIC9jb250aW51ZSB3aXRob3V0L2ksXG5dO1xuXG5jb25zdCBQUklDSU5HX1BBVFRFUk5TID0gW1xuICAvd2FzIFtcXCTCo+KCrFMkXS9pLFxuICAvbm93IFtcXCTCo+KCrFMkXS9pLFxuICAvW1xcJMKj4oKsUyRdXFxzP1tcXGQsLl0rW1xcc1xcU117MCwyMH0od2FzfGJlZm9yZXxjb21wYXJlfG9yaWdpbmFsfHJlZ3VsYXIpL2ksXG4gIC8od2FzfGJlZm9yZXxjb21wYXJlfG9yaWdpbmFsfHJlZ3VsYXIpW1xcc1xcU117MCwyMH1bXFwkwqPigqxTJF1cXHM/W1xcZCwuXSsvaSxcbiAgL3NhdmUgXFxkK1xccyolL2ksXG4gIC9cXGQrXFxzKiVcXHMqb2ZmL2ksXG4gIC9ycnB8bXJycC9pLFxuICAvb3JpZ2luYWwgcHJpY2UvaSxcbiAgL2NvbXBhcmUuP2F0L2ksXG4gIC9yZWd1bGFyIHByaWNlL2ksXG4gIC9saXN0ZWQgcHJpY2UvaSxcbiAgL1xcKyB0YXgvaSxcbiAgL2FkZGl0aW9uYWwgZmVlcz8vaSxcbiAgL3N0YXJ0aW5nIGF0L2ksXG4gIC9mcm9tIFtcXCTCo+KCrFMkXS9pLFxuICAvW1xcJMKj4oKsUyRdW1xcZCwuXStcXHMqW1xcJMKj4oKsUyRdW1xcZCwuXSsvLFxuXTtcblxuY29uc3QgUFJJQ0VfQ09OVEFJTkVSX1NFTEVDVE9SUyA9IFtcbiAgJ1tjbGFzcyo9XCJwcmljZVwiXScsXG4gICdbY2xhc3MqPVwiUHJpY2VcIl0nLFxuICAnW2NsYXNzKj1cImNvbXBhcmVcIl0nLFxuICAnW2NsYXNzKj1cIndhcy1wcmljZVwiXScsXG4gICdbY2xhc3MqPVwid2FzX3ByaWNlXCJdJyxcbiAgJ1tjbGFzcyo9XCJvcmlnaW5hbFwiXScsXG4gICdbY2xhc3MqPVwicmVndWxhclwiXScsXG4gICdbY2xhc3MqPVwic2FsZS1wcmljZVwiXScsXG4gICdbY2xhc3MqPVwic2FsZV9wcmljZVwiXScsXG4gICdbZGF0YS1jb21wYXJlLXByaWNlXScsXG4gICdbZGF0YS1zYWxlLXByaWNlXScsXG4gIFwiLnByaWNlXCIsXG4gIFwiLnByb2R1Y3QtcHJpY2VcIixcbl0uam9pbihcIixcIik7XG5cbmNvbnN0IE5BR0dJTkdfUEFUVEVSTlMgPSBbXG4gIC9zdWJzY3JpYmUvaSxcbiAgL3NpZ24gdXAvaSxcbiAgL2Rvbid0IG1pc3MvaSxcbiAgL2JlZm9yZSB5b3UgZ28vaSxcbiAgL3dhaXQhPyBkb24ndCBsZWF2ZS9pLFxuICAvZW5hYmxlIG5vdGlmaWNhdGlvbnMvaSxcbiAgL3BvcHVwL2ksXG4gIC9tb2RhbC9pLFxuICAvc3RpY2t5IChiYXJ8YmFubmVyfGZvb3RlcikvaSxcbl07XG5cbmNvbnN0IEVOUk9MTE1FTlRfUEFUVEVSTlMgPSBbXG4gIC9zaWduIGluL2ksXG4gIC9sb2cgaW4vaSxcbiAgL3JlZ2lzdGVyL2ksXG4gIC9jcmVhdGUgYWNjb3VudC9pLFxuICAvbXkgb3JkZXJzL2ksXG4gIC9teSBmYXZvcml0ZXMvaSxcbiAgL2pvaW4gbm93L2ksXG5dO1xuXG5jb25zdCBSRVZJRVdfUEFUVEVSTlMgPSBbXG4gIC9yZXZpZXcvaSxcbiAgL3Rlc3RpbW9uaWFsL2ksXG4gIC9jdXN0b21lciBzYWlkL2ksXG4gIC/imIV84q2QLyxcbiAgL3JhdGVkIFxcZC9pLFxuICAvXFxkIG91dCBvZiA1L2ksXG5dO1xuXG5jb25zdCBTTkVBS0lOR19QQVRURVJOUyA9IFtcbiAgL2hpZGRlbiBmZWUvaSxcbiAgL2F1dG8uP3JlbmV3L2ksXG4gIC9mcmVlIHRyaWFsL2ksXG4gIC9hZGRlZCB0byAoY2FydHxiYXNrZXQpL2ksXG4gIC9wcmUuP3NlbGVjdGVkIGFkZC4/b24vaSxcbl07XG5cbnR5cGUgSGlnaGxpZ2h0Q2FuZGlkYXRlID0gT21pdDxQYWdlSGlnaGxpZ2h0LCBcImlkXCI+O1xuXG5leHBvcnQgdHlwZSBIaWdobGlnaHREZXRlY3Rpb24gPSB7XG4gIGNhdGVnb3J5OiBzdHJpbmc7XG4gIHBhdHRlcm5UeXBlOiBzdHJpbmc7XG4gIHNldmVyaXR5OiBQYWdlSGlnaGxpZ2h0W1wic2V2ZXJpdHlcIl07XG4gIGV2aWRlbmNlOiBzdHJpbmc7XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuICBjb25zdCBzdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpO1xuICBpZiAoc3R5bGUuZGlzcGxheSA9PT0gXCJub25lXCIgfHwgc3R5bGUudmlzaWJpbGl0eSA9PT0gXCJoaWRkZW5cIikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoTnVtYmVyLnBhcnNlRmxvYXQoc3R5bGUub3BhY2l0eSkgPT09IDApIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCByZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgaWYgKHJlY3Qud2lkdGggPCAyIHx8IHJlY3QuaGVpZ2h0IDwgMikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgZWxlbWVudC5jaGVja1Zpc2liaWxpdHkgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIHJldHVybiBlbGVtZW50LmNoZWNrVmlzaWJpbGl0eSh7XG4gICAgICBjaGVja09wYWNpdHk6IHRydWUsXG4gICAgICBjaGVja1Zpc2liaWxpdHlDU1M6IHRydWUsXG4gICAgfSk7XG4gIH1cblxuICBpZiAoc3R5bGUucG9zaXRpb24gPT09IFwiZml4ZWRcIiB8fCBzdHlsZS5wb3NpdGlvbiA9PT0gXCJzdGlja3lcIikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGVsZW1lbnQub2Zmc2V0UGFyZW50ICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBhc3NpZ25IaWdobGlnaHRJZChlbGVtZW50OiBFbGVtZW50KTogc3RyaW5nIHtcbiAgY29uc3QgZXhpc3RpbmcgPSBlbGVtZW50LmdldEF0dHJpYnV0ZShISUdITElHSFRfSURfQVRUUik7XG4gIGlmIChleGlzdGluZykge1xuICAgIHJldHVybiBleGlzdGluZztcbiAgfVxuXG4gIGNvbnN0IGlkID0gY3J5cHRvLnJhbmRvbVVVSUQoKTtcbiAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoSElHSExJR0hUX0lEX0FUVFIsIGlkKTtcbiAgcmV0dXJuIGlkO1xufVxuXG5mdW5jdGlvbiBpc0luc2lkZUFydGljbGVCb2R5KGVsZW1lbnQ6IEVsZW1lbnQpOiBib29sZWFuIHtcbiAgY29uc3QgYXJ0aWNsZSA9IGVsZW1lbnQuY2xvc2VzdChcImFydGljbGVcIik7XG4gIGlmICghYXJ0aWNsZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChlbGVtZW50LmNsb3Nlc3QoJ1tyb2xlPVwiZGlhbG9nXCJdLCBbY2xhc3MqPVwibW9kYWxcIl0sIFtjbGFzcyo9XCJwb3B1cFwiXScpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgdGFnID0gZWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCk7XG4gIHJldHVybiAhW1wiaW5wdXRcIiwgXCJidXR0b25cIiwgXCJzZWxlY3RcIiwgXCJ0ZXh0YXJlYVwiLCBcImZvcm1cIl0uaW5jbHVkZXModGFnKTtcbn1cblxuZnVuY3Rpb24gc2hvdWxkU2tpcEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCwgcGFnZVR5cGU6IFBhZ2VUeXBlKTogYm9vbGVhbiB7XG4gIGlmIChwYWdlVHlwZSA9PT0gXCJlZGl0b3JpYWxcIiAmJiBpc0luc2lkZUFydGljbGVCb2R5KGVsZW1lbnQpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBjb25zdCByb290ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJkcGQtaGlnaGxpZ2h0LXJvb3RcIik7XG4gIGlmIChyb290Py5jb250YWlucyhlbGVtZW50KSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCAmJiAhaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBmaXJzdE1hdGNoaW5nUGF0dGVybih0ZXh0OiBzdHJpbmcsIHBhdHRlcm5zOiBSZWdFeHBbXSk6IFJlZ0V4cCB8IG51bGwge1xuICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgcGF0dGVybnMpIHtcbiAgICBpZiAocGF0dGVybi50ZXN0KHRleHQpKSB7XG4gICAgICByZXR1cm4gcGF0dGVybjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGhpZ2hsaWdodFRhcmdldChlbGVtZW50OiBFbGVtZW50KTogRWxlbWVudCB7XG4gIGNvbnN0IGRpYWxvZyA9IGVsZW1lbnQuY2xvc2VzdCgnW3JvbGU9XCJkaWFsb2dcIl0sIFtjbGFzcyo9XCJtb2RhbFwiXSwgW2NsYXNzKj1cInBvcHVwXCJdJyk7XG4gIGlmIChkaWFsb2cgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgIHJldHVybiBkaWFsb2c7XG4gIH1cblxuICBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxJbnB1dEVsZW1lbnQpIHtcbiAgICByZXR1cm4gZWxlbWVudC5jbG9zZXN0KFwibGFiZWxcIikgPz8gZWxlbWVudDtcbiAgfVxuXG4gIGlmIChlbGVtZW50IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICBjb25zdCB0ZXh0ID0gKGVsZW1lbnQuaW5uZXJUZXh0ID8/IFwiXCIpLnRyaW0oKTtcbiAgICBpZiAodGV4dC5sZW5ndGggPCAxMjApIHtcbiAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGVsZW1lbnQuY2xvc2VzdChcbiAgICAgICAgJ25hdiwgaGVhZGVyLCBmb290ZXIsIFtyb2xlPVwiYmFubmVyXCJdLCBbcm9sZT1cIm5hdmlnYXRpb25cIl0sIGZvcm0sIFtjbGFzcyo9XCJjb3VudGRvd25cIl0sIFtjbGFzcyo9XCJ0aW1lclwiXScsXG4gICAgICApO1xuICAgICAgaWYgKGNvbnRhaW5lciBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG4gICAgICAgIHJldHVybiBjb250YWluZXI7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGVsZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIGlzTmVzdGVkU3RpY2t5RWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuICBsZXQgcGFyZW50ID0gZWxlbWVudC5wYXJlbnRFbGVtZW50O1xuICB3aGlsZSAocGFyZW50KSB7XG4gICAgY29uc3Qgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShwYXJlbnQpO1xuICAgIGlmIChzdHlsZS5wb3NpdGlvbiA9PT0gXCJmaXhlZFwiIHx8IHN0eWxlLnBvc2l0aW9uID09PSBcInN0aWNreVwiKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcGFyZW50ID0gcGFyZW50LnBhcmVudEVsZW1lbnQ7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBhZGRDYW5kaWRhdGUoXG4gIGVsZW1lbnQ6IEVsZW1lbnQsXG4gIGNhbmRpZGF0ZTogSGlnaGxpZ2h0Q2FuZGlkYXRlLFxuICBwYWdlVHlwZTogUGFnZVR5cGUsXG4gIHNlZW46IE1hcDxFbGVtZW50LCBQYWdlSGlnaGxpZ2h0Pixcbik6IHZvaWQge1xuICBjb25zdCB0YXJnZXQgPSBoaWdobGlnaHRUYXJnZXQoZWxlbWVudCk7XG4gIGlmICghKHRhcmdldCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoc2hvdWxkU2tpcEVsZW1lbnQodGFyZ2V0LCBwYWdlVHlwZSkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBleGlzdGluZyA9IHNlZW4uZ2V0KHRhcmdldCk7XG4gIGlmIChleGlzdGluZykge1xuICAgIGlmIChzZXZlcml0eVJhbmsoY2FuZGlkYXRlLnNldmVyaXR5KSA+IHNldmVyaXR5UmFuayhleGlzdGluZy5zZXZlcml0eSkpIHtcbiAgICAgIHNlZW4uc2V0KHRhcmdldCwgeyAuLi5jYW5kaWRhdGUsIGlkOiBleGlzdGluZy5pZCB9KTtcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgc2Vlbi5zZXQodGFyZ2V0LCB7XG4gICAgLi4uY2FuZGlkYXRlLFxuICAgIGlkOiBhc3NpZ25IaWdobGlnaHRJZCh0YXJnZXQpLFxuICB9KTtcbn1cblxuZnVuY3Rpb24gc2V2ZXJpdHlSYW5rKHNldmVyaXR5OiBQYWdlSGlnaGxpZ2h0W1wic2V2ZXJpdHlcIl0pOiBudW1iZXIge1xuICBzd2l0Y2ggKHNldmVyaXR5KSB7XG4gICAgY2FzZSBcIkhJR0hcIjpcbiAgICAgIHJldHVybiAzO1xuICAgIGNhc2UgXCJNRURJVU1cIjpcbiAgICAgIHJldHVybiAyO1xuICAgIGNhc2UgXCJMT1dcIjpcbiAgICAgIHJldHVybiAxO1xuICAgIGRlZmF1bHQ6IHtcbiAgICAgIGNvbnN0IF9leGhhdXN0aXZlOiBuZXZlciA9IHNldmVyaXR5O1xuICAgICAgcmV0dXJuIF9leGhhdXN0aXZlO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBjb2xsZWN0Q291bnRkb3duSGlnaGxpZ2h0cyhcbiAgcGFnZVR5cGU6IFBhZ2VUeXBlLFxuICBzZWVuOiBNYXA8RWxlbWVudCwgUGFnZUhpZ2hsaWdodD4sXG4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoQ09VTlRET1dOX1NFTEVDVE9SUykpIHtcbiAgICBpZiAoIShlbGVtZW50IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSBjb250aW51ZTtcblxuICAgIGFkZENhbmRpZGF0ZShcbiAgICAgIGVsZW1lbnQsXG4gICAgICB7XG4gICAgICAgIGNhdGVnb3J5OiBcIlVSR0VOQ1lcIixcbiAgICAgICAgcGF0dGVyblR5cGU6IFwiQ291bnRkb3duVGltZXJcIixcbiAgICAgICAgc2V2ZXJpdHk6IFwiSElHSFwiLFxuICAgICAgICBsYWJlbDogXCJDb3VudGRvd24gdGltZXJcIixcbiAgICAgIH0sXG4gICAgICBwYWdlVHlwZSxcbiAgICAgIHNlZW4sXG4gICAgKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb2xsZWN0UHJlc2VsZWN0aW9uSGlnaGxpZ2h0cyhcbiAgcGFnZVR5cGU6IFBhZ2VUeXBlLFxuICBzZWVuOiBNYXA8RWxlbWVudCwgUGFnZUhpZ2hsaWdodD4sXG4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBpbnB1dCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxJbnB1dEVsZW1lbnQ+KFxuICAgICdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl06Y2hlY2tlZCwgaW5wdXRbdHlwZT1cInJhZGlvXCJdOmNoZWNrZWQnLFxuICApKSB7XG4gICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgaW5wdXQsXG4gICAgICB7XG4gICAgICAgIGNhdGVnb3J5OiBcIlBSRVNFTEVDVElPTlwiLFxuICAgICAgICBwYXR0ZXJuVHlwZTogXCJQcmVDaGVja2VkQm94XCIsXG4gICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICBsYWJlbDogXCJQcmUtc2VsZWN0ZWQgb3B0aW9uXCIsXG4gICAgICB9LFxuICAgICAgcGFnZVR5cGUsXG4gICAgICBzZWVuLFxuICAgICk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaGFzQ3VycmVuY3lUZXh0KHRleHQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gL1tcXCTCo+KCrF18U1xcJHxcXGRbXFxkLC5dKlxccyooPzp3YXN8bm93fG9mZnxzYXZlKS9pLnRlc3QodGV4dCk7XG59XG5cbmZ1bmN0aW9uIHByaWNpbmdDb250YWluZXJGb3IoZWxlbWVudDogRWxlbWVudCk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgY29udGFpbmVyID0gZWxlbWVudC5jbG9zZXN0KFBSSUNFX0NPTlRBSU5FUl9TRUxFQ1RPUlMpO1xuICBpZiAoY29udGFpbmVyIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICByZXR1cm4gY29udGFpbmVyO1xuICB9XG4gIGlmIChlbGVtZW50LnBhcmVudEVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgIHJldHVybiBlbGVtZW50LnBhcmVudEVsZW1lbnQ7XG4gIH1cbiAgcmV0dXJuIGVsZW1lbnQgYXMgSFRNTEVsZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIGNvbGxlY3RQcmljaW5nSGlnaGxpZ2h0cyhcbiAgcGFnZVR5cGU6IFBhZ2VUeXBlLFxuICBzZWVuOiBNYXA8RWxlbWVudCwgUGFnZUhpZ2hsaWdodD4sXG4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiZGVsLCBzXCIpKSB7XG4gICAgaWYgKCFpc1Zpc2libGVIaWdobGlnaHRFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0ZXh0ID0gZWxlbWVudC50ZXh0Q29udGVudCA/PyBcIlwiO1xuICAgIGlmICghaGFzQ3VycmVuY3lUZXh0KHRleHQpICYmICEvW1xcZCwuXSsvLnRlc3QodGV4dCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGFkZENhbmRpZGF0ZShcbiAgICAgIHByaWNpbmdDb250YWluZXJGb3IoZWxlbWVudCksXG4gICAgICB7XG4gICAgICAgIGNhdGVnb3J5OiBcIlBSSUNJTkdfREVDRVBUSU9OXCIsXG4gICAgICAgIHBhdHRlcm5UeXBlOiBcIlN0cmlrZXRocm91Z2hQcmljZVwiLFxuICAgICAgICBzZXZlcml0eTogXCJNRURJVU1cIixcbiAgICAgICAgbGFiZWw6IFwiUHJpY2luZyBjdWVcIixcbiAgICAgIH0sXG4gICAgICBwYWdlVHlwZSxcbiAgICAgIHNlZW4sXG4gICAgKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICBQUklDRV9DT05UQUlORVJfU0VMRUNUT1JTLFxuICApKSB7XG4gICAgY29uc3QgdGV4dCA9IChlbGVtZW50LmlubmVyVGV4dCA/PyBcIlwiKS50cmltKCk7XG4gICAgaWYgKHRleHQubGVuZ3RoIDwgMyB8fCB0ZXh0Lmxlbmd0aCA+IDIwMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgaHRtbCA9IGVsZW1lbnQub3V0ZXJIVE1MO1xuICAgIGNvbnN0IGNvbWJpbmVkID0gYCR7dGV4dH1cXG4ke2h0bWx9YDtcbiAgICBjb25zdCBoYXNTdHJpa2UgPVxuICAgICAgZWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiZGVsLCBzXCIpICE9PSBudWxsIHx8XG4gICAgICAvbGluZS10aHJvdWdoL2kudGVzdCh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KS50ZXh0RGVjb3JhdGlvbik7XG5cbiAgICBpZiAoXG4gICAgICBmaXJzdE1hdGNoaW5nUGF0dGVybihjb21iaW5lZCwgUFJJQ0lOR19QQVRURVJOUykgfHxcbiAgICAgIChoYXNTdHJpa2UgJiYgaGFzQ3VycmVuY3lUZXh0KHRleHQpKVxuICAgICkge1xuICAgICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB7XG4gICAgICAgICAgY2F0ZWdvcnk6IFwiUFJJQ0lOR19ERUNFUFRJT05cIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogaGFzU3RyaWtlID8gXCJTdHJpa2V0aHJvdWdoUHJpY2VcIiA6IFwiTWlzbGVhZGluZ1ByaWNlXCIsXG4gICAgICAgICAgc2V2ZXJpdHk6IFwiTUVESVVNXCIsXG4gICAgICAgICAgbGFiZWw6IFwiUHJpY2luZyBjdWVcIixcbiAgICAgICAgfSxcbiAgICAgICAgcGFnZVR5cGUsXG4gICAgICAgIHNlZW4sXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIipcIikpIHtcbiAgICBpZiAoIWlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHRleHQgPSAoZWxlbWVudC5pbm5lclRleHQgPz8gXCJcIikudHJpbSgpO1xuICAgIGlmICh0ZXh0Lmxlbmd0aCA+IDgwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBzdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpO1xuICAgIGlmIChzdHlsZS50ZXh0RGVjb3JhdGlvbkxpbmUuaW5jbHVkZXMoXCJsaW5lLXRocm91Z2hcIikgJiYgaGFzQ3VycmVuY3lUZXh0KHRleHQpKSB7XG4gICAgICBhZGRDYW5kaWRhdGUoXG4gICAgICAgIHByaWNpbmdDb250YWluZXJGb3IoZWxlbWVudCksXG4gICAgICAgIHtcbiAgICAgICAgICBjYXRlZ29yeTogXCJQUklDSU5HX0RFQ0VQVElPTlwiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIlN0cmlrZXRocm91Z2hQcmljZVwiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlByaWNpbmcgY3VlXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHBhZ2VUeXBlLFxuICAgICAgICBzZWVuLFxuICAgICAgKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gY29sbGVjdFN0aWNreUhpZ2hsaWdodHMoXG4gIHBhZ2VUeXBlOiBQYWdlVHlwZSxcbiAgc2VlbjogTWFwPEVsZW1lbnQsIFBhZ2VIaWdobGlnaHQ+LFxuKTogdm9pZCB7XG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIipcIikpIHtcbiAgICBjb25zdCBzdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpO1xuICAgIGlmIChzdHlsZS5wb3NpdGlvbiAhPT0gXCJmaXhlZFwiICYmIHN0eWxlLnBvc2l0aW9uICE9PSBcInN0aWNreVwiKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoaXNOZXN0ZWRTdGlja3lFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0ZXh0ID0gZWxlbWVudC5pbm5lclRleHQgPz8gXCJcIjtcbiAgICBpZiAodGV4dC5sZW5ndGggPiA1MDApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbWJpbmVkID0gYCR7dGV4dH1cXG4ke2VsZW1lbnQub3V0ZXJIVE1MfWA7XG4gICAgY29uc3QgdXJnZW5jeSA9IGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKGNvbWJpbmVkLCBVUkdFTkNZX1BBVFRFUk5TKTtcbiAgICBjb25zdCBzY2FyY2l0eSA9IGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKGNvbWJpbmVkLCBTQ0FSQ0lUWV9QQVRURVJOUyk7XG5cbiAgICBpZiAodXJnZW5jeSkge1xuICAgICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB7XG4gICAgICAgICAgY2F0ZWdvcnk6IFwiVVJHRU5DWVwiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiAvY291bnRkb3dufHRpbWVyfGVuZHMgaW4gXFxkKy9pLnRlc3QoY29tYmluZWQpXG4gICAgICAgICAgICA/IFwiQ291bnRkb3duVGltZXJcIlxuICAgICAgICAgICAgOiBcIkxpbWl0ZWRUaW1lTWVzc2FnZVwiLFxuICAgICAgICAgIHNldmVyaXR5OiAvY291bnRkb3dufHRpbWVyfGVuZHMgaW4gXFxkKy9pLnRlc3QoY29tYmluZWQpXG4gICAgICAgICAgICA/IFwiSElHSFwiXG4gICAgICAgICAgICA6IFwiTUVESVVNXCIsXG4gICAgICAgICAgbGFiZWw6IFwiVXJnZW5jeSBiYW5uZXJcIixcbiAgICAgICAgfSxcbiAgICAgICAgcGFnZVR5cGUsXG4gICAgICAgIHNlZW4sXG4gICAgICApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKHNjYXJjaXR5KSB7XG4gICAgICBhZGRDYW5kaWRhdGUoXG4gICAgICAgIGVsZW1lbnQsXG4gICAgICAgIHtcbiAgICAgICAgICBjYXRlZ29yeTogXCJTQ0FSQ0lUWVwiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiAvb25seSBcXGQrIGxlZnR8bG93IHN0b2NrfGFsbW9zdCBzb2xkIG91dC9pLnRlc3QodGV4dClcbiAgICAgICAgICAgID8gXCJMb3dTdG9ja01lc3NhZ2VcIlxuICAgICAgICAgICAgOiBcIkhpZ2hEZW1hbmRNZXNzYWdlXCIsXG4gICAgICAgICAgc2V2ZXJpdHk6IFwiTUVESVVNXCIsXG4gICAgICAgICAgbGFiZWw6IFwiU2NhcmNpdHkgYmFubmVyXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHBhZ2VUeXBlLFxuICAgICAgICBzZWVuLFxuICAgICAgKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIC9jbGFzcz1cIlteXCJdKihtb2RhbHxwb3B1cHxwb3BvdmVyfG92ZXJsYXl8d2lkZ2V0fHN0aWNreS1iYW5uZXIpW15cIl0qXCIvaS50ZXN0KFxuICAgICAgICBlbGVtZW50Lm91dGVySFRNTCxcbiAgICAgICkgfHxcbiAgICAgIGVsZW1lbnQubWF0Y2hlcyhcInN0aWNreS1oZWFkZXIsIFtjbGFzcyo9J3N0aWNreS1oZWFkZXInXVwiKVxuICAgICkge1xuICAgICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB7XG4gICAgICAgICAgY2F0ZWdvcnk6IFwiTkFHR0lOR1wiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIlJlcGVhdGVkUG9wdXBPclN0aWNreUJhbm5lclwiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlN0aWNreSBvdmVybGF5XCIsXG4gICAgICAgIH0sXG4gICAgICAgIHBhZ2VUeXBlLFxuICAgICAgICBzZWVuLFxuICAgICAgKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gY29sbGVjdFRleHRIaWdobGlnaHRzKFxuICBwYWdlVHlwZTogUGFnZVR5cGUsXG4gIHNlZW46IE1hcDxFbGVtZW50LCBQYWdlSGlnaGxpZ2h0Pixcbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXG4gICAgSU5URVJBQ1RJVkVfU0VMRUNUT1JTLFxuICApKSB7XG4gICAgY29uc3QgdGV4dCA9IGVsZW1lbnQuaW5uZXJUZXh0ID8/IFwiXCI7XG4gICAgaWYgKHRleHQubGVuZ3RoIDwgNCB8fCB0ZXh0Lmxlbmd0aCA+IDQwMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgaHRtbCA9IGVsZW1lbnQub3V0ZXJIVE1MO1xuICAgIGNvbnN0IGNvbWJpbmVkID0gYCR7dGV4dH1cXG4ke2h0bWx9YDtcblxuICAgIGNvbnN0IHVyZ2VuY3kgPSBmaXJzdE1hdGNoaW5nUGF0dGVybihjb21iaW5lZCwgVVJHRU5DWV9QQVRURVJOUyk7XG4gICAgaWYgKHVyZ2VuY3kpIHtcbiAgICAgIGFkZENhbmRpZGF0ZShcbiAgICAgICAgZWxlbWVudCxcbiAgICAgICAge1xuICAgICAgICAgIGNhdGVnb3J5OiBcIlVSR0VOQ1lcIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogL2NvdW50ZG93bnx0aW1lcnxlbmRzIGluIFxcZCsvaS50ZXN0KGNvbWJpbmVkKVxuICAgICAgICAgICAgPyBcIkNvdW50ZG93blRpbWVyXCJcbiAgICAgICAgICAgIDogXCJMaW1pdGVkVGltZU1lc3NhZ2VcIixcbiAgICAgICAgICBzZXZlcml0eTogL2NvdW50ZG93bnx0aW1lcnxlbmRzIGluIFxcZCsvaS50ZXN0KGNvbWJpbmVkKVxuICAgICAgICAgICAgPyBcIkhJR0hcIlxuICAgICAgICAgICAgOiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlVyZ2VuY3kgY3VlXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHBhZ2VUeXBlLFxuICAgICAgICBzZWVuLFxuICAgICAgKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHNjYXJjaXR5ID0gZmlyc3RNYXRjaGluZ1BhdHRlcm4odGV4dCwgU0NBUkNJVFlfUEFUVEVSTlMpO1xuICAgIGlmIChzY2FyY2l0eSkge1xuICAgICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB7XG4gICAgICAgICAgY2F0ZWdvcnk6IFwiU0NBUkNJVFlcIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogL29ubHkgXFxkKyBsZWZ0fGxvdyBzdG9ja3xhbG1vc3Qgc29sZCBvdXQvaS50ZXN0KHRleHQpXG4gICAgICAgICAgICA/IFwiTG93U3RvY2tNZXNzYWdlXCJcbiAgICAgICAgICAgIDogXCJIaWdoRGVtYW5kTWVzc2FnZVwiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlNjYXJjaXR5IGN1ZVwiLFxuICAgICAgICB9LFxuICAgICAgICBwYWdlVHlwZSxcbiAgICAgICAgc2VlbixcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBzb2NpYWwgPSBmaXJzdE1hdGNoaW5nUGF0dGVybih0ZXh0LCBTT0NJQUxfUFJPT0ZfUEFUVEVSTlMpO1xuICAgIGlmIChzb2NpYWwpIHtcbiAgICAgIGFkZENhbmRpZGF0ZShcbiAgICAgICAgZWxlbWVudCxcbiAgICAgICAge1xuICAgICAgICAgIGNhdGVnb3J5OiBcIlNPQ0lBTF9QUk9PRlwiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIkFjdGl2aXR5Tm90aWZpY2F0aW9uc1wiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlNvY2lhbCBwcm9vZiBjdWVcIixcbiAgICAgICAgfSxcbiAgICAgICAgcGFnZVR5cGUsXG4gICAgICAgIHNlZW4sXG4gICAgICApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgcmV2aWV3ID0gZmlyc3RNYXRjaGluZ1BhdHRlcm4odGV4dCwgUkVWSUVXX1BBVFRFUk5TKTtcbiAgICBpZiAocmV2aWV3KSB7XG4gICAgICBhZGRDYW5kaWRhdGUoXG4gICAgICAgIGVsZW1lbnQsXG4gICAgICAgIHtcbiAgICAgICAgICBjYXRlZ29yeTogXCJTT0NJQUxfUFJPT0ZcIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogXCJBY3Rpdml0eU5vdGlmaWNhdGlvbnNcIixcbiAgICAgICAgICBzZXZlcml0eTogXCJNRURJVU1cIixcbiAgICAgICAgICBsYWJlbDogXCJSZXZpZXcgb3IgdGVzdGltb25pYWxcIixcbiAgICAgICAgfSxcbiAgICAgICAgcGFnZVR5cGUsXG4gICAgICAgIHNlZW4sXG4gICAgICApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3Qgc2hhbWluZyA9IGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKHRleHQsIENPTkZJUk1TSEFNSU5HX1BBVFRFUk5TKTtcbiAgICBpZiAoc2hhbWluZykge1xuICAgICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB7XG4gICAgICAgICAgY2F0ZWdvcnk6IFwiRk9SQ0VEX0FDVElPTlwiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIkNvbmZpcm1zaGFtaW5nXCIsXG4gICAgICAgICAgc2V2ZXJpdHk6IFwiTUVESVVNXCIsXG4gICAgICAgICAgbGFiZWw6IFwiUHJlc3N1cmUgd29yZGluZ1wiLFxuICAgICAgICB9LFxuICAgICAgICBwYWdlVHlwZSxcbiAgICAgICAgc2VlbixcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmljaW5nID0gZmlyc3RNYXRjaGluZ1BhdHRlcm4oY29tYmluZWQsIFBSSUNJTkdfUEFUVEVSTlMpO1xuICAgIGlmIChwcmljaW5nKSB7XG4gICAgICBhZGRDYW5kaWRhdGUoXG4gICAgICAgIGVsZW1lbnQsXG4gICAgICAgIHtcbiAgICAgICAgICBjYXRlZ29yeTogXCJQUklDSU5HX0RFQ0VQVElPTlwiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIk1pc2xlYWRpbmdQcmljZVwiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlByaWNpbmcgY3VlXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHBhZ2VUeXBlLFxuICAgICAgICBzZWVuLFxuICAgICAgKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IG5hZ2dpbmcgPSBmaXJzdE1hdGNoaW5nUGF0dGVybih0ZXh0LCBOQUdHSU5HX1BBVFRFUk5TKTtcbiAgICBpZiAobmFnZ2luZykge1xuICAgICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB7XG4gICAgICAgICAgY2F0ZWdvcnk6IFwiTkFHR0lOR1wiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIlJlcGVhdGVkUG9wdXBPclN0aWNreUJhbm5lclwiLFxuICAgICAgICAgIHNldmVyaXR5OiBcIk1FRElVTVwiLFxuICAgICAgICAgIGxhYmVsOiBcIlJlcGVhdGVkIHByb21wdFwiLFxuICAgICAgICB9LFxuICAgICAgICBwYWdlVHlwZSxcbiAgICAgICAgc2VlbixcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBlbnJvbGxtZW50ID0gZmlyc3RNYXRjaGluZ1BhdHRlcm4odGV4dCwgRU5ST0xMTUVOVF9QQVRURVJOUyk7XG4gICAgaWYgKGVucm9sbG1lbnQpIHtcbiAgICAgIGFkZENhbmRpZGF0ZShcbiAgICAgICAgZWxlbWVudCxcbiAgICAgICAge1xuICAgICAgICAgIGNhdGVnb3J5OiBcIkZPUkNFRF9BQ1RJT05cIixcbiAgICAgICAgICBwYXR0ZXJuVHlwZTogXCJSZXF1aXJlZEVucm9sbG1lbnRcIixcbiAgICAgICAgICBzZXZlcml0eTogXCJNRURJVU1cIixcbiAgICAgICAgICBsYWJlbDogXCJTaWduLWluIHByb21wdFwiLFxuICAgICAgICB9LFxuICAgICAgICBwYWdlVHlwZSxcbiAgICAgICAgc2VlbixcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBzbmVha2luZyA9IGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKGNvbWJpbmVkLCBTTkVBS0lOR19QQVRURVJOUyk7XG4gICAgaWYgKHNuZWFraW5nKSB7XG4gICAgICBhZGRDYW5kaWRhdGUoXG4gICAgICAgIGVsZW1lbnQsXG4gICAgICAgIHtcbiAgICAgICAgICBjYXRlZ29yeTogXCJTTkVBS0lOR1wiLFxuICAgICAgICAgIHBhdHRlcm5UeXBlOiBcIkhpZGRlbkNvc3RcIixcbiAgICAgICAgICBzZXZlcml0eTogXCJNRURJVU1cIixcbiAgICAgICAgICBsYWJlbDogXCJIaWRkZW4gY29zdCBjdWVcIixcbiAgICAgICAgfSxcbiAgICAgICAgcGFnZVR5cGUsXG4gICAgICAgIHNlZW4sXG4gICAgICApO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBsYWJlbEZvckRldGVjdGlvbihkZXRlY3Rpb246IEhpZ2hsaWdodERldGVjdGlvbik6IHN0cmluZyB7XG4gIHN3aXRjaCAoZGV0ZWN0aW9uLmNhdGVnb3J5KSB7XG4gICAgY2FzZSBcIlVSR0VOQ1lcIjpcbiAgICAgIHJldHVybiAvY291bnRkb3dufHRpbWVyL2kudGVzdChkZXRlY3Rpb24ucGF0dGVyblR5cGUpXG4gICAgICAgID8gXCJDb3VudGRvd24gdGltZXJcIlxuICAgICAgICA6IFwiVXJnZW5jeSBjdWVcIjtcbiAgICBjYXNlIFwiU0NBUkNJVFlcIjpcbiAgICAgIHJldHVybiBcIlNjYXJjaXR5IGN1ZVwiO1xuICAgIGNhc2UgXCJTT0NJQUxfUFJPT0ZcIjpcbiAgICAgIHJldHVybiBcIlNvY2lhbCBwcm9vZiBjdWVcIjtcbiAgICBjYXNlIFwiUFJFU0VMRUNUSU9OXCI6XG4gICAgICByZXR1cm4gXCJQcmUtc2VsZWN0ZWQgb3B0aW9uXCI7XG4gICAgY2FzZSBcIk9CU1RSVUNUSU9OXCI6XG4gICAgICByZXR1cm4gXCJTdGlja3kgb3ZlcmxheVwiO1xuICAgIGNhc2UgXCJGT1JDRURfQUNUSU9OXCI6XG4gICAgICByZXR1cm4gZGV0ZWN0aW9uLnBhdHRlcm5UeXBlID09PSBcIlJlcXVpcmVkRW5yb2xsbWVudFwiXG4gICAgICAgID8gXCJTaWduLWluIHByb21wdFwiXG4gICAgICAgIDogXCJQcmVzc3VyZSB3b3JkaW5nXCI7XG4gICAgY2FzZSBcIlBSSUNJTkdfREVDRVBUSU9OXCI6XG4gICAgICByZXR1cm4gXCJQcmljaW5nIGN1ZVwiO1xuICAgIGNhc2UgXCJOQUdHSU5HXCI6XG4gICAgICByZXR1cm4gXCJSZXBlYXRlZCBwcm9tcHRcIjtcbiAgICBjYXNlIFwiTUlTRElSRUNUSU9OXCI6XG4gICAgICByZXR1cm4gXCJNaXNkaXJlY3Rpb24gY3VlXCI7XG4gICAgY2FzZSBcIlNORUFLSU5HXCI6XG4gICAgICByZXR1cm4gXCJIaWRkZW4gY29zdCBjdWVcIjtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFwiUHJlc3N1cmUgY3VlXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJpY2luZ0V2aWRlbmNlUGhyYXNlcyhldmlkZW5jZTogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBwaHJhc2VzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgY29uc3QgcXVvdGVkID0gZXZpZGVuY2UubWF0Y2goL1tcIuKAnF0oLis/KVtcIuKAnV0vKT8uWzFdO1xuICBpZiAocXVvdGVkICYmIHF1b3RlZC50cmltKCkubGVuZ3RoID49IDMpIHtcbiAgICBwaHJhc2VzLmFkZChxdW90ZWQudHJpbSgpKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgbWF0Y2ggb2YgZXZpZGVuY2UubWF0Y2hBbGwoLyg/OlNcXCR8XFwkfMKjfOKCrClcXHM/W1xcZCwuXSsvZykpIHtcbiAgICBwaHJhc2VzLmFkZChtYXRjaFswXS5yZXBsYWNlKC9cXHMvZywgXCJcIikpO1xuICAgIHBocmFzZXMuYWRkKG1hdGNoWzBdLnRyaW0oKSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IG1hdGNoIG9mIGV2aWRlbmNlLm1hdGNoQWxsKC9bXFxkLC5dK1xccyooPzolIG9mZnwlKS9naSkpIHtcbiAgICBwaHJhc2VzLmFkZChtYXRjaFswXS50cmltKCkpO1xuICB9XG5cbiAgZm9yIChjb25zdCBtYXRjaCBvZiBldmlkZW5jZS5tYXRjaEFsbCgvc2F2ZVxccytcXGQrXFxzKiUvZ2kpKSB7XG4gICAgcGhyYXNlcy5hZGQobWF0Y2hbMF0udHJpbSgpKTtcbiAgfVxuXG4gIHJldHVybiBbLi4ucGhyYXNlc10uZmlsdGVyKChwaHJhc2UpID0+IHBocmFzZS5sZW5ndGggPj0gMyk7XG59XG5cbmZ1bmN0aW9uIGZpbmRFbGVtZW50Q29udGFpbmluZ1BocmFzZShwaHJhc2U6IHN0cmluZyk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGNvbnN0IHBocmFzZUxvd2VyID0gcGhyYXNlLnRvTG93ZXJDYXNlKCk7XG4gIGxldCBiZXN0OiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBsZXQgYmVzdEFyZWEgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG5cbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFxuICAgIFRFWFRfU0VBUkNIX1NFTEVDVE9SUyxcbiAgKSkge1xuICAgIGlmICghaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgdGV4dCA9IChlbGVtZW50LmlubmVyVGV4dCA/PyBcIlwiKS50cmltKCk7XG4gICAgaWYgKHRleHQubGVuZ3RoID09PSAwIHx8IHRleHQubGVuZ3RoID4gNTAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKCF0ZXh0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocGhyYXNlTG93ZXIpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCByZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICBjb25zdCBhcmVhID0gcmVjdC53aWR0aCAqIHJlY3QuaGVpZ2h0O1xuICAgIGlmIChhcmVhID4gMCAmJiBhcmVhIDwgYmVzdEFyZWEpIHtcbiAgICAgIGJlc3QgPSBlbGVtZW50O1xuICAgICAgYmVzdEFyZWEgPSBhcmVhO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBiZXN0O1xufVxuXG5mdW5jdGlvbiBmaW5kU3RydWN0dXJhbFByaWNpbmdFbGVtZW50KCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcImRlbCwgc1wiKSkge1xuICAgIGlmICghaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHRleHQgPSBlbGVtZW50LnRleHRDb250ZW50ID8/IFwiXCI7XG4gICAgaWYgKGhhc0N1cnJlbmN5VGV4dCh0ZXh0KSB8fCAvW1xcZCwuXSsvLnRlc3QodGV4dCkpIHtcbiAgICAgIHJldHVybiBwcmljaW5nQ29udGFpbmVyRm9yKGVsZW1lbnQpO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICBQUklDRV9DT05UQUlORVJfU0VMRUNUT1JTLFxuICApKSB7XG4gICAgaWYgKCFpc1Zpc2libGVIaWdobGlnaHRFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0ZXh0ID0gKGVsZW1lbnQuaW5uZXJUZXh0ID8/IFwiXCIpLnRyaW0oKTtcbiAgICBpZiAodGV4dC5sZW5ndGggPCAzKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBoYXNTdHJpa2UgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoXCJkZWwsIHNcIikgIT09IG51bGw7XG4gICAgaWYgKGhhc1N0cmlrZSB8fCBmaXJzdE1hdGNoaW5nUGF0dGVybihgJHt0ZXh0fVxcbiR7ZWxlbWVudC5vdXRlckhUTUx9YCwgUFJJQ0lOR19QQVRURVJOUykpIHtcbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBmaW5kRWxlbWVudEJ5UHJpY2luZ0V2aWRlbmNlKGV2aWRlbmNlOiBzdHJpbmcpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICBmb3IgKGNvbnN0IHBocmFzZSBvZiBwcmljaW5nRXZpZGVuY2VQaHJhc2VzKGV2aWRlbmNlKSkge1xuICAgIGNvbnN0IGVsZW1lbnQgPSBmaW5kRWxlbWVudENvbnRhaW5pbmdQaHJhc2UocGhyYXNlKTtcbiAgICBpZiAoZWxlbWVudCkge1xuICAgICAgcmV0dXJuIHByaWNpbmdDb250YWluZXJGb3IoZWxlbWVudCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZpbmRTdHJ1Y3R1cmFsUHJpY2luZ0VsZW1lbnQoKTtcbn1cblxuZnVuY3Rpb24gc2NhcmNpdHlFdmlkZW5jZVBocmFzZXMoZXZpZGVuY2U6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3QgcGhyYXNlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIGNvbnN0IHF1b3RlZCA9IGV2aWRlbmNlLm1hdGNoKC9bXCLigJwnXSguKz8pW1wi4oCdJ10vKT8uWzFdO1xuICBpZiAocXVvdGVkPy50cmltKCkpIHtcbiAgICBjb25zdCB0cmltbWVkID0gcXVvdGVkLnRyaW0oKTtcbiAgICBwaHJhc2VzLmFkZCh0cmltbWVkKTtcbiAgICBmb3IgKGNvbnN0IHNlZ21lbnQgb2YgdHJpbW1lZC5zcGxpdChcInxcIikpIHtcbiAgICAgIGNvbnN0IHBhcnQgPSBzZWdtZW50LnRyaW0oKTtcbiAgICAgIGlmIChwYXJ0Lmxlbmd0aCA+PSAzKSB7XG4gICAgICAgIHBocmFzZXMuYWRkKHBhcnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgbWF0Y2ggb2YgZXZpZGVuY2UubWF0Y2hBbGwoXG4gICAgL1xcYihpbiBzdG9ja3xsb3cgc3RvY2t8b25seSBcXGQrIGxlZnR8b25seSBcXGQrIHJlbWFpbmluZ3xhbG1vc3Qgc29sZCBvdXR8c2VsbGluZyBmYXN0fGhpZ2ggZGVtYW5kfGxpbWl0ZWQgcXVhbnRpdHl8ZmV3IGxlZnQpXFxiL2dpLFxuICApKSB7XG4gICAgcGhyYXNlcy5hZGQobWF0Y2hbMF0udHJpbSgpKTtcbiAgfVxuXG4gIHJldHVybiBbLi4ucGhyYXNlc10uZmlsdGVyKChwaHJhc2UpID0+IHBocmFzZS5sZW5ndGggPj0gMyk7XG59XG5cbmZ1bmN0aW9uIGZpbmRTdHJ1Y3R1cmFsU2NhcmNpdHlFbGVtZW50KCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICBcInAsIHNwYW4sIGRpdiwgYnV0dG9uLCBhLCBsYWJlbCwgbGksIHN0cm9uZywgZW0sIHNtYWxsXCIsXG4gICkpIHtcbiAgICBpZiAoIWlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHRleHQgPSAoZWxlbWVudC5pbm5lclRleHQgPz8gXCJcIikudHJpbSgpO1xuICAgIGlmICh0ZXh0Lmxlbmd0aCA8IDMgfHwgdGV4dC5sZW5ndGggPiAyMDApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChmaXJzdE1hdGNoaW5nUGF0dGVybih0ZXh0LCBTQ0FSQ0lUWV9QQVRURVJOUykpIHtcbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBmaW5kRWxlbWVudEJ5U2NhcmNpdHlFdmlkZW5jZShldmlkZW5jZTogc3RyaW5nKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgZm9yIChjb25zdCBwaHJhc2Ugb2Ygc2NhcmNpdHlFdmlkZW5jZVBocmFzZXMoZXZpZGVuY2UpKSB7XG4gICAgY29uc3QgZWxlbWVudCA9IGZpbmRFbGVtZW50Q29udGFpbmluZ1BocmFzZShwaHJhc2UpO1xuICAgIGlmIChlbGVtZW50KSB7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmluZFN0cnVjdHVyYWxTY2FyY2l0eUVsZW1lbnQoKTtcbn1cblxuZnVuY3Rpb24gZXZpZGVuY2VQaHJhc2VzKGV2aWRlbmNlOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHBocmFzZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBmb3IgKGNvbnN0IG1hdGNoIG9mIGV2aWRlbmNlLm1hdGNoQWxsKC9bXCLigJwnXSguKz8pW1wi4oCdJ10vZykpIHtcbiAgICBjb25zdCB0cmltbWVkID0gbWF0Y2hbMV0udHJpbSgpO1xuICAgIGlmICh0cmltbWVkLmxlbmd0aCA+PSAzKSB7XG4gICAgICBwaHJhc2VzLmFkZCh0cmltbWVkKTtcbiAgICAgIGZvciAoY29uc3Qgc2VnbWVudCBvZiB0cmltbWVkLnNwbGl0KFwifFwiKSkge1xuICAgICAgICBjb25zdCBwYXJ0ID0gc2VnbWVudC50cmltKCk7XG4gICAgICAgIGlmIChwYXJ0Lmxlbmd0aCA+PSAzKSB7XG4gICAgICAgICAgcGhyYXNlcy5hZGQocGFydCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IG1hdGNoIG9mIGV2aWRlbmNlLm1hdGNoQWxsKC9gKFteYF0rKWAvZykpIHtcbiAgICBjb25zdCB0cmltbWVkID0gbWF0Y2hbMV0udHJpbSgpO1xuICAgIGlmICh0cmltbWVkLmxlbmd0aCA+PSAzKSB7XG4gICAgICBwaHJhc2VzLmFkZCh0cmltbWVkKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCB2aXNpYmxlVGV4dCA9IGV2aWRlbmNlLm1hdGNoKFxuICAgIC9WaXNpYmxlIHRleHQ6XFxzKltcIuKAnCddPyhbXlwi4oCdJ1xcbi5dKz8pW1wi4oCdJ10/KD86XFwufCR8XFxuKS9pLFxuICApPy5bMV07XG4gIGlmICh2aXNpYmxlVGV4dD8udHJpbSgpKSB7XG4gICAgcGhyYXNlcy5hZGQodmlzaWJsZVRleHQudHJpbSgpKTtcbiAgfVxuXG4gIGNvbnN0IHNuaXBwZXQgPSBldmlkZW5jZS5tYXRjaCgvU25pcHBldDpcXHMqKGBbXmBdK2B8PFtePlxcbl0rPikvaSk/LlsxXTtcbiAgaWYgKHNuaXBwZXQ/LnRyaW0oKSkge1xuICAgIHBocmFzZXMuYWRkKHNuaXBwZXQudHJpbSgpLnJlcGxhY2UoL15gfGAkL2csIFwiXCIpKTtcbiAgfVxuXG4gIGNvbnN0IGZhbGxiYWNrID0gZXZpZGVuY2VTZWFyY2hQaHJhc2UoZXZpZGVuY2UpO1xuICBpZiAoZmFsbGJhY2spIHtcbiAgICBwaHJhc2VzLmFkZChmYWxsYmFjayk7XG4gIH1cblxuICByZXR1cm4gWy4uLnBocmFzZXNdLmZpbHRlcigocGhyYXNlKSA9PiBwaHJhc2UubGVuZ3RoID49IDMpO1xufVxuXG5mdW5jdGlvbiBldmlkZW5jZVNlYXJjaFBocmFzZShldmlkZW5jZTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gIGNvbnN0IHF1b3RlZCA9IGV2aWRlbmNlLm1hdGNoKC9bXCLigJwnXSguKz8pW1wi4oCdJ10vKT8uWzFdO1xuICBpZiAocXVvdGVkICYmIHF1b3RlZC50cmltKCkubGVuZ3RoID49IDQpIHtcbiAgICByZXR1cm4gcXVvdGVkLnRyaW0oKTtcbiAgfVxuXG4gIGNvbnN0IGNsZWFuZWQgPSBldmlkZW5jZS5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gIGlmIChjbGVhbmVkLmxlbmd0aCA8IDQpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBjbGVhbmVkLnNsaWNlKDAsIE1hdGgubWluKDgwLCBjbGVhbmVkLmxlbmd0aCkpO1xufVxuXG5mdW5jdGlvbiBmaW5kRWxlbWVudEJ5RXZpZGVuY2UoZXZpZGVuY2U6IHN0cmluZyk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGZvciAoY29uc3QgcGhyYXNlIG9mIGV2aWRlbmNlUGhyYXNlcyhldmlkZW5jZSkpIHtcbiAgICBjb25zdCBlbGVtZW50ID0gZmluZEVsZW1lbnRDb250YWluaW5nUGhyYXNlKHBocmFzZSk7XG4gICAgaWYgKGVsZW1lbnQpIHtcbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5jb25zdCBQT1BVUF9TRUxFQ1RPUlMgPSBbXG4gICdbcm9sZT1cImRpYWxvZ1wiXScsXG4gICdbY2xhc3MqPVwibW9kYWxcIl0nLFxuICAnW2NsYXNzKj1cIk1vZGFsXCJdJyxcbiAgJ1tjbGFzcyo9XCJwb3B1cFwiXScsXG4gICdbY2xhc3MqPVwiUG9wdXBcIl0nLFxuICAnW2NsYXNzKj1cInBvcG92ZXJcIl0nLFxuICAnW2NsYXNzKj1cIlBvcG92ZXJcIl0nLFxuICAnW2NsYXNzKj1cIm92ZXJsYXlcIl0nLFxuICAnW2NsYXNzKj1cIk92ZXJsYXlcIl0nLFxuICAnW2NsYXNzKj1cIndpZGdldFwiXScsXG4gICdbY2xhc3MqPVwiV2lkZ2V0XCJdJyxcbiAgJ1tjbGFzcyo9XCJuZXdzbGV0dGVyXCJdJyxcbiAgJ1tjbGFzcyo9XCJzdGlja3ktYmFubmVyXCJdJyxcbiAgJ1tjbGFzcyo9XCJhbm5vdW5jZW1lbnRcIl0nLFxuICBcInN0aWNreS1oZWFkZXJcIixcbiAgJ1tjbGFzcyo9XCJzdGlja3ktaGVhZGVyXCJdJyxcbl0uam9pbihcIixcIik7XG5cbmNvbnN0IFNUSUNLWV9QUk9NT19TRUxFQ1RPUlMgPSBbXG4gIFwic3RpY2t5LWhlYWRlclwiLFxuICAnW2NsYXNzKj1cInN0aWNreS1oZWFkZXJcIl0nLFxuICAnW2NsYXNzKj1cImFubm91bmNlbWVudC1iYXJcIl0nLFxuICAnW2NsYXNzKj1cInByb21vLWJhclwiXScsXG4gICdbY2xhc3MqPVwicHJvbW8tdGlja2VyXCJdJyxcbiAgJ1tjbGFzcyo9XCJ0aWNrZXJcIl0nLFxuICBcImhlYWRlcltjbGFzcyo9J3N0aWNreSddXCIsXG4gICdbY2xhc3MqPVwiaGVhZGVyLS1zdGlja3lcIl0nLFxuXS5qb2luKFwiLFwiKTtcblxuY29uc3QgVEVYVF9TRUFSQ0hfU0VMRUNUT1JTID1cbiAgXCJwLCBzcGFuLCBkaXYsIGJ1dHRvbiwgYSwgbGFiZWwsIGxpLCBoMSwgaDIsIGgzLCBoNCwgdGQsIHN0cm9uZywgZW0sIHNtYWxsLCBkZWwsIHMsIHN0aWNreS1oZWFkZXIsIGhlYWRlciwgbmF2LCBzZWN0aW9uLCBbY2xhc3MqPSdiYW5uZXInXSwgW2NsYXNzKj0ndGlja2VyJ10sIFtjbGFzcyo9J3BvcG92ZXInXSwgW2NsYXNzKj0nd2lkZ2V0J11cIjtcblxuY29uc3QgT1ZFUkxBWV9DTEFTU19ISU5UID1cbiAgL21vZGFsfHBvcHVwfHBvcG92ZXJ8b3ZlcmxheXx3aWRnZXR8YmFubmVyfHN0aWNreXxuZXdzbGV0dGVyfGNsb3NlfHRpY2tlcnxhbm5vdW5jZW1lbnQvaTtcblxuZnVuY3Rpb24gZXh0cmFjdENsYXNzRnJhZ21lbnRzRnJvbVNuaXBwZXQoc25pcHBldDogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBmcmFnbWVudHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBmb3IgKGNvbnN0IG1hdGNoIG9mIHNuaXBwZXQubWF0Y2hBbGwoL2NsYXNzPVwiKFteXCJdKylcIi9naSkpIHtcbiAgICBmb3IgKGNvbnN0IHRva2VuIG9mIG1hdGNoWzFdLnNwbGl0KC9cXHMrLykpIHtcbiAgICAgIGNvbnN0IHRyaW1tZWQgPSB0b2tlbi50cmltKCk7XG4gICAgICBpZiAodHJpbW1lZC5sZW5ndGggPCA0KSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgZnJhZ21lbnRzLmFkZCh0cmltbWVkKTtcbiAgICAgIGZvciAoY29uc3QgcGFydCBvZiB0cmltbWVkLnNwbGl0KFwiX19cIikpIHtcbiAgICAgICAgaWYgKHBhcnQubGVuZ3RoID49IDQpIHtcbiAgICAgICAgICBmcmFnbWVudHMuYWRkKHBhcnQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIFsuLi5mcmFnbWVudHNdO1xufVxuXG5mdW5jdGlvbiBmaW5kRWxlbWVudEJ5Q2xhc3NGcmFnbWVudChmcmFnbWVudDogc3RyaW5nKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgY29uc3QgbmVlZGxlID0gZnJhZ21lbnQudG9Mb3dlckNhc2UoKTtcbiAgaWYgKG5lZWRsZS5sZW5ndGggPCA0KSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBsZXQgYmVzdDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgbGV0IGJlc3RBcmVhID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuXG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIltjbGFzc11cIikpIHtcbiAgICBjb25zdCBjbGFzc05hbWUgPSBlbGVtZW50LmNsYXNzTmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmICghY2xhc3NOYW1lLmluY2x1ZGVzKG5lZWRsZSkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoIWlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIGNvbnN0IGFyZWEgPSByZWN0LndpZHRoICogcmVjdC5oZWlnaHQ7XG4gICAgaWYgKGFyZWEgPiAwICYmIGFyZWEgPCBiZXN0QXJlYSkge1xuICAgICAgYmVzdCA9IGVsZW1lbnQ7XG4gICAgICBiZXN0QXJlYSA9IGFyZWE7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJlc3Q7XG59XG5cbmZ1bmN0aW9uIGZpbmRFbGVtZW50RnJvbUh0bWxTbmlwcGV0KHNuaXBwZXQ6IHN0cmluZyk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGZvciAoY29uc3QgZnJhZ21lbnQgb2YgZXh0cmFjdENsYXNzRnJhZ21lbnRzRnJvbVNuaXBwZXQoc25pcHBldCkpIHtcbiAgICBjb25zdCBlbGVtZW50ID0gZmluZEVsZW1lbnRCeUNsYXNzRnJhZ21lbnQoZnJhZ21lbnQpO1xuICAgIGlmIChlbGVtZW50KSB7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9XG4gIH1cblxuICBjb25zdCB0YWdNYXRjaCA9IHNuaXBwZXQubWF0Y2goL148XFxzKihbYS16XVthLXowLTktXSopL2kpO1xuICBpZiAodGFnTWF0Y2gpIHtcbiAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4odGFnTWF0Y2hbMV0pKSB7XG4gICAgICBpZiAoaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgICAgICByZXR1cm4gZWxlbWVudDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNPdmVybGF5TGlrZUVsZW1lbnQoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBib29sZWFuIHtcbiAgY29uc3QgY2xhc3NOYW1lID0gZWxlbWVudC5jbGFzc05hbWUudG9Mb3dlckNhc2UoKTtcbiAgY29uc3QgaHRtbCA9IGVsZW1lbnQub3V0ZXJIVE1MLnRvTG93ZXJDYXNlKCk7XG4gIHJldHVybiAoXG4gICAgT1ZFUkxBWV9DTEFTU19ISU5ULnRlc3QoY2xhc3NOYW1lKSB8fFxuICAgIE9WRVJMQVlfQ0xBU1NfSElOVC50ZXN0KGh0bWwpIHx8XG4gICAgZWxlbWVudC5tYXRjaGVzKFxuICAgICAgXCJzdGlja3ktaGVhZGVyLCBbY2xhc3MqPSdzdGlja3ktaGVhZGVyJ10sIFtyb2xlPSdkaWFsb2cnXSwgW2NsYXNzKj0ncG9wb3ZlciddLCBbY2xhc3MqPSd3aWRnZXQnXVwiLFxuICAgIClcbiAgKTtcbn1cblxuZnVuY3Rpb24gZmluZFN0cnVjdHVyYWxTdGlja3lQcm9tb0VsZW1lbnQoKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFxuICAgIFNUSUNLWV9QUk9NT19TRUxFQ1RPUlMsXG4gICkpIHtcbiAgICBpZiAoaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGZpbmRTdHJ1Y3R1cmFsUG9wdXBFbGVtZW50KCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihQT1BVUF9TRUxFQ1RPUlMpKSB7XG4gICAgaWYgKGlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH1cbiAgfVxuXG4gIGxldCBiZXN0T3ZlcmxheTogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgbGV0IGJlc3RPdmVybGF5QXJlYSA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcblxuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCIqXCIpKSB7XG4gICAgY29uc3Qgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KTtcbiAgICBpZiAoc3R5bGUucG9zaXRpb24gIT09IFwiZml4ZWRcIiAmJiBzdHlsZS5wb3NpdGlvbiAhPT0gXCJzdGlja3lcIikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChpc05lc3RlZFN0aWNreUVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHRleHQgPSAoZWxlbWVudC5pbm5lclRleHQgPz8gXCJcIikudHJpbSgpO1xuICAgIGlmICh0ZXh0Lmxlbmd0aCA+IDUwMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICghaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGlzT3ZlcmxheUxpa2VFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICBjb25zdCByZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIGNvbnN0IGFyZWEgPSByZWN0LndpZHRoICogcmVjdC5oZWlnaHQ7XG4gICAgICBpZiAoYXJlYSA+IDAgJiYgYXJlYSA8IGJlc3RPdmVybGF5QXJlYSkge1xuICAgICAgICBiZXN0T3ZlcmxheSA9IGVsZW1lbnQ7XG4gICAgICAgIGJlc3RPdmVybGF5QXJlYSA9IGFyZWE7XG4gICAgICB9XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoIWJlc3RPdmVybGF5KSB7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYmVzdE92ZXJsYXk7XG59XG5cbmZ1bmN0aW9uIGlzU3RpY2t5T3ZlcmxheURldGVjdGlvbihkZXRlY3Rpb246IEhpZ2hsaWdodERldGVjdGlvbik6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIGRldGVjdGlvbi5jYXRlZ29yeSA9PT0gXCJPQlNUUlVDVElPTlwiIHx8XG4gICAgZGV0ZWN0aW9uLmNhdGVnb3J5ID09PSBcIk5BR0dJTkdcIiB8fFxuICAgIHBhdHRlcm5UeXBlc01hdGNoKGRldGVjdGlvbi5wYXR0ZXJuVHlwZSwgXCJTdGlja3lQcmVzc3VyZUJhbm5lclwiKSB8fFxuICAgIHBhdHRlcm5UeXBlc01hdGNoKGRldGVjdGlvbi5wYXR0ZXJuVHlwZSwgXCJSZXBlYXRlZFBvcHVwT3JTdGlja3lCYW5uZXJcIilcbiAgKTtcbn1cblxuZnVuY3Rpb24gaXNTdGlja3lQcm9tb0RldGVjdGlvbihkZXRlY3Rpb246IEhpZ2hsaWdodERldGVjdGlvbik6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIGRldGVjdGlvbi5jYXRlZ29yeSA9PT0gXCJGT1JDRURfQUNUSU9OXCIgJiZcbiAgICAoL3N0aWNreXx0aWNrZXJ8cHJvbW98YmFubmVyfGhlYWRlci9pLnRlc3QoZGV0ZWN0aW9uLmV2aWRlbmNlKSB8fFxuICAgICAgL3N0aWNreXxwcm9tb3x0aWNrZXJ8YmFubmVyL2kudGVzdChkZXRlY3Rpb24ucGF0dGVyblR5cGUpKVxuICApO1xufVxuXG5mdW5jdGlvbiBmaW5kU3RydWN0dXJhbEVucm9sbG1lbnRFbGVtZW50KCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICBcImEsIGJ1dHRvbiwgbmF2LCBoZWFkZXIsIFtjbGFzcyo9J2FjY291bnQnXSwgW2NsYXNzKj0nc2lnbmluJ10sIFtjbGFzcyo9J2xvZ2luJ11cIixcbiAgKSkge1xuICAgIGlmICghaXNWaXNpYmxlSGlnaGxpZ2h0RWxlbWVudChlbGVtZW50KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgdGV4dCA9IChlbGVtZW50LmlubmVyVGV4dCA/PyBcIlwiKS50cmltKCk7XG4gICAgaWYgKHRleHQubGVuZ3RoIDwgMyB8fCB0ZXh0Lmxlbmd0aCA+IDIwMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKHRleHQsIEVOUk9MTE1FTlRfUEFUVEVSTlMpKSB7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZmluZFN0cnVjdHVyYWxSZXZpZXdFbGVtZW50KCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICAnW2NsYXNzKj1cInJldmlld1wiXSwgW2NsYXNzKj1cInRlc3RpbW9uaWFsXCJdLCBibG9ja3F1b3RlLCBbaXRlbXByb3A9XCJyZXZpZXdcIl0nLFxuICApKSB7XG4gICAgaWYgKGlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCkpIHtcbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICBcInAsIHNwYW4sIGRpdiwgc2VjdGlvbiwgYXJ0aWNsZVwiLFxuICApKSB7XG4gICAgaWYgKCFpc1Zpc2libGVIaWdobGlnaHRFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0ZXh0ID0gKGVsZW1lbnQuaW5uZXJUZXh0ID8/IFwiXCIpLnRyaW0oKTtcbiAgICBpZiAodGV4dC5sZW5ndGggPCAyMCB8fCB0ZXh0Lmxlbmd0aCA+IDYwMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGZpcnN0TWF0Y2hpbmdQYXR0ZXJuKHRleHQsIFJFVklFV19QQVRURVJOUykpIHtcbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBmaW5kU3RydWN0dXJhbFNvY2lhbFByb29mRWxlbWVudCgpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXG4gICAgXCJwLCBzcGFuLCBkaXYsIGJ1dHRvbiwgYSwgbGFiZWwsIGxpLCBzdHJvbmcsIGVtLCBzbWFsbFwiLFxuICApKSB7XG4gICAgaWYgKCFpc1Zpc2libGVIaWdobGlnaHRFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0ZXh0ID0gKGVsZW1lbnQuaW5uZXJUZXh0ID8/IFwiXCIpLnRyaW0oKTtcbiAgICBpZiAodGV4dC5sZW5ndGggPCAzIHx8IHRleHQubGVuZ3RoID4gMjAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoZmlyc3RNYXRjaGluZ1BhdHRlcm4odGV4dCwgU09DSUFMX1BST09GX1BBVFRFUk5TKSkge1xuICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGZpbmRFbGVtZW50Rm9yRGV0ZWN0aW9uKFxuICBkZXRlY3Rpb246IEhpZ2hsaWdodERldGVjdGlvbixcbik6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGNvbnN0IHNuaXBwZXRNYXRjaCA9XG4gICAgZGV0ZWN0aW9uLmV2aWRlbmNlLm1hdGNoKC9TbmlwcGV0OlxccypgKFteYF0rKWAvaSkgPz9cbiAgICBkZXRlY3Rpb24uZXZpZGVuY2UubWF0Y2goL1NuaXBwZXQ6XFxzKig8W14+XFxuXSs+KS9pKTtcbiAgaWYgKHNuaXBwZXRNYXRjaCkge1xuICAgIGNvbnN0IGZyb21TbmlwcGV0ID0gZmluZEVsZW1lbnRGcm9tSHRtbFNuaXBwZXQoc25pcHBldE1hdGNoWzFdKTtcbiAgICBpZiAoZnJvbVNuaXBwZXQpIHtcbiAgICAgIHJldHVybiBmcm9tU25pcHBldDtcbiAgICB9XG4gIH1cblxuICBpZiAoZGV0ZWN0aW9uLmNhdGVnb3J5ID09PSBcIlBSSUNJTkdfREVDRVBUSU9OXCIpIHtcbiAgICByZXR1cm4gKFxuICAgICAgZmluZEVsZW1lbnRCeVByaWNpbmdFdmlkZW5jZShkZXRlY3Rpb24uZXZpZGVuY2UpID8/XG4gICAgICBmaW5kU3RydWN0dXJhbFByaWNpbmdFbGVtZW50KClcbiAgICApO1xuICB9XG5cbiAgaWYgKGRldGVjdGlvbi5jYXRlZ29yeSA9PT0gXCJTQ0FSQ0lUWVwiKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGZpbmRFbGVtZW50QnlTY2FyY2l0eUV2aWRlbmNlKGRldGVjdGlvbi5ldmlkZW5jZSkgPz9cbiAgICAgIGZpbmRTdHJ1Y3R1cmFsU2NhcmNpdHlFbGVtZW50KClcbiAgICApO1xuICB9XG5cbiAgaWYgKGlzU3RpY2t5T3ZlcmxheURldGVjdGlvbihkZXRlY3Rpb24pKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGZpbmRFbGVtZW50QnlFdmlkZW5jZShkZXRlY3Rpb24uZXZpZGVuY2UpID8/XG4gICAgICBmaW5kU3RydWN0dXJhbFBvcHVwRWxlbWVudCgpXG4gICAgKTtcbiAgfVxuXG4gIGlmIChpc1N0aWNreVByb21vRGV0ZWN0aW9uKGRldGVjdGlvbikpIHtcbiAgICByZXR1cm4gKFxuICAgICAgZmluZEVsZW1lbnRCeUV2aWRlbmNlKGRldGVjdGlvbi5ldmlkZW5jZSkgPz9cbiAgICAgIGZpbmRTdHJ1Y3R1cmFsU3RpY2t5UHJvbW9FbGVtZW50KClcbiAgICApO1xuICB9XG5cbiAgY29uc3QgYnlFdmlkZW5jZSA9IGZpbmRFbGVtZW50QnlFdmlkZW5jZShkZXRlY3Rpb24uZXZpZGVuY2UpO1xuICBpZiAoYnlFdmlkZW5jZSkge1xuICAgIHJldHVybiBieUV2aWRlbmNlO1xuICB9XG5cbiAgaWYgKFxuICAgIGRldGVjdGlvbi5jYXRlZ29yeSA9PT0gXCJOQUdHSU5HXCIgfHxcbiAgICBwYXR0ZXJuVHlwZXNNYXRjaChkZXRlY3Rpb24ucGF0dGVyblR5cGUsIFwiUmVwZWF0ZWRQb3B1cE9yU3RpY2t5QmFubmVyXCIpXG4gICkge1xuICAgIHJldHVybiBmaW5kU3RydWN0dXJhbFBvcHVwRWxlbWVudCgpO1xuICB9XG5cbiAgaWYgKFxuICAgIGRldGVjdGlvbi5jYXRlZ29yeSA9PT0gXCJGT1JDRURfQUNUSU9OXCIgJiZcbiAgICBwYXR0ZXJuVHlwZXNNYXRjaChkZXRlY3Rpb24ucGF0dGVyblR5cGUsIFwiUmVxdWlyZWRFbnJvbGxtZW50XCIpXG4gICkge1xuICAgIHJldHVybiBmaW5kU3RydWN0dXJhbEVucm9sbG1lbnRFbGVtZW50KCk7XG4gIH1cblxuICBpZiAoZGV0ZWN0aW9uLmNhdGVnb3J5ID09PSBcIlNPQ0lBTF9QUk9PRlwiKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGZpbmRFbGVtZW50QnlFdmlkZW5jZShkZXRlY3Rpb24uZXZpZGVuY2UpID8/XG4gICAgICBmaW5kU3RydWN0dXJhbFJldmlld0VsZW1lbnQoKSA/P1xuICAgICAgZmluZFN0cnVjdHVyYWxTb2NpYWxQcm9vZkVsZW1lbnQoKVxuICAgICk7XG4gIH1cblxuICBpZiAoZGV0ZWN0aW9uLmNhdGVnb3J5ID09PSBcIlVSR0VOQ1lcIikge1xuICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICAgIElOVEVSQUNUSVZFX1NFTEVDVE9SUyxcbiAgICApKSB7XG4gICAgICBjb25zdCB0ZXh0ID0gZWxlbWVudC5pbm5lclRleHQgPz8gXCJcIjtcbiAgICAgIGlmICh0ZXh0Lmxlbmd0aCA8IDQgfHwgdGV4dC5sZW5ndGggPiA0MDApIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAoZmlyc3RNYXRjaGluZ1BhdHRlcm4oYCR7dGV4dH1cXG4ke2VsZW1lbnQub3V0ZXJIVE1MfWAsIFVSR0VOQ1lfUEFUVEVSTlMpKSB7XG4gICAgICAgIHJldHVybiBlbGVtZW50O1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmaW5kRWxlbWVudEJ5RXZpZGVuY2UoZGV0ZWN0aW9uLmV2aWRlbmNlKTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBmaW5hbGl6ZUhpZ2hsaWdodHMoc2VlbjogTWFwPEVsZW1lbnQsIFBhZ2VIaWdobGlnaHQ+KTogUGFnZUhpZ2hsaWdodFtdIHtcbiAgY29uc3QgdmlzaWJsZSA9IEFycmF5LmZyb20oc2Vlbi52YWx1ZXMoKSlcbiAgICAuZmlsdGVyKChoaWdobGlnaHQpID0+IHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFxuICAgICAgICBgWyR7SElHSExJR0hUX0lEX0FUVFJ9PVwiJHtoaWdobGlnaHQuaWR9XCJdYCxcbiAgICAgICk7XG4gICAgICByZXR1cm4gZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50ICYmIGlzVmlzaWJsZUhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCk7XG4gICAgfSlcbiAgICAuc29ydCgoYSwgYikgPT4gc2V2ZXJpdHlSYW5rKGIuc2V2ZXJpdHkpIC0gc2V2ZXJpdHlSYW5rKGEuc2V2ZXJpdHkpKTtcblxuICBjb25zdCBjb3VudGRvd25zID0gdmlzaWJsZS5maWx0ZXIoXG4gICAgKGhpZ2hsaWdodCkgPT4gaGlnaGxpZ2h0LnBhdHRlcm5UeXBlID09PSBcIkNvdW50ZG93blRpbWVyXCIsXG4gICk7XG4gIGNvbnN0IHJlc3QgPSB2aXNpYmxlLmZpbHRlcihcbiAgICAoaGlnaGxpZ2h0KSA9PiBoaWdobGlnaHQucGF0dGVyblR5cGUgIT09IFwiQ291bnRkb3duVGltZXJcIixcbiAgKTtcblxuICByZXR1cm4gWy4uLmNvdW50ZG93bnMsIC4uLnJlc3RdLnNsaWNlKDAsIE1BWF9ISUdITElHSFRTKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVucmljaEhpZ2hsaWdodHNGcm9tRGV0ZWN0aW9ucyhcbiAgZXhpc3Rpbmc6IFBhZ2VIaWdobGlnaHRbXSxcbiAgZGV0ZWN0aW9uczogSGlnaGxpZ2h0RGV0ZWN0aW9uW10sXG4gIHBhZ2VUeXBlOiBQYWdlVHlwZSxcbik6IFBhZ2VIaWdobGlnaHRbXSB7XG4gIGNvbnN0IHNlZW4gPSBuZXcgTWFwPEVsZW1lbnQsIFBhZ2VIaWdobGlnaHQ+KCk7XG5cbiAgZm9yIChjb25zdCBoaWdobGlnaHQgb2YgZXhpc3RpbmcpIHtcbiAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgIGBbJHtISUdITElHSFRfSURfQVRUUn09XCIke2hpZ2hsaWdodC5pZH1cIl1gLFxuICAgICk7XG4gICAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgICAgc2Vlbi5zZXQoZWxlbWVudCwgaGlnaGxpZ2h0KTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBwcmljaW5nRGV0ZWN0aW9ucyA9IGRldGVjdGlvbnMuZmlsdGVyKFxuICAgIChkZXRlY3Rpb24pID0+IGRldGVjdGlvbi5jYXRlZ29yeSA9PT0gXCJQUklDSU5HX0RFQ0VQVElPTlwiLFxuICApO1xuICBjb25zdCBvdGhlckRldGVjdGlvbnMgPSBkZXRlY3Rpb25zLmZpbHRlcihcbiAgICAoZGV0ZWN0aW9uKSA9PiBkZXRlY3Rpb24uY2F0ZWdvcnkgIT09IFwiUFJJQ0lOR19ERUNFUFRJT05cIixcbiAgKTtcblxuICBmb3IgKGNvbnN0IGRldGVjdGlvbiBvZiBbLi4ucHJpY2luZ0RldGVjdGlvbnMsIC4uLm90aGVyRGV0ZWN0aW9uc10pIHtcbiAgICBjb25zdCBlbGVtZW50ID0gZmluZEVsZW1lbnRGb3JEZXRlY3Rpb24oZGV0ZWN0aW9uKTtcbiAgICBpZiAoIWVsZW1lbnQpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHRhcmdldCA9IGhpZ2hsaWdodFRhcmdldChlbGVtZW50KTtcbiAgICBpZiAoISh0YXJnZXQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGV4aXN0aW5nRm9yVGFyZ2V0ID0gc2Vlbi5nZXQodGFyZ2V0KTtcbiAgICBpZiAoZXhpc3RpbmdGb3JUYXJnZXQpIHtcbiAgICAgIHNlZW4uc2V0KHRhcmdldCwge1xuICAgICAgICAuLi5leGlzdGluZ0ZvclRhcmdldCxcbiAgICAgICAgcGF0dGVyblR5cGU6IGRldGVjdGlvbi5wYXR0ZXJuVHlwZSxcbiAgICAgICAgZXZpZGVuY2U6IGRldGVjdGlvbi5ldmlkZW5jZSB8fCBleGlzdGluZ0ZvclRhcmdldC5ldmlkZW5jZSxcbiAgICAgICAgc2V2ZXJpdHk6XG4gICAgICAgICAgc2V2ZXJpdHlSYW5rKGRldGVjdGlvbi5zZXZlcml0eSkgPlxuICAgICAgICAgIHNldmVyaXR5UmFuayhleGlzdGluZ0ZvclRhcmdldC5zZXZlcml0eSlcbiAgICAgICAgICAgID8gZGV0ZWN0aW9uLnNldmVyaXR5XG4gICAgICAgICAgICA6IGV4aXN0aW5nRm9yVGFyZ2V0LnNldmVyaXR5LFxuICAgICAgICBsYWJlbDogbGFiZWxGb3JEZXRlY3Rpb24oZGV0ZWN0aW9uKSxcbiAgICAgIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgYWRkQ2FuZGlkYXRlKFxuICAgICAgZWxlbWVudCxcbiAgICAgIHtcbiAgICAgICAgY2F0ZWdvcnk6IGRldGVjdGlvbi5jYXRlZ29yeSBhcyBEZXRlY3Rpb25DYXRlZ29yeSxcbiAgICAgICAgcGF0dGVyblR5cGU6IGRldGVjdGlvbi5wYXR0ZXJuVHlwZSxcbiAgICAgICAgc2V2ZXJpdHk6IGRldGVjdGlvbi5zZXZlcml0eSxcbiAgICAgICAgbGFiZWw6IGxhYmVsRm9yRGV0ZWN0aW9uKGRldGVjdGlvbiksXG4gICAgICAgIGV2aWRlbmNlOiBkZXRlY3Rpb24uZXZpZGVuY2UsXG4gICAgICB9LFxuICAgICAgcGFnZVR5cGUsXG4gICAgICBzZWVuLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gZmluYWxpemVIaWdobGlnaHRzKHNlZW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29sbGVjdFBhZ2VIaWdobGlnaHRzKHBhZ2VUeXBlOiBQYWdlVHlwZSk6IFBhZ2VIaWdobGlnaHRbXSB7XG4gIGNvbnN0IHNlZW4gPSBuZXcgTWFwPEVsZW1lbnQsIFBhZ2VIaWdobGlnaHQ+KCk7XG5cbiAgY29sbGVjdENvdW50ZG93bkhpZ2hsaWdodHMocGFnZVR5cGUsIHNlZW4pO1xuICBjb2xsZWN0UHJlc2VsZWN0aW9uSGlnaGxpZ2h0cyhwYWdlVHlwZSwgc2Vlbik7XG4gIGNvbGxlY3RQcmljaW5nSGlnaGxpZ2h0cyhwYWdlVHlwZSwgc2Vlbik7XG4gIGNvbGxlY3RUZXh0SGlnaGxpZ2h0cyhwYWdlVHlwZSwgc2Vlbik7XG4gIGNvbGxlY3RTdGlja3lIaWdobGlnaHRzKHBhZ2VUeXBlLCBzZWVuKTtcblxuICByZXR1cm4gZmluYWxpemVIaWdobGlnaHRzKHNlZW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xlYXJIaWdobGlnaHRNYXJrZXJzKCk6IHZvaWQge1xuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChgWyR7SElHSExJR0hUX0lEX0FUVFJ9XWApKSB7XG4gICAgZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoSElHSExJR0hUX0lEX0FUVFIpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGVhckhpZ2hsaWdodEJveGVzKCk6IHZvaWQge1xuICBmb3IgKGNvbnN0IGJveCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKGBbJHtISUdITElHSFRfQk9YX0FUVFJ9XWApKSB7XG4gICAgYm94LnJlbW92ZSgpO1xuICB9XG59XG4iLCJpbXBvcnQgeyBkZXRlY3RQYWdlVHlwZSB9IGZyb20gXCJAZGFya3BhdHRlcm5zL3NoYXJlZC9wYWdlLWNvbnRleHRcIjtcbmltcG9ydCB0eXBlIHsgUGFnZUhpZ2hsaWdodCwgUGFnZVR5cGUgfSBmcm9tIFwiQGRhcmtwYXR0ZXJucy9zaGFyZWQvdHlwZXNcIjtcbmltcG9ydCB7IGNvbGxlY3RQYWdlSGlnaGxpZ2h0cyB9IGZyb20gXCIuL2hpZ2hsaWdodHNcIjtcblxuY29uc3QgSU5URVJBQ1RJVkVfU0VMRUNUT1JTID0gW1xuICBcImlucHV0XCIsXG4gIFwiYnV0dG9uXCIsXG4gIFwiYVwiLFxuICAnW3JvbGU9XCJkaWFsb2dcIl0nLFxuICAnW2NsYXNzKj1cIm1vZGFsXCJdJyxcbiAgJ1tjbGFzcyo9XCJwb3B1cFwiXScsXG4gICdbY2xhc3MqPVwib3ZlcmxheVwiXScsXG4gICdbY2xhc3MqPVwiY291bnRkb3duXCJdJyxcbiAgJ1tjbGFzcyo9XCJ0aW1lclwiXScsXG4gICdbY2xhc3MqPVwic3RpY2t5XCJdJyxcbiAgJ1tzdHlsZSo9XCJwb3NpdGlvbjogZml4ZWRcIl0nLFxuICAnW3N0eWxlKj1cInBvc2l0aW9uOmZpeGVkXCJdJyxcbl0uam9pbihcIixcIik7XG5cbmNvbnN0IE1BWF9URVhUX0xFTkdUSCA9IDEyXzAwMDtcbmNvbnN0IE1BWF9IVE1MX0xFTkdUSCA9IDEyXzAwMDtcblxuZXhwb3J0IHR5cGUgRXh0cmFjdGVkUGFnZSA9IHtcbiAgdXJsOiBzdHJpbmc7XG4gIHBhZ2VUaXRsZTogc3RyaW5nO1xuICB2aXNpYmxlVGV4dDogc3RyaW5nO1xuICBpbnRlcmFjdGl2ZUh0bWw6IHN0cmluZztcbiAgcGFnZVR5cGU6IFBhZ2VUeXBlO1xuICBoaWdobGlnaHRzOiBQYWdlSGlnaGxpZ2h0W107XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdFBhZ2VDb250ZW50KCk6IEV4dHJhY3RlZFBhZ2Uge1xuICBjb25zdCBwYWdlVHlwZSA9IGRldGVjdFBhZ2VUeXBlKGRvY3VtZW50KTtcbiAgY29uc3QgdmlzaWJsZVRleHQgPSAoZG9jdW1lbnQuYm9keT8uaW5uZXJUZXh0ID8/IFwiXCIpLnNsaWNlKFxuICAgIDAsXG4gICAgTUFYX1RFWFRfTEVOR1RILFxuICApO1xuICBjb25zdCBpbnRlcmFjdGl2ZUh0bWwgPSBidWlsZEludGVyYWN0aXZlSHRtbCgpO1xuICBjb25zdCBoaWdobGlnaHRzID0gY29sbGVjdFBhZ2VIaWdobGlnaHRzKHBhZ2VUeXBlKTtcbiAgcmV0dXJuIHtcbiAgICB1cmw6IHdpbmRvdy5sb2NhdGlvbi5ocmVmLFxuICAgIHBhZ2VUaXRsZTogZG9jdW1lbnQudGl0bGUuc2xpY2UoMCwgNTAwKSxcbiAgICB2aXNpYmxlVGV4dCxcbiAgICBpbnRlcmFjdGl2ZUh0bWwsXG4gICAgcGFnZVR5cGUsXG4gICAgaGlnaGxpZ2h0cyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRJbnRlcmFjdGl2ZUh0bWwoKTogc3RyaW5nIHtcbiAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG5cbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoSU5URVJBQ1RJVkVfU0VMRUNUT1JTKSkge1xuICAgIGlmIChwYXJ0cy5qb2luKFwiXFxuXCIpLmxlbmd0aCA+PSBNQVhfSFRNTF9MRU5HVEgpIGJyZWFrO1xuICAgIGNvbnN0IGh0bWwgPSBlbGVtZW50Lm91dGVySFRNTC5zbGljZSgwLCA1MDApO1xuICAgIHBhcnRzLnB1c2goaHRtbCk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCIqXCIpKSB7XG4gICAgaWYgKHBhcnRzLmpvaW4oXCJcXG5cIikubGVuZ3RoID49IE1BWF9IVE1MX0xFTkdUSCkgYnJlYWs7XG4gICAgY29uc3Qgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KTtcbiAgICBpZiAoc3R5bGUucG9zaXRpb24gPT09IFwiZml4ZWRcIiB8fCBzdHlsZS5wb3NpdGlvbiA9PT0gXCJzdGlja3lcIikge1xuICAgICAgcGFydHMucHVzaChcbiAgICAgICAgYDxkaXYgZGF0YS1kcGQtb3ZlcmxheT1cIiR7c3R5bGUucG9zaXRpb259XCI+JHtlbGVtZW50Lm91dGVySFRNTC5zbGljZSgwLCAzMDApfTwvZGl2PmAsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYXJ0cy5qb2luKFwiXFxuXCIpLnNsaWNlKDAsIE1BWF9IVE1MX0xFTkdUSCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBob29rU3BhTmF2aWdhdGlvbihvbk5hdmlnYXRlOiAoKSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XG4gIGNvbnN0IG9yaWdpbmFsUHVzaFN0YXRlID0gaGlzdG9yeS5wdXNoU3RhdGUuYmluZChoaXN0b3J5KTtcbiAgY29uc3Qgb3JpZ2luYWxSZXBsYWNlU3RhdGUgPSBoaXN0b3J5LnJlcGxhY2VTdGF0ZS5iaW5kKGhpc3RvcnkpO1xuXG4gIGhpc3RvcnkucHVzaFN0YXRlID0gKC4uLmFyZ3MpID0+IHtcbiAgICBvcmlnaW5hbFB1c2hTdGF0ZSguLi5hcmdzKTtcbiAgICBvbk5hdmlnYXRlKCk7XG4gIH07XG5cbiAgaGlzdG9yeS5yZXBsYWNlU3RhdGUgPSAoLi4uYXJncykgPT4ge1xuICAgIG9yaWdpbmFsUmVwbGFjZVN0YXRlKC4uLmFyZ3MpO1xuICAgIG9uTmF2aWdhdGUoKTtcbiAgfTtcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInBvcHN0YXRlXCIsIG9uTmF2aWdhdGUpO1xuXG4gIHJldHVybiAoKSA9PiB7XG4gICAgaGlzdG9yeS5wdXNoU3RhdGUgPSBvcmlnaW5hbFB1c2hTdGF0ZTtcbiAgICBoaXN0b3J5LnJlcGxhY2VTdGF0ZSA9IG9yaWdpbmFsUmVwbGFjZVN0YXRlO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwicG9wc3RhdGVcIiwgb25OYXZpZ2F0ZSk7XG4gIH07XG59XG4iLCJjb25zdCBMT0FEX1RJTUVPVVRfTVMgPSAxNV8wMDA7XG5jb25zdCBTRVRUTEVfTVMgPSAyXzAwMDtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdhaXRGb3JQYWdlUmVhZHkoXG4gIHNldHRsZU1zID0gU0VUVExFX01TLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IHdhaXRGb3JEb2N1bWVudExvYWQoTE9BRF9USU1FT1VUX01TKTtcblxuICBpZiAoc2V0dGxlTXMgPiAwKSB7XG4gICAgYXdhaXQgZGVsYXkoc2V0dGxlTXMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRlbGF5KG1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgd2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgbXMpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gd2FpdEZvckRvY3VtZW50TG9hZCh0aW1lb3V0TXM6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gXCJjb21wbGV0ZVwiKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgY29uc3QgZmluaXNoID0gKCkgPT4ge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgIHJlc29sdmUoKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdGltZW91dCA9IHdpbmRvdy5zZXRUaW1lb3V0KGZpbmlzaCwgdGltZW91dE1zKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRcIiwgZmluaXNoLCB7IG9uY2U6IHRydWUgfSk7XG4gIH0pO1xufVxuIiwiaW1wb3J0IHR5cGUgeyBQYWdlSGlnaGxpZ2h0IH0gZnJvbSBcIkBkYXJrcGF0dGVybnMvc2hhcmVkL3R5cGVzXCI7XG5pbXBvcnQge1xuICBjbGVhckhpZ2hsaWdodEJveGVzLFxuICBISUdITElHSFRfQk9YX0FUVFIsXG4gIEhJR0hMSUdIVF9JRF9BVFRSLFxuICBpc1Zpc2libGVIaWdobGlnaHRFbGVtZW50LFxufSBmcm9tIFwiLi4vZXh0cmFjdC9oaWdobGlnaHRzXCI7XG5cbmNvbnN0IFNFVkVSSVRZX0NPTE9SUzogUmVjb3JkPFxuICBQYWdlSGlnaGxpZ2h0W1wic2V2ZXJpdHlcIl0sXG4gIHsgYm9yZGVyOiBzdHJpbmc7IGJhY2tncm91bmQ6IHN0cmluZyB9XG4+ID0ge1xuICBISUdIOiB7IGJvcmRlcjogXCIjREMyNjI2XCIsIGJhY2tncm91bmQ6IFwicmdiYSgyMjAsIDM4LCAzOCwgMC4xNClcIiB9LFxuICBNRURJVU06IHsgYm9yZGVyOiBcIiNEOTc3MDZcIiwgYmFja2dyb3VuZDogXCJyZ2JhKDIxNywgMTE5LCA2LCAwLjE0KVwiIH0sXG4gIExPVzogeyBib3JkZXI6IFwiIzI1NjNFQlwiLCBiYWNrZ3JvdW5kOiBcInJnYmEoMzcsIDk5LCAyMzUsIDAuMTIpXCIgfSxcbn07XG5cbmV4cG9ydCBjbGFzcyBIaWdobGlnaHRPdmVybGF5IHtcbiAgcHJpdmF0ZSBoaWdobGlnaHRzOiBQYWdlSGlnaGxpZ2h0W10gPSBbXTtcbiAgcHJpdmF0ZSB2aXNpYmxlID0gZmFsc2U7XG4gIHByaXZhdGUgYm91bmRVcGRhdGU6ICgoKSA9PiB2b2lkKSB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGFjdGl2ZUhpZ2hsaWdodElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSByYWZJZDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgc2hvdyhoaWdobGlnaHRzOiBQYWdlSGlnaGxpZ2h0W10pOiB2b2lkIHtcbiAgICB0aGlzLmhpZ2hsaWdodHMgPSBoaWdobGlnaHRzO1xuICAgIHRoaXMudmlzaWJsZSA9IGhpZ2hsaWdodHMubGVuZ3RoID4gMDtcbiAgICB0aGlzLmVuc3VyZUJpbmRpbmdzKCk7XG4gICAgdGhpcy5yZW5kZXIoKTtcbiAgfVxuXG4gIGhpZGUoKTogdm9pZCB7XG4gICAgdGhpcy52aXNpYmxlID0gZmFsc2U7XG4gICAgdGhpcy5hY3RpdmVIaWdobGlnaHRJZCA9IG51bGw7XG4gICAgY2xlYXJIaWdobGlnaHRCb3hlcygpO1xuICAgIGlmICh0aGlzLnJhZklkICE9PSBudWxsKSB7XG4gICAgICBjYW5jZWxBbmltYXRpb25GcmFtZSh0aGlzLnJhZklkKTtcbiAgICAgIHRoaXMucmFmSWQgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHNjcm9sbFRvSGlnaGxpZ2h0KGhpZ2hsaWdodElkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgIGBbJHtISUdITElHSFRfSURfQVRUUn09XCIke2hpZ2hsaWdodElkfVwiXWAsXG4gICAgKTtcbiAgICBpZiAoIShlbGVtZW50IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5hY3RpdmVIaWdobGlnaHRJZCA9IGhpZ2hsaWdodElkO1xuICAgIGVsZW1lbnQuc2Nyb2xsSW50b1ZpZXcoeyBiZWhhdmlvcjogXCJzbW9vdGhcIiwgYmxvY2s6IFwiY2VudGVyXCIgfSk7XG4gICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5yZW5kZXIoKTtcbiAgICB9LCAzNTApO1xuICB9XG5cbiAgcHJpdmF0ZSBlbnN1cmVCaW5kaW5ncygpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5ib3VuZFVwZGF0ZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYm91bmRVcGRhdGUgPSAoKSA9PiB7XG4gICAgICBpZiAoIXRoaXMudmlzaWJsZSB8fCB0aGlzLnJhZklkICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdGhpcy5yYWZJZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XG4gICAgICAgIHRoaXMucmFmSWQgPSBudWxsO1xuICAgICAgICB0aGlzLnJlbmRlcigpO1xuICAgICAgfSk7XG4gICAgfTtcblxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgdGhpcy5ib3VuZFVwZGF0ZSwge1xuICAgICAgY2FwdHVyZTogdHJ1ZSxcbiAgICAgIHBhc3NpdmU6IHRydWUsXG4gICAgfSk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgdGhpcy5ib3VuZFVwZGF0ZSwgeyBwYXNzaXZlOiB0cnVlIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXIoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnZpc2libGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjbGVhckhpZ2hsaWdodEJveGVzKCk7XG5cbiAgICBmb3IgKGNvbnN0IGhpZ2hsaWdodCBvZiB0aGlzLmhpZ2hsaWdodHMpIHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFxuICAgICAgICBgWyR7SElHSExJR0hUX0lEX0FUVFJ9PVwiJHtoaWdobGlnaHQuaWR9XCJdYCxcbiAgICAgICk7XG4gICAgICBpZiAoIShlbGVtZW50IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKCFpc1Zpc2libGVIaWdobGlnaHRFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIGlmIChyZWN0LndpZHRoIDw9IDAgfHwgcmVjdC5oZWlnaHQgPD0gMCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29sb3JzID0gU0VWRVJJVFlfQ09MT1JTW2hpZ2hsaWdodC5zZXZlcml0eV07XG4gICAgICBjb25zdCBpc0FjdGl2ZSA9IGhpZ2hsaWdodC5pZCA9PT0gdGhpcy5hY3RpdmVIaWdobGlnaHRJZDtcbiAgICAgIGNvbnN0IGJvcmRlcldpZHRoID0gaXNBY3RpdmUgPyAzIDogMjtcbiAgICAgIGNvbnN0IGluc2V0ID0gYm9yZGVyV2lkdGggKyAxO1xuXG4gICAgICBjb25zdCBib3ggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgYm94LnNldEF0dHJpYnV0ZShISUdITElHSFRfQk9YX0FUVFIsIGhpZ2hsaWdodC5pZCk7XG4gICAgICBib3guc3R5bGUuY3NzVGV4dCA9IFtcbiAgICAgICAgXCJwb3NpdGlvbjpmaXhlZFwiLFxuICAgICAgICBcInBvaW50ZXItZXZlbnRzOm5vbmVcIixcbiAgICAgICAgXCJib3gtc2l6aW5nOmJvcmRlci1ib3hcIixcbiAgICAgICAgXCJib3JkZXItcmFkaXVzOjZweFwiLFxuICAgICAgICBgei1pbmRleDoyMTQ3NDgzNjQ2YCxcbiAgICAgICAgYGxlZnQ6JHtyZWN0LmxlZnQgLSBpbnNldH1weGAsXG4gICAgICAgIGB0b3A6JHtyZWN0LnRvcCAtIGluc2V0fXB4YCxcbiAgICAgICAgYHdpZHRoOiR7cmVjdC53aWR0aCArIGluc2V0ICogMn1weGAsXG4gICAgICAgIGBoZWlnaHQ6JHtyZWN0LmhlaWdodCArIGluc2V0ICogMn1weGAsXG4gICAgICAgIGBib3JkZXI6JHtib3JkZXJXaWR0aH1weCBzb2xpZCAke2NvbG9ycy5ib3JkZXJ9YCxcbiAgICAgICAgYGJhY2tncm91bmQ6JHtjb2xvcnMuYmFja2dyb3VuZH1gLFxuICAgICAgXS5qb2luKFwiO1wiKTtcblxuICAgICAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgbGFiZWwudGV4dENvbnRlbnQgPSBoaWdobGlnaHQubGFiZWw7XG4gICAgICBsYWJlbC5zdHlsZS5jc3NUZXh0ID0gW1xuICAgICAgICBcInBvc2l0aW9uOmFic29sdXRlXCIsXG4gICAgICAgIFwidG9wOi0yNHB4XCIsXG4gICAgICAgIFwibGVmdDowXCIsXG4gICAgICAgIGBiYWNrZ3JvdW5kOiR7Y29sb3JzLmJvcmRlcn1gLFxuICAgICAgICBcImNvbG9yOiNmZmZcIixcbiAgICAgICAgXCJmb250OjYwMCAxMXB4LzEuMiBzeXN0ZW0tdWksc2Fucy1zZXJpZlwiLFxuICAgICAgICBcInBhZGRpbmc6NHB4IDhweFwiLFxuICAgICAgICBcImJvcmRlci1yYWRpdXM6NHB4XCIsXG4gICAgICAgIFwid2hpdGUtc3BhY2U6bm93cmFwXCIsXG4gICAgICAgIFwibWF4LXdpZHRoOjI0MHB4XCIsXG4gICAgICAgIFwib3ZlcmZsb3c6aGlkZGVuXCIsXG4gICAgICAgIFwidGV4dC1vdmVyZmxvdzplbGxpcHNpc1wiLFxuICAgICAgXS5qb2luKFwiO1wiKTtcblxuICAgICAgYm94LmFwcGVuZENoaWxkKGxhYmVsKTtcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYm94KTtcbiAgICB9XG4gIH1cbn1cbiIsIi8qKiBCcm93c2VyLWludGVybmFsIHBhZ2VzIHRoYXQgYXJlIG5ldmVyIHNjYW5uZWQuICovXG5leHBvcnQgY29uc3QgRVhDTFVERURfVVJMX1BSRUZJWEVTID0gW1xuICBcImNocm9tZTovL1wiLFxuICBcImNocm9tZS11bnRydXN0ZWQ6Ly9cIixcbiAgXCJjaHJvbWUtZXh0ZW5zaW9uOi8vXCIsXG4gIFwiYWJvdXQ6XCIsXG4gIFwiZWRnZTovL1wiLFxuICBcImJyYXZlOi8vXCIsXG5dIGFzIGNvbnN0O1xuXG4vKiogUG9wdWxhciBzaXRlcyBza2lwcGVkIGJ5IGF1dG8tc2NhbiAoZW1haWwsIGNoYXQsIHNvY2lhbCwgc3RyZWFtaW5nLCBldGMuKS4gKi9cbmV4cG9ydCBjb25zdCBFWENMVURFRF9IT1NUUyA9IFtcbiAgLy8gR29vZ2xlXG4gIFwiZ29vZ2xlLmNvbVwiLFxuICBcImdtYWlsLmNvbVwiLFxuICBcInlvdXR1YmUuY29tXCIsXG4gIC8vIE1ldGFcbiAgXCJmYWNlYm9vay5jb21cIixcbiAgXCJpbnN0YWdyYW0uY29tXCIsXG4gIFwibWV0YS5jb21cIixcbiAgXCJtZXNzZW5nZXIuY29tXCIsXG4gIFwidGhyZWFkcy5uZXRcIixcbiAgXCJ3aGF0c2FwcC5jb21cIixcbiAgLy8gTWljcm9zb2Z0XG4gIFwibWljcm9zb2Z0LmNvbVwiLFxuICBcIm91dGxvb2suY29tXCIsXG4gIFwibGl2ZS5jb21cIixcbiAgXCJob3RtYWlsLmNvbVwiLFxuICBcIm9mZmljZS5jb21cIixcbiAgXCJvZmZpY2UzNjUuY29tXCIsXG4gIC8vIEFwcGxlXG4gIFwiYXBwbGUuY29tXCIsXG4gIFwiaWNsb3VkLmNvbVwiLFxuICAvLyBTb2NpYWwgJiBtZXNzYWdpbmdcbiAgXCJ0d2l0dGVyLmNvbVwiLFxuICBcInguY29tXCIsXG4gIFwibGlua2VkaW4uY29tXCIsXG4gIFwidGlrdG9rLmNvbVwiLFxuICBcInJlZGRpdC5jb21cIixcbiAgXCJwaW50ZXJlc3QuY29tXCIsXG4gIFwic25hcGNoYXQuY29tXCIsXG4gIFwiZGlzY29yZC5jb21cIixcbiAgXCJzbGFjay5jb21cIixcbiAgXCJ0ZWxlZ3JhbS5vcmdcIixcbiAgXCJ0Lm1lXCIsXG4gIFwiem9vbS51c1wiLFxuICBcInpvb20uY29tXCIsXG4gIC8vIEVtYWlsXG4gIFwieWFob28uY29tXCIsXG4gIFwicHJvdG9uLm1lXCIsXG4gIFwicHJvdG9ubWFpbC5jb21cIixcbiAgLy8gU3RyZWFtaW5nICYgY29tbWVyY2VcbiAgXCJuZXRmbGl4LmNvbVwiLFxuICBcInNwb3RpZnkuY29tXCIsXG4gIFwiYW1hem9uLmNvbVwiLFxuICBcImJpbmcuY29tXCIsXG5dIGFzIGNvbnN0O1xuXG5leHBvcnQgZnVuY3Rpb24gaXNFeGNsdWRlZFVybCh1cmw6IHN0cmluZyB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuICBpZiAoIXVybCkgcmV0dXJuIHRydWU7XG5cbiAgY29uc3QgbG93ZXIgPSB1cmwudG9Mb3dlckNhc2UoKTtcbiAgZm9yIChjb25zdCBwcmVmaXggb2YgRVhDTFVERURfVVJMX1BSRUZJWEVTKSB7XG4gICAgaWYgKGxvd2VyLnN0YXJ0c1dpdGgocHJlZml4KSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgdHJ5IHtcbiAgICByZXR1cm4gaXNFeGNsdWRlZEhvc3QobmV3IFVSTCh1cmwpLmhvc3RuYW1lKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRXhjbHVkZWRIb3N0KGhvc3RuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgaG9zdCA9IGhvc3RuYW1lLnRvTG93ZXJDYXNlKCk7XG4gIGZvciAoY29uc3QgZXhjbHVkZWQgb2YgRVhDTFVERURfSE9TVFMpIHtcbiAgICBpZiAoaG9zdCA9PT0gZXhjbHVkZWQgfHwgaG9zdC5lbmRzV2l0aChgLiR7ZXhjbHVkZWR9YCkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG4iLCJpbXBvcnQgdHlwZSB7IEV4dGVuc2lvbkFuYWx5emVSZXNwb25zZSB9IGZyb20gXCJAZGFya3BhdHRlcm5zL3NoYXJlZC90eXBlc1wiO1xuaW1wb3J0IHsgaXNFeGNsdWRlZFVybCB9IGZyb20gXCIuL2V4Y2x1ZGVkLWhvc3RzXCI7XG5cbmV4cG9ydCB0eXBlIEV4dGVuc2lvblNldHRpbmdzID0ge1xuICB0ZXJtc0FjY2VwdGVkQXQ6IHN0cmluZyB8IG51bGw7XG4gIGF1dG9TY2FuRW5hYmxlZDogYm9vbGVhbjtcbiAgYXBpQmFzZVVybDogc3RyaW5nO1xuICBhcGlLZXk6IHN0cmluZztcbn07XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1M6IEV4dGVuc2lvblNldHRpbmdzID0ge1xuICB0ZXJtc0FjY2VwdGVkQXQ6IG51bGwsXG4gIGF1dG9TY2FuRW5hYmxlZDogdHJ1ZSxcbiAgYXBpQmFzZVVybDogXCJodHRwOi8vbG9jYWxob3N0OjMwMDBcIixcbiAgYXBpS2V5OiBcIlwiLFxufTtcblxudHlwZSBVcmxSZXBvcnRDYWNoZSA9IHtcbiAgbm9ybWFsaXplZFVybDogc3RyaW5nO1xuICByZXBvcnQ6IEV4dGVuc2lvbkFuYWx5emVSZXNwb25zZVtcInNjYW5cIl07XG4gIGNhY2hlZEF0OiBudW1iZXI7XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplVXJsRm9yQ2FjaGUodXJsOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBwYXJzZWQgPSBuZXcgVVJMKHVybCk7XG4gIHBhcnNlZC5oYXNoID0gXCJcIjtcbiAgcGFyc2VkLmhvc3RuYW1lID0gcGFyc2VkLmhvc3RuYW1lLnRvTG93ZXJDYXNlKCk7XG4gIHJldHVybiBwYXJzZWQudG9TdHJpbmcoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVybHNNYXRjaEZvckNhY2hlKGE6IHN0cmluZywgYjogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIG5vcm1hbGl6ZVVybEZvckNhY2hlKGEpID09PSBub3JtYWxpemVVcmxGb3JDYWNoZShiKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGEgPT09IGI7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFNldHRpbmdzKCk6IFByb21pc2U8RXh0ZW5zaW9uU2V0dGluZ3M+IHtcbiAgY29uc3Qgc3RvcmVkID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KE9iamVjdC5rZXlzKERFRkFVTFRfU0VUVElOR1MpKTtcbiAgcmV0dXJuIHsgLi4uREVGQVVMVF9TRVRUSU5HUywgLi4uc3RvcmVkIH0gYXMgRXh0ZW5zaW9uU2V0dGluZ3M7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzYXZlU2V0dGluZ3MoXG4gIHBhcnRpYWw6IFBhcnRpYWw8RXh0ZW5zaW9uU2V0dGluZ3M+LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldChwYXJ0aWFsKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFRhYlJlcG9ydChcbiAgdGFiSWQ6IG51bWJlcixcbik6IFByb21pc2U8aW1wb3J0KFwiLi9tZXNzYWdlc1wiKS5UYWJSZXBvcnRTdGF0ZSB8IG51bGw+IHtcbiAgY29uc3Qga2V5ID0gYHRhYlJlcG9ydDoke3RhYklkfWA7XG4gIGNvbnN0IHN0b3JlZCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLnNlc3Npb24uZ2V0KGtleSk7XG4gIHJldHVybiAoXG4gICAgKHN0b3JlZFtrZXldIGFzIGltcG9ydChcIi4vbWVzc2FnZXNcIikuVGFiUmVwb3J0U3RhdGUgfCB1bmRlZmluZWQpID8/IG51bGxcbiAgKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldFRhYlJlcG9ydChcbiAgdGFiSWQ6IG51bWJlcixcbiAgc3RhdGU6IGltcG9ydChcIi4vbWVzc2FnZXNcIikuVGFiUmVwb3J0U3RhdGUsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qga2V5ID0gYHRhYlJlcG9ydDoke3RhYklkfWA7XG4gIGF3YWl0IGNocm9tZS5zdG9yYWdlLnNlc3Npb24uc2V0KHsgW2tleV06IHN0YXRlIH0pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0VXJsUmVwb3J0Q2FjaGUoXG4gIHVybDogc3RyaW5nLFxuKTogUHJvbWlzZTxFeHRlbnNpb25BbmFseXplUmVzcG9uc2VbXCJzY2FuXCJdIHwgbnVsbD4ge1xuICBjb25zdCBub3JtYWxpemVkVXJsID0gbm9ybWFsaXplVXJsRm9yQ2FjaGUodXJsKTtcbiAgY29uc3Qga2V5ID0gYHVybFJlcG9ydDoke25vcm1hbGl6ZWRVcmx9YDtcbiAgY29uc3Qgc3RvcmVkID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KGtleSk7XG4gIGNvbnN0IGNhY2hlID0gc3RvcmVkW2tleV0gYXMgVXJsUmVwb3J0Q2FjaGUgfCB1bmRlZmluZWQ7XG4gIHJldHVybiBjYWNoZT8ucmVwb3J0ID8/IG51bGw7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXRVcmxSZXBvcnRDYWNoZShcbiAgdXJsOiBzdHJpbmcsXG4gIHJlcG9ydDogRXh0ZW5zaW9uQW5hbHl6ZVJlc3BvbnNlW1wic2NhblwiXSxcbik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBub3JtYWxpemVkVXJsID0gbm9ybWFsaXplVXJsRm9yQ2FjaGUodXJsKTtcbiAgY29uc3Qga2V5ID0gYHVybFJlcG9ydDoke25vcm1hbGl6ZWRVcmx9YDtcbiAgYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHtcbiAgICBba2V5XToge1xuICAgICAgbm9ybWFsaXplZFVybCxcbiAgICAgIHJlcG9ydCxcbiAgICAgIGNhY2hlZEF0OiBEYXRlLm5vdygpLFxuICAgIH0gc2F0aXNmaWVzIFVybFJlcG9ydENhY2hlLFxuICB9KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNsZWFyVXJsUmVwb3J0Q2FjaGUodXJsOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgbm9ybWFsaXplZFVybCA9IG5vcm1hbGl6ZVVybEZvckNhY2hlKHVybCk7XG4gIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnJlbW92ZShgdXJsUmVwb3J0OiR7bm9ybWFsaXplZFVybH1gKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQW5hbHl6YWJsZVVybCh1cmw6IHN0cmluZyB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuICBpZiAoIXVybCkgcmV0dXJuIGZhbHNlO1xuICBpZiAoIXVybC5zdGFydHNXaXRoKFwiaHR0cDovL1wiKSAmJiAhdXJsLnN0YXJ0c1dpdGgoXCJodHRwczovL1wiKSkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gIWlzRXhjbHVkZWRVcmwodXJsKTtcbn1cbiIsIi8vLyA8cmVmZXJlbmNlIHR5cGVzPVwid3h0L2NsaWVudC10eXBlc1wiIC8+XG5cbmltcG9ydCB7IGRldGVjdFBhZ2VUeXBlIH0gZnJvbSBcIkBkYXJrcGF0dGVybnMvc2hhcmVkL3BhZ2UtY29udGV4dFwiO1xuaW1wb3J0IHtcbiAgY2xlYXJIaWdobGlnaHRNYXJrZXJzLFxuICBlbnJpY2hIaWdobGlnaHRzRnJvbURldGVjdGlvbnMsXG4gIHR5cGUgSGlnaGxpZ2h0RGV0ZWN0aW9uLFxufSBmcm9tIFwiLi4vZXh0cmFjdC9oaWdobGlnaHRzXCI7XG5pbXBvcnQgeyBleHRyYWN0UGFnZUNvbnRlbnQsIGhvb2tTcGFOYXZpZ2F0aW9uIH0gZnJvbSBcIi4uL2V4dHJhY3QvcGFnZVwiO1xuaW1wb3J0IHsgd2FpdEZvclBhZ2VSZWFkeSB9IGZyb20gXCIuLi9leHRyYWN0L3dhaXQtZm9yLXBhZ2VcIjtcbmltcG9ydCB7IEhpZ2hsaWdodE92ZXJsYXkgfSBmcm9tIFwiLi4vaGlnaGxpZ2h0L292ZXJsYXlcIjtcbmltcG9ydCB0eXBlIHsgUGFnZUhpZ2hsaWdodCB9IGZyb20gXCJAZGFya3BhdHRlcm5zL3NoYXJlZC90eXBlc1wiO1xuaW1wb3J0IHsgaXNBbmFseXphYmxlVXJsIH0gZnJvbSBcIi4uL2xpYi9zdG9yYWdlXCI7XG5cbmNvbnN0IERFQk9VTkNFX01TID0gMjAwMDtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFtcImh0dHA6Ly8qLypcIiwgXCJodHRwczovLyovKlwiXSxcbiAgcnVuQXQ6IFwiZG9jdW1lbnRfaWRsZVwiLFxuICBtYWluKCkge1xuICAgIGlmICghaXNBbmFseXphYmxlVXJsKHdpbmRvdy5sb2NhdGlvbi5ocmVmKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG92ZXJsYXkgPSBuZXcgSGlnaGxpZ2h0T3ZlcmxheSgpO1xuICAgIGxldCBkZWJvdW5jZVRpbWVyOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IG51bGwgPSBudWxsO1xuXG4gICAgY29uc3QgYW5hbHl6ZSA9IChmb3JjZSA9IGZhbHNlKSA9PiB7XG4gICAgICBpZiAoZGVib3VuY2VUaW1lcikge1xuICAgICAgICBjbGVhclRpbWVvdXQoZGVib3VuY2VUaW1lcik7XG4gICAgICB9XG5cbiAgICAgIGRlYm91bmNlVGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgZGVib3VuY2VUaW1lciA9IG51bGw7XG5cbiAgICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWZvcmNlKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gKGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcIlNIT1VMRF9BTkFMWVpFXCIsXG4gICAgICAgICAgICAgICAgdXJsOiB3aW5kb3cubG9jYXRpb24uaHJlZixcbiAgICAgICAgICAgICAgfSkpIGFzIHsgc2hvdWxkQW5hbHl6ZT86IGJvb2xlYW4gfSB8IHVuZGVmaW5lZDtcblxuICAgICAgICAgICAgICBpZiAoIXJlc3BvbnNlPy5zaG91bGRBbmFseXplKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG92ZXJsYXkuaGlkZSgpO1xuICAgICAgICAgICAgY2xlYXJIaWdobGlnaHRNYXJrZXJzKCk7XG5cbiAgICAgICAgICAgIGF3YWl0IHdhaXRGb3JQYWdlUmVhZHkoKTtcblxuICAgICAgICAgICAgY29uc3QgcGFnZSA9IGV4dHJhY3RQYWdlQ29udGVudCgpO1xuICAgICAgICAgICAgdm9pZCBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICAgIHR5cGU6IFwiUEFHRV9DT05URU5UXCIsXG4gICAgICAgICAgICAgIC4uLnBhZ2UsXG4gICAgICAgICAgICAgIGZvcmNlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSkoKTtcbiAgICAgICAgfSxcbiAgICAgICAgZm9yY2UgPyAwIDogREVCT1VOQ0VfTVMsXG4gICAgICApO1xuICAgIH07XG5cbiAgICBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1lc3NhZ2UsIF9zZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgICAgaWYgKG1lc3NhZ2U/LnR5cGUgPT09IFwiQU5BTFlaRV9QQUdFXCIpIHtcbiAgICAgICAgYW5hbHl6ZShCb29sZWFuKG1lc3NhZ2UuZm9yY2UpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAobWVzc2FnZT8udHlwZSA9PT0gXCJTRVRfUEFHRV9ISUdITElHSFRTXCIpIHtcbiAgICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHBhZ2VUeXBlID0gZGV0ZWN0UGFnZVR5cGUoZG9jdW1lbnQpO1xuICAgICAgICAgIGNvbnN0IGVucmljaGVkID0gZW5yaWNoSGlnaGxpZ2h0c0Zyb21EZXRlY3Rpb25zKFxuICAgICAgICAgICAgKG1lc3NhZ2UuaGlnaGxpZ2h0cyBhcyBQYWdlSGlnaGxpZ2h0W10pID8/IFtdLFxuICAgICAgICAgICAgKG1lc3NhZ2UuZGV0ZWN0aW9ucyBhcyBIaWdobGlnaHREZXRlY3Rpb25bXSB8IHVuZGVmaW5lZCkgPz8gW10sXG4gICAgICAgICAgICBwYWdlVHlwZSxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgaWYgKG1lc3NhZ2UudmlzaWJsZSkge1xuICAgICAgICAgICAgb3ZlcmxheS5zaG93KGVucmljaGVkKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3ZlcmxheS5oaWRlKCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgdHlwZTogXCJISUdITElHSFRTX1VQREFURURcIixcbiAgICAgICAgICAgIGhpZ2hsaWdodHM6IGVucmljaGVkLFxuICAgICAgICAgICAgcmVwb3J0SWQ6IG1lc3NhZ2UucmVwb3J0SWQgYXMgc3RyaW5nIHwgdW5kZWZpbmVkLFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgc2VuZFJlc3BvbnNlKHsgaGlnaGxpZ2h0czogZW5yaWNoZWQgfSk7XG4gICAgICAgIH0pKCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAobWVzc2FnZT8udHlwZSA9PT0gXCJDTEVBUl9QQUdFX0hJR0hMSUdIVFNcIikge1xuICAgICAgICBvdmVybGF5LmhpZGUoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAobWVzc2FnZT8udHlwZSA9PT0gXCJTQ1JPTExfVE9fSElHSExJR0hUXCIpIHtcbiAgICAgICAgb3ZlcmxheS5zY3JvbGxUb0hpZ2hsaWdodChtZXNzYWdlLmhpZ2hsaWdodElkIGFzIHN0cmluZyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBob29rU3BhTmF2aWdhdGlvbigoKSA9PiB7XG4gICAgICBvdmVybGF5LmhpZGUoKTtcbiAgICAgIGNsZWFySGlnaGxpZ2h0TWFya2VycygpO1xuICAgICAgYW5hbHl6ZShmYWxzZSk7XG4gICAgfSk7XG4gIH0sXG59KTtcbiIsIi8vI3JlZ2lvbiBzcmMvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLnRzXG5mdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcblx0aWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuXHRpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIG1ldGhvZChgW3d4dF0gJHthcmdzLnNoaWZ0KCl9YCwgLi4uYXJncyk7XG5cdGVsc2UgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG59XG4vKiogV3JhcHBlciBhcm91bmQgYGNvbnNvbGVgIHdpdGggYSBcIlt3eHRdXCIgcHJlZml4ICovXG5jb25zdCBsb2dnZXIgPSB7XG5cdGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG5cdGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcblx0d2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG5cdGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGxvZ2dlciB9O1xuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBicm93c2VyJDEgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuLy8jcmVnaW9uIHNyYy9icm93c2VyLnRzXG4vKipcbiogQ29udGFpbnMgdGhlIGBicm93c2VyYCBleHBvcnQgd2hpY2ggeW91IHNob3VsZCB1c2UgdG8gYWNjZXNzIHRoZSBleHRlbnNpb25cbiogQVBJcyBpbiB5b3VyIHByb2plY3Q6XG4qXG4qIGBgYHRzXG4qIGltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG4qXG4qIGJyb3dzZXIucnVudGltZS5vbkluc3RhbGxlZC5hZGRMaXN0ZW5lcigoKSA9PiB7XG4qICAgLy8gLi4uXG4qIH0pO1xuKiBgYGBcbipcbiogQG1vZHVsZSB3eHQvYnJvd3NlclxuKi9cbmNvbnN0IGJyb3dzZXIgPSBicm93c2VyJDE7XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGJyb3dzZXIgfTtcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbi8vI3JlZ2lvbiBzcmMvdXRpbHMvaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy50c1xudmFyIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgPSBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuXHRzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcblx0Y29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcblx0XHRzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcblx0XHR0aGlzLm5ld1VybCA9IG5ld1VybDtcblx0XHR0aGlzLm9sZFVybCA9IG9sZFVybDtcblx0fVxufTtcbi8qKlxuKiBSZXR1cm5zIGFuIGV2ZW50IG5hbWUgdW5pcXVlIHRvIHRoZSBleHRlbnNpb24gYW5kIGNvbnRlbnQgc2NyaXB0IHRoYXQnc1xuKiBydW5uaW5nLlxuKi9cbmZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcblx0cmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LCBnZXRVbmlxdWVFdmVudE5hbWUgfTtcbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuLy8jcmVnaW9uIHNyYy91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLnRzXG5jb25zdCBzdXBwb3J0c05hdmlnYXRpb25BcGkgPSB0eXBlb2YgZ2xvYmFsVGhpcy5uYXZpZ2F0aW9uPy5hZGRFdmVudExpc3RlbmVyID09PSBcImZ1bmN0aW9uXCI7XG4vKipcbiogQ3JlYXRlIGEgdXRpbCB0aGF0IHdhdGNoZXMgZm9yIFVSTCBjaGFuZ2VzLCBkaXNwYXRjaGluZyB0aGUgY3VzdG9tIGV2ZW50IHdoZW5cbiogZGV0ZWN0ZWQuIFN0b3BzIHdhdGNoaW5nIHdoZW4gY29udGVudCBzY3JpcHQgaXMgaW52YWxpZGF0ZWQuIFVzZXMgTmF2aWdhdGlvblxuKiBBUEkgd2hlbiBhdmFpbGFibGUsIG90aGVyd2lzZSBmYWxscyBiYWNrIHRvIHBvbGxpbmcuXG4qL1xuZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuXHRsZXQgbGFzdFVybDtcblx0bGV0IHdhdGNoaW5nID0gZmFsc2U7XG5cdHJldHVybiB7IHJ1bigpIHtcblx0XHRpZiAod2F0Y2hpbmcpIHJldHVybjtcblx0XHR3YXRjaGluZyA9IHRydWU7XG5cdFx0bGFzdFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG5cdFx0aWYgKHN1cHBvcnRzTmF2aWdhdGlvbkFwaSkgZ2xvYmFsVGhpcy5uYXZpZ2F0aW9uLmFkZEV2ZW50TGlzdGVuZXIoXCJuYXZpZ2F0ZVwiLCAoZXZlbnQpID0+IHtcblx0XHRcdGNvbnN0IG5ld1VybCA9IG5ldyBVUkwoZXZlbnQuZGVzdGluYXRpb24udXJsKTtcblx0XHRcdGlmIChuZXdVcmwuaHJlZiA9PT0gbGFzdFVybC5ocmVmKSByZXR1cm47XG5cdFx0XHR3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIGxhc3RVcmwpKTtcblx0XHRcdGxhc3RVcmwgPSBuZXdVcmw7XG5cdFx0fSwgeyBzaWduYWw6IGN0eC5zaWduYWwgfSk7XG5cdFx0ZWxzZSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0Y29uc3QgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcblx0XHRcdGlmIChuZXdVcmwuaHJlZiAhPT0gbGFzdFVybC5ocmVmKSB7XG5cdFx0XHRcdHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgbGFzdFVybCkpO1xuXHRcdFx0XHRsYXN0VXJsID0gbmV3VXJsO1xuXHRcdFx0fVxuXHRcdH0sIDFlMyk7XG5cdH0gfTtcbn1cbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH07XG4iLCJpbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQgeyBnZXRVbmlxdWVFdmVudE5hbWUgfSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbi8vI3JlZ2lvbiBzcmMvdXRpbHMvY29udGVudC1zY3JpcHQtY29udGV4dC50c1xuLyoqXG4qIEltcGxlbWVudHNcbiogW2BBYm9ydENvbnRyb2xsZXJgXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvQWJvcnRDb250cm9sbGVyKS5cbiogVXNlZCB0byBkZXRlY3QgYW5kIHN0b3AgY29udGVudCBzY3JpcHQgY29kZSB3aGVuIHRoZSBzY3JpcHQgaXMgaW52YWxpZGF0ZWQuXG4qXG4qIEl0IGFsc28gcHJvdmlkZXMgc2V2ZXJhbCB1dGlsaXRpZXMgbGlrZSBgY3R4LnNldFRpbWVvdXRgIGFuZFxuKiBgY3R4LnNldEludGVydmFsYCB0aGF0IHNob3VsZCBiZSB1c2VkIGluIGNvbnRlbnQgc2NyaXB0cyBpbnN0ZWFkIG9mXG4qIGB3aW5kb3cuc2V0VGltZW91dGAgb3IgYHdpbmRvdy5zZXRJbnRlcnZhbGAuXG4qXG4qIFRvIGNyZWF0ZSBjb250ZXh0IGZvciB0ZXN0aW5nLCB5b3UgY2FuIHVzZSB0aGUgY2xhc3MncyBjb25zdHJ1Y3RvcjpcbipcbiogYGBgdHNcbiogaW1wb3J0IHsgQ29udGVudFNjcmlwdENvbnRleHQgfSBmcm9tICd3eHQvdXRpbHMvY29udGVudC1zY3JpcHRzLWNvbnRleHQnO1xuKlxuKiB0ZXN0KCdzdG9yYWdlIGxpc3RlbmVyIHNob3VsZCBiZSByZW1vdmVkIHdoZW4gY29udGV4dCBpcyBpbnZhbGlkYXRlZCcsICgpID0+IHtcbiogICBjb25zdCBjdHggPSBuZXcgQ29udGVudFNjcmlwdENvbnRleHQoJ3Rlc3QnKTtcbiogICBjb25zdCBpdGVtID0gc3RvcmFnZS5kZWZpbmVJdGVtKCdsb2NhbDpjb3VudCcsIHsgZGVmYXVsdFZhbHVlOiAwIH0pO1xuKiAgIGNvbnN0IHdhdGNoZXIgPSB2aS5mbigpO1xuKlxuKiAgIGNvbnN0IHVud2F0Y2ggPSBpdGVtLndhdGNoKHdhdGNoZXIpO1xuKiAgIGN0eC5vbkludmFsaWRhdGVkKHVud2F0Y2gpOyAvLyBMaXN0ZW4gZm9yIGludmFsaWRhdGUgaGVyZVxuKlxuKiAgIGF3YWl0IGl0ZW0uc2V0VmFsdWUoMSk7XG4qICAgZXhwZWN0KHdhdGNoZXIpLnRvQmVDYWxsZWRUaW1lcygxKTtcbiogICBleHBlY3Qod2F0Y2hlcikudG9CZUNhbGxlZFdpdGgoMSwgMCk7XG4qXG4qICAgY3R4Lm5vdGlmeUludmFsaWRhdGVkKCk7IC8vIFVzZSB0aGlzIGZ1bmN0aW9uIHRvIGludmFsaWRhdGUgdGhlIGNvbnRleHRcbiogICBhd2FpdCBpdGVtLnNldFZhbHVlKDIpO1xuKiAgIGV4cGVjdCh3YXRjaGVyKS50b0JlQ2FsbGVkVGltZXMoMSk7XG4qIH0pO1xuKiBgYGBcbiovXG52YXIgQ29udGVudFNjcmlwdENvbnRleHQgPSBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG5cdHN0YXRpYyBTQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6Y29udGVudC1zY3JpcHQtc3RhcnRlZFwiKTtcblx0aWQ7XG5cdGFib3J0Q29udHJvbGxlcjtcblx0bG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuXHRjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuXHRcdHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcblx0XHR0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXHRcdHRoaXMuaWQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKTtcblx0XHR0aGlzLmFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcblx0XHR0aGlzLnN0b3BPbGRTY3JpcHRzKCk7XG5cdFx0dGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcblx0fVxuXHRnZXQgc2lnbmFsKCkge1xuXHRcdHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG5cdH1cblx0YWJvcnQocmVhc29uKSB7XG5cdFx0cmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG5cdH1cblx0Z2V0IGlzSW52YWxpZCgpIHtcblx0XHRpZiAoYnJvd3Nlci5ydW50aW1lPy5pZCA9PSBudWxsKSB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG5cdFx0cmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG5cdH1cblx0Z2V0IGlzVmFsaWQoKSB7XG5cdFx0cmV0dXJuICF0aGlzLmlzSW52YWxpZDtcblx0fVxuXHQvKipcblx0KiBBZGQgYSBsaXN0ZW5lciB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBjb250ZW50IHNjcmlwdCdzIGNvbnRleHQgaXNcblx0KiBpbnZhbGlkYXRlZC5cblx0KlxuXHQqIEBleGFtcGxlXG5cdCogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcblx0KiAgIGNvbnN0IHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIgPSBjdHgub25JbnZhbGlkYXRlZCgoKSA9PiB7XG5cdCogICAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuXHQqICAgfSk7XG5cdCogICAvLyAuLi5cblx0KiAgIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcblx0KlxuXHQqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSBsaXN0ZW5lci5cblx0Ki9cblx0b25JbnZhbGlkYXRlZChjYikge1xuXHRcdHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG5cdFx0cmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG5cdH1cblx0LyoqXG5cdCogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IG5ldmVyIHJlc29sdmVzLiBVc2VmdWwgaWYgeW91IGhhdmUgYW4gYXN5bmMgZnVuY3Rpb25cblx0KiB0aGF0IHNob3VsZG4ndCBydW4gYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cblx0KlxuXHQqIEBleGFtcGxlXG5cdCogICBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuXHQqICAgICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuXHQqXG5cdCogICAgIC8vIC4uLlxuXHQqICAgfTtcblx0Ki9cblx0YmxvY2soKSB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHt9KTtcblx0fVxuXHQvKipcblx0KiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbFxuXHQqIHdoZW4gaW52YWxpZGF0ZWQuXG5cdCpcblx0KiBJbnRlcnZhbHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjbGVhckludGVydmFsYCBmdW5jdGlvbi5cblx0Ki9cblx0c2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuXHRcdGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuXHRcdH0sIHRpbWVvdXQpO1xuXHRcdHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cdC8qKlxuXHQqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWxcblx0KiB3aGVuIGludmFsaWRhdGVkLlxuXHQqXG5cdCogVGltZW91dHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBzZXRUaW1lb3V0YCBmdW5jdGlvbi5cblx0Ki9cblx0c2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG5cdFx0Y29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcblx0XHR9LCB0aW1lb3V0KTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cdC8qKlxuXHQqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2Vsc1xuXHQqIHRoZSByZXF1ZXN0IHdoZW4gaW52YWxpZGF0ZWQuXG5cdCpcblx0KiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsQW5pbWF0aW9uRnJhbWVgXG5cdCogZnVuY3Rpb24uXG5cdCovXG5cdHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuXHRcdGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcblx0XHR9KTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcblx0XHRyZXR1cm4gaWQ7XG5cdH1cblx0LyoqXG5cdCogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGVcblx0KiByZXF1ZXN0IHdoZW4gaW52YWxpZGF0ZWQuXG5cdCpcblx0KiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsSWRsZUNhbGxiYWNrYFxuXHQqIGZ1bmN0aW9uLlxuXHQqL1xuXHRyZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0Y29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuXHRcdH0sIG9wdGlvbnMpO1xuXHRcdHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcblx0XHRyZXR1cm4gaWQ7XG5cdH1cblx0YWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcblx0XHRpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuXHRcdFx0aWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG5cdFx0fVxuXHRcdHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4odHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsIGhhbmRsZXIsIHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRzaWduYWw6IHRoaXMuc2lnbmFsXG5cdFx0fSk7XG5cdH1cblx0LyoqXG5cdCogQGludGVybmFsXG5cdCogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG5cdCovXG5cdG5vdGlmeUludmFsaWRhdGVkKCkge1xuXHRcdHRoaXMuYWJvcnQoXCJDb250ZW50IHNjcmlwdCBjb250ZXh0IGludmFsaWRhdGVkXCIpO1xuXHRcdGxvZ2dlci5kZWJ1ZyhgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGApO1xuXHR9XG5cdHN0b3BPbGRTY3JpcHRzKCkge1xuXHRcdGRvY3VtZW50LmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSwgeyBkZXRhaWw6IHtcblx0XHRcdGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuXHRcdFx0bWVzc2FnZUlkOiB0aGlzLmlkXG5cdFx0fSB9KSk7XG5cdFx0aWYgKCF0aGlzLm9wdGlvbnM/Lm5vU2NyaXB0U3RhcnRlZFBvc3RNZXNzYWdlKSB3aW5kb3cucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0dHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuXHRcdFx0Y29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG5cdFx0XHRtZXNzYWdlSWQ6IHRoaXMuaWRcblx0XHR9LCBcIipcIik7XG5cdH1cblx0dmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG5cdFx0Y29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRldGFpbD8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG5cdFx0Y29uc3QgaXNGcm9tU2VsZiA9IGV2ZW50LmRldGFpbD8ubWVzc2FnZUlkID09PSB0aGlzLmlkO1xuXHRcdHJldHVybiBpc1NhbWVDb250ZW50U2NyaXB0ICYmICFpc0Zyb21TZWxmO1xuXHR9XG5cdGxpc3RlbkZvck5ld2VyU2NyaXB0cygpIHtcblx0XHRjb25zdCBjYiA9IChldmVudCkgPT4ge1xuXHRcdFx0aWYgKCEoZXZlbnQgaW5zdGFuY2VvZiBDdXN0b21FdmVudCkgfHwgIXRoaXMudmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSkgcmV0dXJuO1xuXHRcdFx0dGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuXHRcdH07XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsIGNiKTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsIGNiKSk7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IENvbnRlbnRTY3JpcHRDb250ZXh0IH07XG4iXSwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsMTAsMTEsMTIsMTMsMTQsMTVdLCJtYXBwaW5ncyI6Ijs7Q0FDQSxTQUFTLG9CQUFvQixZQUFZO0VBQ3hDLE9BQU87Q0FDUjs7O0NDREEsU0FBUyx3QkFBd0IsS0FBNEI7RUFDM0QsSUFBSTtHQUNGLE1BQU0sU0FBa0IsS0FBSyxNQUFNLEdBQUc7R0FDdEMsTUFBTSxRQUFRLE1BQU0sUUFBUSxNQUFNLElBQUksU0FBUyxDQUFDLE1BQU07R0FFdEQsS0FBSyxNQUFNLFFBQVEsT0FBTztJQUN4QixJQUFJLENBQUMsUUFBUSxPQUFPLFNBQVMsVUFBVTtJQUN2QyxNQUFNLFNBQVM7SUFDZixNQUFNLFFBQVEsT0FBTztJQUNyQixJQUFJLE1BQU0sUUFBUSxLQUFLO1VBQ2hCLE1BQU0sUUFBUSxPQUNqQixJQUFJLFFBQVEsT0FBTyxTQUFTLFVBQVU7TUFDcEMsTUFBTSxPQUFRLEtBQWlDO01BQy9DLElBQUksT0FBTyxTQUFTLFVBQVUsT0FBTztLQUN2Qzs7SUFHSixNQUFNLE9BQU8sT0FBTztJQUNwQixJQUFJLE9BQU8sU0FBUyxVQUFVLE9BQU87R0FDdkM7RUFDRixRQUFRO0dBQ04sT0FBTztFQUNUO0VBRUEsT0FBTztDQUNUO0NBRUEsU0FBZ0IsZUFBZSxLQUF5QjtFQUN0RCxNQUFNLFNBQVMsSUFDWixjQUFjLDRCQUEwQixDQUFDLEVBQ3hDLGFBQWEsU0FBUyxDQUFDLEVBQ3ZCLFlBQVk7RUFFaEIsSUFBSSxXQUFXLGFBQWEsV0FBVyxlQUNyQyxPQUFPO0VBR1QsS0FBSyxNQUFNLFVBQVUsSUFBSSxpQkFDdkIsc0NBQ0YsR0FBRztHQUNELE1BQU0saUJBQWlCLHdCQUF3QixPQUFPLGVBQWUsRUFBRTtHQUN2RSxJQUNFLG1CQUFtQixpQkFDbkIsbUJBQW1CLGFBQ25CLG1CQUFtQixlQUVuQixPQUFPO0VBRVg7RUFFQSxNQUFNLFVBQVUsSUFBSSxjQUFjLFNBQVM7RUFDM0MsSUFBSSxTQUFTO0dBQ1gsTUFBTSxpQkFBaUIsUUFBUSxlQUFlLEdBQUEsQ0FBSSxLQUFLLENBQUMsQ0FBQztHQUN6RCxNQUFNLGNBQWMsSUFBSSxNQUFNLGVBQWUsR0FBQSxDQUFJLEtBQUssQ0FBQyxDQUFDO0dBQ3hELElBQUksZ0JBQWdCLE9BQU8sZ0JBQWdCLEtBQUssSUFBSSxZQUFZLENBQUMsSUFBSSxLQUNuRSxPQUFPO0VBRVg7RUFFQSxPQUFPO0NBQ1Q7OztDQzVEQSxJQUFNLHNCQUEyQztFQUMvQztHQUFDO0dBQStCO0dBQWtCO0VBQXNCO0VBQ3hFO0dBQUM7R0FBeUI7R0FBd0I7RUFBcUI7RUFDdkUsQ0FBQyxzQkFBc0IsZ0JBQWdCO0VBQ3ZDO0dBQUM7R0FBc0I7R0FBb0I7RUFBc0I7RUFDakU7R0FBQztHQUFtQjtHQUFlO0VBQWlCO0NBQ3REO0NBSUEsU0FBZ0Isa0JBQWtCLEdBQVcsR0FBb0I7RUFDL0QsSUFBSSxNQUFNLEdBQ1IsT0FBTztFQUdULEtBQUssTUFBTSxTQUFTLHFCQUNsQixJQUFJLE1BQU0sU0FBUyxDQUFDLEtBQUssTUFBTSxTQUFTLENBQUMsR0FDdkMsT0FBTztFQUlYLE9BQU87Q0FDVDs7O0NDakJBLElBQWEsb0JBQW9CO0NBQ2pDLElBQWEscUJBQXFCO0NBRWxDLElBQU0saUJBQWlCO0NBRXZCLElBQU0sc0JBQXNCO0VBQzFCO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7Q0FDRixDQUFDLENBQUMsS0FBSyxHQUFHO0NBRVYsSUFBTSwwQkFBd0I7RUFDNUI7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtDQUNGLENBQUMsQ0FBQyxLQUFLLEdBQUc7Q0FFVixJQUFNLG1CQUFtQjtFQUN2QjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0NBQ0Y7Q0FFQSxJQUFNLG9CQUFvQjtFQUN4QjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7Q0FDRjtDQUVBLElBQU0sd0JBQXdCO0VBQzVCO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0NBQ0Y7Q0FFQSxJQUFNLDBCQUEwQjtFQUM5QjtFQUNBO0VBQ0E7RUFDQTtDQUNGO0NBRUEsSUFBTSxtQkFBbUI7RUFDdkI7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7Q0FDRjtDQUVBLElBQU0sNEJBQTRCO0VBQ2hDO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0NBQ0YsQ0FBQyxDQUFDLEtBQUssR0FBRztDQUVWLElBQU0sbUJBQW1CO0VBQ3ZCO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtDQUNGO0NBRUEsSUFBTSxzQkFBc0I7RUFDMUI7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7Q0FDRjtDQUVBLElBQU0sa0JBQWtCO0VBQ3RCO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtDQUNGO0NBRUEsSUFBTSxvQkFBb0I7RUFDeEI7RUFDQTtFQUNBO0VBQ0E7RUFDQTtDQUNGO0NBV0EsU0FBZ0IsMEJBQTBCLFNBQStCO0VBQ3ZFLE1BQU0sUUFBUSxPQUFPLGlCQUFpQixPQUFPO0VBQzdDLElBQUksTUFBTSxZQUFZLFVBQVUsTUFBTSxlQUFlLFVBQ25ELE9BQU87RUFFVCxJQUFJLE9BQU8sV0FBVyxNQUFNLE9BQU8sTUFBTSxHQUN2QyxPQUFPO0VBR1QsTUFBTSxPQUFPLFFBQVEsc0JBQXNCO0VBQzNDLElBQUksS0FBSyxRQUFRLEtBQUssS0FBSyxTQUFTLEdBQ2xDLE9BQU87RUFHVCxJQUFJLE9BQU8sUUFBUSxvQkFBb0IsWUFDckMsT0FBTyxRQUFRLGdCQUFnQjtHQUM3QixjQUFjO0dBQ2Qsb0JBQW9CO0VBQ3RCLENBQUM7RUFHSCxJQUFJLE1BQU0sYUFBYSxXQUFXLE1BQU0sYUFBYSxVQUNuRCxPQUFPO0VBR1QsT0FBTyxRQUFRLGlCQUFpQjtDQUNsQztDQUVBLFNBQVMsa0JBQWtCLFNBQTBCO0VBQ25ELE1BQU0sV0FBVyxRQUFRLGFBQWEsaUJBQWlCO0VBQ3ZELElBQUksVUFDRixPQUFPO0VBR1QsTUFBTSxLQUFLLE9BQU8sV0FBVztFQUM3QixRQUFRLGFBQWEsbUJBQW1CLEVBQUU7RUFDMUMsT0FBTztDQUNUO0NBRUEsU0FBUyxvQkFBb0IsU0FBMkI7RUFFdEQsSUFBSSxDQURZLFFBQVEsUUFBUSxTQUMzQixHQUNILE9BQU87RUFHVCxJQUFJLFFBQVEsUUFBUSwyREFBcUQsR0FDdkUsT0FBTztFQUdULE1BQU0sTUFBTSxRQUFRLFFBQVEsWUFBWTtFQUN4QyxPQUFPLENBQUM7R0FBQztHQUFTO0dBQVU7R0FBVTtHQUFZO0VBQU0sQ0FBQyxDQUFDLFNBQVMsR0FBRztDQUN4RTtDQUVBLFNBQVMsa0JBQWtCLFNBQWtCLFVBQTZCO0VBQ3hFLElBQUksYUFBYSxlQUFlLG9CQUFvQixPQUFPLEdBQ3pELE9BQU87RUFJVCxJQURhLFNBQVMsZUFBZSxvQkFDakMsQ0FBQSxFQUFNLFNBQVMsT0FBTyxHQUN4QixPQUFPO0VBR1QsSUFBSSxtQkFBbUIsZUFBZSxDQUFDLDBCQUEwQixPQUFPLEdBQ3RFLE9BQU87RUFHVCxPQUFPO0NBQ1Q7Q0FFQSxTQUFTLHFCQUFxQixNQUFjLFVBQW1DO0VBQzdFLEtBQUssTUFBTSxXQUFXLFVBQ3BCLElBQUksUUFBUSxLQUFLLElBQUksR0FDbkIsT0FBTztFQUdYLE9BQU87Q0FDVDtDQUVBLFNBQVMsZ0JBQWdCLFNBQTJCO0VBQ2xELE1BQU0sU0FBUyxRQUFRLFFBQVEsMkRBQXFEO0VBQ3BGLElBQUksa0JBQWtCLGFBQ3BCLE9BQU87RUFHVCxJQUFJLG1CQUFtQixrQkFDckIsT0FBTyxRQUFRLFFBQVEsT0FBTyxLQUFLO0VBR3JDLElBQUksbUJBQW1CO1FBQ1AsUUFBUSxhQUFhLEdBQUEsQ0FBSSxLQUNuQyxDQUFBLENBQUssU0FBUyxLQUFLO0lBQ3JCLE1BQU0sWUFBWSxRQUFRLFFBQ3hCLGlIQUNGO0lBQ0EsSUFBSSxxQkFBcUIsYUFDdkIsT0FBTztHQUVYOztFQUdGLE9BQU87Q0FDVDtDQUVBLFNBQVMsc0JBQXNCLFNBQStCO0VBQzVELElBQUksU0FBUyxRQUFRO0VBQ3JCLE9BQU8sUUFBUTtHQUNiLE1BQU0sUUFBUSxPQUFPLGlCQUFpQixNQUFNO0dBQzVDLElBQUksTUFBTSxhQUFhLFdBQVcsTUFBTSxhQUFhLFVBQ25ELE9BQU87R0FFVCxTQUFTLE9BQU87RUFDbEI7RUFDQSxPQUFPO0NBQ1Q7Q0FFQSxTQUFTLGFBQ1AsU0FDQSxXQUNBLFVBQ0EsTUFDTTtFQUNOLE1BQU0sU0FBUyxnQkFBZ0IsT0FBTztFQUN0QyxJQUFJLEVBQUUsa0JBQWtCLGNBQ3RCO0VBRUYsSUFBSSxrQkFBa0IsUUFBUSxRQUFRLEdBQ3BDO0VBR0YsTUFBTSxXQUFXLEtBQUssSUFBSSxNQUFNO0VBQ2hDLElBQUksVUFBVTtHQUNaLElBQUksYUFBYSxVQUFVLFFBQVEsSUFBSSxhQUFhLFNBQVMsUUFBUSxHQUNuRSxLQUFLLElBQUksUUFBUTtJQUFFLEdBQUc7SUFBVyxJQUFJLFNBQVM7R0FBRyxDQUFDO0dBRXBEO0VBQ0Y7RUFFQSxLQUFLLElBQUksUUFBUTtHQUNmLEdBQUc7R0FDSCxJQUFJLGtCQUFrQixNQUFNO0VBQzlCLENBQUM7Q0FDSDtDQUVBLFNBQVMsYUFBYSxVQUE2QztFQUNqRSxRQUFRLFVBQVI7R0FDRSxLQUFLLFFBQ0gsT0FBTztHQUNULEtBQUssVUFDSCxPQUFPO0dBQ1QsS0FBSyxPQUNILE9BQU87R0FDVCxTQUVFLE9BQU87RUFFWDtDQUNGO0NBRUEsU0FBUywyQkFDUCxVQUNBLE1BQ007RUFDTixLQUFLLE1BQU0sV0FBVyxTQUFTLGlCQUFpQixtQkFBbUIsR0FBRztHQUNwRSxJQUFJLEVBQUUsbUJBQW1CLGNBQWM7R0FFdkMsYUFDRSxTQUNBO0lBQ0UsVUFBVTtJQUNWLGFBQWE7SUFDYixVQUFVO0lBQ1YsT0FBTztHQUNULEdBQ0EsVUFDQSxJQUNGO0VBQ0Y7Q0FDRjtDQUVBLFNBQVMsOEJBQ1AsVUFDQSxNQUNNO0VBQ04sS0FBSyxNQUFNLFNBQVMsU0FBUyxpQkFDM0IsaUVBQ0YsR0FDRSxhQUNFLE9BQ0E7R0FDRSxVQUFVO0dBQ1YsYUFBYTtHQUNiLFVBQVU7R0FDVixPQUFPO0VBQ1QsR0FDQSxVQUNBLElBQ0Y7Q0FFSjtDQUVBLFNBQVMsZ0JBQWdCLE1BQXVCO0VBQzlDLE9BQU8sK0NBQStDLEtBQUssSUFBSTtDQUNqRTtDQUVBLFNBQVMsb0JBQW9CLFNBQStCO0VBQzFELE1BQU0sWUFBWSxRQUFRLFFBQVEseUJBQXlCO0VBQzNELElBQUkscUJBQXFCLGFBQ3ZCLE9BQU87RUFFVCxJQUFJLFFBQVEseUJBQXlCLGFBQ25DLE9BQU8sUUFBUTtFQUVqQixPQUFPO0NBQ1Q7Q0FFQSxTQUFTLHlCQUNQLFVBQ0EsTUFDTTtFQUNOLEtBQUssTUFBTSxXQUFXLFNBQVMsaUJBQThCLFFBQVEsR0FBRztHQUN0RSxJQUFJLENBQUMsMEJBQTBCLE9BQU8sR0FDcEM7R0FHRixNQUFNLE9BQU8sUUFBUSxlQUFlO0dBQ3BDLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxLQUFLLENBQUMsVUFBVSxLQUFLLElBQUksR0FDaEQ7R0FHRixhQUNFLG9CQUFvQixPQUFPLEdBQzNCO0lBQ0UsVUFBVTtJQUNWLGFBQWE7SUFDYixVQUFVO0lBQ1YsT0FBTztHQUNULEdBQ0EsVUFDQSxJQUNGO0VBQ0Y7RUFFQSxLQUFLLE1BQU0sV0FBVyxTQUFTLGlCQUM3Qix5QkFDRixHQUFHO0dBQ0QsTUFBTSxRQUFRLFFBQVEsYUFBYSxHQUFBLENBQUksS0FBSztHQUM1QyxJQUFJLEtBQUssU0FBUyxLQUFLLEtBQUssU0FBUyxLQUNuQztHQUlGLE1BQU0sV0FBVyxHQUFHLEtBQUssSUFEWixRQUFRO0dBRXJCLE1BQU0sWUFDSixRQUFRLGNBQWMsUUFBUSxNQUFNLFFBQ3BDLGdCQUFnQixLQUFLLE9BQU8saUJBQWlCLE9BQU8sQ0FBQyxDQUFDLGNBQWM7R0FFdEUsSUFDRSxxQkFBcUIsVUFBVSxnQkFBZ0IsS0FDOUMsYUFBYSxnQkFBZ0IsSUFBSSxHQUVsQyxhQUNFLFNBQ0E7SUFDRSxVQUFVO0lBQ1YsYUFBYSxZQUFZLHVCQUF1QjtJQUNoRCxVQUFVO0lBQ1YsT0FBTztHQUNULEdBQ0EsVUFDQSxJQUNGO0VBRUo7RUFFQSxLQUFLLE1BQU0sV0FBVyxTQUFTLGlCQUE4QixHQUFHLEdBQUc7R0FDakUsSUFBSSxDQUFDLDBCQUEwQixPQUFPLEdBQ3BDO0dBR0YsTUFBTSxRQUFRLFFBQVEsYUFBYSxHQUFBLENBQUksS0FBSztHQUM1QyxJQUFJLEtBQUssU0FBUyxJQUNoQjtHQUlGLElBRGMsT0FBTyxpQkFBaUIsT0FDbEMsQ0FBQSxDQUFNLG1CQUFtQixTQUFTLGNBQWMsS0FBSyxnQkFBZ0IsSUFBSSxHQUMzRSxhQUNFLG9CQUFvQixPQUFPLEdBQzNCO0lBQ0UsVUFBVTtJQUNWLGFBQWE7SUFDYixVQUFVO0lBQ1YsT0FBTztHQUNULEdBQ0EsVUFDQSxJQUNGO0VBRUo7Q0FDRjtDQUVBLFNBQVMsd0JBQ1AsVUFDQSxNQUNNO0VBQ04sS0FBSyxNQUFNLFdBQVcsU0FBUyxpQkFBOEIsR0FBRyxHQUFHO0dBQ2pFLE1BQU0sUUFBUSxPQUFPLGlCQUFpQixPQUFPO0dBQzdDLElBQUksTUFBTSxhQUFhLFdBQVcsTUFBTSxhQUFhLFVBQ25EO0dBR0YsSUFBSSxzQkFBc0IsT0FBTyxHQUMvQjtHQUdGLE1BQU0sT0FBTyxRQUFRLGFBQWE7R0FDbEMsSUFBSSxLQUFLLFNBQVMsS0FDaEI7R0FHRixNQUFNLFdBQVcsR0FBRyxLQUFLLElBQUksUUFBUTtHQUNyQyxNQUFNLFVBQVUscUJBQXFCLFVBQVUsZ0JBQWdCO0dBQy9ELE1BQU0sV0FBVyxxQkFBcUIsVUFBVSxpQkFBaUI7R0FFakUsSUFBSSxTQUFTO0lBQ1gsYUFDRSxTQUNBO0tBQ0UsVUFBVTtLQUNWLGFBQWEsK0JBQStCLEtBQUssUUFBUSxJQUNyRCxtQkFDQTtLQUNKLFVBQVUsK0JBQStCLEtBQUssUUFBUSxJQUNsRCxTQUNBO0tBQ0osT0FBTztJQUNULEdBQ0EsVUFDQSxJQUNGO0lBQ0E7R0FDRjtHQUVBLElBQUksVUFBVTtJQUNaLGFBQ0UsU0FDQTtLQUNFLFVBQVU7S0FDVixhQUFhLDJDQUEyQyxLQUFLLElBQUksSUFDN0Qsb0JBQ0E7S0FDSixVQUFVO0tBQ1YsT0FBTztJQUNULEdBQ0EsVUFDQSxJQUNGO0lBQ0E7R0FDRjtHQUVBLElBQ0Usd0VBQXdFLEtBQ3RFLFFBQVEsU0FDVixLQUNBLFFBQVEsUUFBUSx5Q0FBeUMsR0FFekQsYUFDRSxTQUNBO0lBQ0UsVUFBVTtJQUNWLGFBQWE7SUFDYixVQUFVO0lBQ1YsT0FBTztHQUNULEdBQ0EsVUFDQSxJQUNGO0VBRUo7Q0FDRjtDQUVBLFNBQVMsc0JBQ1AsVUFDQSxNQUNNO0VBQ04sS0FBSyxNQUFNLFdBQVcsU0FBUyxpQkFDN0IsdUJBQ0YsR0FBRztHQUNELE1BQU0sT0FBTyxRQUFRLGFBQWE7R0FDbEMsSUFBSSxLQUFLLFNBQVMsS0FBSyxLQUFLLFNBQVMsS0FDbkM7R0FJRixNQUFNLFdBQVcsR0FBRyxLQUFLLElBRFosUUFBUTtHQUlyQixJQURnQixxQkFBcUIsVUFBVSxnQkFDM0MsR0FBUztJQUNYLGFBQ0UsU0FDQTtLQUNFLFVBQVU7S0FDVixhQUFhLCtCQUErQixLQUFLLFFBQVEsSUFDckQsbUJBQ0E7S0FDSixVQUFVLCtCQUErQixLQUFLLFFBQVEsSUFDbEQsU0FDQTtLQUNKLE9BQU87SUFDVCxHQUNBLFVBQ0EsSUFDRjtJQUNBO0dBQ0Y7R0FHQSxJQURpQixxQkFBcUIsTUFBTSxpQkFDeEMsR0FBVTtJQUNaLGFBQ0UsU0FDQTtLQUNFLFVBQVU7S0FDVixhQUFhLDJDQUEyQyxLQUFLLElBQUksSUFDN0Qsb0JBQ0E7S0FDSixVQUFVO0tBQ1YsT0FBTztJQUNULEdBQ0EsVUFDQSxJQUNGO0lBQ0E7R0FDRjtHQUdBLElBRGUscUJBQXFCLE1BQU0scUJBQ3RDLEdBQVE7SUFDVixhQUNFLFNBQ0E7S0FDRSxVQUFVO0tBQ1YsYUFBYTtLQUNiLFVBQVU7S0FDVixPQUFPO0lBQ1QsR0FDQSxVQUNBLElBQ0Y7SUFDQTtHQUNGO0dBR0EsSUFEZSxxQkFBcUIsTUFBTSxlQUN0QyxHQUFRO0lBQ1YsYUFDRSxTQUNBO0tBQ0UsVUFBVTtLQUNWLGFBQWE7S0FDYixVQUFVO0tBQ1YsT0FBTztJQUNULEdBQ0EsVUFDQSxJQUNGO0lBQ0E7R0FDRjtHQUdBLElBRGdCLHFCQUFxQixNQUFNLHVCQUN2QyxHQUFTO0lBQ1gsYUFDRSxTQUNBO0tBQ0UsVUFBVTtLQUNWLGFBQWE7S0FDYixVQUFVO0tBQ1YsT0FBTztJQUNULEdBQ0EsVUFDQSxJQUNGO0lBQ0E7R0FDRjtHQUdBLElBRGdCLHFCQUFxQixVQUFVLGdCQUMzQyxHQUFTO0lBQ1gsYUFDRSxTQUNBO0tBQ0UsVUFBVTtLQUNWLGFBQWE7S0FDYixVQUFVO0tBQ1YsT0FBTztJQUNULEdBQ0EsVUFDQSxJQUNGO0lBQ0E7R0FDRjtHQUdBLElBRGdCLHFCQUFxQixNQUFNLGdCQUN2QyxHQUFTO0lBQ1gsYUFDRSxTQUNBO0tBQ0UsVUFBVTtLQUNWLGFBQWE7S0FDYixVQUFVO0tBQ1YsT0FBTztJQUNULEdBQ0EsVUFDQSxJQUNGO0lBQ0E7R0FDRjtHQUdBLElBRG1CLHFCQUFxQixNQUFNLG1CQUMxQyxHQUFZO0lBQ2QsYUFDRSxTQUNBO0tBQ0UsVUFBVTtLQUNWLGFBQWE7S0FDYixVQUFVO0tBQ1YsT0FBTztJQUNULEdBQ0EsVUFDQSxJQUNGO0lBQ0E7R0FDRjtHQUdBLElBRGlCLHFCQUFxQixVQUFVLGlCQUM1QyxHQUNGLGFBQ0UsU0FDQTtJQUNFLFVBQVU7SUFDVixhQUFhO0lBQ2IsVUFBVTtJQUNWLE9BQU87R0FDVCxHQUNBLFVBQ0EsSUFDRjtFQUVKO0NBQ0Y7Q0FFQSxTQUFTLGtCQUFrQixXQUF1QztFQUNoRSxRQUFRLFVBQVUsVUFBbEI7R0FDRSxLQUFLLFdBQ0gsT0FBTyxtQkFBbUIsS0FBSyxVQUFVLFdBQVcsSUFDaEQsb0JBQ0E7R0FDTixLQUFLLFlBQ0gsT0FBTztHQUNULEtBQUssZ0JBQ0gsT0FBTztHQUNULEtBQUssZ0JBQ0gsT0FBTztHQUNULEtBQUssZUFDSCxPQUFPO0dBQ1QsS0FBSyxpQkFDSCxPQUFPLFVBQVUsZ0JBQWdCLHVCQUM3QixtQkFDQTtHQUNOLEtBQUsscUJBQ0gsT0FBTztHQUNULEtBQUssV0FDSCxPQUFPO0dBQ1QsS0FBSyxnQkFDSCxPQUFPO0dBQ1QsS0FBSyxZQUNILE9BQU87R0FDVCxTQUNFLE9BQU87RUFDWDtDQUNGO0NBRUEsU0FBUyx1QkFBdUIsVUFBNEI7RUFDMUQsTUFBTSwwQkFBVSxJQUFJLElBQVk7RUFFaEMsTUFBTSxTQUFTLFNBQVMsTUFBTSxlQUFlLENBQUMsR0FBRztFQUNqRCxJQUFJLFVBQVUsT0FBTyxLQUFLLENBQUMsQ0FBQyxVQUFVLEdBQ3BDLFFBQVEsSUFBSSxPQUFPLEtBQUssQ0FBQztFQUczQixLQUFLLE1BQU0sU0FBUyxTQUFTLFNBQVMsMkJBQTJCLEdBQUc7R0FDbEUsUUFBUSxJQUFJLE1BQU0sRUFBRSxDQUFDLFFBQVEsT0FBTyxFQUFFLENBQUM7R0FDdkMsUUFBUSxJQUFJLE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQztFQUM3QjtFQUVBLEtBQUssTUFBTSxTQUFTLFNBQVMsU0FBUyx5QkFBeUIsR0FDN0QsUUFBUSxJQUFJLE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQztFQUc3QixLQUFLLE1BQU0sU0FBUyxTQUFTLFNBQVMsa0JBQWtCLEdBQ3RELFFBQVEsSUFBSSxNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUM7RUFHN0IsT0FBTyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsUUFBUSxXQUFXLE9BQU8sVUFBVSxDQUFDO0NBQzNEO0NBRUEsU0FBUyw0QkFBNEIsUUFBb0M7RUFDdkUsTUFBTSxjQUFjLE9BQU8sWUFBWTtFQUN2QyxJQUFJLE9BQTJCO0VBQy9CLElBQUksV0FBVyxPQUFPO0VBRXRCLEtBQUssTUFBTSxXQUFXLFNBQVMsaUJBQzdCLHFCQUNGLEdBQUc7R0FDRCxJQUFJLENBQUMsMEJBQTBCLE9BQU8sR0FDcEM7R0FHRixNQUFNLFFBQVEsUUFBUSxhQUFhLEdBQUEsQ0FBSSxLQUFLO0dBQzVDLElBQUksS0FBSyxXQUFXLEtBQUssS0FBSyxTQUFTLEtBQ3JDO0dBRUYsSUFBSSxDQUFDLEtBQUssWUFBWSxDQUFDLENBQUMsU0FBUyxXQUFXLEdBQzFDO0dBR0YsTUFBTSxPQUFPLFFBQVEsc0JBQXNCO0dBQzNDLE1BQU0sT0FBTyxLQUFLLFFBQVEsS0FBSztHQUMvQixJQUFJLE9BQU8sS0FBSyxPQUFPLFVBQVU7SUFDL0IsT0FBTztJQUNQLFdBQVc7R0FDYjtFQUNGO0VBRUEsT0FBTztDQUNUO0NBRUEsU0FBUywrQkFBbUQ7RUFDMUQsS0FBSyxNQUFNLFdBQVcsU0FBUyxpQkFBOEIsUUFBUSxHQUFHO0dBQ3RFLElBQUksQ0FBQywwQkFBMEIsT0FBTyxHQUNwQztHQUVGLE1BQU0sT0FBTyxRQUFRLGVBQWU7R0FDcEMsSUFBSSxnQkFBZ0IsSUFBSSxLQUFLLFVBQVUsS0FBSyxJQUFJLEdBQzlDLE9BQU8sb0JBQW9CLE9BQU87RUFFdEM7RUFFQSxLQUFLLE1BQU0sV0FBVyxTQUFTLGlCQUM3Qix5QkFDRixHQUFHO0dBQ0QsSUFBSSxDQUFDLDBCQUEwQixPQUFPLEdBQ3BDO0dBR0YsTUFBTSxRQUFRLFFBQVEsYUFBYSxHQUFBLENBQUksS0FBSztHQUM1QyxJQUFJLEtBQUssU0FBUyxHQUNoQjtHQUlGLElBRGtCLFFBQVEsY0FBYyxRQUFRLE1BQU0sUUFDckMscUJBQXFCLEdBQUcsS0FBSyxJQUFJLFFBQVEsYUFBYSxnQkFBZ0IsR0FDckYsT0FBTztFQUVYO0VBRUEsT0FBTztDQUNUO0NBRUEsU0FBUyw2QkFBNkIsVUFBc0M7RUFDMUUsS0FBSyxNQUFNLFVBQVUsdUJBQXVCLFFBQVEsR0FBRztHQUNyRCxNQUFNLFVBQVUsNEJBQTRCLE1BQU07R0FDbEQsSUFBSSxTQUNGLE9BQU8sb0JBQW9CLE9BQU87RUFFdEM7RUFFQSxPQUFPLDZCQUE2QjtDQUN0QztDQUVBLFNBQVMsd0JBQXdCLFVBQTRCO0VBQzNELE1BQU0sMEJBQVUsSUFBSSxJQUFZO0VBRWhDLE1BQU0sU0FBUyxTQUFTLE1BQU0saUJBQWlCLENBQUMsR0FBRztFQUNuRCxJQUFJLFFBQVEsS0FBSyxHQUFHO0dBQ2xCLE1BQU0sVUFBVSxPQUFPLEtBQUs7R0FDNUIsUUFBUSxJQUFJLE9BQU87R0FDbkIsS0FBSyxNQUFNLFdBQVcsUUFBUSxNQUFNLEdBQUcsR0FBRztJQUN4QyxNQUFNLE9BQU8sUUFBUSxLQUFLO0lBQzFCLElBQUksS0FBSyxVQUFVLEdBQ2pCLFFBQVEsSUFBSSxJQUFJO0dBRXBCO0VBQ0Y7RUFFQSxLQUFLLE1BQU0sU0FBUyxTQUFTLFNBQzNCLGdJQUNGLEdBQ0UsUUFBUSxJQUFJLE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQztFQUc3QixPQUFPLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxRQUFRLFdBQVcsT0FBTyxVQUFVLENBQUM7Q0FDM0Q7Q0FFQSxTQUFTLGdDQUFvRDtFQUMzRCxLQUFLLE1BQU0sV0FBVyxTQUFTLGlCQUM3Qix1REFDRixHQUFHO0dBQ0QsSUFBSSxDQUFDLDBCQUEwQixPQUFPLEdBQ3BDO0dBR0YsTUFBTSxRQUFRLFFBQVEsYUFBYSxHQUFBLENBQUksS0FBSztHQUM1QyxJQUFJLEtBQUssU0FBUyxLQUFLLEtBQUssU0FBUyxLQUNuQztHQUdGLElBQUkscUJBQXFCLE1BQU0saUJBQWlCLEdBQzlDLE9BQU87RUFFWDtFQUVBLE9BQU87Q0FDVDtDQUVBLFNBQVMsOEJBQThCLFVBQXNDO0VBQzNFLEtBQUssTUFBTSxVQUFVLHdCQUF3QixRQUFRLEdBQUc7R0FDdEQsTUFBTSxVQUFVLDRCQUE0QixNQUFNO0dBQ2xELElBQUksU0FDRixPQUFPO0VBRVg7RUFFQSxPQUFPLDhCQUE4QjtDQUN2QztDQUVBLFNBQVMsZ0JBQWdCLFVBQTRCO0VBQ25ELE1BQU0sMEJBQVUsSUFBSSxJQUFZO0VBRWhDLEtBQUssTUFBTSxTQUFTLFNBQVMsU0FBUyxrQkFBa0IsR0FBRztHQUN6RCxNQUFNLFVBQVUsTUFBTSxFQUFFLENBQUMsS0FBSztHQUM5QixJQUFJLFFBQVEsVUFBVSxHQUFHO0lBQ3ZCLFFBQVEsSUFBSSxPQUFPO0lBQ25CLEtBQUssTUFBTSxXQUFXLFFBQVEsTUFBTSxHQUFHLEdBQUc7S0FDeEMsTUFBTSxPQUFPLFFBQVEsS0FBSztLQUMxQixJQUFJLEtBQUssVUFBVSxHQUNqQixRQUFRLElBQUksSUFBSTtJQUVwQjtHQUNGO0VBQ0Y7RUFFQSxLQUFLLE1BQU0sU0FBUyxTQUFTLFNBQVMsWUFBWSxHQUFHO0dBQ25ELE1BQU0sVUFBVSxNQUFNLEVBQUUsQ0FBQyxLQUFLO0dBQzlCLElBQUksUUFBUSxVQUFVLEdBQ3BCLFFBQVEsSUFBSSxPQUFPO0VBRXZCO0VBRUEsTUFBTSxjQUFjLFNBQVMsTUFDM0IsdURBQ0YsQ0FBQyxHQUFHO0VBQ0osSUFBSSxhQUFhLEtBQUssR0FDcEIsUUFBUSxJQUFJLFlBQVksS0FBSyxDQUFDO0VBR2hDLE1BQU0sVUFBVSxTQUFTLE1BQU0saUNBQWlDLENBQUMsR0FBRztFQUNwRSxJQUFJLFNBQVMsS0FBSyxHQUNoQixRQUFRLElBQUksUUFBUSxLQUFLLENBQUMsQ0FBQyxRQUFRLFVBQVUsRUFBRSxDQUFDO0VBR2xELE1BQU0sV0FBVyxxQkFBcUIsUUFBUTtFQUM5QyxJQUFJLFVBQ0YsUUFBUSxJQUFJLFFBQVE7RUFHdEIsT0FBTyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsUUFBUSxXQUFXLE9BQU8sVUFBVSxDQUFDO0NBQzNEO0NBRUEsU0FBUyxxQkFBcUIsVUFBaUM7RUFDN0QsTUFBTSxTQUFTLFNBQVMsTUFBTSxpQkFBaUIsQ0FBQyxHQUFHO0VBQ25ELElBQUksVUFBVSxPQUFPLEtBQUssQ0FBQyxDQUFDLFVBQVUsR0FDcEMsT0FBTyxPQUFPLEtBQUs7RUFHckIsTUFBTSxVQUFVLFNBQVMsUUFBUSxRQUFRLEdBQUcsQ0FBQyxDQUFDLEtBQUs7RUFDbkQsSUFBSSxRQUFRLFNBQVMsR0FDbkIsT0FBTztFQUdULE9BQU8sUUFBUSxNQUFNLEdBQUcsS0FBSyxJQUFJLElBQUksUUFBUSxNQUFNLENBQUM7Q0FDdEQ7Q0FFQSxTQUFTLHNCQUFzQixVQUFzQztFQUNuRSxLQUFLLE1BQU0sVUFBVSxnQkFBZ0IsUUFBUSxHQUFHO0dBQzlDLE1BQU0sVUFBVSw0QkFBNEIsTUFBTTtHQUNsRCxJQUFJLFNBQ0YsT0FBTztFQUVYO0VBRUEsT0FBTztDQUNUO0NBRUEsSUFBTSxrQkFBa0I7RUFDdEI7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7Q0FDRixDQUFDLENBQUMsS0FBSyxHQUFHO0NBRVYsSUFBTSx5QkFBeUI7RUFDN0I7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtDQUNGLENBQUMsQ0FBQyxLQUFLLEdBQUc7Q0FFVixJQUFNLHdCQUNKO0NBRUYsSUFBTSxxQkFDSjtDQUVGLFNBQVMsaUNBQWlDLFNBQTJCO0VBQ25FLE1BQU0sNEJBQVksSUFBSSxJQUFZO0VBRWxDLEtBQUssTUFBTSxTQUFTLFFBQVEsU0FBUyxtQkFBbUIsR0FDdEQsS0FBSyxNQUFNLFNBQVMsTUFBTSxFQUFFLENBQUMsTUFBTSxLQUFLLEdBQUc7R0FDekMsTUFBTSxVQUFVLE1BQU0sS0FBSztHQUMzQixJQUFJLFFBQVEsU0FBUyxHQUNuQjtHQUVGLFVBQVUsSUFBSSxPQUFPO0dBQ3JCLEtBQUssTUFBTSxRQUFRLFFBQVEsTUFBTSxJQUFJLEdBQ25DLElBQUksS0FBSyxVQUFVLEdBQ2pCLFVBQVUsSUFBSSxJQUFJO0VBR3hCO0VBR0YsT0FBTyxDQUFDLEdBQUcsU0FBUztDQUN0QjtDQUVBLFNBQVMsMkJBQTJCLFVBQXNDO0VBQ3hFLE1BQU0sU0FBUyxTQUFTLFlBQVk7RUFDcEMsSUFBSSxPQUFPLFNBQVMsR0FDbEIsT0FBTztFQUdULElBQUksT0FBMkI7RUFDL0IsSUFBSSxXQUFXLE9BQU87RUFFdEIsS0FBSyxNQUFNLFdBQVcsU0FBUyxpQkFBOEIsU0FBUyxHQUFHO0dBRXZFLElBQUksQ0FEYyxRQUFRLFVBQVUsWUFDL0IsQ0FBQSxDQUFVLFNBQVMsTUFBTSxHQUM1QjtHQUVGLElBQUksQ0FBQywwQkFBMEIsT0FBTyxHQUNwQztHQUdGLE1BQU0sT0FBTyxRQUFRLHNCQUFzQjtHQUMzQyxNQUFNLE9BQU8sS0FBSyxRQUFRLEtBQUs7R0FDL0IsSUFBSSxPQUFPLEtBQUssT0FBTyxVQUFVO0lBQy9CLE9BQU87SUFDUCxXQUFXO0dBQ2I7RUFDRjtFQUVBLE9BQU87Q0FDVDtDQUVBLFNBQVMsMkJBQTJCLFNBQXFDO0VBQ3ZFLEtBQUssTUFBTSxZQUFZLGlDQUFpQyxPQUFPLEdBQUc7R0FDaEUsTUFBTSxVQUFVLDJCQUEyQixRQUFRO0dBQ25ELElBQUksU0FDRixPQUFPO0VBRVg7RUFFQSxNQUFNLFdBQVcsUUFBUSxNQUFNLHlCQUF5QjtFQUN4RCxJQUFJO1FBQ0csTUFBTSxXQUFXLFNBQVMsaUJBQThCLFNBQVMsRUFBRSxHQUN0RSxJQUFJLDBCQUEwQixPQUFPLEdBQ25DLE9BQU87RUFBQTtFQUtiLE9BQU87Q0FDVDtDQUVBLFNBQVMscUJBQXFCLFNBQStCO0VBQzNELE1BQU0sWUFBWSxRQUFRLFVBQVUsWUFBWTtFQUNoRCxNQUFNLE9BQU8sUUFBUSxVQUFVLFlBQVk7RUFDM0MsT0FDRSxtQkFBbUIsS0FBSyxTQUFTLEtBQ2pDLG1CQUFtQixLQUFLLElBQUksS0FDNUIsUUFBUSxRQUNOLGlHQUNGO0NBRUo7Q0FFQSxTQUFTLG1DQUF1RDtFQUM5RCxLQUFLLE1BQU0sV0FBVyxTQUFTLGlCQUM3QixzQkFDRixHQUNFLElBQUksMEJBQTBCLE9BQU8sR0FDbkMsT0FBTztFQUlYLE9BQU87Q0FDVDtDQUVBLFNBQVMsNkJBQWlEO0VBQ3hELEtBQUssTUFBTSxXQUFXLFNBQVMsaUJBQThCLGVBQWUsR0FDMUUsSUFBSSwwQkFBMEIsT0FBTyxHQUNuQyxPQUFPO0VBSVgsSUFBSSxjQUFrQztFQUN0QyxJQUFJLGtCQUFrQixPQUFPO0VBRTdCLEtBQUssTUFBTSxXQUFXLFNBQVMsaUJBQThCLEdBQUcsR0FBRztHQUNqRSxNQUFNLFFBQVEsT0FBTyxpQkFBaUIsT0FBTztHQUM3QyxJQUFJLE1BQU0sYUFBYSxXQUFXLE1BQU0sYUFBYSxVQUNuRDtHQUVGLElBQUksc0JBQXNCLE9BQU8sR0FDL0I7R0FJRixLQURjLFFBQVEsYUFBYSxHQUFBLENBQUksS0FDbkMsQ0FBQSxDQUFLLFNBQVMsS0FDaEI7R0FFRixJQUFJLENBQUMsMEJBQTBCLE9BQU8sR0FDcEM7R0FHRixJQUFJLHFCQUFxQixPQUFPLEdBQUc7SUFDakMsTUFBTSxPQUFPLFFBQVEsc0JBQXNCO0lBQzNDLE1BQU0sT0FBTyxLQUFLLFFBQVEsS0FBSztJQUMvQixJQUFJLE9BQU8sS0FBSyxPQUFPLGlCQUFpQjtLQUN0QyxjQUFjO0tBQ2Qsa0JBQWtCO0lBQ3BCO0lBQ0E7R0FDRjtHQUVBLElBQUksQ0FBQyxhQUNILE9BQU87RUFFWDtFQUVBLE9BQU87Q0FDVDtDQUVBLFNBQVMseUJBQXlCLFdBQXdDO0VBQ3hFLE9BQ0UsVUFBVSxhQUFhLGlCQUN2QixVQUFVLGFBQWEsYUFDdkIsa0JBQWtCLFVBQVUsYUFBYSxzQkFBc0IsS0FDL0Qsa0JBQWtCLFVBQVUsYUFBYSw2QkFBNkI7Q0FFMUU7Q0FFQSxTQUFTLHVCQUF1QixXQUF3QztFQUN0RSxPQUNFLFVBQVUsYUFBYSxvQkFDdEIscUNBQXFDLEtBQUssVUFBVSxRQUFRLEtBQzNELDhCQUE4QixLQUFLLFVBQVUsV0FBVztDQUU5RDtDQUVBLFNBQVMsa0NBQXNEO0VBQzdELEtBQUssTUFBTSxXQUFXLFNBQVMsaUJBQzdCLGlGQUNGLEdBQUc7R0FDRCxJQUFJLENBQUMsMEJBQTBCLE9BQU8sR0FDcEM7R0FHRixNQUFNLFFBQVEsUUFBUSxhQUFhLEdBQUEsQ0FBSSxLQUFLO0dBQzVDLElBQUksS0FBSyxTQUFTLEtBQUssS0FBSyxTQUFTLEtBQ25DO0dBR0YsSUFBSSxxQkFBcUIsTUFBTSxtQkFBbUIsR0FDaEQsT0FBTztFQUVYO0VBRUEsT0FBTztDQUNUO0NBRUEsU0FBUyw4QkFBa0Q7RUFDekQsS0FBSyxNQUFNLFdBQVcsU0FBUyxpQkFDN0Isa0ZBQ0YsR0FDRSxJQUFJLDBCQUEwQixPQUFPLEdBQ25DLE9BQU87RUFJWCxLQUFLLE1BQU0sV0FBVyxTQUFTLGlCQUM3QixnQ0FDRixHQUFHO0dBQ0QsSUFBSSxDQUFDLDBCQUEwQixPQUFPLEdBQ3BDO0dBR0YsTUFBTSxRQUFRLFFBQVEsYUFBYSxHQUFBLENBQUksS0FBSztHQUM1QyxJQUFJLEtBQUssU0FBUyxNQUFNLEtBQUssU0FBUyxLQUNwQztHQUdGLElBQUkscUJBQXFCLE1BQU0sZUFBZSxHQUM1QyxPQUFPO0VBRVg7RUFFQSxPQUFPO0NBQ1Q7Q0FFQSxTQUFTLG1DQUF1RDtFQUM5RCxLQUFLLE1BQU0sV0FBVyxTQUFTLGlCQUM3Qix1REFDRixHQUFHO0dBQ0QsSUFBSSxDQUFDLDBCQUEwQixPQUFPLEdBQ3BDO0dBR0YsTUFBTSxRQUFRLFFBQVEsYUFBYSxHQUFBLENBQUksS0FBSztHQUM1QyxJQUFJLEtBQUssU0FBUyxLQUFLLEtBQUssU0FBUyxLQUNuQztHQUdGLElBQUkscUJBQXFCLE1BQU0scUJBQXFCLEdBQ2xELE9BQU87RUFFWDtFQUVBLE9BQU87Q0FDVDtDQUVBLFNBQVMsd0JBQ1AsV0FDb0I7RUFDcEIsTUFBTSxlQUNKLFVBQVUsU0FBUyxNQUFNLHVCQUF1QixLQUNoRCxVQUFVLFNBQVMsTUFBTSx5QkFBeUI7RUFDcEQsSUFBSSxjQUFjO0dBQ2hCLE1BQU0sY0FBYywyQkFBMkIsYUFBYSxFQUFFO0dBQzlELElBQUksYUFDRixPQUFPO0VBRVg7RUFFQSxJQUFJLFVBQVUsYUFBYSxxQkFDekIsT0FDRSw2QkFBNkIsVUFBVSxRQUFRLEtBQy9DLDZCQUE2QjtFQUlqQyxJQUFJLFVBQVUsYUFBYSxZQUN6QixPQUNFLDhCQUE4QixVQUFVLFFBQVEsS0FDaEQsOEJBQThCO0VBSWxDLElBQUkseUJBQXlCLFNBQVMsR0FDcEMsT0FDRSxzQkFBc0IsVUFBVSxRQUFRLEtBQ3hDLDJCQUEyQjtFQUkvQixJQUFJLHVCQUF1QixTQUFTLEdBQ2xDLE9BQ0Usc0JBQXNCLFVBQVUsUUFBUSxLQUN4QyxpQ0FBaUM7RUFJckMsTUFBTSxhQUFhLHNCQUFzQixVQUFVLFFBQVE7RUFDM0QsSUFBSSxZQUNGLE9BQU87RUFHVCxJQUNFLFVBQVUsYUFBYSxhQUN2QixrQkFBa0IsVUFBVSxhQUFhLDZCQUE2QixHQUV0RSxPQUFPLDJCQUEyQjtFQUdwQyxJQUNFLFVBQVUsYUFBYSxtQkFDdkIsa0JBQWtCLFVBQVUsYUFBYSxvQkFBb0IsR0FFN0QsT0FBTyxnQ0FBZ0M7RUFHekMsSUFBSSxVQUFVLGFBQWEsZ0JBQ3pCLE9BQ0Usc0JBQXNCLFVBQVUsUUFBUSxLQUN4Qyw0QkFBNEIsS0FDNUIsaUNBQWlDO0VBSXJDLElBQUksVUFBVSxhQUFhLFdBQVc7R0FDcEMsS0FBSyxNQUFNLFdBQVcsU0FBUyxpQkFDN0IsdUJBQ0YsR0FBRztJQUNELE1BQU0sT0FBTyxRQUFRLGFBQWE7SUFDbEMsSUFBSSxLQUFLLFNBQVMsS0FBSyxLQUFLLFNBQVMsS0FDbkM7SUFFRixJQUFJLHFCQUFxQixHQUFHLEtBQUssSUFBSSxRQUFRLGFBQWEsZ0JBQWdCLEdBQ3hFLE9BQU87R0FFWDtHQUVBLE9BQU8sc0JBQXNCLFVBQVUsUUFBUTtFQUNqRDtFQUVBLE9BQU87Q0FDVDtDQUVBLFNBQVMsbUJBQW1CLE1BQW9EO0VBQzlFLE1BQU0sVUFBVSxNQUFNLEtBQUssS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUN0QyxRQUFRLGNBQWM7R0FDckIsTUFBTSxVQUFVLFNBQVMsY0FDdkIsSUFBSSxrQkFBa0IsSUFBSSxVQUFVLEdBQUcsR0FDekM7R0FDQSxPQUFPLG1CQUFtQixlQUFlLDBCQUEwQixPQUFPO0VBQzVFLENBQUMsQ0FBQyxDQUNELE1BQU0sR0FBRyxNQUFNLGFBQWEsRUFBRSxRQUFRLElBQUksYUFBYSxFQUFFLFFBQVEsQ0FBQztFQUVyRSxNQUFNLGFBQWEsUUFBUSxRQUN4QixjQUFjLFVBQVUsZ0JBQWdCLGdCQUMzQztFQUNBLE1BQU0sT0FBTyxRQUFRLFFBQ2xCLGNBQWMsVUFBVSxnQkFBZ0IsZ0JBQzNDO0VBRUEsT0FBTyxDQUFDLEdBQUcsWUFBWSxHQUFHLElBQUksQ0FBQyxDQUFDLE1BQU0sR0FBRyxjQUFjO0NBQ3pEO0NBRUEsU0FBZ0IsK0JBQ2QsVUFDQSxZQUNBLFVBQ2lCO0VBQ2pCLE1BQU0sdUJBQU8sSUFBSSxJQUE0QjtFQUU3QyxLQUFLLE1BQU0sYUFBYSxVQUFVO0dBQ2hDLE1BQU0sVUFBVSxTQUFTLGNBQ3ZCLElBQUksa0JBQWtCLElBQUksVUFBVSxHQUFHLEdBQ3pDO0dBQ0EsSUFBSSxtQkFBbUIsYUFDckIsS0FBSyxJQUFJLFNBQVMsU0FBUztFQUUvQjtFQUVBLE1BQU0sb0JBQW9CLFdBQVcsUUFDbEMsY0FBYyxVQUFVLGFBQWEsbUJBQ3hDO0VBQ0EsTUFBTSxrQkFBa0IsV0FBVyxRQUNoQyxjQUFjLFVBQVUsYUFBYSxtQkFDeEM7RUFFQSxLQUFLLE1BQU0sYUFBYSxDQUFDLEdBQUcsbUJBQW1CLEdBQUcsZUFBZSxHQUFHO0dBQ2xFLE1BQU0sVUFBVSx3QkFBd0IsU0FBUztHQUNqRCxJQUFJLENBQUMsU0FDSDtHQUdGLE1BQU0sU0FBUyxnQkFBZ0IsT0FBTztHQUN0QyxJQUFJLEVBQUUsa0JBQWtCLGNBQ3RCO0dBR0YsTUFBTSxvQkFBb0IsS0FBSyxJQUFJLE1BQU07R0FDekMsSUFBSSxtQkFBbUI7SUFDckIsS0FBSyxJQUFJLFFBQVE7S0FDZixHQUFHO0tBQ0gsYUFBYSxVQUFVO0tBQ3ZCLFVBQVUsVUFBVSxZQUFZLGtCQUFrQjtLQUNsRCxVQUNFLGFBQWEsVUFBVSxRQUFRLElBQy9CLGFBQWEsa0JBQWtCLFFBQVEsSUFDbkMsVUFBVSxXQUNWLGtCQUFrQjtLQUN4QixPQUFPLGtCQUFrQixTQUFTO0lBQ3BDLENBQUM7SUFDRDtHQUNGO0dBRUEsYUFDRSxTQUNBO0lBQ0UsVUFBVSxVQUFVO0lBQ3BCLGFBQWEsVUFBVTtJQUN2QixVQUFVLFVBQVU7SUFDcEIsT0FBTyxrQkFBa0IsU0FBUztJQUNsQyxVQUFVLFVBQVU7R0FDdEIsR0FDQSxVQUNBLElBQ0Y7RUFDRjtFQUVBLE9BQU8sbUJBQW1CLElBQUk7Q0FDaEM7Q0FFQSxTQUFnQixzQkFBc0IsVUFBcUM7RUFDekUsTUFBTSx1QkFBTyxJQUFJLElBQTRCO0VBRTdDLDJCQUEyQixVQUFVLElBQUk7RUFDekMsOEJBQThCLFVBQVUsSUFBSTtFQUM1Qyx5QkFBeUIsVUFBVSxJQUFJO0VBQ3ZDLHNCQUFzQixVQUFVLElBQUk7RUFDcEMsd0JBQXdCLFVBQVUsSUFBSTtFQUV0QyxPQUFPLG1CQUFtQixJQUFJO0NBQ2hDO0NBRUEsU0FBZ0Isd0JBQThCO0VBQzVDLEtBQUssTUFBTSxXQUFXLFNBQVMsaUJBQWlCLElBQUksa0JBQWtCLEVBQUUsR0FDdEUsUUFBUSxnQkFBZ0IsaUJBQWlCO0NBRTdDO0NBRUEsU0FBZ0Isc0JBQTRCO0VBQzFDLEtBQUssTUFBTSxPQUFPLFNBQVMsaUJBQWlCLElBQUksbUJBQW1CLEVBQUUsR0FDbkUsSUFBSSxPQUFPO0NBRWY7OztDQ3A1Q0EsSUFBTSx3QkFBd0I7RUFDNUI7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0NBQ0YsQ0FBQyxDQUFDLEtBQUssR0FBRztDQUVWLElBQU0sa0JBQWtCO0NBQ3hCLElBQU0sa0JBQWtCO0NBV3hCLFNBQWdCLHFCQUFvQztFQUNsRCxNQUFNLFdBQVcsZUFBZSxRQUFRO0VBQ3hDLE1BQU0sZUFBZSxTQUFTLE1BQU0sYUFBYSxHQUFBLENBQUksTUFDbkQsR0FDQSxlQUNGO0VBQ0EsTUFBTSxrQkFBa0IscUJBQXFCO0VBQzdDLE1BQU0sYUFBYSxzQkFBc0IsUUFBUTtFQUNqRCxPQUFPO0dBQ0wsS0FBSyxPQUFPLFNBQVM7R0FDckIsV0FBVyxTQUFTLE1BQU0sTUFBTSxHQUFHLEdBQUc7R0FDdEM7R0FDQTtHQUNBO0dBQ0E7RUFDRjtDQUNGO0NBRUEsU0FBUyx1QkFBK0I7RUFDdEMsTUFBTSxRQUFrQixDQUFDO0VBRXpCLEtBQUssTUFBTSxXQUFXLFNBQVMsaUJBQWlCLHFCQUFxQixHQUFHO0dBQ3RFLElBQUksTUFBTSxLQUFLLElBQUksQ0FBQyxDQUFDLFVBQVUsaUJBQWlCO0dBQ2hELE1BQU0sT0FBTyxRQUFRLFVBQVUsTUFBTSxHQUFHLEdBQUc7R0FDM0MsTUFBTSxLQUFLLElBQUk7RUFDakI7RUFFQSxLQUFLLE1BQU0sV0FBVyxTQUFTLGlCQUE4QixHQUFHLEdBQUc7R0FDakUsSUFBSSxNQUFNLEtBQUssSUFBSSxDQUFDLENBQUMsVUFBVSxpQkFBaUI7R0FDaEQsTUFBTSxRQUFRLE9BQU8saUJBQWlCLE9BQU87R0FDN0MsSUFBSSxNQUFNLGFBQWEsV0FBVyxNQUFNLGFBQWEsVUFDbkQsTUFBTSxLQUNKLDBCQUEwQixNQUFNLFNBQVMsSUFBSSxRQUFRLFVBQVUsTUFBTSxHQUFHLEdBQUcsRUFBRSxPQUMvRTtFQUVKO0VBRUEsT0FBTyxNQUFNLEtBQUssSUFBSSxDQUFDLENBQUMsTUFBTSxHQUFHLGVBQWU7Q0FDbEQ7Q0FFQSxTQUFnQixrQkFBa0IsWUFBb0M7RUFDcEUsTUFBTSxvQkFBb0IsUUFBUSxVQUFVLEtBQUssT0FBTztFQUN4RCxNQUFNLHVCQUF1QixRQUFRLGFBQWEsS0FBSyxPQUFPO0VBRTlELFFBQVEsYUFBYSxHQUFHLFNBQVM7R0FDL0Isa0JBQWtCLEdBQUcsSUFBSTtHQUN6QixXQUFXO0VBQ2I7RUFFQSxRQUFRLGdCQUFnQixHQUFHLFNBQVM7R0FDbEMscUJBQXFCLEdBQUcsSUFBSTtHQUM1QixXQUFXO0VBQ2I7RUFFQSxPQUFPLGlCQUFpQixZQUFZLFVBQVU7RUFFOUMsYUFBYTtHQUNYLFFBQVEsWUFBWTtHQUNwQixRQUFRLGVBQWU7R0FDdkIsT0FBTyxvQkFBb0IsWUFBWSxVQUFVO0VBQ25EO0NBQ0Y7OztDQzVGQSxJQUFNLGtCQUFrQjtDQUN4QixJQUFNLFlBQVk7Q0FFbEIsZUFBc0IsaUJBQ3BCLFdBQVcsV0FDSTtFQUNmLE1BQU0sb0JBQW9CLGVBQWU7RUFFekMsSUFBSSxXQUFXLEdBQ2IsTUFBTSxNQUFNLFFBQVE7Q0FFeEI7Q0FFQSxTQUFTLE1BQU0sSUFBMkI7RUFDeEMsT0FBTyxJQUFJLFNBQVMsWUFBWTtHQUM5QixPQUFPLFdBQVcsU0FBUyxFQUFFO0VBQy9CLENBQUM7Q0FDSDtDQUVBLFNBQVMsb0JBQW9CLFdBQWtDO0VBQzdELElBQUksU0FBUyxlQUFlLFlBQzFCLE9BQU8sUUFBUSxRQUFRO0VBR3pCLE9BQU8sSUFBSSxTQUFTLFlBQVk7R0FDOUIsTUFBTSxlQUFlO0lBQ25CLE9BQU8sYUFBYSxPQUFPO0lBQzNCLFFBQVE7R0FDVjtHQUVBLE1BQU0sVUFBVSxPQUFPLFdBQVcsUUFBUSxTQUFTO0dBQ25ELE9BQU8saUJBQWlCLFFBQVEsUUFBUSxFQUFFLE1BQU0sS0FBSyxDQUFDO0VBQ3hELENBQUM7Q0FDSDs7O0NDekJBLElBQU0sa0JBR0Y7RUFDRixNQUFNO0dBQUUsUUFBUTtHQUFXLFlBQVk7RUFBMEI7RUFDakUsUUFBUTtHQUFFLFFBQVE7R0FBVyxZQUFZO0VBQTBCO0VBQ25FLEtBQUs7R0FBRSxRQUFRO0dBQVcsWUFBWTtFQUEwQjtDQUNsRTtDQUVBLElBQWEsbUJBQWIsTUFBOEI7RUFDNUIsYUFBc0MsQ0FBQztFQUN2QyxVQUFrQjtFQUNsQixjQUEyQztFQUMzQyxvQkFBMkM7RUFDM0MsUUFBK0I7RUFFL0IsS0FBSyxZQUFtQztHQUN0QyxLQUFLLGFBQWE7R0FDbEIsS0FBSyxVQUFVLFdBQVcsU0FBUztHQUNuQyxLQUFLLGVBQWU7R0FDcEIsS0FBSyxPQUFPO0VBQ2Q7RUFFQSxPQUFhO0dBQ1gsS0FBSyxVQUFVO0dBQ2YsS0FBSyxvQkFBb0I7R0FDekIsb0JBQW9CO0dBQ3BCLElBQUksS0FBSyxVQUFVLE1BQU07SUFDdkIscUJBQXFCLEtBQUssS0FBSztJQUMvQixLQUFLLFFBQVE7R0FDZjtFQUNGO0VBRUEsa0JBQWtCLGFBQTJCO0dBQzNDLE1BQU0sVUFBVSxTQUFTLGNBQ3ZCLElBQUksa0JBQWtCLElBQUksWUFBWSxHQUN4QztHQUNBLElBQUksRUFBRSxtQkFBbUIsY0FDdkI7R0FHRixLQUFLLG9CQUFvQjtHQUN6QixRQUFRLGVBQWU7SUFBRSxVQUFVO0lBQVUsT0FBTztHQUFTLENBQUM7R0FDOUQsT0FBTyxpQkFBaUI7SUFDdEIsS0FBSyxPQUFPO0dBQ2QsR0FBRyxHQUFHO0VBQ1I7RUFFQSxpQkFBK0I7R0FDN0IsSUFBSSxLQUFLLGFBQ1A7R0FHRixLQUFLLG9CQUFvQjtJQUN2QixJQUFJLENBQUMsS0FBSyxXQUFXLEtBQUssVUFBVSxNQUNsQztJQUdGLEtBQUssUUFBUSw0QkFBNEI7S0FDdkMsS0FBSyxRQUFRO0tBQ2IsS0FBSyxPQUFPO0lBQ2QsQ0FBQztHQUNIO0dBRUEsU0FBUyxpQkFBaUIsVUFBVSxLQUFLLGFBQWE7SUFDcEQsU0FBUztJQUNULFNBQVM7R0FDWCxDQUFDO0dBQ0QsT0FBTyxpQkFBaUIsVUFBVSxLQUFLLGFBQWEsRUFBRSxTQUFTLEtBQUssQ0FBQztFQUN2RTtFQUVBLFNBQXVCO0dBQ3JCLElBQUksQ0FBQyxLQUFLLFNBQ1I7R0FHRixvQkFBb0I7R0FFcEIsS0FBSyxNQUFNLGFBQWEsS0FBSyxZQUFZO0lBQ3ZDLE1BQU0sVUFBVSxTQUFTLGNBQ3ZCLElBQUksa0JBQWtCLElBQUksVUFBVSxHQUFHLEdBQ3pDO0lBQ0EsSUFBSSxFQUFFLG1CQUFtQixjQUN2QjtJQUVGLElBQUksQ0FBQywwQkFBMEIsT0FBTyxHQUNwQztJQUdGLE1BQU0sT0FBTyxRQUFRLHNCQUFzQjtJQUMzQyxJQUFJLEtBQUssU0FBUyxLQUFLLEtBQUssVUFBVSxHQUNwQztJQUdGLE1BQU0sU0FBUyxnQkFBZ0IsVUFBVTtJQUV6QyxNQUFNLGNBRFcsVUFBVSxPQUFPLEtBQUssb0JBQ1IsSUFBSTtJQUNuQyxNQUFNLFFBQVEsY0FBYztJQUU1QixNQUFNLE1BQU0sU0FBUyxjQUFjLEtBQUs7SUFDeEMsSUFBSSxhQUFhLG9CQUFvQixVQUFVLEVBQUU7SUFDakQsSUFBSSxNQUFNLFVBQVU7S0FDbEI7S0FDQTtLQUNBO0tBQ0E7S0FDQTtLQUNBLFFBQVEsS0FBSyxPQUFPLE1BQU07S0FDMUIsT0FBTyxLQUFLLE1BQU0sTUFBTTtLQUN4QixTQUFTLEtBQUssUUFBUSxRQUFRLEVBQUU7S0FDaEMsVUFBVSxLQUFLLFNBQVMsUUFBUSxFQUFFO0tBQ2xDLFVBQVUsWUFBWSxXQUFXLE9BQU87S0FDeEMsY0FBYyxPQUFPO0lBQ3ZCLENBQUMsQ0FBQyxLQUFLLEdBQUc7SUFFVixNQUFNLFFBQVEsU0FBUyxjQUFjLEtBQUs7SUFDMUMsTUFBTSxjQUFjLFVBQVU7SUFDOUIsTUFBTSxNQUFNLFVBQVU7S0FDcEI7S0FDQTtLQUNBO0tBQ0EsY0FBYyxPQUFPO0tBQ3JCO0tBQ0E7S0FDQTtLQUNBO0tBQ0E7S0FDQTtLQUNBO0tBQ0E7SUFDRixDQUFDLENBQUMsS0FBSyxHQUFHO0lBRVYsSUFBSSxZQUFZLEtBQUs7SUFDckIsU0FBUyxLQUFLLFlBQVksR0FBRztHQUMvQjtFQUNGO0NBQ0Y7Ozs7Q0MvSUEsSUFBYSx3QkFBd0I7RUFDbkM7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0NBQ0Y7O0NBR0EsSUFBYSxpQkFBaUI7RUFFNUI7RUFDQTtFQUNBO0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBRUE7RUFDQTtFQUVBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBRUE7RUFDQTtFQUNBO0VBRUE7RUFDQTtFQUNBO0VBQ0E7Q0FDRjtDQUVBLFNBQWdCLGNBQWMsS0FBa0M7RUFDOUQsSUFBSSxDQUFDLEtBQUssT0FBTztFQUVqQixNQUFNLFFBQVEsSUFBSSxZQUFZO0VBQzlCLEtBQUssTUFBTSxVQUFVLHVCQUNuQixJQUFJLE1BQU0sV0FBVyxNQUFNLEdBQ3pCLE9BQU87RUFJWCxJQUFJO0dBQ0YsT0FBTyxlQUFlLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxRQUFRO0VBQzdDLFFBQVE7R0FDTixPQUFPO0VBQ1Q7Q0FDRjtDQUVBLFNBQWdCLGVBQWUsVUFBMkI7RUFDeEQsTUFBTSxPQUFPLFNBQVMsWUFBWTtFQUNsQyxLQUFLLE1BQU0sWUFBWSxnQkFDckIsSUFBSSxTQUFTLFlBQVksS0FBSyxTQUFTLElBQUksVUFBVSxHQUNuRCxPQUFPO0VBR1gsT0FBTztDQUNUOzs7Q0NjQSxTQUFnQixnQkFBZ0IsS0FBa0M7RUFDaEUsSUFBSSxDQUFDLEtBQUssT0FBTztFQUNqQixJQUFJLENBQUMsSUFBSSxXQUFXLFNBQVMsS0FBSyxDQUFDLElBQUksV0FBVyxVQUFVLEdBQUcsT0FBTztFQUN0RSxPQUFPLENBQUMsY0FBYyxHQUFHO0NBQzNCOzs7Q0N2RkEsSUFBQSxjQUFBO0NBRUEsSUFBQSxrQkFBQSxvQkFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FpR0EsQ0FBQTs7O0NDaEhBLFNBQVNBLFFBQU0sUUFBUSxHQUFHLE1BQU07RUFFL0IsSUFBSSxPQUFPLEtBQUssT0FBTyxVQUFVLE9BQU8sU0FBUyxLQUFLLE1BQU0sS0FBSyxHQUFHLElBQUk7T0FDbkUsT0FBTyxTQUFTLEdBQUcsSUFBSTtDQUM3Qjs7Q0FFQSxJQUFNQyxXQUFTO0VBQ2QsUUFBUSxHQUFHLFNBQVNELFFBQU0sUUFBUSxPQUFPLEdBQUcsSUFBSTtFQUNoRCxNQUFNLEdBQUcsU0FBU0EsUUFBTSxRQUFRLEtBQUssR0FBRyxJQUFJO0VBQzVDLE9BQU8sR0FBRyxTQUFTQSxRQUFNLFFBQVEsTUFBTSxHQUFHLElBQUk7RUFDOUMsUUFBUSxHQUFHLFNBQVNBLFFBQU0sUUFBUSxPQUFPLEdBQUcsSUFBSTtDQUNqRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0VJQSxJQUFNLFVEZmlCLFdBQVcsU0FBUyxTQUFTLEtBQ2hELFdBQVcsVUFDWCxXQUFXOzs7Q0VEZixJQUFJLHlCQUF5QixNQUFNLCtCQUErQixNQUFNO0VBQ3ZFLE9BQU8sYUFBYSxtQkFBbUIsb0JBQW9CO0VBQzNELFlBQVksUUFBUSxRQUFRO0dBQzNCLE1BQU0sdUJBQXVCLFlBQVksQ0FBQyxDQUFDO0dBQzNDLEtBQUssU0FBUztHQUNkLEtBQUssU0FBUztFQUNmO0NBQ0Q7Ozs7O0NBS0EsU0FBUyxtQkFBbUIsV0FBVztFQUN0QyxPQUFPLEdBQUcsU0FBUyxTQUFTLEdBQUcsV0FBaUM7Q0FDakU7OztDQ2RBLElBQU0sd0JBQXdCLE9BQU8sV0FBVyxZQUFZLHFCQUFxQjs7Ozs7O0NBTWpGLFNBQVMsc0JBQXNCLEtBQUs7RUFDbkMsSUFBSTtFQUNKLElBQUksV0FBVztFQUNmLE9BQU8sRUFBRSxNQUFNO0dBQ2QsSUFBSSxVQUFVO0dBQ2QsV0FBVztHQUNYLFVBQVUsSUFBSSxJQUFJLFNBQVMsSUFBSTtHQUMvQixJQUFJLHVCQUF1QixXQUFXLFdBQVcsaUJBQWlCLGFBQWEsVUFBVTtJQUN4RixNQUFNLFNBQVMsSUFBSSxJQUFJLE1BQU0sWUFBWSxHQUFHO0lBQzVDLElBQUksT0FBTyxTQUFTLFFBQVEsTUFBTTtJQUNsQyxPQUFPLGNBQWMsSUFBSSx1QkFBdUIsUUFBUSxPQUFPLENBQUM7SUFDaEUsVUFBVTtHQUNYLEdBQUcsRUFBRSxRQUFRLElBQUksT0FBTyxDQUFDO1FBQ3BCLElBQUksa0JBQWtCO0lBQzFCLE1BQU0sU0FBUyxJQUFJLElBQUksU0FBUyxJQUFJO0lBQ3BDLElBQUksT0FBTyxTQUFTLFFBQVEsTUFBTTtLQUNqQyxPQUFPLGNBQWMsSUFBSSx1QkFBdUIsUUFBUSxPQUFPLENBQUM7S0FDaEUsVUFBVTtJQUNYO0dBQ0QsR0FBRyxHQUFHO0VBQ1AsRUFBRTtDQUNIOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQ1FBLElBQUksdUJBQXVCLE1BQU0scUJBQXFCO0VBQ3JELE9BQU8sOEJBQThCLG1CQUFtQiw0QkFBNEI7RUFDcEY7RUFDQTtFQUNBLGtCQUFrQixzQkFBc0IsSUFBSTtFQUM1QyxZQUFZLG1CQUFtQixTQUFTO0dBQ3ZDLEtBQUssb0JBQW9CO0dBQ3pCLEtBQUssVUFBVTtHQUNmLEtBQUssS0FBSyxLQUFLLE9BQU8sQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDO0dBQzVDLEtBQUssa0JBQWtCLElBQUksZ0JBQWdCO0dBQzNDLEtBQUssZUFBZTtHQUNwQixLQUFLLHNCQUFzQjtFQUM1QjtFQUNBLElBQUksU0FBUztHQUNaLE9BQU8sS0FBSyxnQkFBZ0I7RUFDN0I7RUFDQSxNQUFNLFFBQVE7R0FDYixPQUFPLEtBQUssZ0JBQWdCLE1BQU0sTUFBTTtFQUN6QztFQUNBLElBQUksWUFBWTtHQUNmLElBQUksUUFBUSxTQUFTLE1BQU0sTUFBTSxLQUFLLGtCQUFrQjtHQUN4RCxPQUFPLEtBQUssT0FBTztFQUNwQjtFQUNBLElBQUksVUFBVTtHQUNiLE9BQU8sQ0FBQyxLQUFLO0VBQ2Q7Ozs7Ozs7Ozs7Ozs7OztFQWVBLGNBQWMsSUFBSTtHQUNqQixLQUFLLE9BQU8saUJBQWlCLFNBQVMsRUFBRTtHQUN4QyxhQUFhLEtBQUssT0FBTyxvQkFBb0IsU0FBUyxFQUFFO0VBQ3pEOzs7Ozs7Ozs7Ozs7RUFZQSxRQUFRO0dBQ1AsT0FBTyxJQUFJLGNBQWMsQ0FBQyxDQUFDO0VBQzVCOzs7Ozs7O0VBT0EsWUFBWSxTQUFTLFNBQVM7R0FDN0IsTUFBTSxLQUFLLGtCQUFrQjtJQUM1QixJQUFJLEtBQUssU0FBUyxRQUFRO0dBQzNCLEdBQUcsT0FBTztHQUNWLEtBQUssb0JBQW9CLGNBQWMsRUFBRSxDQUFDO0dBQzFDLE9BQU87RUFDUjs7Ozs7OztFQU9BLFdBQVcsU0FBUyxTQUFTO0dBQzVCLE1BQU0sS0FBSyxpQkFBaUI7SUFDM0IsSUFBSSxLQUFLLFNBQVMsUUFBUTtHQUMzQixHQUFHLE9BQU87R0FDVixLQUFLLG9CQUFvQixhQUFhLEVBQUUsQ0FBQztHQUN6QyxPQUFPO0VBQ1I7Ozs7Ozs7O0VBUUEsc0JBQXNCLFVBQVU7R0FDL0IsTUFBTSxLQUFLLHVCQUF1QixHQUFHLFNBQVM7SUFDN0MsSUFBSSxLQUFLLFNBQVMsU0FBUyxHQUFHLElBQUk7R0FDbkMsQ0FBQztHQUNELEtBQUssb0JBQW9CLHFCQUFxQixFQUFFLENBQUM7R0FDakQsT0FBTztFQUNSOzs7Ozs7OztFQVFBLG9CQUFvQixVQUFVLFNBQVM7R0FDdEMsTUFBTSxLQUFLLHFCQUFxQixHQUFHLFNBQVM7SUFDM0MsSUFBSSxDQUFDLEtBQUssT0FBTyxTQUFTLFNBQVMsR0FBRyxJQUFJO0dBQzNDLEdBQUcsT0FBTztHQUNWLEtBQUssb0JBQW9CLG1CQUFtQixFQUFFLENBQUM7R0FDL0MsT0FBTztFQUNSO0VBQ0EsaUJBQWlCLFFBQVEsTUFBTSxTQUFTLFNBQVM7R0FDaEQsSUFBSSxTQUFTO1FBQ1IsS0FBSyxTQUFTLEtBQUssZ0JBQWdCLElBQUk7R0FBQTtHQUU1QyxPQUFPLG1CQUFtQixLQUFLLFdBQVcsTUFBTSxJQUFJLG1CQUFtQixJQUFJLElBQUksTUFBTSxTQUFTO0lBQzdGLEdBQUc7SUFDSCxRQUFRLEtBQUs7R0FDZCxDQUFDO0VBQ0Y7Ozs7O0VBS0Esb0JBQW9CO0dBQ25CLEtBQUssTUFBTSxvQ0FBb0M7R0FDL0MsU0FBTyxNQUFNLG1CQUFtQixLQUFLLGtCQUFrQixzQkFBc0I7RUFDOUU7RUFDQSxpQkFBaUI7R0FDaEIsU0FBUyxjQUFjLElBQUksWUFBWSxxQkFBcUIsNkJBQTZCLEVBQUUsUUFBUTtJQUNsRyxtQkFBbUIsS0FBSztJQUN4QixXQUFXLEtBQUs7R0FDakIsRUFBRSxDQUFDLENBQUM7R0FDSixJQUFJLENBQUMsS0FBSyxTQUFTLDRCQUE0QixPQUFPLFlBQVk7SUFDakUsTUFBTSxxQkFBcUI7SUFDM0IsbUJBQW1CLEtBQUs7SUFDeEIsV0FBVyxLQUFLO0dBQ2pCLEdBQUcsR0FBRztFQUNQO0VBQ0EseUJBQXlCLE9BQU87R0FDL0IsTUFBTSxzQkFBc0IsTUFBTSxRQUFRLHNCQUFzQixLQUFLO0dBQ3JFLE1BQU0sYUFBYSxNQUFNLFFBQVEsY0FBYyxLQUFLO0dBQ3BELE9BQU8sdUJBQXVCLENBQUM7RUFDaEM7RUFDQSx3QkFBd0I7R0FDdkIsTUFBTSxNQUFNLFVBQVU7SUFDckIsSUFBSSxFQUFFLGlCQUFpQixnQkFBZ0IsQ0FBQyxLQUFLLHlCQUF5QixLQUFLLEdBQUc7SUFDOUUsS0FBSyxrQkFBa0I7R0FDeEI7R0FDQSxTQUFTLGlCQUFpQixxQkFBcUIsNkJBQTZCLEVBQUU7R0FDOUUsS0FBSyxvQkFBb0IsU0FBUyxvQkFBb0IscUJBQXFCLDZCQUE2QixFQUFFLENBQUM7RUFDNUc7Q0FDRCJ9