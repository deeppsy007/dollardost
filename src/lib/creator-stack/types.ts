export type IncomeCategory =
  | "youtube"
  | "sponsorship"
  | "freelance"
  | "affiliate"
  | "digital_product"
  | "ugc"
  | "other";

export type AmountStage =
  | "contract_amount"
  | "after_platform"
  | "net_received";

export type TaxReserveBase = "amount_received" | "gross";
export type FeeCurrency = "source" | "payout";
export type FeeBasis = "source_amount" | "payout_amount";

export type DataVerificationStatus =
  | "verified"
  | "user_entered"
  | "estimate"
  | "unverified";

export interface DataProvenance {
  source?: string;
  sourceUrl?: string;
  lastChecked?: string;
  effectiveFrom?: string;
  verificationStatus: DataVerificationStatus;
  note?: string;
}

export interface EligibilityConfirmation {
  status: "confirmed" | "not_confirmed" | "unknown";
  note?: string;
}

export interface PlatformFeePreset extends DataProvenance {
  presetId: string;
  label: string;
  percent: number;
  fixedFee: number;
  fixedFeeCurrency: FeeCurrency;
}

export interface PaymentPercentageFee {
  percent: number;
  basis: FeeBasis;
}

export interface PaymentFixedFee {
  amount: number;
  currency: FeeCurrency;
}

export interface PaymentFeeTier {
  upToAmount?: number;
  thresholdBasis: FeeBasis;
  percentageFee: PaymentPercentageFee;
  fixedFee: PaymentFixedFee;
}

export type PaymentFeeModel =
  | {
      kind: "percentage_plus_fixed";
      percentageFee: PaymentPercentageFee;
      fixedFee: PaymentFixedFee;
    }
  | {
      kind: "tiered";
      tiers: PaymentFeeTier[];
    }
  | {
      kind: "none";
    };

export type RouteAvailability =
  | "available"
  | "unavailable"
  | "unknown";

export interface PaymentRoute extends DataProvenance {
  providerName: string;
  payoutCountryCode: string;
  payoutCurrency: string;

  // Source currency -> payout currency, before provider FX markup.
  referenceExchangeRate: number;

  // Percentage reduction applied to the reference exchange rate.
  fxMarkupPercent: number;

  // Fee schedule specifies fee currency and calculation basis.
  processingFee: PaymentFeeModel;

  // Availability must be assessed for this specific corridor.
  availability: RouteAvailability;
  availabilityNote?: string;
}

export interface AlternativeRoute {
  providerName: string;
  route: PaymentRoute;
}

export interface IncomeSource {
  id: string;
  name: string;
  category: IncomeCategory;
  earningSubtype?: string;

  // Amount is expressed in currency at the selected amountStage.
  amount: number;
  currency: string;
  amountStage: AmountStage;

  // Used only for contract_amount.
  platformFeePercent: number;
  platformFixedFee: number;
  platformFixedFeeCurrency: FeeCurrency;
  platformFeePreset?: PlatformFeePreset;

  clientCountryCode: string;
  clientType?:
    | "platform"
    | "direct_client"
    | "brand"
    | "affiliate_network";

  // Must be established independently; never inferred only from client country.
  isUsSource?: boolean;

  // Used only for net_received.
  // If omitted, the engine must use currency.
  // Never apply a payment-route exchange rate to this amount.
  receivedCurrency?: string;

  // Required for contract_amount and after_platform.
  // Not required for net_received.
  paymentRoute?: PaymentRoute;

  alternativeRoute?: AlternativeRoute;
}

export interface TaxReserve extends DataProvenance {
  enabled: boolean;
  percent: number;
  base: TaxReserveBase;

  presetId?: string;
  eligibility: EligibilityConfirmation;
  eligibilityNote?: string;
}

export interface FxRate {
  rate: number;
  source?: string;
  sourceUrl?: string;
  asOf?: string;
  verificationStatus: DataVerificationStatus;
}

export interface ComplianceEligibilityConditions {
  clientCountryCodes?: string[];
  payoutCountryCodes?: string[];
  incomeCategories?: IncomeCategory[];
  requiresUsSource?: boolean;
  requiresNonUsSource?: boolean;
}

export interface ComplianceRule extends DataProvenance {
  id: string;
  label: string;
  why: string;
  jurisdiction: string;

  // The engine evaluates these against each income source.
  // No precomputed applies boolean is accepted.
  eligibilityConditions: ComplianceEligibilityConditions;

  eligibilityNote?: string;
}

export interface ComplianceItem {
  id: string;
  label: string;
  why: string;
  jurisdiction: string;
  appliesComputed: boolean;
  eligibilityNote?: string;
  source?: string;
  sourceUrl?: string;
  lastChecked?: string;
}

export interface CreatorStackInput {
  incomeSources: IncomeSource[];
  reportingCurrency: string;
  taxReserve: TaxReserve;

  // Key format: SOURCE_REPORTING, e.g. USD_INR.
  // Same-currency conversions do not require a map entry.
  fxRatesToReporting: Record<string, FxRate>;

  // Only verified rules should be considered by the engine.
  // Applicability is computed from eligibilityConditions.
  complianceRules?: ComplianceRule[];

  future?: {
    whatIfEnabled?: boolean;
    exportEnabled?: boolean;
    localSaveEnabled?: boolean;
  };
}

export type BiggestLeak =
  | "platform"
  | "fx"
  | "processing"
  | "none";

export type BiggestPaymentLeak =
  | "fx"
  | "processing"
  | "none";

export interface IncomeSourceResult {
  sourceId: string;
  sourceName: string;
  category: IncomeCategory;
  amountStage: AmountStage;

  originalAmount: number;
  currency: string;
  receivedCurrency?: string;

  // Present only when contract gross is known.
  knownContractGrossReportingAmount?: number;

  platformFee: number;
  amountAfterPlatformFees: number;

  // Values in payout currency. Zero for net_received.
  referenceConvertedAmount: number;
  fxCost: number;
  paymentProcessingFee: number;
  amountReceived: number;
  payoutCurrency: string;

  // Reporting currency values.
  enteredAmountReporting: number;
  platformFeeReportingAmount: number;
  fxCostReportingAmount: number;
  processingFeeReportingAmount: number;

  // FX + processing only. Excludes platform fees.
  paymentRouteCostReportingAmount: number;

  receivedReportingAmount: number;

  keepRatePercent?: number;

  // Largest individual deduction category.
  // Must not be used to rank the payment-route leak report.
  biggestLeak: BiggestLeak;

  // Largest component of payment-route costs only.
  biggestPaymentLeak: BiggestPaymentLeak;

  alternativeReceivedReportingAmount?: number;
  alternativeSavingReportingAmount?: number;
}

export type LeakType =
  | "platform"
  | "fx"
  | "processing"
  | "payment_route";

export interface LeakItem {
  rank: number;
  sourceId: string;
  sourceName: string;
  leakType: LeakType;
  costReporting: number;
  savingReporting?: number;
  action: string;
  isEstimate: boolean;
}

export interface CreatorStackResult {
  reportingCurrency: string;

  // Entered amounts may represent different stages.
  // This is not automatically gross income.
  totalEnteredIncome: number;

  // Only populated when gross is known for every source.
  knownContractGrossIncome?: number;

  totalPlatformFees: number;
  totalFxCost: number;
  totalPaymentProcessingFees: number;
  totalPaymentRouteCosts: number;

  amountBeforeTaxReserve: number;
  taxReserveBaseAmount: number;
  estimatedTaxReserve: number;
  estimatedTakeHome: number;

  totalDeductions: number;
  effectiveDeductionPercent?: number;
  keepRatePercent?: number;

  sourceResults: IncomeSourceResult[];
  leakReport: LeakItem[];
  complianceChecklist: ComplianceItem[];

  whatIf?: {
    enabled: false;
    reason: string;
  };

  export?: {
    enabled: false;
    reason: string;
  };
}
