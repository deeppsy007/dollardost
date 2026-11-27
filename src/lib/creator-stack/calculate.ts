import type {
  AlternativeRoute,
  ComplianceItem,
  ComplianceRule,
  CreatorStackInput,
  CreatorStackResult,
  FeeBasis,
  FeeCurrency,
  FxRate,
  IncomeSource,
  IncomeSourceResult,
  LeakItem,
  PaymentFeeModel,
  PaymentRoute,
} from "./types";

const EPSILON = 1e-9;

function fail(message: string): never {
  throw new Error(message);
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) fail(`${label} must be a finite number.`);
  return value;
}

function nonNegative(value: number, label: string): number {
  finite(value, label);
  if (value < 0) fail(`${label} cannot be negative.`);
  return value;
}

function positive(value: number, label: string): number {
  finite(value, label);
  if (value <= 0) fail(`${label} must be greater than zero.`);
  return value;
}

function currencyCode(value: string, label: string): string {
  if (!/^[A-Za-z]{3}$/.test(value)) {
    fail(`${label} must be a three-letter currency code.`);
  }
  return value.toUpperCase();
}

function countryCode(value: string, label: string): string {
  if (!/^[A-Za-z]{2}$/.test(value)) {
    fail(`${label} must be a two-letter country code.`);
  }
  return value.toUpperCase();
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function rateToReporting(
  currency: string,
  reportingCurrency: string,
  rates: Record<string, FxRate>,
): { rate: number; isEstimate: boolean } {
  const from = currencyCode(currency, "Source currency");
  const to = currencyCode(reportingCurrency, "Reporting currency");

  if (from === to) return { rate: 1, isEstimate: false };

  const key = `${from}_${to}`;
  const entry = rates[key];

  if (!entry) fail(`Missing FX rate ${key}. Add it to fxRatesToReporting.`);

  const rate = positive(entry.rate, `FX rate ${key}`);
  return {
    rate,
    isEstimate: entry.verificationStatus !== "verified",
  };
}

function validateRoute(route: PaymentRoute, sourceCurrency: string): void {
  if (!route.providerName.trim()) fail("Payment route provider name is required.");

  countryCode(route.payoutCountryCode, "Payout country");
  currencyCode(route.payoutCurrency, "Payout currency");

  positive(route.referenceExchangeRate, `${route.providerName} reference FX rate`);
  finite(route.fxMarkupPercent, `${route.providerName} FX markup`);

  if (route.fxMarkupPercent < 0 || route.fxMarkupPercent >= 100) {
    fail(`${route.providerName} FX markup must be at least 0% and below 100%.`);
  }

  if (route.availability === "unavailable") {
    fail(`${route.providerName} route is marked unavailable.`);
  }

  // Validate the source currency even when a fee model is empty.
  currencyCode(sourceCurrency, "Income source currency");
}

function validatePercent(percent: number, label: string): void {
  finite(percent, label);
  if (percent < 0 || percent > 100) {
    fail(`${label} must be between 0% and 100%.`);
  }
}

function validateFeeComponent(
  percent: number,
  fixed: number,
  label: string,
): void {
  validatePercent(percent, `${label} percentage`);
  nonNegative(fixed, `${label} fixed fee`);
}

interface FeeSelection {
  percentageFee: { percent: number; basis: FeeBasis };
  fixedFee: { amount: number; currency: FeeCurrency };
}

function selectPaymentFee(
  model: PaymentFeeModel,
  sourceAmount: number,
  payoutAmount: number,
): FeeSelection | null {
  if (model.kind === "none") return null;

  if (model.kind === "percentage_plus_fixed") {
    return {
      percentageFee: model.percentageFee,
      fixedFee: model.fixedFee,
    };
  }

  if (model.kind === "tiered") {
    if (!Array.isArray(model.tiers) || model.tiers.length === 0) {
      fail("Tiered payment fee requires at least one tier.");
    }

    let previousThreshold = -Infinity;

    for (let index = 0; index < model.tiers.length; index++) {
      const tier = model.tiers[index];

      if (tier.upToAmount === undefined) {
        if (index !== model.tiers.length - 1) {
          fail("The open-ended payment fee tier must be the final tier.");
        }
        continue;
      }

      positive(tier.upToAmount, "Payment fee tier threshold");

      if (tier.upToAmount <= previousThreshold) {
        fail("Payment fee tier thresholds must be strictly increasing.");
      }

      previousThreshold = tier.upToAmount;
    }

    if (model.tiers[model.tiers.length - 1].upToAmount !== undefined) {
      fail("Tiered payment fee needs a final open-ended tier.");
    }

    const selected = model.tiers.find((tier) => {
      const basis =
        tier.thresholdBasis === "source_amount" ? sourceAmount : payoutAmount;
      return tier.upToAmount === undefined || basis <= tier.upToAmount;
    });

    if (!selected) fail("No payment fee tier matches this transaction.");

    return {
      percentageFee: selected.percentageFee,
      fixedFee: selected.fixedFee,
    };
  }

  // Runtime guard for unsupported models such as variable/SWIFT deductions.
  fail("This payment fee is variable or unsupported. Enter a manual fee first.");
}

interface RouteCalculation {
  referenceConverted: number;
  fxCost: number;
  processingFee: number;
  received: number;
  payoutCurrency: string;
  isEstimate: boolean;
}

function calculateRoute(
  sourceAmount: number,
  sourceCurrency: string,
  route: PaymentRoute,
): RouteCalculation {
  validateRoute(route, sourceCurrency);

  const referenceRate = route.referenceExchangeRate;
  const providerRate = referenceRate * (1 - route.fxMarkupPercent / 100);

  positive(providerRate, `${route.providerName} effective FX rate`);

  const referenceConverted = sourceAmount * referenceRate;
  const payoutBeforeFees = sourceAmount * providerRate;
  const fxCost = referenceConverted - payoutBeforeFees;

  const selectedFee = selectPaymentFee(
    route.processingFee,
    sourceAmount,
    payoutBeforeFees,
  );

  let sourcePercentageFee = 0;
  let payoutPercentageFee = 0;
  let sourceFixedFee = 0;
  let payoutFixedFee = 0;

  if (selectedFee) {
    const { percentageFee, fixedFee } = selectedFee;

    validatePercent(
      percentageFee.percent,
      `${route.providerName} processing fee`,
    );
    nonNegative(fixedFee.amount, `${route.providerName} fixed processing fee`);

    if (percentageFee.basis === "source_amount") {
      sourcePercentageFee = sourceAmount * percentageFee.percent / 100;
    } else {
      payoutPercentageFee = payoutBeforeFees * percentageFee.percent / 100;
    }

    if (fixedFee.currency === "source") {
      sourceFixedFee = fixedFee.amount;
    } else {
      payoutFixedFee = fixedFee.amount;
    }
  }

  const sourceFees = sourcePercentageFee + sourceFixedFee;

  if (sourceFees > sourceAmount + EPSILON) {
    fail(`${route.providerName} processing fees exceed the available source amount.`);
  }

  const sourceFeesInPayout = sourceFees * providerRate;
  const processingFee =
    sourceFeesInPayout + payoutPercentageFee + payoutFixedFee;

  if (processingFee > payoutBeforeFees + EPSILON) {
    fail(`${route.providerName} processing fees exceed the available payout.`);
  }

  const received = payoutBeforeFees - processingFee;

  if (received < -EPSILON) {
    fail(`${route.providerName} fees produce a negative payout.`);
  }

  return {
    referenceConverted,
    fxCost,
    processingFee,
    received,
    payoutCurrency: route.payoutCurrency.toUpperCase(),
    isEstimate: route.verificationStatus !== "verified",
  };
}

function platformDeduction(
  source: IncomeSource,
  sourceAmount: number,
  providerRate: number,
  sourceToReportingRate: number,
  payoutToReportingRate: number,
): {
  feeInSourceCurrency: number;
  remainingSourceAmount: number;
  feeReporting: number;
} {
  const percent = source.platformFeePercent;
  const fixed = source.platformFixedFee;

  validatePercent(percent, `${source.name} platform fee`);
  nonNegative(fixed, `${source.name} platform fixed fee`);

  const percentageFee = sourceAmount * percent / 100;
  let sourceFixed = 0;
  let fixedFeeReporting = 0;

  if (source.platformFixedFeeCurrency === "source") {
    sourceFixed = fixed;
    fixedFeeReporting = fixed * sourceToReportingRate;
  } else {
    positive(providerRate, `${source.name} provider FX rate`);
    sourceFixed = fixed / providerRate;
    fixedFeeReporting = fixed * payoutToReportingRate;
  }

  const total = percentageFee + sourceFixed;

  if (total > sourceAmount + EPSILON) {
    fail(`${source.name} platform fees exceed the available amount.`);
  }

  return {
    feeInSourceCurrency: total,
    remainingSourceAmount: sourceAmount - total,
    feeReporting:
      percentageFee * sourceToReportingRate + fixedFeeReporting,
  };
}

function biggestPaymentLeak(
  fxCost: number,
  processingFee: number,
): "fx" | "processing" | "none" {
  if (fxCost <= EPSILON && processingFee <= EPSILON) return "none";
  return fxCost >= processingFee ? "fx" : "processing";
}

function biggestLeak(
  platform: number,
  fx: number,
  processing: number,
): "platform" | "fx" | "processing" | "none" {
  const values = [
    ["platform", platform],
    ["fx", fx],
    ["processing", processing],
  ] as const;

  const largest = values.reduce((a, b) => (b[1] > a[1] ? b : a));
  return largest[1] <= EPSILON ? "none" : largest[0];
}

function ruleMatchesSource(
  rule: ComplianceRule,
  source: IncomeSource,
): boolean {
  const conditions = rule.eligibilityConditions;
  const hasCondition =
    Boolean(conditions.clientCountryCodes?.length) ||
    Boolean(conditions.payoutCountryCodes?.length) ||
    Boolean(conditions.incomeCategories?.length) ||
    conditions.requiresUsSource === true ||
    conditions.requiresNonUsSource === true;

  if (!hasCondition) return false;

  if (
    conditions.clientCountryCodes?.length &&
    !conditions.clientCountryCodes
      .map((v) => v.toUpperCase())
      .includes(source.clientCountryCode.toUpperCase())
  ) return false;

  if (
    conditions.payoutCountryCodes?.length &&
    (!source.paymentRoute ||
      !conditions.payoutCountryCodes
        .map((v) => v.toUpperCase())
        .includes(source.paymentRoute.payoutCountryCode.toUpperCase()))
  ) return false;

  if (
    conditions.incomeCategories?.length &&
    !conditions.incomeCategories.includes(source.category)
  ) return false;

  if (conditions.requiresUsSource === true && source.isUsSource !== true) {
    return false;
  }

  if (
    conditions.requiresNonUsSource === true &&
    source.isUsSource !== false
  ) return false;

  return true;
}

function buildCompliance(
  rules: ComplianceRule[] | undefined,
  sources: IncomeSource[],
): ComplianceItem[] {
  if (!rules?.length) return [];

  const result: ComplianceItem[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    if (seen.has(rule.id)) continue;

    // Verified status alone is insufficient without traceable provenance.
    if (
      rule.verificationStatus !== "verified" ||
      !rule.source?.trim() ||
      !rule.sourceUrl?.trim() ||
      !rule.lastChecked?.trim()
    ) continue;

    if (!sources.some((source) => ruleMatchesSource(rule, source))) continue;

    result.push({
      id: rule.id,
      label: rule.label,
      why: rule.why,
      jurisdiction: rule.jurisdiction,
      appliesComputed: true,
      eligibilityNote: rule.eligibilityNote,
      source: rule.source,
      sourceUrl: rule.sourceUrl,
      lastChecked: rule.lastChecked,
    });

    seen.add(rule.id);
  }

  return result;
}

function validateAlternative(
  source: IncomeSource,
  alternative: AlternativeRoute,
  primaryRoute: PaymentRoute,
): void {
  if (
    countryCode(
      alternative.route.payoutCountryCode,
      "Alternative payout country",
    ) !== countryCode(primaryRoute.payoutCountryCode, "Primary payout country")
  ) {
    fail(
      `${source.name}: alternative route must use the same payout destination country.`,
    );
  }

  if (alternative.route.availability === "unavailable") {
    fail(`${alternative.providerName} alternative route is unavailable.`);
  }

  // Source amount, source currency, amount stage and reporting currency are
  // inherited from this same IncomeSource and CreatorStackInput.
  validateRoute(alternative.route, source.currency);
}

function calculateSource(
  source: IncomeSource,
  input: CreatorStackInput,
): IncomeSourceResult {
  const sourceCurrency = currencyCode(source.currency, `${source.name} currency`);
  const amountCurrency =
    source.amountStage === "net_received"
      ? currencyCode(
          source.receivedCurrency ?? source.currency,
          `${source.name} received currency`,
        )
      : sourceCurrency;

  if (
    source.amountStage === "after_platform" &&
    (source.platformFeePercent > 0 || source.platformFixedFee > 0)
  ) {
    fail(
      `${source.name}: platform fees must be 0 for after_platform. Enter the amount after platform fees, or change stage to contract_amount.`,
    );
  }

  if (
    source.amountStage === "net_received" &&
    (source.platformFeePercent > 0 || source.platformFixedFee > 0)
  ) {
    fail(
      `${source.name}: platform fees must be 0 for net_received.`,
    );
  }

  if (
    source.amountStage === "net_received" &&
    source.paymentRoute !== undefined
  ) {
    fail(
      `${source.name}: paymentRoute must be omitted for net_received. The amount is already received.`,
    );
  }

  const enteredRate = rateToReporting(
    amountCurrency,
    input.reportingCurrency,
    input.fxRatesToReporting,
  );

  const enteredAmountReporting = source.amount * enteredRate.rate;

  if (source.amountStage === "net_received") {
    const receivedCurrency = currencyCode(
      source.receivedCurrency ?? source.currency,
      `${source.name} received currency`,
    );
    const receivedRate = rateToReporting(
      receivedCurrency,
      input.reportingCurrency,
      input.fxRatesToReporting,
    );
    const receivedReporting = source.amount * receivedRate.rate;

    return {
      sourceId: source.id,
      sourceName: source.name,
      category: source.category,
      amountStage: source.amountStage,
      originalAmount: source.amount,
      currency: sourceCurrency,
      receivedCurrency,
      platformFee: 0,
      amountAfterPlatformFees: source.amount,
      referenceConvertedAmount: 0,
      fxCost: 0,
      paymentProcessingFee: 0,
      amountReceived: source.amount,
      payoutCurrency: receivedCurrency,
      enteredAmountReporting,
      platformFeeReportingAmount: 0,
      fxCostReportingAmount: 0,
      processingFeeReportingAmount: 0,
      paymentRouteCostReportingAmount: 0,
      receivedReportingAmount: receivedReporting,
      biggestLeak: "none",
      biggestPaymentLeak: "none",
    };
  }

  if (!source.paymentRoute) {
    fail(`${source.name}: paymentRoute is required unless amountStage is net_received.`);
  }

  const route = source.paymentRoute;
  validateRoute(route, sourceCurrency);

  const providerRate =
    route.referenceExchangeRate * (1 - route.fxMarkupPercent / 100);

  const routePayoutRate = rateToReporting(
    route.payoutCurrency,
    input.reportingCurrency,
    input.fxRatesToReporting,
  );

  let platformFee = 0;
  let platformFeeReporting = 0;
  let amountAfterPlatformFees = source.amount;

  if (source.amountStage === "contract_amount") {
    const deduction = platformDeduction(
      source,
      source.amount,
      providerRate,
      enteredRate.rate,
      routePayoutRate.rate,
    );
    platformFee = deduction.feeInSourceCurrency;
    platformFeeReporting = deduction.feeReporting;
    amountAfterPlatformFees = deduction.remainingSourceAmount;
  } else {
    // after_platform: do not deduct platform fees again.
    nonNegative(source.platformFixedFee, `${source.name} unused platform fixed fee`);
    validatePercent(source.platformFeePercent, `${source.name} unused platform fee`);
  }

  const primary = calculateRoute(
    amountAfterPlatformFees,
    sourceCurrency,
    route,
  );

  // Convert payout-currency values to the stack reporting currency.
  const payoutRate = routePayoutRate;
  const fxCostReporting = primary.fxCost * payoutRate.rate;
  const processingReporting = primary.processingFee * payoutRate.rate;
  const receivedReporting = primary.received * payoutRate.rate;

  let alternativeReceivedReportingAmount: number | undefined;
  let alternativeSavingReportingAmount: number | undefined;

  if (source.alternativeRoute) {
    validateAlternative(source, source.alternativeRoute, route);

    const alternative = calculateRoute(
      amountAfterPlatformFees,
      sourceCurrency,
      source.alternativeRoute.route,
    );

    const alternativePayoutRate = rateToReporting(
      alternative.payoutCurrency,
      input.reportingCurrency,
      input.fxRatesToReporting,
    );

    alternativeReceivedReportingAmount =
      alternative.received * alternativePayoutRate.rate;

    const calculatedSaving =
      alternativeReceivedReportingAmount - receivedReporting;

    alternativeSavingReportingAmount =
      calculatedSaving > EPSILON ? calculatedSaving : undefined;
  }

  const paymentRouteCost = fxCostReporting + processingReporting;


  return {
    sourceId: source.id,
    sourceName: source.name,
    category: source.category,
    amountStage: source.amountStage,
    originalAmount: source.amount,
    currency: sourceCurrency,
    knownContractGrossReportingAmount:
      source.amountStage === "contract_amount"
        ? enteredAmountReporting
        : undefined,
    platformFee,
    amountAfterPlatformFees,
    referenceConvertedAmount: primary.referenceConverted,
    fxCost: primary.fxCost,
    paymentProcessingFee: primary.processingFee,
    amountReceived: primary.received,
    payoutCurrency: primary.payoutCurrency,
    enteredAmountReporting,
    platformFeeReportingAmount: platformFeeReporting,
    fxCostReportingAmount: fxCostReporting,
    processingFeeReportingAmount: processingReporting,
    paymentRouteCostReportingAmount: paymentRouteCost,
    receivedReportingAmount: receivedReporting,
    keepRatePercent:
      source.amountStage === "contract_amount" && enteredAmountReporting > 0
        ? receivedReporting / enteredAmountReporting * 100
        : undefined,
    biggestLeak: biggestLeak(
      platformFeeReporting,
      fxCostReporting,
      processingReporting,
    ),
    biggestPaymentLeak: biggestPaymentLeak(
      fxCostReporting,
      processingReporting,
    ),
    alternativeReceivedReportingAmount,
    alternativeSavingReportingAmount,
  };
}

export function calculateCreatorStack(
  input: CreatorStackInput,
): CreatorStackResult {
  if (!input || !Array.isArray(input.incomeSources) || input.incomeSources.length === 0) {
    fail("Add at least one income source.");
  }

  const reportingCurrency = currencyCode(
    input.reportingCurrency,
    "Reporting currency",
  );

  const ids = new Set<string>();

  for (const source of input.incomeSources) {
    if (!source.id.trim()) fail("Every income source needs an ID.");
    if (ids.has(source.id)) fail(`Duplicate income source ID: ${source.id}`);
    ids.add(source.id);

    if (!source.name.trim()) fail("Every income source needs a name.");
    nonNegative(source.amount, `${source.name} amount`);
    currencyCode(source.currency, `${source.name} currency`);
    countryCode(source.clientCountryCode, `${source.name} client country`);

    validatePercent(source.platformFeePercent, `${source.name} platform fee`);
    nonNegative(source.platformFixedFee, `${source.name} platform fixed fee`);
  }

  const allContractAmounts = input.incomeSources.every(
    (source) => source.amountStage === "contract_amount",
  );

  const tax = input.taxReserve;
  validatePercent(tax.percent, "Tax reserve percentage");

  if (tax.enabled) {
    if (tax.eligibility.status !== "confirmed") {
      fail("Tax reserve blocked: eligibility must be confirmed before applying a reserve.");
    }

    if (tax.presetId) {
      if (tax.verificationStatus !== "verified") {
        fail("Tax preset is not verified. Use a manual user-entered reserve instead.");
      }
      if (tax.eligibility.status !== "confirmed") {
        fail("Tax preset blocked until its eligibility is confirmed.");
      }
    } else if (
      tax.verificationStatus === "unverified" ||
      tax.verificationStatus === "estimate"
    ) {
      fail("Tax reserve needs a verified preset or an explicitly user-entered estimate.");
    }
  }

  if (tax.enabled && tax.base === "gross" && !allContractAmounts) {
    fail(
      "Gross tax base is unavailable for mixed amount stages. Use amount_received or enter all sources as contract_amount.",
    );
  }

  const sourceResults = input.incomeSources.map((source) =>
    calculateSource(source, input),
  );

  const sum = (selector: (result: IncomeSourceResult) => number) =>
    sourceResults.reduce((total, result) => total + selector(result), 0);

  const totalEnteredIncome = sum((r) => r.enteredAmountReporting);
  const totalPlatformFees = sum((r) => r.platformFeeReportingAmount);
  const totalFxCost = sum((r) => r.fxCostReportingAmount);
  const totalPaymentProcessingFees = sum(
    (r) => r.processingFeeReportingAmount,
  );
  const amountBeforeTaxReserve = sum((r) => r.receivedReportingAmount);

  const knownContractGrossIncome = allContractAmounts
    ? totalEnteredIncome
    : undefined;

  const taxReserveBaseAmount = !tax.enabled
    ? 0
    : tax.base === "gross"
      ? knownContractGrossIncome!
      : amountBeforeTaxReserve;

  const estimatedTaxReserve = tax.enabled
    ? taxReserveBaseAmount * tax.percent / 100
    : 0;

  const estimatedTakeHome = amountBeforeTaxReserve - estimatedTaxReserve;

  if (estimatedTaxReserve > amountBeforeTaxReserve + EPSILON) {
    fail("Tax reserve exceeds the amount received.");
  }

  const totalPaymentRouteCosts = totalFxCost + totalPaymentProcessingFees;
  const totalDeductions =
    totalPlatformFees + totalPaymentRouteCosts + estimatedTaxReserve;

  const leakReport: LeakItem[] = [];

  // Payment-route leaks are ranked independently from platform fees.
  const routeLeaks = sourceResults
    .filter((r) => r.paymentRouteCostReportingAmount > EPSILON)
    .sort(
      (a, b) =>
        b.paymentRouteCostReportingAmount -
        a.paymentRouteCostReportingAmount,
    );

  routeLeaks.forEach((result, index) => {
    leakReport.push({
      rank: index + 1,
      sourceId: result.sourceId,
      sourceName: result.sourceName,
      leakType: "payment_route",
      costReporting: roundMoney(result.paymentRouteCostReportingAmount),
      savingReporting:
        result.alternativeSavingReportingAmount !== undefined
          ? roundMoney(result.alternativeSavingReportingAmount)
          : undefined,
      action: result.alternativeSavingReportingAmount !== undefined
        ? "Compare the calculated alternative route before switching."
        : "Compare a verified alternative payment route for this corridor.",
      isEstimate: (() => {
        const source = input.incomeSources.find(
          (item) => item.id === result.sourceId,
        );
        if (!source?.paymentRoute) return true;

        const payoutRate = rateToReporting(
          source.paymentRoute.payoutCurrency,
          reportingCurrency,
          input.fxRatesToReporting,
        );

        const alternativeRoute = source.alternativeRoute?.route;
        let alternativeIsEstimate = false;

        if (alternativeRoute) {
          const alternativePayoutRate = rateToReporting(
            alternativeRoute.payoutCurrency,
            reportingCurrency,
            input.fxRatesToReporting,
          );

          alternativeIsEstimate =
            alternativeRoute.verificationStatus !== "verified" ||
            alternativePayoutRate.isEstimate;
        }

        return (
          source.paymentRoute.verificationStatus !== "verified" ||
          payoutRate.isEstimate ||
          alternativeIsEstimate
        );
      })(),
    });
  });

  // Platform fees are disclosed separately and never ranked as provider leaks.
  sourceResults
    .filter((r) => r.platformFeeReportingAmount > EPSILON)
    .forEach((result) => {
      leakReport.push({
        rank: 0,
        sourceId: result.sourceId,
        sourceName: result.sourceName,
        leakType: "platform",
        costReporting: roundMoney(result.platformFeeReportingAmount),
        action:
          "Platform deduction. It is not recoverable by switching payment providers.",
        isEstimate: (() => {
          const source = input.incomeSources.find(
            (item) => item.id === result.sourceId,
          );
          const preset = source?.platformFeePreset;

          return (
            !preset ||
            preset.verificationStatus !== "verified" ||
            preset.percent !== source.platformFeePercent ||
            preset.fixedFee !== source.platformFixedFee ||
            preset.fixedFeeCurrency !== source.platformFixedFeeCurrency
          );
        })(),
      });
    });
  const complianceChecklist = buildCompliance(
    input.complianceRules,
    input.incomeSources,
  );

  const result: CreatorStackResult = {
    reportingCurrency,
    totalEnteredIncome: roundMoney(totalEnteredIncome),
    totalPlatformFees: roundMoney(totalPlatformFees),
    totalFxCost: roundMoney(totalFxCost),
    totalPaymentProcessingFees: roundMoney(totalPaymentProcessingFees),
    totalPaymentRouteCosts: roundMoney(totalPaymentRouteCosts),
    amountBeforeTaxReserve: roundMoney(amountBeforeTaxReserve),
    taxReserveBaseAmount: roundMoney(taxReserveBaseAmount),
    estimatedTaxReserve: roundMoney(estimatedTaxReserve),
    estimatedTakeHome: roundMoney(estimatedTakeHome),
    totalDeductions: roundMoney(totalDeductions),
    sourceResults: sourceResults.map((r) => ({
      ...r,
      originalAmount: roundMoney(r.originalAmount),
      platformFee: roundMoney(r.platformFee),
      amountAfterPlatformFees: roundMoney(r.amountAfterPlatformFees),
      referenceConvertedAmount: roundMoney(r.referenceConvertedAmount),
      fxCost: roundMoney(r.fxCost),
      paymentProcessingFee: roundMoney(r.paymentProcessingFee),
      amountReceived: roundMoney(r.amountReceived),
      enteredAmountReporting: roundMoney(r.enteredAmountReporting),
      platformFeeReportingAmount: roundMoney(r.platformFeeReportingAmount),
      fxCostReportingAmount: roundMoney(r.fxCostReportingAmount),
      processingFeeReportingAmount: roundMoney(r.processingFeeReportingAmount),
      paymentRouteCostReportingAmount: roundMoney(r.paymentRouteCostReportingAmount),
      receivedReportingAmount: roundMoney(r.receivedReportingAmount),
      knownContractGrossReportingAmount:
        r.knownContractGrossReportingAmount === undefined
          ? undefined
          : roundMoney(r.knownContractGrossReportingAmount),
      alternativeReceivedReportingAmount:
        r.alternativeReceivedReportingAmount === undefined
          ? undefined
          : roundMoney(r.alternativeReceivedReportingAmount),
      alternativeSavingReportingAmount:
        r.alternativeSavingReportingAmount === undefined
          ? undefined
          : roundMoney(r.alternativeSavingReportingAmount),
    })),
    leakReport,
    complianceChecklist,
    ...(knownContractGrossIncome === undefined
      ? {}
      : {
          knownContractGrossIncome: roundMoney(knownContractGrossIncome),
          effectiveDeductionPercent:
            knownContractGrossIncome > 0
              ? roundMoney(totalDeductions / knownContractGrossIncome * 100)
              : undefined,
          keepRatePercent:
            knownContractGrossIncome > 0
              ? roundMoney(estimatedTakeHome / knownContractGrossIncome * 100)
              : undefined,
        }),
    whatIf: {
      enabled: false,
      reason: "What-if projections are not implemented yet.",
    },
    export: {
      enabled: false,
      reason: "Export is not implemented yet.",
    },
  };

  return result;
}
