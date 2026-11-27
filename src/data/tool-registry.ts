export type ToolCategory =
  | "creator-stack"
  | "currency-calculators"
  | "tax-compliance"
  | "payments-documentation"
  | "business-income-planning";

export type ToolStatus = "live" | "planned";

export type ToolFamily = "creator-financial-toolkit" | "currency";

export interface ToolDefinition {
  id: string;
  title: string;
  description: string;
  category: ToolCategory;
  family: ToolFamily;
  icon: string;
  href: string;
  status: ToolStatus;
}

export const toolRegistry: ToolDefinition[] = [
  // CREATOR & FREELANCER FINANCIAL TOOLKIT — 12 TOOLS

  {
    id: "creator-stack",
    title: "Creator Stack Calculator",
    description:
      "Combine income across creator and freelance platforms, payment routes and currencies.",
    category: "creator-stack",
    family: "creator-financial-toolkit",
    icon: "🌐",
    href: "/creator-stack-calculator/",
    status: "live",
  },
  {
    id: "w8ben-risk-checker",
    title: "W-8BEN Withholding Risk Checker",
    description:
      "Understand potential US withholding risks and W-8BEN considerations.",
    category: "tax-compliance",
    family: "creator-financial-toolkit",
    icon: "🧾",
    href: "/w8ben-withholding-risk-checker/",
    status: "planned",
  },
  {
    id: "fira-firc-finder",
    title: "FIRA / FIRC Missing Document Finder",
    description:
      "Identify missing foreign inward remittance documentation.",
    category: "payments-documentation",
    family: "creator-financial-toolkit",
    icon: "📄",
    href: "/fira-firc-document-finder/",
    status: "planned",
  },
  {
    id: "platform-fee-tracker",
    title: "Platform Fee Change Tracker",
    description:
      "Track platform fee changes and potential effects on creator earnings.",
    category: "payments-documentation",
    family: "creator-financial-toolkit",
    icon: "📊",
    href: "/platform-fee-change-tracker/",
    status: "planned",
  },
  {
    id: "gst-lut-tracker",
    title: "GST LUT Eligibility & Deadline Tracker",
    description:
      "Explore LUT eligibility considerations and important filing deadlines.",
    category: "tax-compliance",
    family: "creator-financial-toolkit",
    icon: "📅",
    href: "/gst-lut-tracker/",
    status: "planned",
  },
  {
    id: "advance-tax-calculator",
    title: "Advance Tax Calculator & Reminder",
    description:
      "Estimate advance tax instalments and track important payment dates.",
    category: "tax-compliance",
    family: "creator-financial-toolkit",
    icon: "🧮",
    href: "/advance-tax-calculator/",
    status: "planned",
  },
  {
    id: "invoice-purpose-code-selector",
    title: "Invoice & Purpose Code Selector",
    description:
      "Find relevant invoice, purpose-code and SAC-code information.",
    category: "payments-documentation",
    family: "creator-financial-toolkit",
    icon: "📝",
    href: "/invoice-purpose-code-selector/",
    status: "planned",
  },
  {
    id: "client-payment-risk-checker",
    title: "Client Payment Risk Checker",
    description:
      "Review payment-method and cross-border client-payment considerations.",
    category: "payments-documentation",
    family: "creator-financial-toolkit",
    icon: "🛡️",
    href: "/client-payment-risk-checker/",
    status: "planned",
  },
  {
    id: "llc-vs-proprietor",
    title: "US LLC vs Indian Sole Proprietor",
    description:
      "Compare business-structure considerations for cross-border earners.",
    category: "business-income-planning",
    family: "creator-financial-toolkit",
    icon: "🏢",
    href: "/us-llc-vs-indian-proprietor/",
    status: "planned",
  },
  {
    id: "creator-income-split",
    title: "Creator Income Split Calculator",
    description:
      "Explore income scenarios involving freelance, salary and creator earnings.",
    category: "business-income-planning",
    family: "creator-financial-toolkit",
    icon: "💰",
    href: "/creator-income-split-calculator/",
    status: "planned",
  },
  {
    id: "bank-rejection-decoder",
    title: "Bank Rejection Reason Decoder",
    description:
      "Understand possible reasons for rejected international payments.",
    category: "payments-documentation",
    family: "creator-financial-toolkit",
    icon: "🏦",
    href: "/bank-rejection-decoder/",
    status: "planned",
  },
  {
    id: "creator-compliance-dashboard",
    title: "Creator Compliance Dashboard",
    description:
      "Bring recurring creator tax and payment-compliance tasks together.",
    category: "tax-compliance",
    family: "creator-financial-toolkit",
    icon: "📋",
    href: "/creator-compliance-dashboard/",
    status: "planned",
  },

  // SEPARATE CURRENCY CALCULATOR FAMILY

  {
    id: "global-currency-calculator",
    title: "Global Currency Calculator",
    description:
      "Calculate international currency conversions, fees and estimated payouts.",
    category: "currency-calculators",
    family: "currency",
    icon: "🌍",
    href: "#calculator",
    status: "live",
  },
  {
    id: "usd-to-inr",
    title: "USD to INR Calculator",
    description: "Convert US dollars to Indian rupees and estimate payout costs.",
    category: "currency-calculators",
    family: "currency",
    icon: "🇮🇳",
    href: "/usd-to-inr-calculator/",
    status: "live",
  },
  {
    id: "usd-to-pkr",
    title: "USD to PKR Calculator",
    description: "Convert US dollars to Pakistani rupees and estimate payout costs.",
    category: "currency-calculators",
    family: "currency",
    icon: "🇵🇰",
    href: "/usd-to-pkr-calculator/",
    status: "live",
  },
  {
    id: "usd-to-bdt",
    title: "USD to BDT Calculator",
    description: "Convert US dollars to Bangladeshi taka and estimate payout costs.",
    category: "currency-calculators",
    family: "currency",
    icon: "🇧🇩",
    href: "/usd-to-bdt-calculator/",
    status: "live",
  },
  {
    id: "usd-to-php",
    title: "USD to PHP Calculator",
    description: "Convert US dollars to Philippine pesos and estimate payout costs.",
    category: "currency-calculators",
    family: "currency",
    icon: "🇵🇭",
    href: "/usd-to-php-calculator/",
    status: "live",
  },
  {
    id: "usd-to-ngn",
    title: "USD to NGN Calculator",
    description: "Convert US dollars to Nigerian naira and estimate payout costs.",
    category: "currency-calculators",
    family: "currency",
    icon: "🇳🇬",
    href: "/usd-to-ngn-calculator/",
    status: "live",
  },
];
