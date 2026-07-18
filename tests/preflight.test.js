"use strict";

const assert = require("node:assert/strict");
const { runPreflight } = require("../preflight.js");

function count(result, ruleId) {
  return result.findings.filter((item) => item.ruleId === ruleId).length;
}

const fixtures = [
  {
    name: "R1 flags an uncited percentage claim",
    input: "This treatment reduces redness by 60% in just 3 days.",
    check: (result) => assert.equal(count(result, "R1"), 1)
  },
  {
    name: "R1 accepts a citation signal",
    input: "According to a 2024 clinical trial published in JAMA Dermatology, this treatment reduces redness by 60% over 3 days.",
    check: (result) => assert.equal(count(result, "R1"), 0)
  },
  {
    name: "R2 groups multiple absolute claims into one sentence finding",
    input: "Our program guarantees 100% safe, permanent results with zero side effects.",
    check: (result) => assert.equal(count(result, "R2"), 1)
  },
  {
    name: "R3 flags testosterone without safety framing",
    input: "Many users report taking testosterone boosters for faster gains.",
    check: (result) => assert.equal(count(result, "R3"), 1)
  },
  {
    name: "R3 accepts same-paragraph professional safety framing",
    input: "Before starting any testosterone therapy, consult a licensed physician to discuss the risks and side effects.",
    check: (result) => assert.equal(count(result, "R3"), 0)
  },
  {
    name: "R4 flags a transformation without a timeframe",
    input: "Look at this insane transformation!",
    check: (result) => assert.equal(count(result, "R4"), 1)
  },
  {
    name: "R4 accepts a transformation with a timeframe",
    input: "Look at this transformation after 12 weeks of consistent training and diet.",
    check: (result) => assert.equal(count(result, "R4"), 0)
  },
  {
    name: "R6 presents a question as an opportunity",
    input: "What is mewing?",
    check: (result) => {
      assert.equal(count(result, "R6"), 1);
      assert.equal(result.findings.find((item) => item.ruleId === "R6").kind, "Opportunity");
    }
  },
  {
    name: "R5 appears once when no year is present",
    input: "A careful draft with no date reference in its body.",
    check: (result) => assert.equal(count(result, "R5"), 1)
  }
];

for (const fixture of fixtures) {
  fixture.check(runPreflight(fixture.input));
  console.log("PASS:", fixture.name);
}

const boundaryCases = [
  {
    name: "citation in the following sentence suppresses R1",
    input: "Studies show this routine improves hydration by 40%. Research from a 2023 university trial supports the estimate.",
    check: (result) => assert.equal(count(result, "R1"), 0)
  },
  {
    name: "substance matching is case-insensitive",
    input: "Some forums recommend FINASTERIDE for hair loss.",
    check: (result) => assert.equal(count(result, "R3"), 1)
  },
  {
    name: "repeated substances in one paragraph produce one R3 finding",
    input: "Testosterone and TRT are often discussed together. Some users also mention testosterone boosters.",
    check: (result) => assert.equal(count(result, "R3"), 1)
  },
  {
    name: "safety framing does not leak across paragraphs",
    input: "Consult a licensed physician before making medical decisions.\n\nMany users recommend Accutane for quick results.",
    check: (result) => assert.equal(count(result, "R3"), 1)
  },
  {
    name: "a visible year suppresses the structural proxy",
    input: "Updated in 2025 after editorial review.",
    check: (result) => assert.equal(count(result, "R5"), 0)
  },
  {
    name: "a clean dated statement returns no configured findings",
    input: "This guide was reviewed in 2025 and describes a basic grooming routine.",
    check: (result) => assert.equal(result.findings.length, 0)
  }
];

for (const fixture of boundaryCases) {
  fixture.check(runPreflight(fixture.input));
  console.log("PASS:", fixture.name);
}

console.log(`All ${fixtures.length} required fixtures and ${boundaryCases.length} boundary cases passed.`);
