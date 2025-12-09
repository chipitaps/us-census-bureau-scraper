# US Census Bureau Scraper

An Apify Actor for extracting Census data from the US Census Bureau's data.census.gov website using their public API.

## Features

- **Search Support**: Search for Census tables using keywords (e.g., "population", "income", "housing")
- **Direct Table Access**: Fetch specific tables by their table ID
- **Comprehensive Data**: Retrieves table metadata, variables, geographic information, and data values
- **Multiple Surveys**: Supports American Community Survey (ACS), Decennial Census, Economic Census, and more
- **Pagination**: Automatically handles pagination for search results
- **Free User Support**: Auto-limits to 100 items for free users with clear warnings

## Input Parameters

### Search Query (Mutually Exclusive with Table ID)
- **searchQuery** (string): Search term to find Census tables
  - Example: "population", "income by state", "housing units"

### Direct Table ID (Mutually Exclusive with Search Query)
- **tableId** (string): Specific Census table ID to fetch
  - Example: "ACSDT1Y2021.B01001"

### Optional Filters
- **year** (string): Filter results by year
- **dataset** (string): Filter by dataset type (e.g., "acs", "decennial")
- **geography** (string): Filter by geography level (e.g., "state", "county")

### Limits
- **maxItems** (integer, optional): Maximum number of tables to scrape
  - Free users: Automatically limited to 100
  - Paid users: Up to 1,000,000 (optional, leave empty for all results)

## Output

The actor outputs Census table data with the following structure:

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
    "variables": { ... },
    "data": { ... },
    "scrapedTimestamp": "2025-12-09T..."
}
```

## Usage Examples

### Search for Tables
```json
{
    "searchQuery": "population",
    "maxItems": 10
}
```

### Fetch Specific Table
```json
{
    "tableId": "ACSDT1Y2021.B01001"
}
```

## API Endpoints Used

The actor uses the following Census Bureau API endpoints:

- `/api/search` - Search for tables by keyword
- `/api/search/metadata/table` - Get table metadata
- `/api/access/data/table` - Get table data

## Limitations

- Free users are automatically limited to 100 items per run
- API rate limits may apply (the actor includes delays between requests)
- Some tables may require authentication or have access restrictions

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run locally
npm start

# Lint code
npm run lint

# Format code
npm run format
```

## License

ISC

