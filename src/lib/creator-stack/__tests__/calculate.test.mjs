import test from "node:test";
import assert from "node:assert/strict";
import { calculateCreatorStack } from "../calculate.ts";

function makeRoute(overrides = {}) {
  return {
    providerName: "Test Provider",
    payoutCountryCode: "IN",
    payoutCurrency: "INR",
    referenceExchangeRate: 80,
    fxMarkupPercent: 0,
    processingFee: { kind: "none" },
    availability: "available",
    verificationStatus: "verified",
    ...overrides,
  };
}

function makeSource(overrides = {}) {
  return {
    id: "source-1",
    name: "Test Income",
    category: "freelance",
    amount: 100,
    currency: "USD",
    amountStage: "contract_amount",
    platformFeePercent: 0,
    platformFixedFee: 0,
    platformFixedFeeCurrency: "source",
    clientCountryCode: "US",
    paymentRoute: makeRoute(),
    ...overrides,
  };
}

function makeInput(source, overrides = {}) {
  return {
    incomeSources: [source],
    reportingCurrency: "INR",
    taxReserve: {
      enabled: false,
      percent: 0,
      base: "amount_received",
      eligibility: { status: "unknown" },
    },
    fxRatesToReporting: {
      USD_INR: {
        rate: 80,
        verificationStatus: "verified",
      },
    },
    ...overrides,
  };
}

test("net_received converts the received amount without payment deductions", () => {
  const source = makeSource({
    amountStage: "net_received",
    paymentRoute: undefined,
    receivedCurrency: "USD",
  });

  const result = calculateCreatorStack(makeInput(source));
  const row = result.sourceResults[0];

  assert.equal(row.platformFee, 0);
  assert.equal(row.fxCost, 0);
  assert.equal(row.paymentProcessingFee, 0);
  assert.equal(row.amountReceived, 100);
  assert.equal(row.receivedReportingAmount, 8000);
});

test("after_platform rejects a non-zero platform percentage", () => {
  const source = makeSource({
    amountStage: "after_platform",
    platformFeePercent: 10,
  });

  assert.throws(
    () => calculateCreatorStack(makeInput(source)),
    /Test Income: platform fees must be 0 for after_platform/,
  );
});

test("after_platform rejects a non-zero platform fixed fee", () => {
  const source = makeSource({
    amountStage: "after_platform",
    platformFixedFee: 2,
  });

  assert.throws(
    () => calculateCreatorStack(makeInput(source)),
    /Test Income: platform fees must be 0 for after_platform/,
  );
});

test("net_received rejects a non-zero platform percentage", () => {
  const source = makeSource({
    amountStage: "net_received",
    paymentRoute: undefined,
    platformFeePercent: 10,
  });

  assert.throws(
    () => calculateCreatorStack(makeInput(source)),
    /Test Income: platform fees must be 0 for net_received/,
  );
});

test("net_received rejects a non-zero platform fixed fee", () => {
  const source = makeSource({
    amountStage: "net_received",
    paymentRoute: undefined,
    platformFixedFee: 2,
  });

  assert.throws(
    () => calculateCreatorStack(makeInput(source)),
    /Test Income: platform fees must be 0 for net_received/,
  );
});

test("net_received rejects a supplied payment route", () => {
  const source = makeSource({
    amountStage: "net_received",
    platformFeePercent: 0,
    platformFixedFee: 0,
    paymentRoute: makeRoute(),
  });

  assert.throws(
    () => calculateCreatorStack(makeInput(source)),
    /Test Income: paymentRoute must be omitted for net_received/,
  );
});

test("contract_amount applies the payment route", () => {
  const source = makeSource();
  const result = calculateCreatorStack(makeInput(source));
  const row = result.sourceResults[0];

  assert.equal(row.amountReceived, 8000);
  assert.equal(row.receivedReportingAmount, 8000);
  assert.equal(row.paymentRouteCostReportingAmount, 0);
});

test("rejects a NaN income amount", () => {
  const source = makeSource({ amount: Number.NaN });

  assert.throws(
    () => calculateCreatorStack(makeInput(source)),
    /finite number/,
  );
});

test("rejects a negative income amount", () => {
  const source = makeSource({ amount: -1 });

  assert.throws(
    () => calculateCreatorStack(makeInput(source)),
    /cannot be negative/,
  );
});

test("rejects negative FX markup", () => {
  const source = makeSource({
    paymentRoute: makeRoute({ fxMarkupPercent: -0.01 }),
  });

  assert.throws(
    () => calculateCreatorStack(makeInput(source)),
    /FX markup must be at least 0% and below 100%/,
  );
});

test("rejects FX markup of 100 percent", () => {
  const source = makeSource({
    paymentRoute: makeRoute({ fxMarkupPercent: 100 }),
  });

  assert.throws(
    () => calculateCreatorStack(makeInput(source)),
    /FX markup must be at least 0% and below 100%/,
  );
});

test("rejects a missing reporting FX rate", () => {
  const source = makeSource();

  assert.throws(
    () =>
      calculateCreatorStack(
        makeInput(source, { fxRatesToReporting: {} }),
      ),
    /Missing FX rate USD_INR/,
  );
});

test("rejects a zero reporting FX rate", () => {
  const source = makeSource();

  assert.throws(
    () =>
      calculateCreatorStack(
        makeInput(source, {
          fxRatesToReporting: {
            USD_INR: {
              rate: 0,
              verificationStatus: "verified",
            },
          },
        }),
      ),
    /must be greater than zero/,
  );
});

function makeMainFixture() {
  const youtube = makeSource({
    id: "youtube",
    name: "YouTube",
    category: "youtube",
    amount: 1000,
    amountStage: "contract_amount",
    platformFeePercent: 45,
    paymentRoute: makeRoute({
      providerName: "Wise",
      referenceExchangeRate: 88.5,
      fxMarkupPercent: 0.5,
      processingFee: {
        kind: "percentage_plus_fixed",
        percentageFee: { percent: 1, basis: "source_amount" },
        fixedFee: { amount: 0, currency: "source" },
      },
    }),
  });

  const sponsorship = makeSource({
    id: "sponsorship",
    name: "Sponsorship",
    category: "sponsorship",
    amount: 2000,
    amountStage: "after_platform",
    platformFeePercent: 0,
    platformFixedFee: 0,
    paymentRoute: makeRoute({
      providerName: "PayPal",
      referenceExchangeRate: 88.5,
      fxMarkupPercent: 3.5,
      processingFee: {
        kind: "percentage_plus_fixed",
        percentageFee: { percent: 4.4, basis: "source_amount" },
        fixedFee: { amount: 0, currency: "source" },
      },
    }),
  });

  return makeInput(youtube, {
    incomeSources: [youtube, sponsorship],
    fxRatesToReporting: {
      USD_INR: {
        rate: 88.5,
        verificationStatus: "verified",
      },
    },
    taxReserve: {
      enabled: true,
      percent: 10,
      base: "amount_received",
      eligibility: { status: "confirmed" },
      verificationStatus: "verified",
    },
  });
}

test("main two-source example matches expected financial totals and top payment leak", () => {
  const result = calculateCreatorStack(makeMainFixture());

  assert.equal(result.totalEnteredIncome, 265500);
  assert.equal(result.amountBeforeTaxReserve, 211236.89);
  assert.equal(result.estimatedTaxReserve, 21123.69);
  assert.equal(result.estimatedTakeHome, 190113.20);

  const sponsorshipLeak = result.leakReport.find(
    (item) =>
      item.sourceId === "sponsorship" &&
      item.leakType === "payment_route",
  );

  assert.ok(sponsorshipLeak, "Sponsorship payment-route leak should exist");
  assert.equal(sponsorshipLeak.rank, 1);
  assert.equal(sponsorshipLeak.costReporting, 13710.42);
});

test("main example keeps YouTube platform fee separate from payment-route leaks", () => {
  const result = calculateCreatorStack(makeMainFixture());

  const youtubePlatformLeak = result.leakReport.find(
    (item) =>
      item.sourceId === "youtube" &&
      item.leakType === "platform",
  );

  const youtubePaymentLeak = result.leakReport.find(
    (item) =>
      item.sourceId === "youtube" &&
      item.leakType === "payment_route",
  );

  assert.ok(youtubePlatformLeak);
  assert.equal(youtubePlatformLeak.costReporting, 39825);
  assert.ok(youtubePaymentLeak);
  assert.equal(youtubePaymentLeak.costReporting, 727.69);
});

test("INR net_received amount of 100000 has zero fees and remains 100000", () => {
  const source = makeSource({
    amount: 100000,
    currency: "INR",
    amountStage: "net_received",
    receivedCurrency: "INR",
    paymentRoute: undefined,
  });

  const result = calculateCreatorStack(
    makeInput(source, {
      reportingCurrency: "INR",
      fxRatesToReporting: {},
    }),
  );

  const row = result.sourceResults[0];

  assert.equal(row.amountReceived, 100000);
  assert.equal(row.receivedReportingAmount, 100000);
  assert.equal(row.platformFee, 0);
  assert.equal(row.fxCost, 0);
  assert.equal(row.paymentProcessingFee, 0);
  assert.equal(result.estimatedTakeHome, 100000);
});

test("gross tax reserve base rejects mixed amount stages", () => {
  const contractSource = makeSource({
    id: "contract",
    amountStage: "contract_amount",
  });

  const receivedSource = makeSource({
    id: "received",
    amountStage: "net_received",
    paymentRoute: undefined,
  });

  assert.throws(
    () =>
      calculateCreatorStack(
        makeInput(contractSource, {
          incomeSources: [contractSource, receivedSource],
          taxReserve: {
            enabled: true,
            percent: 10,
            base: "gross",
            eligibility: { status: "confirmed" },
            verificationStatus: "verified",
          },
        }),
      ),
    /gross|contract_amount/i,
  );
});

test("payment processing fee greater than available amount throws", () => {
  const source = makeSource({
    paymentRoute: makeRoute({
      processingFee: {
        kind: "percentage_plus_fixed",
        percentageFee: { percent: 100, basis: "source_amount" },
        fixedFee: { amount: 1, currency: "source" },
      },
    }),
  });

  assert.throws(
    () => calculateCreatorStack(makeInput(source)),
    /fees exceed the available/i,
  );
});

test("alternative route with a different payout country throws", () => {
  const source = makeSource({
    alternativeRoute: {
      providerName: "Alternative Provider",
      route: makeRoute({
        providerName: "Alternative Provider",
        payoutCountryCode: "US",
        payoutCurrency: "USD",
      }),
    },
  });

  assert.throws(
    () => calculateCreatorStack(makeInput(source)),
    /same payout destination country/i,
  );
});

test("compliance checklist stays empty when no verified rule is supplied", () => {
  const source = makeSource();

  const result = calculateCreatorStack(
    makeInput(source, {
      complianceRules: [
        {
          id: "unverified-rule",
          label: "Unverified rule",
          why: "Test only",
          jurisdiction: "US",
          eligibilityConditions: {
            clientCountryCodes: ["US"],
          },
          verificationStatus: "unverified",
          source: "Test source",
          sourceUrl: "https://example.com",
          lastChecked: "2026-11-27",
        },
      ],
    }),
  );

  assert.deepEqual(result.complianceChecklist, []);
});

test("main two-source test", () => {
  const input = makeMainFixture();

  // Use the exact reporting FX rate from the manual calculation.
  input.fxRatesToReporting = {
    USD_INR: {
      rate: 88.5,
      verificationStatus: "verified",
    },
  };

  // PayPal remains primary; Wise is the alternative route.
  input.incomeSources[1].alternativeRoute = {
    providerName: "Wise",
    route: makeRoute({
      providerName: "Wise",
      payoutCountryCode: "IN",
      payoutCurrency: "INR",
      referenceExchangeRate: 88.5,
      fxMarkupPercent: 0.5,
      processingFee: {
        kind: "percentage_plus_fixed",
        percentageFee: { percent: 1, basis: "source_amount" },
        fixedFee: { amount: 0, currency: "source" },
      },
    }),
  };

  input.taxReserve = {
    enabled: true,
    percent: 10,
    base: "amount_received",
    eligibility: { status: "confirmed" },
    presetId: "test-verified-10-percent",
    verificationStatus: "verified",
    source: "Test fixture",
    sourceUrl: "https://example.com/test-tax-reserve",
    lastChecked: "2026-11-27",
  };

  input.complianceRules = [];

  const result = calculateCreatorStack(input);

  assert.equal(result.totalEnteredIncome, 265500);
  assert.ok(
    Math.abs(result.amountBeforeTaxReserve - 211236.89) <= 0.02,
    `Expected before-tax amount near 211236.89; received ${result.amountBeforeTaxReserve}`,
  );
  assert.equal(result.estimatedTaxReserve, 21123.69);
  assert.equal(result.estimatedTakeHome, 190113.20);

  assert.equal(result.leakReport[0].sourceId, "sponsorship");
  assert.equal(result.leakReport[0].leakType, "payment_route");
  assert.equal(result.leakReport[0].costReporting, 13710.42);

  const youtubePlatformLeak = result.leakReport.find(
    (item) =>
      item.sourceId === "youtube" &&
      item.leakType === "platform",
  );

  assert.ok(youtubePlatformLeak, "YouTube platform fee must be reported separately");
  assert.equal(youtubePlatformLeak.rank, 0);
  assert.equal(youtubePlatformLeak.costReporting, 39825);

  assert.equal(
    result.leakReport.some(
      (item) =>
        item.sourceId === "youtube" &&
        item.leakType === "payment_route" &&
        item.costReporting === 39825,
    ),
    false,
  );

  assert.deepEqual(result.complianceChecklist, []);
});

test("gross tax base with contract_amount and after_platform stages throws", () => {
  const contractSource = makeSource({
    id: "contract",
    name: "Contract income",
    amountStage: "contract_amount",
  });

  const afterPlatformSource = makeSource({
    id: "after-platform",
    name: "After-platform income",
    amountStage: "after_platform",
    platformFeePercent: 0,
    platformFixedFee: 0,
  });

  assert.throws(
    () =>
      calculateCreatorStack(
        makeInput(contractSource, {
          incomeSources: [contractSource, afterPlatformSource],
          taxReserve: {
            enabled: true,
            percent: 10,
            base: "gross",
            eligibility: { status: "confirmed" },
            presetId: "test-verified-gross",
            verificationStatus: "verified",
            source: "Test fixture",
            sourceUrl: "https://example.com/test-tax-reserve",
            lastChecked: "2026-11-27",
          },
        }),
      ),
    /gross|contract_amount/i,
  );
});

test("processing fee greater than payout throws instead of clamping", () => {
  const source = makeSource({
    paymentRoute: makeRoute({
      processingFee: {
        kind: "percentage_plus_fixed",
        percentageFee: { percent: 0, basis: "source_amount" },
        fixedFee: { amount: 8001, currency: "payout" },
      },
    }),
  });

  assert.throws(
    () => calculateCreatorStack(makeInput(source)),
    /processing fees exceed the available payout|negative payout/i,
  );
});

test("alternative route with a different payout country throws", () => {
  const source = makeSource({
    paymentRoute: makeRoute({
      providerName: "Primary Provider",
      payoutCountryCode: "IN",
      payoutCurrency: "INR",
    }),
    alternativeRoute: {
      providerName: "Alternative Provider",
      route: makeRoute({
        providerName: "Alternative Provider",
        payoutCountryCode: "US",
        payoutCurrency: "USD",
      }),
    },
  });

  assert.throws(
    () => calculateCreatorStack(makeInput(source)),
    /same payout destination country/i,
  );
});

import {
  platformPresets,
  paymentRoutePresets,
  toEnginePlatformPreset,
  toEnginePaymentRoute,
} from "../presets.ts";

test("all current platform presets reject conversion while unverified", () => {
  for (const preset of Object.values(platformPresets)) {
    assert.throws(
      () =>
        toEnginePlatformPreset(preset, {
          percent: 10,
          fixedAmount: 0,
          fixedCurrency: "source",
        }),
      /verified/i,
      preset.id,
    );
  }
});

test("PayPal India route rejects conversion because its provenance is unverified", () => {
  assert.throws(
    () =>
      toEnginePaymentRoute(paymentRoutePresets.paypal_india, 80, 1, {
        kind: "none",
      }),
    /verified/i,
  );
});

test("blank unverified platform draft rejects even when a valid user fee is supplied", () => {
  const blankDraft = {
    ...platformPresets.upwork,
    fee: {
      ...platformPresets.upwork.fee,
      percent: null,
      fixedAmount: null,
      fixedCurrency: null,
    },
  };

  assert.throws(
    () =>
      toEnginePlatformPreset(blankDraft, {
        percent: 10,
        fixedAmount: 0,
        fixedCurrency: "source",
      }),
    /verified/i,
  );
});

test("verified platform draft accepts a user-entered fee", () => {
  const draft = {
    ...platformPresets.upwork,
    verificationStatus: "verified",
  };

  const result = toEnginePlatformPreset(draft, {
    percent: 12,
    fixedAmount: 1,
    fixedCurrency: "source",
  });

  assert.equal(result.percent, 12);
  assert.equal(result.fixedFee, 1);
  assert.equal(result.fixedFeeCurrency, "source");
  assert.equal(result.verificationStatus, "user_entered");
});

test("verified complete platform draft uses its published draft fee", () => {
  const draft = {
    ...platformPresets.upwork,
    verificationStatus: "verified",
    fee: {
      ...platformPresets.upwork.fee,
      percent: 10,
      fixedAmount: 2,
      fixedCurrency: "source",
    },
  };

  const result = toEnginePlatformPreset(draft);

  assert.equal(result.percent, 10);
  assert.equal(result.fixedFee, 2);
  assert.equal(result.verificationStatus, "verified");
});

test("verified platform draft rejects an invalid percentage", () => {
  const draft = {
    ...platformPresets.upwork,
    verificationStatus: "verified",
    fee: {
      ...platformPresets.upwork.fee,
      percent: 150,
      fixedAmount: 0,
      fixedCurrency: "source",
    },
  };

  assert.throws(() => toEnginePlatformPreset(draft), /percentage/i);
});

test("verified platform draft rejects a negative fixed fee", () => {
  const draft = {
    ...platformPresets.upwork,
    verificationStatus: "verified",
    fee: {
      ...platformPresets.upwork.fee,
      percent: 10,
      fixedAmount: -1,
      fixedCurrency: "source",
    },
  };

  assert.throws(() => toEnginePlatformPreset(draft), /fixed fee/i);
});

test("verified payment route accepts a user-entered processing fee", () => {
  const draft = {
    ...paymentRoutePresets.paypal_india,
    verificationStatus: "verified",
    referenceExchangeRate: 80,
    fxMarkupPercent: 1,
  };

  const userFee = {
    kind: "percentage_plus_fixed",
    percentageFee: { percent: 3, basis: "source_amount" },
    fixedFee: { amount: 0.5, currency: "source" },
  };

  const result = toEnginePaymentRoute(draft, undefined, undefined, userFee);

  assert.equal(result.referenceExchangeRate, 80);
  assert.equal(result.fxMarkupPercent, 1);
  assert.deepEqual(result.processingFee, userFee);
  assert.equal(result.verificationStatus, "user_entered");
});

test("verified PayPal draft converts its processing fee using source currency", () => {
  const draft = {
    ...paymentRoutePresets.paypal_india,
    verificationStatus: "verified",
    referenceExchangeRate: 80,
    fxMarkupPercent: 1,
  };

  const result = toEnginePaymentRoute(draft);

  assert.equal(result.processingFee.kind, "percentage_plus_fixed");
  assert.equal(result.processingFee.percentageFee.percent, 4.4);
  assert.equal(result.processingFee.percentageFee.basis, "source_amount");
  assert.equal(result.processingFee.fixedFee.amount, 0.3);
  assert.equal(result.processingFee.fixedFee.currency, "source");
  assert.equal(result.verificationStatus, "verified");
});

test("verified payment route rejects an invalid processing fee percentage", () => {
  const draft = {
    ...paymentRoutePresets.paypal_india,
    verificationStatus: "verified",
    referenceExchangeRate: 80,
    fxMarkupPercent: 1,
    processingFee: {
      ...paymentRoutePresets.paypal_india.processingFee,
      percent: 150,
    },
  };

  assert.throws(() => toEnginePaymentRoute(draft), /percentage/i);
});

test("user-entered payment route rate marks the converted route user-entered", () => {
  const draft = {
    ...paymentRoutePresets.paypal_india,
    verificationStatus: "verified",
    referenceExchangeRate: 80,
    fxMarkupPercent: 1,
  };

  const result = toEnginePaymentRoute(draft, 82);

  assert.equal(result.referenceExchangeRate, 82);
  assert.equal(result.verificationStatus, "user_entered");
});

