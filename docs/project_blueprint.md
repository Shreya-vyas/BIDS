# AI Talent & Company Growth Intelligence Platform

## Executive Question

Can AI hiring patterns predict revenue growth, funding activity, IPO readiness, product expansion, market leadership, and future business performance?

This project reframes a job market dashboard as a strategic workforce intelligence product. The focus is not "which jobs are open?" The focus is "what does hiring behavior imply about company trajectory?"

## Dashboard Architecture

### 1. AI Hiring Landscape

Questions:

- Which companies are hiring AI talent?
- Which AI roles and skills are accelerating?
- Which industries and cities are becoming AI hubs?

Metrics:

- Total AI openings
- Openings by company, industry, and geography
- Hiring growth rate
- Skill demand concentration

Visuals:

- Hiring trend line
- Skill demand heatmap
- Geographic hiring map
- Industry treemap

### 2. Funding vs Hiring Analysis

Questions:

- Do companies hire aggressively after funding?
- Which companies scale fastest after investment?
- How long is the lag between funding and hiring acceleration?

Metrics:

- Funding amount
- AI job velocity
- Six-month post-funding hiring surge
- Funding-to-hiring correlation

Visuals:

- Funding timeline
- Funding event to hiring surge ranking
- Scatter plot of funding amount vs AI jobs posted

### 3. Company Growth Intelligence

Questions:

- Is AI hiring a leading indicator of revenue growth?
- Which companies are over-hiring relative to revenue?
- Which companies are under-hiring relative to market signal?

Metrics:

- Revenue growth
- AI hiring growth
- Over-hiring gap
- IPO readiness score

### 4. Skill Premium Analytics

Questions:

- Which skills command the highest salaries?
- Which AI skills are transitioning from emerging to core?
- Which capabilities are associated with productized AI systems?

Metrics:

- Salary p25, average, and p75
- Skill demand volume
- Skill family concentration

### 5. Startup Success Predictor

Questions:

- Which companies are likely to raise the next round?
- Which startups are moving toward acquisition or unicorn status?
- Which features drive the prediction?

Candidate features:

- Hiring growth velocity
- Funding intensity
- Headcount scale
- Market sector
- Product expansion score
- Job opening velocity

Model options:

- XGBoost
- Random Forest
- Logistic regression baseline
- SHAP for explainability

### 6. Layoff Risk and Hiring Health

Questions:

- Which companies are slowing hiring?
- Which industries may be freezing hiring?
- Which firms are likely preparing layoffs?

Metric:

```text
Hiring Momentum = Current Jobs / Average Jobs Last 6 Months
```

Interpretation:

- `> 1.2`: expansion
- `0.8 to 1.2`: stable
- `< 0.8`: contraction

## Data Model

Recommended warehouse tables:

- `dim_company`
- `dim_skill`
- `dim_location`
- `dim_date`
- `fact_job_posting`
- `fact_funding_event`
- `fact_company_metric`
- `fact_employee_movement`
- `fact_company_outcome`
- `bridge_job_skill`

## Data Sources

Production source candidates:

- Job postings APIs
- LinkedIn datasets or licensed labor market data
- Crunchbase
- YC company directory
- SEC filings
- Public company earnings reports
- Company career pages
- Layoff trackers
- Salary datasets

## ETL Design

1. Ingest job postings, funding events, public financial data, and company metadata.
2. Normalize company names with canonical IDs.
3. Extract AI role tags and skills from titles and descriptions.
4. Deduplicate postings across aggregators and company career pages.
5. Build monthly hiring snapshots.
6. Join funding events to hiring windows.
7. Create feature tables for predictive modeling.
8. Publish BI marts for Tableau, Power BI, Plotly Dash, or this static app.

## Analytics Methods

- Exploratory data analysis
- Cohort analysis
- Time series trend analysis
- Correlation and lag analysis
- Salary distribution analysis
- Classification modeling
- Feature importance
- SHAP explainability
- Network analysis for talent migration

## Portfolio Positioning

This project demonstrates:

- SQL analytics
- Executive KPI design
- Data storytelling
- Workforce analytics
- Product analytics
- Financial and funding analysis
- Market intelligence
- Predictive modeling
- BI-ready data modeling
- Data engineering architecture

## Current Implementation

The repository ships with a self-contained static web application. It uses synthetic data in `data/companies.js` and browser-native SVG visualizations so it can run without installing dependencies. The structure is designed so real pipelines can replace the synthetic data layer later without rewriting the dashboard experience.
