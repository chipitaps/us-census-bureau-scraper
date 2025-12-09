# US Census Bureau Scraper

🚀 Supercharge your demographic research with our comprehensive US Census Bureau scraper! Automate collection of detailed Census table data from data.census.gov using their public API. Get complete table information including metadata, variables, geographic data, and statistical values. Perfect for researchers, data analysts, policy makers, and businesses who need accurate, up-to-date Census data without manual work.

**Target Audience:** Data researchers, policy analysts, demographers, market researchers, government agencies, academic researchers, urban planners, business analysts  
**Primary Use Cases:** Demographic research, policy analysis, market research, academic studies, data-driven decision making, urban planning, business location analysis

## What Does US Census Bureau Scraper Do?

This tool extracts comprehensive Census table data from the US Census Bureau's public API, supporting both keyword search and direct table ID access. It delivers:

- **Table Metadata**: Complete table information including title, description, survey type, universe, year, and vintage
- **Geographic Information**: Geography levels and coverage areas (state, county, city, tract, etc.)
- **Variable Definitions**: Detailed variable definitions and metadata for each table
- **Table Data**: Actual data values and statistics
- **Source URLs**: Direct links to view tables on data.census.gov
- **Multiple Surveys**: Supports ACS, Decennial Census, Economic Census, Population Estimates, and more
- **Timestamps**: When each table was scraped

**Business Value:** Access authoritative Census data programmatically, analyze demographic trends, support policy decisions, conduct market research, identify business opportunities, and build comprehensive datasets for analysis.

## How to use the US Census Bureau Scraper - Full Demo

[YouTube video embed or link]

_Watch this 3-minute demo to see how easy it is to get started!_

## Input

To start scraping Census data, simply fill in the input form. You can scrape Census tables in two ways:

### Input Method: Search

- **searchQuery** - A search term to find Census tables by keyword (e.g., "population", "income by state", "housing units"). Use this OR tableId below, not both.
  - Example: "population", "income by state", "housing units", "education"
  - Uses Census Reporter API to find matching tables
  - Returns multiple matching tables

### Input Method: Direct Table ID

- **tableId** - A specific Census table ID to fetch directly (e.g., "ACSDT1Y2021.B01001"). Use this OR searchQuery above, not both.
  - Example: "ACSDT1Y2021.B01001", "ACSDT5Y2020.B17001"
  - Format: `{DATASET}{YEAR}.{TABLE_ID}` (e.g., ACSDT1Y2021 = ACS 1-Year Estimates 2021)
  - Returns a single table

### Optional Filters

- **dataset** - Filter by dataset type. Common options: ACS 1-Year Estimates, ACS 5-Year Estimates, Decennial Census, etc.
  - Options include:
    - American Community Survey 1-Year Estimates
    - American Community Survey 5-Year Estimates
    - ACS 1-Year Subject Tables
    - ACS 5-Year Subject Tables
    - Decennial Census Redistricting Data (PL 94-171)
    - Decennial Census Demographic Profile
    - Decennial Census Summary Files (SF1-SF4)
    - Population Estimates Program
    - County Business Patterns
    - Economic Surveys
    - And more (18 total options)

- **geography** - Filter by geography level. Note: Some geographies require state parameter. Use format like 'state:*' for all states, 'county:*' for all counties, or specific codes.
  - Options include:
    - United States (Nation)
    - State
    - County
    - Place (City/Town)
    - Census Tract
    - ZIP Code Tabulation Area
    - Congressional District
    - Metropolitan/Micropolitan Statistical Area
    - Urban Area
    - Block Group
    - School Districts (Elementary, Secondary, Unified)
    - And more (17 total options)

- **year** - Filter results by year/vintage (e.g., "2021", "2020"). Optional. Recent years: 2023, 2022, 2021, 2020, 2019, etc.
  - Example: "2021", "2020", "2019"

### Limits

- **maxItems** - Maximum number of tables to scrape (Free users: Limited to 100. Paid users: Optional, max 1,000,000).

Here's what the filled-out input schema looks like:

![Input Configuration](https://github.com/chipitaps/us-census-bureau-scraper/blob/main/docs/input.png?raw=true)

And here it is written in JSON:

```json
{
    "searchQuery": "population",
    "dataset": "acs/acs1",
    "geography": "state",
    "year": "2021",
    "maxItems": 10
}
```

Or for a specific table:

```json
{
    "tableId": "ACSDT1Y2021.B01001"
}
```

## Output

The actor outputs Census table data with the following structure. Each record contains comprehensive table information:

```json
{
    "tableId": "ACSDT1Y2021.B01001",
    "title": "SEX BY AGE",
    "description": "Detailed age and sex demographics",
    "survey": "American Community Survey",
    "universe": "Total population",
    "year": "2021",
    "vintage": "2021",
    "url": "https://data.census.gov/table?tid=ACSDT1Y2021.B01001",
    "geography": "United States",
    "variables": {
        "measures": [...],
        "dimensions": [...]
    },
    "data": {
        "GEO_ID": "...",
        "values": [...]
    },
    "scrapedTimestamp": "2025-12-09T18:30:00.000Z"
}
```

### Error Records

When table processing fails, error records are pushed to the dataset with the following structure:

```json
{
    "error": "Failed to process table",
    "tableId": "ACSDT1Y2023.INVALID123",
    "entityId": "optional-entity-id-from-search",
    "errorMessage": "Metadata request failed with status 404: Not Found",
    "scrapedTimestamp": "2025-12-09T18:30:00.000Z"
}
```

## How to Use

1. **Sign Up**: [Create a free account w/ $5 credit](https://console.apify.com/sign-up?fpr=vmoqkp) (takes 2 minutes)
2. **Find the Scraper**: Visit the US Census Bureau Scraper page
3. **Set Input**: Add your search query or table ID (we'll show you exactly what to enter)
4. **Run It**: Click "Start" and let it collect your Census data
5. **Download Data**: Get your results in the "Dataset" tab as CSV, Excel, or JSON

**Total Time:** Less than 5 minutes from sign-up to downloaded data  
**No Technical Skills Required:** Everything is point-and-click

## Business Use Cases

**Policy Analysts & Government Agencies:**

- Analyze demographic trends for policy decisions
- Track population changes over time
- Study income distribution and poverty rates
- Monitor housing and economic indicators
- Support evidence-based policy making

**Market Researchers & Business Analysts:**

- Identify target markets and demographics
- Analyze consumer behavior by location
- Research business location opportunities
- Study income and spending patterns
- Conduct competitive market analysis

**Academic Researchers:**

- Build comprehensive demographic databases
- Analyze population trends and patterns
- Study social and economic indicators
- Support academic publications with data
- Conduct longitudinal demographic studies

**Urban Planners & Real Estate Professionals:**

- Analyze neighborhood demographics
- Study housing and population density
- Track urban development trends
- Research location suitability
- Support planning decisions with data

**Data Analysts & Data Scientists:**

- Build comprehensive Census datasets
- Create regular demographic reports
- Support data-driven decision making
- Integrate Census data with other sources
- Perform statistical analysis on demographic data

## Using US Census Bureau Scraper with the Apify API

For advanced users who want to automate this process, you can control the scraper programmatically with the Apify API. This allows you to schedule regular data collection and integrate with your existing business tools.

- **Node.js**: Install the apify-client NPM package
- **Python**: Use the apify-client PyPI package
- See the [Apify API reference](https://docs.apify.com/api/v2) for full details

## Frequently Asked Questions

**Q: How does it work?**  
A: US Census Bureau Scraper is easy to use and requires no technical knowledge. Simply provide a search query or table ID, set your filters (optional), and let the tool collect the Census data automatically using the official Census Bureau API.

**Q: How accurate is the data?**  
A: The scraper extracts data directly from the US Census Bureau's official API (data.census.gov), ensuring high accuracy and up-to-date information. All fields are captured as they appear in the official Census data.

**Q: What Census surveys are supported?**  
A: The scraper supports multiple Census surveys including American Community Survey (ACS) 1-Year and 5-Year Estimates, Decennial Census, Population Estimates Program, Economic Census, County Business Patterns, and more.

**Q: Can I search for tables by keyword?**  
A: Yes! You can use the `searchQuery` parameter to find tables by keywords like "population", "income", "housing", etc. The scraper uses the Census Reporter API to find matching tables.

**Q: Can I filter by dataset, geography, or year?**  
A: Yes, you can filter results by dataset type (e.g., ACS 1-Year), geography level (e.g., state, county), and year/vintage using the optional filter parameters.

**Q: Can I scrape multiple tables?**  
A: Yes! When using search queries, the scraper automatically collects all matching tables up to your specified `maxItems` limit. You can also run multiple scraper instances for different searches.

**Q: Can I schedule regular runs?**  
A: Yes, you can schedule regular runs using Apify's scheduling features or the API to keep your Census data up-to-date automatically as new data is released.

**Q: What if a table fails to process?**  
A: The scraper is designed to handle errors gracefully. If a table fails to process completely, an error record is pushed to the dataset with details about what went wrong, while other tables continue processing.

**Q: What if I need help?**  
A: Our support team is available to help you get the most out of this tool. Contact us through the Apify platform for assistance.

**Q: Is my data secure?**  
A: Yes, all data is processed securely through Apify's platform. Your scraped data is stored securely and only accessible to you.

## Integrate US Census Bureau Scraper with any app and automate your workflow

Last but not least, US Census Bureau Scraper can be connected with almost any cloud service or web app thanks to [integrations](https://apify.com/integrations) on the Apify platform.

These includes:

- [Make](https://docs.apify.com/platform/integrations/make)
- [Zapier](https://docs.apify.com/platform/integrations/zapier)
- [Slack](https://docs.apify.com/platform/integrations/slack)
- [Airbyte](https://docs.apify.com/platform/integrations/airbyte)
- [GitHub](https://docs.apify.com/platform/integrations/github)
- [Google Drive](https://docs.apify.com/platform/integrations/drive)
- and [much more](https://docs.apify.com/platform/integrations).

Alternatively, you can use webhooks to carry out an action whenever an event occurs, e.g. get a notification whenever US Census Bureau Scraper successfully finishes a run.

## 🔗 Recommended Actors

Looking for more data collection tools? Check out these related actors:

| Actor | Description | Link |
|-------|-------------|------|
| PubMed Citation Scraper | Extracts academic citations and research data from PubMed | [https://apify.com/parseforge/pubmed-citation-scraper](https://apify.com/parseforge/pubmed-citation-scraper) |
| Hugging Face Model Scraper | Collects AI model information and metadata from Hugging Face | [https://apify.com/parseforge/hugging-face-model-scraper](https://apify.com/parseforge/hugging-face-model-scraper) |
| GSA eLibrary Scraper | Extracts government documents and publications from GSA eLibrary | [https://apify.com/parseforge/gsa-elibrary-scraper](https://apify.com/parseforge/gsa-elibrary-scraper) |
| PR Newswire Scraper | Collects press releases and news content from PR Newswire | [https://apify.com/parseforge/pr-newswire-scraper](https://apify.com/parseforge/pr-newswire-scraper) |

**Pro Tip:** 💡 Browse our complete collection of [data collection actors](https://apify.com/parseforge) to find the perfect tool for your business needs.

**Need Help?** Our support team is here to help you get the most out of this tool.

---

> **⚠️ Disclaimer:** This Actor is an independent tool and is not affiliated with, endorsed by, or sponsored by the US Census Bureau or any of its subsidiaries. All trademarks mentioned are the property of their respective owners.
