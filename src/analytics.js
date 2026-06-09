import {
  companies,
  skillPremiums,
  geoHubs,
  geoTalentFlows,
  scrapeTargets,
  talentFlows,
  skillEvolution,
  cohorts
} from "../data/companies.js";

const monthKeys = [
  "2023-01", "2023-02", "2023-03", "2023-04", "2023-05", "2023-06",
  "2023-07", "2023-08", "2023-09", "2023-10", "2023-11", "2023-12",
  "2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06",
  "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12",
  "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
  "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"
];

const stageWeights = {
  "Venture": 0.88,
  "Growth": 1.06,
  "Late Stage": 1.18,
  "Pre-IPO": 1.12
};

function monthIndex(key) {
  return monthKeys.indexOf(key);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function eventLift(company, idx) {
  return company.fundingEvents.reduce((lift, event) => {
    const eventIndex = monthIndex(event.date);
    if (eventIndex < 0) return lift;
    const distance = idx - eventIndex;
    if (distance < 0 || distance > 9) return lift;
    const sizeLift = Math.log10(event.amount + 10) * 4.2;
    const decay = 1 - distance / 11;
    return lift + sizeLift * decay;
  }, 0);
}

function buildMonthlySeries(company) {
  const base = Math.max(8, company.sixMonthAvgJobs * 0.42);
  const growthSlope = company.aiHiringGrowth / 100;
  const stage = stageWeights[company.stage] ?? 1;
  return monthKeys.map((month, idx) => {
    const cycle = Math.sin((idx + company.name.length) / 3.3) * 5;
    const trend = base + idx * growthSlope * stage * 1.55;
    const fundingLift = eventLift(company, idx);
    const cooldown = company.currentAiJobs < company.sixMonthAvgJobs && idx > 30 ? (idx - 30) * 5 : 0;
    const openings = Math.max(2, Math.round(trend + cycle + fundingLift - cooldown));
    const revenue = round(company.revenueIndex * (0.62 + idx / 82) + Math.max(0, fundingLift) * 0.18, 1);
    return {
      companyId: company.id,
      company: company.name,
      month,
      openings,
      revenueIndex: revenue,
      hiringMomentum: round(openings / company.sixMonthAvgJobs, 2)
    };
  });
}

const monthlyCompanySeries = companies.flatMap(buildMonthlySeries);

function estimateCorrelation(points, xKey, yKey) {
  const xs = points.map((point) => point[xKey]);
  const ys = points.map((point) => point[yKey]);
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const numerator = points.reduce((sum, point) => sum + (point[xKey] - meanX) * (point[yKey] - meanY), 0);
  const denomX = Math.sqrt(xs.reduce((sum, value) => sum + (value - meanX) ** 2, 0));
  const denomY = Math.sqrt(ys.reduce((sum, value) => sum + (value - meanY) ** 2, 0));
  return round(numerator / (denomX * denomY), 2);
}

function logistic(value) {
  return 1 / (1 + Math.exp(-value));
}

function scoreCompany(company) {
  const hiringMomentum = company.currentAiJobs / company.sixMonthAvgJobs;
  const fundingIntensity = Math.log10(company.fundingTotal + 25) / 4;
  const headcountScale = Math.log10(company.employees + 30) / 4.2;
  const productSignal = company.productExpansion / 100;
  const revenueSignal = company.revenueGrowth / 220;
  const marketSignal = company.marketSignal / 100;
  const raw =
    -2.0 +
    hiringMomentum * 1.25 +
    fundingIntensity * 1.1 +
    headcountScale * 0.7 +
    productSignal * 0.95 +
    revenueSignal * 0.85 +
    marketSignal * 0.75;
  const successProbability = round(logistic(raw) * 100, 1);
  const layoffRisk = round(clamp((1.05 - hiringMomentum) * 95 + (65 - company.marketSignal) * 0.42, 2, 93), 1);
  const ipoReadiness = round(clamp(company.revenueIndex * 0.34 + company.marketSignal * 0.28 + headcountScale * 18 + hiringMomentum * 12, 0, 100), 1);
  const overHiringGap = round(company.aiHiringGrowth - company.revenueGrowth, 1);
  const aiIntensity      = round((company.currentAiJobs / company.employees) * 100, 1);
  const fundingEfficiency = company.fundingTotal > 0
    ? round(company.revenueIndex / (company.fundingTotal / 100), 2) : 0;
  const burnRateProxy    = round((company.fundingTotal * 1000) / company.employees, 0); // $K per employee
  const pmfScore         = round((company.marketSignal * company.productExpansion) / 100, 1);
  const velocityScore    = round(company.aiHiringGrowth / Math.max(1, 2026 - company.founded), 1);

  return {
    ...company,
    hiringMomentum: round(hiringMomentum, 2),
    successProbability,
    layoffRisk,
    ipoReadiness,
    overHiringGap,
    aiIntensity,
    fundingEfficiency,
    burnRateProxy,
    pmfScore,
    velocityScore,
    health:
      hiringMomentum >= 1.2 ? "Expansion" :
      hiringMomentum >= 0.8 ? "Stable" :
      "Contraction"
  };
}

const companyScores = companies.map(scoreCompany);

function skillDemandMatrix(selectedCompanies = companyScores) {
  const selectedIds = new Set(selectedCompanies.map((company) => company.id));
  return skillPremiums.map((skill) => {
    const demand = companies.reduce((sum, company) => {
      if (!selectedIds.has(company.id)) return sum;
      return sum + (company.skills.includes(skill.skill) ? company.currentAiJobs : 0);
    }, 0);
    return {
      ...skill,
      selectedDemand: demand
    };
  }).sort((a, b) => b.selectedDemand - a.selectedDemand);
}

function industrySummary(selectedCompanies = companyScores) {
  const map = new Map();
  selectedCompanies.forEach((company) => {
    const item = map.get(company.industry) ?? {
      industry: company.industry,
      companies: 0,
      openings: 0,
      funding: 0,
      growth: 0
    };
    item.companies += 1;
    item.openings += company.currentAiJobs;
    item.funding += company.fundingTotal;
    item.growth += company.aiHiringGrowth;
    map.set(company.industry, item);
  });
  return [...map.values()]
    .map((item) => ({ ...item, growth: round(item.growth / item.companies, 1) }))
    .sort((a, b) => b.openings - a.openings);
}

function fundingHiringPoints(selectedCompanies = companyScores) {
  return selectedCompanies.map((company) => ({
    company: company.name,
    fundingTotal: company.fundingTotal,
    currentAiJobs: company.currentAiJobs,
    aiHiringGrowth: company.aiHiringGrowth,
    stage: company.stage
  }));
}

function totalMonthlyHiring(selectedCompanies = companyScores) {
  const ids = new Set(selectedCompanies.map((company) => company.id));
  return monthKeys.map((month) => {
    const values = monthlyCompanySeries.filter((point) => point.month === month && ids.has(point.companyId));
    return {
      month,
      openings: values.reduce((sum, point) => sum + point.openings, 0),
      revenueIndex: round(values.reduce((sum, point) => sum + point.revenueIndex, 0) / values.length, 1)
    };
  });
}

function fundingSurgeSummary(selectedCompanies = companyScores) {
  const rows = [];
  selectedCompanies.forEach((company) => {
    company.fundingEvents.forEach((event) => {
      const eventIdx = monthIndex(event.date);
      const before = monthlyCompanySeries.find((point) => point.companyId === company.id && point.month === monthKeys[Math.max(0, eventIdx - 1)]);
      const after = monthlyCompanySeries.find((point) => point.companyId === company.id && point.month === monthKeys[Math.min(monthKeys.length - 1, eventIdx + 6)]);
      if (!before || !after) return;
      rows.push({
        company: company.name,
        date: event.date,
        round: event.round,
        amount: event.amount,
        surge: round(((after.openings - before.openings) / before.openings) * 100, 1)
      });
    });
  });
  return rows.sort((a, b) => b.surge - a.surge);
}

function featureImportance() {
  return [
    { feature: "Hiring growth velocity", importance: 0.28 },
    { feature: "Funding intensity", importance: 0.22 },
    { feature: "Product expansion signal", importance: 0.18 },
    { feature: "Market leadership score", importance: 0.14 },
    { feature: "Revenue growth", importance: 0.11 },
    { feature: "Headcount scale", importance: 0.07 }
  ];
}

function shapBreakdown(company) {
  const scored = scoreCompany(company);
  return [
    { factor: "Base rate", value: 38 },
    { factor: "Hiring velocity", value: round((scored.hiringMomentum - 1) * 24, 1) },
    { factor: "Funding", value: round(Math.log10(company.fundingTotal + 25) * 6, 1) },
    { factor: "Market signal", value: round((company.marketSignal - 70) * 0.32, 1) },
    { factor: "Product expansion", value: round((company.productExpansion - 70) * 0.28, 1) },
    { factor: "Revenue growth", value: round(company.revenueGrowth * 0.08, 1) }
  ];
}

function scoreGeoHub(hub) {
  const salaryEfficiency = Math.min(150, (230000 / hub.salary) * 100);
  const costEfficiency = 120 - hub.costIndex;
  const supplyDemandBalance = hub.talentSupply - hub.competitionIndex * 0.45;
  const rawExpansion =
    hub.growthRate * 0.95 +
    salaryEfficiency * 0.18 +
    costEfficiency * 0.25 +
    hub.talentSupply * 0.28 +
    hub.fundingDensity * 0.18 +
    hub.universityIndex * 0.14 -
    hub.competitionIndex * 0.2;
  const expansionScore = round(clamp(rawExpansion / 1.5, 0, 100), 1);
  const overheatingRisk = round(clamp(
    hub.competitionIndex * 0.42 + hub.costIndex * 0.34 + (100 - hub.remoteShare) * 0.12 - hub.talentSupply * 0.16,
    5,
    95
  ), 1);
  return {
    ...hub,
    salaryEfficiency: round(salaryEfficiency, 1),
    supplyDemandBalance: round(supplyDemandBalance, 1),
    expansionScore,
    overheatingRisk,
    recommendedPlay:
      expansionScore >= 60 && overheatingRisk < 55 ? "Build hub" :
      expansionScore >= 48 ? "Selective hiring" :
      overheatingRisk >= 65 ? "Remote-first" :
      "Monitor"
  };
}

const geoScores = geoHubs.map(scoreGeoHub);

function geoSummary() {
  const totalJobs = geoScores.reduce((sum, hub) => sum + hub.jobs, 0);
  const avgSalary = geoScores.reduce((sum, hub) => sum + hub.salary * hub.jobs, 0) / totalJobs;
  const avgRemote = geoScores.reduce((sum, hub) => sum + hub.remoteShare * hub.jobs, 0) / totalJobs;
  const bestExpansion = [...geoScores].sort((a, b) => b.expansionScore - a.expansionScore)[0];
  const overheated = [...geoScores].sort((a, b) => b.overheatingRisk - a.overheatingRisk)[0];
  return {
    totalJobs,
    avgSalary: round(avgSalary, 0),
    avgRemote: round(avgRemote, 1),
    bestExpansion,
    overheated
  };
}

function geoCorrelationMatrix() {
  const metrics = [
    ["jobs", "Openings"],
    ["salary", "Salary"],
    ["costIndex", "Cost"],
    ["talentSupply", "Talent"],
    ["fundingDensity", "Funding"],
    ["competitionIndex", "Competition"],
    ["growthRate", "Growth"]
  ];
  return metrics.map(([xKey, xLabel]) => ({
    metric: xLabel,
    values: metrics.map(([yKey, yLabel]) => ({
      metric: yLabel,
      correlation: estimateCorrelation(geoScores, xKey, yKey)
    }))
  }));
}

function geoClusterSummary() {
  return geoScores.map((hub) => ({
    ...hub,
    cluster:
      hub.jobs > 300 ? "Mega hub" :
      hub.expansionScore >= 74 && hub.costIndex < 70 ? "Efficient growth hub" :
      hub.universityIndex >= 80 ? "Research hub" :
      hub.remoteShare >= 55 ? "Remote-friendly hub" :
      "Emerging hub"
  }));
}

function modelRoadmap() {
  return [
    { model: "Location expansion score", target: "Best city for next AI hiring pod", graph: "Bubble map + score ranking", features: "Talent supply, salary efficiency, funding density, growth, competition" },
    { model: "Hiring surge forecast", target: "Expected openings 3-6 months after funding", graph: "Lagged line chart + prediction interval", features: "Funding round, amount, stage, prior velocity, city mix" },
    { model: "Layoff risk classifier", target: "Probability of hiring contraction", graph: "Risk ranking + SHAP waterfall", features: "Momentum, posting decay, revenue signal, market signal, cost pressure" },
    { model: "Skill premium model", target: "Salary premium by skill and city", graph: "Boxplot + city heatmap", features: "Skill, level, geography, remote policy, company stage" },
    { model: "Talent migration graph", target: "Where AI talent is moving", graph: "Network/Sankey + centrality table", features: "Prior employer, destination hub, seniority, role family" }
  ];
}

function marketConcentration(selectedCompanies = companyScores) {
  const total = selectedCompanies.reduce((s, c) => s + c.currentAiJobs, 0) || 1;
  const byIndustry = new Map();
  selectedCompanies.forEach(c => {
    byIndustry.set(c.industry, (byIndustry.get(c.industry) || 0) + c.currentAiJobs);
  });
  const shares = [...byIndustry.entries()]
    .map(([industry, jobs]) => ({ industry, jobs, share: round(jobs / total * 100, 1) }))
    .sort((a, b) => b.jobs - a.jobs);
  const hhi = round(shares.reduce((s, r) => s + r.share ** 2, 0), 0);
  const top3Share = round(shares.slice(0, 3).reduce((s, r) => s + r.share, 0), 1);
  // Company-level dominance
  const companies = [...selectedCompanies]
    .sort((a, b) => b.currentAiJobs - a.currentAiJobs)
    .map(c => ({ name: c.name, jobs: c.currentAiJobs, share: round(c.currentAiJobs / total * 100, 1), industry: c.industry }));
  return { shares, hhi, top3Share, companies };
}

function stageIntelligence(selectedCompanies = companyScores) {
  const map = new Map();
  selectedCompanies.forEach(c => {
    const g = map.get(c.stage) || { count: 0, jobs: 0, funding: 0, growth: 0, success: 0, salary: 0 };
    g.count++; g.jobs += c.currentAiJobs; g.funding += c.fundingTotal;
    g.growth += c.aiHiringGrowth; g.success += c.successProbability; g.salary += c.salaryMedian;
    map.set(c.stage, g);
  });
  const stageOrder = ["Venture", "Growth", "Late Stage", "Pre-IPO"];
  return [...map.entries()]
    .map(([stage, g]) => ({
      stage,
      count: g.count,
      totalJobs: g.jobs,
      totalFunding: g.funding,
      avgGrowth: round(g.growth / g.count, 1),
      avgSuccess: round(g.success / g.count, 1),
      avgSalary: round(g.salary / g.count, 0)
    }))
    .sort((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage));
}

function salaryIntelligence(selectedCompanies = companyScores) {
  const industryMap = new Map();
  selectedCompanies.forEach(c => {
    const g = industryMap.get(c.industry) || { salaries: [], jobs: 0 };
    g.salaries.push(c.salaryMedian);
    g.jobs += c.currentAiJobs;
    industryMap.set(c.industry, g);
  });
  const byIndustry = [...industryMap.entries()].map(([industry, g]) => {
    const s = [...g.salaries].sort((a, b) => a - b);
    return {
      industry,
      avg: round(s.reduce((a, v) => a + v, 0) / s.length, 0),
      min: s[0],
      max: s[s.length - 1],
      jobs: g.jobs,
      count: s.length
    };
  }).sort((a, b) => b.avg - a.avg);

  const remote = selectedCompanies.filter(c => c.remoteShare >= 50);
  const onsite = selectedCompanies.filter(c => c.remoteShare < 30);
  const remoteAvg = remote.length ? round(remote.reduce((s, c) => s + c.salaryMedian, 0) / remote.length, 0) : 0;
  const onsiteAvg = onsite.length ? round(onsite.reduce((s, c) => s + c.salaryMedian, 0) / onsite.length, 0) : 0;
  const remotePremium = onsiteAvg && remoteAvg ? round((onsiteAvg - remoteAvg) / remoteAvg * 100, 1) : 0;

  const stageMap = new Map();
  selectedCompanies.forEach(c => {
    const g = stageMap.get(c.stage) || [];
    g.push(c.salaryMedian);
    stageMap.set(c.stage, g);
  });
  const byStage = [...stageMap.entries()].map(([stage, salaries]) => ({
    stage,
    avg: round(salaries.reduce((a, v) => a + v, 0) / salaries.length, 0),
    count: salaries.length
  })).sort((a, b) => b.avg - a.avg);

  const topCompanies = [...selectedCompanies]
    .sort((a, b) => b.salaryMedian - a.salaryMedian)
    .slice(0, 10)
    .map(c => ({ name: c.name, salary: c.salaryMedian, stage: c.stage, industry: c.industry, remote: c.remoteShare }));

  return { byIndustry, byStage, remoteAvg, onsiteAvg, remotePremium, topCompanies };
}

function forecastHiring(selectedCompanies = companyScores) {
  const trend = totalMonthlyHiring(selectedCompanies);
  const recent = trend.slice(-12);
  const n = recent.length;
  const xs = recent.map((_, i) => i);
  const ys = recent.map(p => p.openings);
  const xMean = xs.reduce((s, v) => s + v, 0) / n;
  const yMean = ys.reduce((s, v) => s + v, 0) / n;
  const slope = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0) /
    xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const intercept = yMean - slope * xMean;
  const forecastMonths = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];
  const forecast = forecastMonths.map((month, i) => ({
    month,
    openings: Math.max(0, Math.round(intercept + slope * (n + i))),
    isForecast: true
  }));
  const r2 = (() => {
    const predicted = xs.map(x => intercept + slope * x);
    const ss_res = ys.reduce((s, y, i) => s + (y - predicted[i]) ** 2, 0);
    const ss_tot = ys.reduce((s, y) => s + (y - yMean) ** 2, 0);
    return round(1 - ss_res / ss_tot, 3);
  })();
  return { trend, forecast, slope: round(slope, 1), r2, currentOpenings: trend[trend.length - 1].openings };
}

export const analytics = {
  companies,
  companyScores,
  cohorts,
  geoHubs,
  geoScores,
  geoTalentFlows,
  scrapeTargets,
  skillEvolution,
  skillPremiums,
  talentFlows,
  monthKeys,
  monthlyCompanySeries,
  totalMonthlyHiring,
  skillDemandMatrix,
  industrySummary,
  fundingHiringPoints,
  fundingSurgeSummary,
  featureImportance,
  shapBreakdown,
  geoSummary,
  geoCorrelationMatrix,
  geoClusterSummary,
  modelRoadmap,
  estimateCorrelation,
  round,
  marketConcentration,
  stageIntelligence,
  salaryIntelligence,
  forecastHiring
};
