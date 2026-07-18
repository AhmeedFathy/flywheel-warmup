(function (root, factory) {
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  if (root) root.PreflightEngine = engine;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RULES = {
    R1: {
      id: "R1",
      title: "Unsupported quantified or medical claim",
      severity: "high",
      kind: "Finding",
      suggestion: "Add a citation or soften the claim."
    },
    R2: {
      id: "R2",
      title: "Absolute or unsafe-certainty language",
      severity: "high",
      kind: "Finding",
      suggestion: "Replace absolute language with qualified, evidence-based phrasing."
    },
    R3: {
      id: "R3",
      title: "Procedure or substance without safety framing",
      severity: "high",
      kind: "Finding",
      suggestion: "Add a note recommending professional consultation and naming the real risks."
    },
    R4: {
      id: "R4",
      title: "Before/after claim without a timeframe",
      severity: "medium",
      kind: "Finding",
      suggestion: "Add a specific timeframe so the claim is falsifiable and honest."
    },
    R5: {
      id: "R5",
      title: "Missing source or date signal",
      severity: "low",
      kind: "Advisory proxy",
      suggestion: "Confirm the article has a visible publish/update date and author byline; pasted body text cannot prove that structure."
    },
    R6: {
      id: "R6",
      title: "FAQ-readiness opportunity",
      severity: "low",
      kind: "Opportunity",
      suggestion: "Confirm a concise, direct-answer sentence follows within the next sentence or two; that is what AI search tools can extract for citations."
    }
  };

  const CLAIM_SIGNAL = /\d+(?:\.\d+)?%|\b(?:clinically proven|studies show|science shows|proven to)\b/i;
  const CITATION_SIGNAL = /https?:\/\/\S+|www\.\S+|\b(?:according to|study by|research from)\b|\(source\b|\[\d+\]/i;
  const ABSOLUTE_SIGNAL = /\b(?:guaranteed|100% safe|no risk|zero side effects|completely safe|permanent results|never fails|always works|instant results|risk-free)\b/i;
  const CURE_CLAIM = /\b(?:(?:this|it|the\s+(?:treatment|product|program|method|routine|supplement|procedure))\s+(?:can\s+|will\s+)?cures?|cures?\s+(?:acne|hair loss|baldness|disease|condition|problem))\b/i;
  const SUBSTANCE_SIGNAL = /\b(?:Accutane|isotretinoin|testosterone|TRT|steroids?|fillers?|Botox|minoxidil|finasteride|surgery|rhinoplasty|Aqualyx|injections?)\b/gi;
  const SAFETY_SIGNAL = /\b(?:consult|doctor|dermatologist|physician|licensed|professional|risk|side effects?)\b/i;
  const TRANSFORMATION_SIGNAL = /\b(?:before\s+and\s+after|transformation)\b/i;
  const TIMEFRAME_SIGNAL = /\b\d+\s*(?:days?|weeks?|months?)\b/i;
  const YEAR_SIGNAL = /\b(?:19|20)\d{2}\b/;

  function normalizeText(value) {
    return String(value || "").replace(/\r\n?/g, "\n").trim();
  }

  function splitSentences(text) {
    const normalized = normalizeText(text).replace(/\n+/g, " ");
    if (!normalized) return [];
    return normalized
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'([])/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
  }

  function splitParagraphs(text) {
    return normalizeText(text)
      .split(/\n\s*\n+/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  function compactQuote(value, maxLength) {
    const clean = String(value || "").replace(/\s+/g, " ").trim();
    const limit = maxLength || 220;
    return clean.length <= limit ? clean : clean.slice(0, limit - 1).trimEnd() + "…";
  }

  function finding(ruleId, quote, detail) {
    const rule = RULES[ruleId];
    return {
      ruleId: rule.id,
      rule: rule.title,
      severity: rule.severity,
      kind: rule.kind,
      quote: compactQuote(quote),
      detail: detail || "",
      suggestion: rule.suggestion
    };
  }

  function runPreflight(input) {
    const text = normalizeText(input);
    if (!text) return { findings: [], evaluatedRules: Object.keys(RULES).length, empty: true };

    const findings = [];
    const sentences = splitSentences(text);

    sentences.forEach((sentence, index) => {
      const nextSentence = sentences[index + 1] || "";
      const twoSentenceWindow = sentence + " " + nextSentence;

      if (CLAIM_SIGNAL.test(sentence) && !CITATION_SIGNAL.test(twoSentenceWindow)) {
        findings.push(finding("R1", sentence));
      }

      if (ABSOLUTE_SIGNAL.test(sentence) || CURE_CLAIM.test(sentence)) {
        findings.push(finding("R2", sentence));
      }

      if (TRANSFORMATION_SIGNAL.test(sentence) && !TIMEFRAME_SIGNAL.test(twoSentenceWindow)) {
        findings.push(finding("R4", sentence));
      }

      if (/\?\s*["')\]]*$/.test(sentence)) {
        findings.push(finding("R6", sentence));
      }
    });

    splitParagraphs(text).forEach((paragraph) => {
      const terms = paragraph.match(SUBSTANCE_SIGNAL) || [];
      if (terms.length && !SAFETY_SIGNAL.test(paragraph)) {
        const uniqueTerms = [...new Set(terms.map((term) => term.toLowerCase()))];
        findings.push(finding("R3", paragraph, "Matched: " + uniqueTerms.join(", ")));
      }
    });

    if (!YEAR_SIGNAL.test(text)) {
      findings.push(finding("R5", "Whole-document structural check"));
    }

    const order = { high: 0, medium: 1, low: 2 };
    findings.sort((a, b) => order[a.severity] - order[b.severity]);

    return {
      findings,
      evaluatedRules: Object.keys(RULES).length,
      empty: false
    };
  }

  return {
    RULES,
    runPreflight,
    splitSentences
  };
});
