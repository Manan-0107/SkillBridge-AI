/**
 * lib/career/financialPlanner.ts
 *
 * UBIX Financial Reality Planner
 *
 * Models transition runway, learning investment ROI, and income differential
 * based strictly on user-supplied numbers and transparent arithmetic formulas.
 *
 * Invariant: Never fabricates cost-of-living metrics or guaranteed salary figures.
 * All outputs state: "CALCULATED_FROM_USER_INPUTS".
 */

export interface FinancialPlanInput {
  currentAnnualIncome: number;
  targetAnnualIncome: number;
  monthlyLivingExpenses: number;
  currentLiquidSavings: number;
  estimatedLearningCosts: number; // certifications, hardware, courses
  projectedTransitionMonths: number;
  monthlySavingsContribution?: number;
}

export interface FinancialPlanAnalysis {
  planId: string;
  monthlyBurnRate: number;
  totalTransitionCost: number;
  totalRunwayMonths: number;
  runwayBufferStatus: "COMFORTABLE" | "TIGHT" | "INSUFFICIENT_RUNWAY";
  breakEvenMonthsPostTransition: number;
  projectedAnnualIncomeDifferential: number;
  isFinanciallyFeasible: boolean;
  userAssumptionsSummary: string;
  provenance: "CALCULATED_FROM_USER_INPUTS";
}

/**
 * Computes runway and financial feasibility from explicit user inputs.
 */
export function calculateFinancialPlan(input: FinancialPlanInput): FinancialPlanAnalysis {
  const monthlyBurnRate = input.monthlyLivingExpenses;
  const livingCostOverTransition = monthlyBurnRate * input.projectedTransitionMonths;
  const totalTransitionCost = livingCostOverTransition + input.estimatedLearningCosts;

  // Runway months available with current liquid savings
  const totalRunwayMonths =
    monthlyBurnRate > 0
      ? Math.round((input.currentLiquidSavings / monthlyBurnRate) * 10) / 10
      : 99;

  let runwayBufferStatus: FinancialPlanAnalysis["runwayBufferStatus"] = "COMFORTABLE";
  if (totalRunwayMonths < input.projectedTransitionMonths) {
    runwayBufferStatus = "INSUFFICIENT_RUNWAY";
  } else if (totalRunwayMonths < input.projectedTransitionMonths + 2) {
    runwayBufferStatus = "TIGHT";
  }

  // Income differential
  const projectedAnnualIncomeDifferential = input.targetAnnualIncome - input.currentAnnualIncome;
  const monthlyGain = projectedAnnualIncomeDifferential / 12;

  // Break-even calculation for upfront learning investment
  let breakEvenMonths = 0;
  if (monthlyGain > 0 && input.estimatedLearningCosts > 0) {
    breakEvenMonths = Math.ceil(input.estimatedLearningCosts / monthlyGain);
  }

  const isFinanciallyFeasible = runwayBufferStatus !== "INSUFFICIENT_RUNWAY";

  const userAssumptionsSummary = `Based on user inputs: Current Income ($${input.currentAnnualIncome}), Target Income ($${input.targetAnnualIncome}), Monthly Expenses ($${input.monthlyLivingExpenses}), Savings ($${input.currentLiquidSavings}), Learning Investment ($${input.estimatedLearningCosts}) over a ${input.projectedTransitionMonths}-month horizon.`;

  return {
    planId: `fin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    monthlyBurnRate,
    totalTransitionCost,
    totalRunwayMonths,
    runwayBufferStatus,
    breakEvenMonthsPostTransition: breakEvenMonths,
    projectedAnnualIncomeDifferential,
    isFinanciallyFeasible,
    userAssumptionsSummary,
    provenance: "CALCULATED_FROM_USER_INPUTS",
  };
}
