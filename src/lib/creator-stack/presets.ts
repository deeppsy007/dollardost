import type {
  FeeBasis,
  FeeCurrency,
  PlatformFeePreset,
  PaymentFeeModel,
  PaymentRoute,
} from "./types";
export type PresetVerificationStatus = "verified" | "unverified";

interface PresetProvenance {
  source: string;
  sourceUrl: string;
  lastChecked: string;
  verificationStatus: PresetVerificationStatus;
}

export interface EditableFeeDraft {
  percent: number | null;
  fixedAmount: number | null;
  fixedCurrency: string | null;
  basis: "contract_amount" | "source_amount" | "payout_amount" | null;
  editable: true;
  warning: string;
}

export interface PlatformPresetDraft extends PresetProvenance {
  id: string;
  provider: string;
  kind: "platform_fee";
  basis: "contract_amount";
  fee: EditableFeeDraft;
  variants?: Array<{
    id: string;
    label: string;
    fee: EditableFeeDraft;
    note: string;
  }>;
  note: string;
}

export interface PaymentRoutePresetDraft extends PresetProvenance {
  id: string;
  provider: string;
  kind: "payment_route";
  corridor: {
    fromCurrency: "USD";
    toCurrency: "INR";
    payoutCountryCode: "IN";
  };
  referenceExchangeRate: number | null;
  fxMarkupPercent: number | null;
  processingFee: EditableFeeDraft;
  eligibilityNote: string;
  note: string;
}

export interface AffiliatePayoutPresetDraft extends PresetProvenance {
  id: string;
  provider: string;
  kind: "affiliate_payout";
  platformFee: null;
  payoutMethodsByMarketplace: Record<string, string[]>;
  editablePayoutMethod: true;
  note: string;
}

export interface TaxPresetDraft extends PresetProvenance {
  id: string;
  label: string;
  kind: "tax_reference";
  eligibility: {
    status: "not_confirmed";
    note: string;
  };
  taxRatePercent: number | null;
  presumptiveIncomePercent: number | null;
  taxBaseNote: string;
  note: string;
}

const LAST_CHECKED = "2026-11-27";

const blankFee = (
  basis: EditableFeeDraft["basis"] = "contract_amount",
): EditableFeeDraft => ({
  percent: null,
  fixedAmount: null,
  fixedCurrency: null,
  basis,
  editable: true,
  warning:
    "No dated official fee schedule was verified. Enter your actual fee or use a clearly labelled estimate. This blank is not a zero-fee claim.",
});

const platformSource = {
  youtube: {
    source: "YouTube Help Center",
    sourceUrl: "https://support.google.com/youtube/answer/72902",
    lastChecked: LAST_CHECKED,
    verificationStatus: "unverified" as const,
  },
  upwork: {
    source: "Upwork Help Center",
    sourceUrl:
      "https://support.upwork.com/hc/en-us/articles/211062538-Learn-about-the-Freelancer-Service-Fee",
    lastChecked: LAST_CHECKED,
    verificationStatus: "unverified" as const,
  },
  fiverr: {
    source: "Fiverr Payment Terms",
    sourceUrl:
      "https://www.fiverr.com/legal-portal/legal-terms/payment-terms-of-service",
    lastChecked: LAST_CHECKED,
    verificationStatus: "unverified" as const,
  },
  gumroad: {
    source: "Gumroad Help Center",
    sourceUrl: "https://gumroad.com/help/article/66-gumroads-fees",
    lastChecked: LAST_CHECKED,
    verificationStatus: "unverified" as const,
  },
  kofi: {
    source: "Ko-fi Help Center",
    sourceUrl:
      "https://help.ko-fi.com/hc/en-us/articles/360002506494-Does-Ko-fi-take-a-fee",
    lastChecked: LAST_CHECKED,
    verificationStatus: "unverified" as const,
  },
};

export const platformPresets = {
  youtube: {
    id: "youtube",
    provider: "YouTube",
    kind: "platform_fee",
    basis: "contract_amount",
    ...platformSource.youtube,
    fee: blankFee(),
    variants: [
      {
        id: "watch_page_ads",
        label: "Watch Page Ads",
        fee: blankFee(),
        note:
          "Separate Watch Page Monetization Module. Do not reuse a Shorts or fan-funding assumption.",
      },
      {
        id: "shorts_pool",
        label: "Shorts Feed Ads",
        fee: blankFee(),
        note:
          "Separate Shorts Creator Pool model. Do not treat it as the Watch Page fee model.",
      },
      {
        id: "fan_funding",
        label: "Fan Funding",
        fee: blankFee(),
        note:
          "Separate Commerce Product Module covering memberships, Super Chat, Super Stickers and Super Thanks.",
      },
    ],
    note:
      "YouTube revenue-share terms differ by module. YouTube Studio estimated revenue may already represent the creator share. Confirm the amount stage before deducting any platform fee.",
  },

  upwork: {
    id: "upwork",
    provider: "Upwork",
    kind: "platform_fee",
    basis: "contract_amount",
    ...platformSource.upwork,
    fee: blankFee(),
    note:
      "Editable per contract and earning type. Enter the actual fee shown in the offer, contract details or transaction history. No universal default is applied.",
  },

  fiverr: {
    id: "fiverr",
    provider: "Fiverr",
    kind: "platform_fee",
    basis: "contract_amount",
    ...platformSource.fiverr,
    fee: blankFee(),
    note:
      "Editable seller deduction. Verify the applicable terms and transaction details before entering a fee.",
  },

  gumroad: {
    id: "gumroad",
    provider: "Gumroad",
    kind: "platform_fee",
    basis: "contract_amount",
    ...platformSource.gumroad,
    fee: blankFee(),
    variants: [
      {
        id: "direct_sales",
        label: "Direct / Profile Sales",
        fee: blankFee(),
        note:
          "Platform fee and payment-processing fee are separate components. Enter each from the applicable current schedule.",
      },
      {
        id: "discover",
        label: "Discover Marketplace",
        fee: blankFee(),
        note:
          "Discover has a distinct fee model that includes processing. Do not add processing a second time.",
      },
    ],
    note:
      "Direct sales and Discover marketplace sales have different fee structures. All values remain editable and unverified until checked against a dated schedule.",
  },

  kofi: {
    id: "kofi",
    provider: "Ko-fi",
    kind: "platform_fee",
    basis: "contract_amount",
    ...platformSource.kofi,
    fee: blankFee(),
    variants: [
      {
        id: "free_one_time_tips",
        label: "Free — One-time Tips",
        fee: blankFee(),
        note: "Keep separate from memberships, monthly tips, shop and commissions.",
      },
      {
        id: "memberships",
        label: "Memberships",
        fee: blankFee(),
        note: "Platform service fee and payment processor fee are separate.",
      },
      {
        id: "commissions",
        label: "Commissions",
        fee: blankFee(),
        note: "Platform service fee and payment processor fee are separate.",
      },
      {
        id: "shop",
        label: "Shop",
        fee: blankFee(),
        note: "Platform service fee and payment processor fee are separate.",
      },
    ],
    note:
      "Ko-fi Free and Standard have different fee treatment. Payments go directly to the connected PayPal or Stripe account; processor fees must be entered separately.",
  },
} satisfies Record<string, PlatformPresetDraft>;

export const amazonAssociatesPreset: AffiliatePayoutPresetDraft = {
  id: "amazon_associates",
  provider: "Amazon Associates",
  kind: "affiliate_payout",
  source: "Amazon Associates Help",
  sourceUrl:
    "https://affiliate-program.amazon.in/help/node/topic/GGD9H76RMDDNEWAE",
  lastChecked: LAST_CHECKED,
  verificationStatus: "unverified",
  platformFee: null,
  payoutMethodsByMarketplace: {
    IN: ["direct_deposit", "cheque"],
    US: ["direct_deposit", "gift_card", "cheque"],
  },
  editablePayoutMethod: true,
  note:
    "No platform-fee deduction is configured. Affiliate commission rates are earnings, not platform fees, and vary by marketplace and product category. Payout methods are marketplace-specific; confirm the current marketplace account options.",
};

const routeSource = {
  wise: {
    source: "Wise India — Receiving Money",
    sourceUrl: "https://wise.com/in/pricing/receive",
    lastChecked: LAST_CHECKED,
    verificationStatus: "unverified" as const,
  },
  paypal: {
    source: "PayPal India — Merchant Fees",
    sourceUrl: "https://www.paypal.com/in/business/paypal-business-fees",
    lastChecked: LAST_CHECKED,
    verificationStatus: "unverified" as const,
  },
  payoneer: {
    source: "Payoneer India — Pricing",
    sourceUrl: "https://www.payoneer.com/en-in/about/pricing/",
    lastChecked: LAST_CHECKED,
    verificationStatus: "unverified" as const,
  },
  skydo: {
    source: "Skydo — Fees and Charges",
    sourceUrl: "https://www.skydo.com/faqs/fees?q=how-much-does-skydo-charge",
    lastChecked: LAST_CHECKED,
    verificationStatus: "unverified" as const,
  },
};

const corridor = {
  fromCurrency: "USD" as const,
  toCurrency: "INR" as const,
  payoutCountryCode: "IN" as const,
};

export const paymentRoutePresets = {
  wise: {
    id: "wise_usd_inr",
    provider: "Wise",
    kind: "payment_route",
    ...routeSource.wise,
    corridor,
    referenceExchangeRate: null,
    fxMarkupPercent: null,
    processingFee: blankFee("source_amount"),
    eligibilityNote:
      "Wise states that receiving money for Indian residents is currently a business-customer feature. Indian business verification and supported account details are required. Confirm the user's account type and USD receiving eligibility.",
    note:
      "Use a current reference rate and the actual Wise conversion/eFIRC fee for the transaction. Do not assume a universal Wise FX markup or processing fee.",
  },

  paypal_india: {
    id: "paypal_india_usd_inr",
    provider: "PayPal India",
    kind: "payment_route",
    ...routeSource.paypal,
    corridor,
    referenceExchangeRate: null,
    fxMarkupPercent: null,
    processingFee: {
      percent: 4.4,
      fixedAmount: 0.30,
      fixedCurrency: "source",
      basis: "source_amount",
      editable: true,
      warning:
        "Dated PayPal India merchant schedule: page last updated 28 March 2024. The published international commercial rate is 4.40% plus a fixed fee; USD fixed fee is USD 0.30. Confirm current account terms before use. FX conversion is separate and remains blank.",
    },
    eligibilityNote:
      "This schedule applies to PayPal accounts registered in India receiving international commercial transactions. PayPal states that India users only receive international payments. Confirm transaction type and account eligibility.",
    note:
      "Processing fee is separate from the exchange-rate conversion cost. Do not treat the 4.4% processing fee as the FX markup. Processing fee sourced, FX markup and reference rate are blank, so route as a whole is unverified.",
  },

  payoneer: {
    id: "payoneer_usd_inr",
    provider: "Payoneer",
    kind: "payment_route",
    ...routeSource.payoneer,
    corridor,
    referenceExchangeRate: null,
    fxMarkupPercent: null,
    processingFee: blankFee("source_amount"),
    eligibilityNote:
      "Payoneer fees depend on account region, payment method, currency and transaction type. India withdrawals and account-specific terms must be checked in the user's account.",
    note:
      "No universal USD-to-INR fee or FX markup is assumed. Enter the actual account-specific withdrawal and conversion charges.",
  },

  skydo: {
    id: "skydo_usd_inr",
    provider: "Skydo",
    kind: "payment_route",
    ...routeSource.skydo,
    corridor,
    referenceExchangeRate: null,
    fxMarkupPercent: null,
    processingFee: blankFee("source_amount"),
    eligibilityNote:
      "Confirm the user's Indian business eligibility, supported transaction purpose, documentation and payout corridor with Skydo before applying a fee schedule.",
    note:
      "Skydo publishes transaction-size-based pricing, but the fee schedule has no clear effective date on the page checked. Do not prefill a tier amount until a dated official schedule is verified.",
  },
} satisfies Record<string, PaymentRoutePresetDraft>;

export const taxPresets = {
  india_44ada: {
    id: "india_44ada",
    label: "India — Section 44ADA",
    kind: "tax_reference",
    source: "Income Tax Department — Notification No. 47/2026",
    sourceUrl:
      "https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-04/Notification_No_47_2026.pdf",
    lastChecked: LAST_CHECKED,
    verificationStatus: "verified",
    eligibility: {
      status: "not_confirmed",
      note:
        "Do not enable until the user confirms they are an eligible resident assessee carrying on a profession specified under Section 44ADA and meets the applicable gross-receipts and other statutory conditions. Eligibility is not inferred from being a freelancer or creator.",
    },
    taxRatePercent: null,
    presumptiveIncomePercent: 50,
    taxBaseNote:
      "The 50% figure is presumptive income as a share of gross professional receipts, not a 50% income-tax rate and not a tax-reserve percentage. The 2026 notification shows the ₹50 lakh limit, extended to ₹75 lakh where the specified cash/other-receipt condition is met. Actual tax depends on the user's tax position and applicable rates.",
    note:
      "Eligibility defaults to not_confirmed. This preset is a tax reference, not a determination of eligibility or tax payable.",
  },

  philippines_8_percent: {
    id: "philippines_8_percent",
    label: "Philippines — 8% Income Tax Option",
    kind: "tax_reference",
    source: "Bureau of Internal Revenue — Revenue Memorandum Order No. 23-2018",
    sourceUrl:
      "https://bir-cdn.bir.gov.ph/local/pdf/RMO_No.%2023-2018_digest.pdf",
    lastChecked: LAST_CHECKED,
    verificationStatus: "verified",
    eligibility: {
      status: "not_confirmed",
      note:
        "The taxpayer must qualify as an individual earning from self-employment or practice of profession, meet the applicable VAT/percentage-tax registration and gross-receipts conditions, and make the required election for the taxable year. VAT-registered taxpayers and other excluded categories cannot use this option. Confirm current BIR rules and the user's registration before enabling.",
    },
    taxRatePercent: 8,
    presumptiveIncomePercent: null,
    taxBaseNote:
      "For purely self-employed individuals, the cited BIR guidance applies 8% to gross sales/receipts and other non-operating income in excess of PHP 250,000. Mixed-income earners have different treatment: the PHP 250,000 reduction does not apply to the business portion. This is not a universal 8% tax on every creator's total income.",
    note:
      "Eligibility defaults to not_confirmed. The 8% option requires a valid annual election and must not be presented as actual tax payable without checking the taxpayer's circumstances and current BIR rules.",
  },
} satisfies Record<string, TaxPresetDraft>;

// Intentionally no crypto or Binance preset.
// Availability, fees and permitted routes are country- and corridor-specific.

// Strict conversion boundary: incomplete or unverified presets cannot be
// represented as verified engine data.
function assertVerifiedProvenance(draft: {
  sourceUrl: string;
  lastChecked: string;
  verificationStatus: PresetVerificationStatus;
}): void {
  if (!draft.sourceUrl?.trim()) {
    throw new Error("Cannot convert preset: sourceUrl is missing.");
  }
  if (!draft.lastChecked?.trim()) {
    throw new Error("Cannot convert preset: lastChecked is missing.");
  }
  if (draft.verificationStatus !== "verified") {
    throw new Error("Cannot convert preset: verificationStatus must be verified.");
  }
}

function validateConverterPercent(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} must be finite and between 0 and 100.`);
  }
}

function validateConverterFixedFee(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be finite and non-negative.`);
  }
}

function validateConverterPaymentFee(model: PaymentFeeModel): void {
  if (model.kind === "none") return;

  const components =
    model.kind === "percentage_plus_fixed"
      ? [{
          percentageFee: model.percentageFee,
          fixedFee: model.fixedFee,
        }]
      : model.tiers.map((tier) => ({
          percentageFee: tier.percentageFee,
          fixedFee: tier.fixedFee,
        }));

  if (components.length === 0) {
    throw new Error("Payment fee model must contain at least one fee component.");
  }

  for (const component of components) {
    validateConverterPercent(
      component.percentageFee.percent,
      "Payment processing fee percentage",
    );
    validateConverterFixedFee(
      component.fixedFee.amount,
      "Payment fixed fee",
    );
  }

  if (model.kind === "tiered") {
    let previousThreshold = -Infinity;

    for (let index = 0; index < model.tiers.length; index++) {
      const threshold = model.tiers[index].upToAmount;

      if (threshold === undefined) {
        if (index !== model.tiers.length - 1) {
          throw new Error("Open-ended payment fee tier must be last.");
        }
        continue;
      }

      if (
        !Number.isFinite(threshold) ||
        threshold <= 0 ||
        threshold <= previousThreshold
      ) {
        throw new Error("Payment fee tier thresholds must be positive and increasing.");
      }

      previousThreshold = threshold;
    }

    if (model.tiers[model.tiers.length - 1].upToAmount !== undefined) {
      throw new Error("Tiered payment fee needs a final open-ended tier.");
    }
  }
}

export function toEnginePlatformPreset(
  draft: PlatformPresetDraft,
  userFee?: {
    percent: number;
    fixedAmount: number;
    fixedCurrency: FeeCurrency;
  },
): PlatformFeePreset {
  assertVerifiedProvenance(draft);

  const draftFeeComplete =
    draft.fee.percent !== null &&
    draft.fee.fixedAmount !== null &&
    (draft.fee.fixedCurrency === "source" ||
      draft.fee.fixedCurrency === "payout");

  let percent: number;
  let fixedFee: number;
  let fixedFeeCurrency: FeeCurrency;
  let verificationStatus: "verified" | "user_entered";

  if (userFee !== undefined) {
    validateConverterPercent(userFee.percent, "Platform fee percentage");
    validateConverterFixedFee(userFee.fixedAmount, "Platform fixed fee");

    percent = userFee.percent;
    fixedFee = userFee.fixedAmount;
    fixedFeeCurrency = userFee.fixedCurrency;
    verificationStatus = "user_entered";
  } else if (draftFeeComplete) {
    validateConverterPercent(draft.fee.percent!, "Platform fee percentage");
    validateConverterFixedFee(draft.fee.fixedAmount!, "Platform fixed fee");

    percent = draft.fee.percent!;
    fixedFee = draft.fee.fixedAmount!;
    fixedFeeCurrency = draft.fee.fixedCurrency as FeeCurrency;
    verificationStatus = "verified";
  } else {
    throw new Error(
      "Cannot convert platform preset: enter a complete user fee or provide a complete verified draft fee.",
    );
  }

  return {
    presetId: draft.id,
    label: draft.provider,
    percent,
    fixedFee,
    fixedFeeCurrency,
    source: draft.source,
    sourceUrl: draft.sourceUrl,
    lastChecked: draft.lastChecked,
    verificationStatus,
  };
}

export function toEnginePaymentRoute(
  draft: PaymentRoutePresetDraft,
  userRate?: number,
  userMarkup?: number,
  userFee?: PaymentFeeModel,
): PaymentRoute {
  assertVerifiedProvenance(draft);

  const usingUserRate = userRate !== undefined;
  const usingUserMarkup = userMarkup !== undefined;

  const referenceExchangeRate =
    userRate ?? draft.referenceExchangeRate;
  const fxMarkupPercent =
    userMarkup ?? draft.fxMarkupPercent;

  if (
    referenceExchangeRate === null ||
    fxMarkupPercent === null
  ) {
    throw new Error(
      "Cannot convert payment route: reference rate and FX markup are required.",
    );
  }

  if (!Number.isFinite(referenceExchangeRate) || referenceExchangeRate <= 0) {
    throw new Error("Payment route reference rate must be finite and greater than zero.");
  }

  if (
    !Number.isFinite(fxMarkupPercent) ||
    fxMarkupPercent < 0 ||
    fxMarkupPercent >= 100
  ) {
    throw new Error("Payment route FX markup must be finite, at least 0 and below 100.");
  }

  const draftFeeComplete =
    draft.processingFee.percent !== null &&
    draft.processingFee.fixedAmount !== null &&
    (draft.processingFee.fixedCurrency === "source" ||
      draft.processingFee.fixedCurrency === "payout") &&
    (draft.processingFee.basis === "source_amount" ||
      draft.processingFee.basis === "payout_amount");

  let processingFee: PaymentFeeModel;
  let verificationStatus: "verified" | "user_entered";

  if (userFee !== undefined) {
    validateConverterPaymentFee(userFee);
    processingFee = userFee;
    verificationStatus = "user_entered";
  } else if (draftFeeComplete) {
    processingFee = {
      kind: "percentage_plus_fixed",
      percentageFee: {
        percent: draft.processingFee.percent!,
        basis: draft.processingFee.basis as FeeBasis,
      },
      fixedFee: {
        amount: draft.processingFee.fixedAmount!,
        currency: draft.processingFee.fixedCurrency as FeeCurrency,
      },
    };
    validateConverterPaymentFee(processingFee);
    verificationStatus =
      usingUserRate || usingUserMarkup ? "user_entered" : "verified";
  } else {
    throw new Error(
      "Cannot convert payment route: enter a processing fee or provide a complete verified draft fee.",
    );
  }

  return {
    providerName: draft.provider,
    payoutCountryCode: draft.corridor.payoutCountryCode,
    payoutCurrency: draft.corridor.toCurrency,
    referenceExchangeRate,
    fxMarkupPercent,
    processingFee,
    availability: "unknown",
    availabilityNote: draft.eligibilityNote,
    source: draft.source,
    sourceUrl: draft.sourceUrl,
    lastChecked: draft.lastChecked,
    verificationStatus:
      userFee !== undefined || usingUserRate || usingUserMarkup
        ? "user_entered"
        : verificationStatus,
  };
}