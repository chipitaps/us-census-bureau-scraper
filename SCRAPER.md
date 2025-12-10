# US Census Bureau Scraper

🚀 Extract comprehensive Census data from the US Census Bureau's data.census.gov website using their public API! Automate collection of detailed table data, metadata, variables, and geographic information from various Census surveys including American Community Survey (ACS), Decennial Census, Economic Census, and more. Perfect for researchers, data analysts, policy makers, and businesses who need accurate, up-to-date Census data without manual work.

**Target Audience:** Data researchers, policy analysts, demographers, market researchers, government agencies, academic researchers  
**Primary Use Cases:** Demographic research, policy analysis, market research, academic studies, data-driven decision making

## What Does US Census Bureau Scraper Do?

This tool extracts comprehensive Census table data from the US Census Bureau's public API, supporting both keyword search and direct table ID access. It delivers:

- **Table Metadata**: Complete table information including title, description, survey type, universe, year, and vintage
- **Geographic Information**: Geography levels and coverage areas
- **Variable Definitions**: Detailed variable definitions and metadata for each table
- **Table Data**: Actual data values and statistics
- **Source URLs**: Direct links to view tables on data.census.gov
- **Timestamps**: When each table was scraped

**Business Value:** Access authoritative Census data programmatically, analyze demographic trends, support policy decisions, conduct market research, and build comprehensive datasets for analysis.

## How to use the US Census Bureau Scraper - Full Demo

[YouTube video embed or link]

_Watch this 3-minute demo to see how easy it is to get started!_

## Input

To start scraping Census data, simply fill in the input form. You can scrape Census tables in two ways:

### Input Method: Search

- **searchQuery** (string): Search term to find Census tables by keyword
  - Example: "population", "income by state", "housing units", "education"
  - Uses Census Reporter API to find matching tables
  - Returns multiple matching tables

### Input Method: Direct Table ID

- **tableId** (string): Specific Census table ID to fetch directly
  - Example: "ACSDT1Y2021.B01001", "ACSDT5Y2020.B17001"
  - Format: `{DATASET}{YEAR}.{TABLE_ID}` (e.g., ACSDT1Y2021 = ACS 1-Year Estimates 2021)
  - Returns a single table

**Note:** Use either `searchQuery` OR `tableId`, not both.

### Optional Filters

- **dataset** (enum): Filter by dataset type
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

- **geography** (enum): Filter by geography level
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

- **year** (string): Filter results by year/vintage
  - Example: "2021", "2020", "2019"
  - Recent years: 2023, 2022, 2021, 2020, etc.

### Limits

- **maxItems** (integer, optional): Maximum number of tables to scrape
  - Free users: Automatically limited to 100 items
  - Paid users: Optional, up to 1,000,000 (leave empty for all results)

Here's what the filled-out input schema looks like:

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
    "tableId": "ACSDT1Y2021.B01001",
    "maxItems": 1
}
```

## Output

After the Actor finishes its run, you'll get a dataset with the output. The length of the dataset depends on the number of tables you've requested. You can download those results as Excel, HTML, XML, JSON, and CSV documents.

Here's an example of scraped Census table data you'll get:

```json
{
    "tableId": "ACSDT1Y2021.B01001",
    "title": "SEX BY AGE",
    "description": "Detailed age and sex demographics for the total population",
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
        "values": [...],
        "geographicData": [...]
    },
    "scrapedTimestamp": "2025-12-09T18:00:00.000Z"
}
```

**What You Get:**
- **Table Identification**: Unique table IDs for tracking and referencing
- **Complete Metadata**: Title, description, survey type, universe coverage
- **Temporal Information**: Year and vintage for time-series analysis
- **Geographic Coverage**: Geography levels and coverage areas
- **Variable Definitions**: Detailed definitions of all variables in the table
- **Actual Data**: Real data values and statistics
- **Source Links**: Direct URLs to view tables on Census Bureau website
- **Timestamps**: Track when data was scraped

**Download Options:** CSV, Excel, or JSON formats for easy analysis in your preferred tools

## Why Choose the US Census Bureau Scraper?

- **Authoritative Data Source**: Access official US Census Bureau data directly from their public API
- **Multiple Survey Types**: Support for ACS, Decennial Census, Economic Census, Population Estimates, and more
- **Flexible Search Options**: Search by keyword or access specific tables directly by ID
- **Comprehensive Data**: Get metadata, variables, geography, and actual data in one extraction
- **Advanced Filtering**: Filter by dataset type, geography level, and year for precise data collection
- **Time Savings**: Collect Census data programmatically instead of manual downloads
- **Scalable**: Process up to 1,000,000 tables for comprehensive data collection
- **Free Tier Available**: Try with up to 100 items on the free plan

**Time Savings:** What would take hours of manual navigation and downloads is now done automatically in minutes  
**Efficiency:** Collect comprehensive Census data at scale across multiple surveys and years simultaneously  
**Accuracy:** Direct API access ensures you get the latest official Census data

## How to Use

1. **Sign Up**: [Create a free account w/ $5 credit](https://console.apify.com/sign-up?fpr=vmoqkp) (takes 2 minutes)
2. **Find the Scraper**: Visit the US Census Bureau Scraper page
3. **Set Input**: 
   - For search: Enter a search query like "income" or "housing"
   - For specific table: Enter a table ID like "ACSDT1Y2021.B01001"
   - (Optional) Set filters for dataset, geography, or year
   - Set maxItems if needed
4. **Run It**: Click "Start" and let it collect your Census data
5. **Download Data**: Get your results in the "Dataset" tab as CSV, Excel, or JSON

**Total Time:** Less than 5 minutes from sign-up to downloaded data  
**No Technical Skills Required:** Everything is point-and-click

## Business Use Cases

**Researchers & Academics:**

- Build comprehensive demographic databases
- Conduct longitudinal studies across multiple years
- Analyze population trends and patterns
- Access authoritative data for research papers

**Policy Makers & Government Agencies:**

- Access Census data for policy analysis
- Monitor demographic changes over time
- Support evidence-based decision making
- Track population and economic indicators

**Market Researchers:**

- Analyze demographic trends for target markets
- Study income and housing patterns
- Track population shifts for business planning
- Understand geographic market characteristics

**Data Analysts:**

- Build Census data pipelines for regular updates
- Create dashboards with Census data
- Integrate Census data into existing datasets
- Automate data collection workflows

**Businesses:**

- Understand market demographics
- Analyze potential customer bases
- Track regional economic indicators
- Support location planning decisions

## Using US Census Bureau Scraper with the Apify API

For advanced users who want to automate this process, you can control the scraper programmatically with the Apify API. This allows you to schedule regular data collection and integrate with your existing business tools.

- **Node.js**: Install the apify-client NPM package
- **Python**: Use the apify-client PyPI package
- See the [Apify API reference](https://docs.apify.com/api/v2) for full details

### Example API Call

```javascript
const { ApifyClient } = require('apify-client');

const client = new ApifyClient({
    token: 'YOUR_API_TOKEN',
});

const run = await client.actor('us-census-bureau-scraper').call({
    searchQuery: 'income',
    dataset: 'acs/acs1',
    geography: 'state',
    year: '2021',
    maxItems: 10,
});
```

## Supported Datasets

The scraper supports a wide variety of Census datasets:

- **American Community Survey (ACS)**
  - 1-Year Estimates
  - 5-Year Estimates
  - Subject Tables
- **Decennial Census**
  - Redistricting Data (PL 94-171)
  - Demographic Profile
  - Summary Files (SF1-SF4)
- **Population Estimates Program**
- **Economic Census**
- **County Business Patterns**
- **Economic Surveys**
- **And more...**

## Supported Geography Levels

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
- School Districts
- And more geographic levels

## API Endpoints Used

The actor uses the following Census Bureau API endpoints:

- **Census Reporter API**: `/1.0/table/search` - Search for tables by keyword
- **Census Bureau API**: `/api/search/metadata/table` - Get table metadata
- **Census Bureau API**: `/api/access/data/table` - Get table data

## Limitations

- Free users are automatically limited to 100 items per run
- API rate limits may apply (the actor includes delays between requests)
- Some tables may require additional parameters for specific geographic areas
- Table IDs must be in the correct format: `{DATASET}{YEAR}.{TABLE_ID}`

## Frequently Asked Questions

**Q: How does it work?**  
A: The US Census Bureau Scraper uses the official Census Bureau public API and Census Reporter API to access Census data. Simply provide a search query or table ID, set your filters, and let the tool collect the data automatically.

**Q: How accurate is the data?**  
A: The scraper accesses data directly from the US Census Bureau's official APIs, ensuring high accuracy and up-to-date information. All data comes from authoritative Census Bureau sources.

**Q: Can I scrape multiple tables?**  
A: Yes! Use a search query to find multiple matching tables, or run multiple scraper instances for different table IDs. You can also use the Apify API to automate collection across multiple tables.

**Q: Can I schedule regular runs?**  
A: Yes, you can schedule regular runs using Apify's scheduling features or the API to keep your Census data up-to-date automatically.

**Q: What if I need help?**  
A: Our support team is available to help you get the most out of this tool. Contact us through the Apify platform for assistance.

**Q: Is my data secure?**  
A: Yes, all data is processed securely through Apify's platform. Your scraped data is stored securely and only accessible to you.

**Q: What's the difference between 1-Year and 5-Year ACS estimates?**  
A: 1-Year estimates provide data for geographic areas with populations of 65,000+, while 5-Year estimates provide data for all geographic areas but have larger margins of error. Choose based on your geographic needs.

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
| GSA eLibrary Scraper | Extracts government documents and publications from GSA eLibrary | [https://apify.com/parseforge/gsa-elibrary-scraper](https://apify.com/parseforge/gsa-elibrary-scraper) |
| PubMed Citation Scraper | Extracts academic citations and research data from PubMed | [https://apify.com/parseforge/pubmed-citation-scraper](https://apify.com/parseforge/pubmed-citation-scraper) |
| PR Newswire Scraper | Collects press releases and news content from PR Newswire | [https://apify.com/parseforge/pr-newswire-scraper](https://apify.com/parseforge/pr-newswire-scraper) |
| Government Data Scraper | Collects data from various government sources | [Search Apify](https://apify.com/store) |

**Pro Tip:** 💡 Browse our complete collection of [data collection actors](https://apify.com/store) to find the perfect tool for your business needs.

**Need Help?** Our support team is here to help you get the most out of this tool.

---

> **⚠️ Disclaimer:** This Actor is an independent tool and is not affiliated with, endorsed by, or sponsored by the US Census Bureau or any of its subsidiaries. All trademarks mentioned are the property of their respective owners. This scraper accesses publicly available data through the Census Bureau's public API.


