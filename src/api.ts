import log from '@apify/log';
import type { RawCensusEntity, RawCensusTable } from './types.js';

const BASE_API_URL = 'https://data.census.gov/api';
const BASE_SEARCH_URL = 'https://data.census.gov';

/**
 * Searches for tables using Census Reporter API and converts to Census Bureau format
 * The Census Reporter API provides table search functionality that the Census Bureau API lacks
 */
export async function searchCensusData(
    query: string,
    size: number = 50,
    page: number = 0,
    datasetFilter?: string,
    yearFilter?: string
): Promise<RawCensusEntity[]> {
    try {
        // Use Census Reporter API for table search
        const CENSUS_REPORTER_API = 'https://api.censusreporter.org/1.0/table/search';
        const url = `${CENSUS_REPORTER_API}?q=${encodeURIComponent(query)}`;
        
        log.info('Fetching search results from Census Reporter API', { query, url });

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; CensusScraper/1.0)',
            },
        });

        if (!response.ok) {
            throw new Error(`Search request failed with status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Extract unique table IDs from Census Reporter results
        const tableIdsSet = new Set<string>();
        const entities: RawCensusEntity[] = [];
        
        // Census Reporter returns an array of results with table_id field
        if (Array.isArray(data)) {
            for (const item of data) {
                if (item.table_id && !tableIdsSet.has(item.table_id)) {
                    tableIdsSet.add(item.table_id);
                    
                    // Try to find the full table ID format by searching Census Bureau API
                    const baseTableId = item.table_id;
                    const fullTableId = await findFullTableId(baseTableId, datasetFilter, yearFilter);
                    
                    if (fullTableId) {
                        entities.push({
                            id: fullTableId,
                            title: item.table_name || item.simple_table_name || baseTableId,
                            description: item.table_name,
                            type: 'table',
                            metadata: {
                                tableId: baseTableId,
                                tableName: item.table_name,
                                simpleTableName: item.simple_table_name,
                            },
                        } as RawCensusEntity);
                    }
                }
                
                // Stop if we have enough results (before pagination)
                if (entities.length >= size * 2) {
                    break;
                }
            }
        }

        // Apply pagination
        const startIndex = page * size;
        const endIndex = startIndex + size;
        const paginatedEntities = entities.slice(startIndex, endIndex);

        log.info('Search results fetched successfully', {
            query,
            entitiesFound: paginatedEntities.length,
            totalFound: entities.length,
        });

        return paginatedEntities;
    } catch (error) {
        log.error('Failed to fetch search results', {
            error: error instanceof Error ? error.message : String(error),
            query,
        });
        throw error;
    }
}

/**
 * Attempts to find the full table ID format (e.g., ACSDT1Y2021.B01001) from a base table ID (e.g., B01001)
 * Tries common dataset/year combinations and returns the first valid one found
 * Can be filtered by dataset and year parameters
 */
async function findFullTableId(
    baseTableId: string,
    datasetFilter?: string,
    yearFilter?: string
): Promise<string | null> {
    // Map dataset codes to table ID prefixes
    const datasetPrefixMap: Record<string, string[]> = {
        'acs/acs1': ['ACSDT1Y'],
        'acs/acs5': ['ACSDT5Y'],
        'acs/acs1/subject': ['ACSSDT1Y'],
        'acs/acs5/subject': ['ACSSDT5Y'],
        'dec/pl': ['DECENNIALPL'],
        'dec/dp': ['DECENNIALDP'],
        'dec/sf1': ['DECENNIALSF1'],
        'dec/sf2': ['DECENNIALSF2'],
        'dec/sf3': ['DECENNIALSF3'],
        'dec/sf4': ['DECENNIALSF4'],
    };

    // Determine which dataset prefixes to try
    let datasets: string[] = ['ACSDT1Y', 'ACSDT5Y']; // Default: ACS 1-year and 5-year estimates
    
    if (datasetFilter) {
        // Use the dataset filter to determine prefixes
        const mappedPrefixes = datasetPrefixMap[datasetFilter];
        if (mappedPrefixes) {
            datasets = mappedPrefixes;
        } else {
            // Try to infer from dataset code
            if (datasetFilter.includes('acs1')) {
                datasets = ['ACSDT1Y'];
            } else if (datasetFilter.includes('acs5')) {
                datasets = ['ACSDT5Y'];
            } else if (datasetFilter.includes('dec')) {
                datasets = ['DECENNIALPL', 'DECENNIALDP'];
            }
        }
    }

    // Determine which years to try
    let recentYears = ['2023', '2022', '2021', '2020', '2019'];
    if (yearFilter) {
        // Use the year filter - try the specified year first
        recentYears = [yearFilter, ...recentYears.filter(y => y !== yearFilter)];
    }
    
    // Try to fetch metadata for possible table IDs
    for (const dataset of datasets) {
        for (const year of recentYears) {
            const fullTableId = `${dataset}${year}.${baseTableId}`;
            try {
                const testUrl = `${BASE_API_URL}/search/metadata/table?id=${encodeURIComponent(fullTableId)}`;
                const response = await fetch(testUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    },
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.response?.metadataContent || data.metadataContent) {
                        // Found a valid table ID, return it
                        return fullTableId;
                    }
                }
            } catch {
                // Table doesn't exist with this combination, continue
                continue;
            }
        }
    }
    
    // If no full format found, try returning base table ID (might work for some endpoints)
    // But most Census Bureau endpoints require full format
    return null;
}

/**
 * Fetches table metadata by table ID
 */
export async function fetchTableMetadata(tableId: string): Promise<RawCensusTable> {
    try {
        const url = `${BASE_API_URL}/search/metadata/table?id=${encodeURIComponent(tableId)}`;
        
        log.info('Fetching table metadata', { tableId, url });

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; CensusScraper/1.0)',
            },
        });

        if (!response.ok) {
            throw new Error(`Metadata request failed with status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        log.info('Table metadata fetched successfully', {
            tableId,
            hasData: !!data,
        });

        // Extract metadata from nested response structure
        const metadataContent = data.response?.metadataContent || data.metadataContent || data;
        
        return {
            id: tableId,
            title: metadataContent.title || data.response?.title,
            description: metadataContent.description || data.response?.description,
            universe: metadataContent.universe || data.response?.universe,
            year: metadataContent.dataset?.vintage || data.response?.dataset?.vintage,
            vintage: metadataContent.dataset?.vintage || data.response?.dataset?.vintage,
            survey: metadataContent.dataset?.name || data.response?.dataset?.name,
            url: `https://data.census.gov/table?tid=${tableId}`,
            metadata: metadataContent,
        } as RawCensusTable;
    } catch (error) {
        log.error('Failed to fetch table metadata', {
            error: error instanceof Error ? error.message : String(error),
            tableId,
        });
        throw error;
    }
}

/**
 * Fetches table data by table ID
 */
export async function fetchTableData(tableId: string): Promise<RawCensusTable> {
    try {
        const url = `${BASE_API_URL}/access/data/table?id=${encodeURIComponent(tableId)}`;
        
        log.info('Fetching table data', { tableId, url });

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; CensusScraper/1.0)',
            },
        });

        if (!response.ok) {
            throw new Error(`Table data request failed with status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        log.info('Table data fetched successfully', {
            tableId,
            hasData: !!data,
        });

        // Extract data from nested response structure
        const responseData = data.response?.data || data.data || [];
        const tableInfo = data.response || data;
        
        return {
            id: tableId,
            tableId: tableInfo.tableId || tableInfo.objectId || tableId,
            data: responseData,
            metadata: {
                dataURI: tableInfo.dataURI,
                metadataURI: tableInfo.metadataURI,
                dataAPIURI: tableInfo.dataAPIURI,
                metadataAPIURI: tableInfo.metadataAPIURI,
            },
        } as RawCensusTable;
    } catch (error) {
        log.error('Failed to fetch table data', {
            error: error instanceof Error ? error.message : String(error),
            tableId,
        });
        throw error;
    }
}

/**
 * Fetches facets (filter options) for search
 */
export async function fetchFacets(facetType: 'topics' | 'datasets' | 'vintages', query?: string): Promise<Record<string, unknown>> {
    try {
        let url = `${BASE_API_URL}/search?facets=${facetType}&services=facets`;
        if (query) {
            url += `&q=${encodeURIComponent(query)}`;
        }
        
        log.info('Fetching facets', { facetType, query, url });

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; CensusScraper/1.0)',
            },
        });

        if (!response.ok) {
            throw new Error(`Facets request failed with status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        log.info('Facets fetched successfully', {
            facetType,
            hasData: !!data,
        });

        return data as Record<string, unknown>;
    } catch (error) {
        log.error('Failed to fetch facets', {
            error: error instanceof Error ? error.message : String(error),
            facetType,
        });
        throw error;
    }
}

/**
 * Fetches all search results with pagination
 */
export async function fetchAllSearchResults(
    query: string,
    maxItems?: number,
    onResult?: (entity: RawCensusEntity) => Promise<void>,
    datasetFilter?: string,
    yearFilter?: string
): Promise<RawCensusEntity[]> {
    const allEntities: RawCensusEntity[] = [];
    const PAGE_SIZE = 50;
    let currentPage = 0;
    let hasMore = true;

    while (hasMore) {
        // Check if we've reached maxItems before making another request
        if (maxItems && allEntities.length >= maxItems) {
            break;
        }

        const entities = await searchCensusData(query, PAGE_SIZE, currentPage, datasetFilter, yearFilter);
        
        if (entities.length === 0) {
            hasMore = false;
            break;
        }

        for (const entity of entities) {
            // Check maxItems before processing
            if (maxItems && allEntities.length >= maxItems) {
                hasMore = false;
                break;
            }

            allEntities.push(entity);
            
            if (onResult) {
                await onResult(entity);
            }
        }

        // Check if we got fewer results than requested (last page)
        if (entities.length < PAGE_SIZE) {
            hasMore = false;
        }

        currentPage++;

        // Add delay between requests to be respectful
        if (hasMore && (!maxItems || allEntities.length < maxItems)) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return allEntities;
}

