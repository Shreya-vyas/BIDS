-- AI Talent & Company Growth Intelligence Platform
-- Warehouse-oriented SQL examples for Snowflake, BigQuery, Postgres, or DuckDB.
-- Table names assume a simple star schema:
-- dim_company, dim_skill, dim_location, fact_job_posting, fact_funding_event,
-- fact_company_metric, fact_employee_movement.

-- 1. AI openings, hiring growth, and hiring momentum by company.
with monthly_ai_jobs as (
  select
    company_id,
    date_trunc('month', posted_at) as month,
    count(*) as ai_openings
  from fact_job_posting
  where is_ai_role = true
  group by 1, 2
),
current_vs_baseline as (
  select
    company_id,
    sum(case when month = date_trunc('month', current_date) then ai_openings else 0 end) as current_jobs,
    avg(case when month >= dateadd(month, -6, date_trunc('month', current_date))
             and month < date_trunc('month', current_date)
             then ai_openings end) as avg_jobs_last_6_months,
    min(case when month >= dateadd(month, -12, date_trunc('month', current_date)) then ai_openings end) as min_jobs_12m,
    max(case when month >= dateadd(month, -12, date_trunc('month', current_date)) then ai_openings end) as max_jobs_12m
  from monthly_ai_jobs
  group by 1
)
select
  c.company_name,
  c.industry,
  current_jobs,
  avg_jobs_last_6_months,
  current_jobs / nullif(avg_jobs_last_6_months, 0) as hiring_momentum_index,
  (max_jobs_12m - min_jobs_12m) / nullif(min_jobs_12m, 0) as trailing_12m_hiring_growth
from current_vs_baseline b
join dim_company c using (company_id)
order by hiring_momentum_index desc;

-- 2. Funding event to hiring surge lag analysis.
with job_counts as (
  select
    company_id,
    date_trunc('month', posted_at) as month,
    count(*) as ai_openings
  from fact_job_posting
  where is_ai_role = true
  group by 1, 2
),
event_windows as (
  select
    f.company_id,
    f.funding_date,
    f.round_name,
    f.amount_usd,
    pre.ai_openings as jobs_before_event,
    post.ai_openings as jobs_6m_after_event
  from fact_funding_event f
  left join job_counts pre
    on pre.company_id = f.company_id
   and pre.month = dateadd(month, -1, date_trunc('month', f.funding_date))
  left join job_counts post
    on post.company_id = f.company_id
   and post.month = dateadd(month, 6, date_trunc('month', f.funding_date))
)
select
  c.company_name,
  round_name,
  funding_date,
  amount_usd,
  jobs_before_event,
  jobs_6m_after_event,
  (jobs_6m_after_event - jobs_before_event) / nullif(jobs_before_event, 0) as post_funding_hiring_surge
from event_windows
join dim_company c using (company_id)
order by post_funding_hiring_surge desc;

-- 3. Company growth intelligence: compare revenue growth with AI hiring growth.
with company_growth as (
  select
    company_id,
    max(case when metric_name = 'revenue' then metric_value end) as current_revenue,
    lag(max(case when metric_name = 'revenue' then metric_value end), 4)
      over (partition by company_id order by fiscal_quarter) as revenue_1y_prior,
    max(case when metric_name = 'employee_count' then metric_value end) as current_headcount
  from fact_company_metric
  group by company_id, fiscal_quarter
),
latest_growth as (
  select *
  from company_growth
  qualify row_number() over (partition by company_id order by fiscal_quarter desc) = 1
),
ai_hiring_growth as (
  select
    company_id,
    count_if(posted_at >= dateadd(month, -3, current_date)) as jobs_last_3m,
    count_if(posted_at between dateadd(month, -15, current_date) and dateadd(month, -12, current_date)) as jobs_prior_period
  from fact_job_posting
  where is_ai_role = true
  group by company_id
)
select
  c.company_name,
  c.industry,
  (current_revenue - revenue_1y_prior) / nullif(revenue_1y_prior, 0) as revenue_growth_rate,
  (jobs_last_3m - jobs_prior_period) / nullif(jobs_prior_period, 0) as ai_hiring_growth_rate,
  ((jobs_last_3m - jobs_prior_period) / nullif(jobs_prior_period, 0))
    - ((current_revenue - revenue_1y_prior) / nullif(revenue_1y_prior, 0)) as over_hiring_gap,
  current_headcount
from latest_growth g
join ai_hiring_growth h using (company_id)
join dim_company c using (company_id)
order by over_hiring_gap desc;

-- 4. Skill premium analytics.
select
  s.skill_name,
  s.skill_family,
  count(*) as postings,
  percentile_cont(0.25) within group (order by salary_midpoint_usd) as salary_p25,
  avg(salary_midpoint_usd) as avg_salary,
  percentile_cont(0.75) within group (order by salary_midpoint_usd) as salary_p75
from fact_job_posting p
join bridge_job_skill js using (job_id)
join dim_skill s using (skill_id)
where salary_midpoint_usd is not null
group by 1, 2
having count(*) >= 25
order by avg_salary desc;

-- 5. Startup success feature table for XGBoost or Random Forest training.
create or replace table mart_startup_success_features as
select
  c.company_id,
  c.company_name,
  c.industry,
  c.stage,
  count(distinct p.job_id) as ai_jobs_last_90d,
  count(distinct p.job_id) / nullif(c.employee_count, 0) as ai_job_velocity_per_employee,
  sum(f.amount_usd) as funding_total_usd,
  max(f.funding_date) as latest_funding_date,
  datediff(day, max(f.funding_date), current_date) as days_since_last_funding,
  c.employee_count,
  c.market_sector_score,
  max(case when o.outcome_type in ('next_round', 'acquisition', 'unicorn') then 1 else 0 end) as target_success
from dim_company c
left join fact_job_posting p
  on p.company_id = c.company_id
 and p.is_ai_role = true
 and p.posted_at >= dateadd(day, -90, current_date)
left join fact_funding_event f
  on f.company_id = c.company_id
left join fact_company_outcome o
  on o.company_id = c.company_id
group by 1, 2, 3, 4, 8, 9;

-- 6. Talent migration network.
select
  source_company.company_name as from_company,
  target_company.company_name as to_company,
  count(*) as employee_moves
from fact_employee_movement m
join dim_company source_company
  on source_company.company_id = m.previous_company_id
join dim_company target_company
  on target_company.company_id = m.current_company_id
where m.move_date >= dateadd(year, -2, current_date)
group by 1, 2
having count(*) >= 10
order by employee_moves desc;
