import { mkdir, writeFile } from "node:fs/promises";
import { analytics } from "../src/analytics.js";

const outDir = new URL("../data/marts/", import.meta.url);

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n");
}

const companyMart = analytics.companyScores.map((company) => ({
  company_id: company.id,
  company_name: company.name,
  industry: company.industry,
  stage: company.stage,
  hq: company.hq,
  current_ai_jobs: company.currentAiJobs,
  avg_jobs_last_6_months: company.sixMonthAvgJobs,
  hiring_momentum: company.hiringMomentum,
  revenue_growth_pct: company.revenueGrowth,
  ai_hiring_growth_pct: company.aiHiringGrowth,
  over_hiring_gap_pct: company.overHiringGap,
  funding_total_millions: company.fundingTotal,
  success_probability_pct: company.successProbability,
  layoff_risk_pct: company.layoffRisk,
  ipo_readiness_pct: company.ipoReadiness,
  health: company.health
}));

const skillMart = analytics.skillPremiums.map((skill) => ({
  skill: skill.skill,
  skill_family: skill.family,
  avg_salary: skill.avgSalary,
  salary_p25: skill.p25,
  salary_p75: skill.p75,
  demand_index: skill.demand
}));

const fundingMart = analytics.fundingSurgeSummary(analytics.companyScores).map((event) => ({
  company_name: event.company,
  funding_date: event.date,
  round_name: event.round,
  amount_millions: event.amount,
  post_funding_hiring_surge_pct: event.surge
}));

await mkdir(outDir, { recursive: true });
await writeFile(new URL("company_growth_mart.csv", outDir), toCsv(companyMart));
await writeFile(new URL("skill_premium_mart.csv", outDir), toCsv(skillMart));
await writeFile(new URL("funding_surge_mart.csv", outDir), toCsv(fundingMart));

console.log("Exported marts:");
console.log("- data/marts/company_growth_mart.csv");
console.log("- data/marts/skill_premium_mart.csv");
console.log("- data/marts/funding_surge_mart.csv");
