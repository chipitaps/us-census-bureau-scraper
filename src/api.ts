import log from '@apify/log';
import type { RawCensusEntity, RawCensusTable } from './types.js';

const BASE_API_URL = 'https://data.census.gov/api';
const BASE_SEARCH_URL = 'https://data.census.gov';

// Delay between API requests to avoid rate limiting
// Increased to 300ms to reduce 429 errors with batch processing
const REQUEST_DELAY_MS = 300;

/**
 * Helper function to add a delay between requests
 */
async function delay(ms: number = REQUEST_DELAY_MS): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Expands broad economic/demographic queries to relevant Census table categories
 * This improves relevance because Census tables use specific terminology, not broad academic terms
 */
function expandBroadQueries(query: string): string[] {
    const lowerQuery = query.toLowerCase().trim();
    
    // Map broad terms to specific Census categories
    const broadQueryMap: Record<string, string[]> = {
        'economics': ['income', 'employment', 'industry', 'occupation', 'business', 'economic'],
        'economic': ['income', 'employment', 'industry', 'occupation', 'business'],
        'demographics': ['population', 'age', 'sex', 'race', 'ethnicity', 'demographic'],
        'demographic': ['population', 'age', 'sex', 'race', 'ethnicity'],
        'socioeconomic': ['income', 'poverty', 'education', 'employment', 'occupation'],
        'social': ['population', 'family', 'household', 'marital status', 'education'],
    };
    
    if (broadQueryMap[lowerQuery]) {
        return broadQueryMap[lowerQuery];
    }
    
    return [query]; // Return original if no expansion needed
}

/**
 * Normalizes search query by trying common variations (plural/singular, etc.)
 * This helps because Census Reporter API does exact substring matching on table names
 */
function normalizeSearchQuery(query: string): string[] {
    const variations: string[] = [query]; // Always try original query first
    
    // Check for broad queries that need expansion
    const expanded = expandBroadQueries(query);
    if (expanded.length > 1) {
        // This is a broad query - use expanded terms instead of just plural/singular
        return expanded;
    }
    
    // Common plural/singular variations for specific queries
    const pluralToSingular: Record<string, string> = {
        'economics': 'economic',
        'demographics': 'demographic',
        'statistics': 'statistic',
        'populations': 'population',
        'incomes': 'income',
        'employments': 'employment',
        'housings': 'housing',
        'educations': 'education',
    };
    
    const singularToPlural: Record<string, string> = {
        'economic': 'economics',
        'demographic': 'demographics',
        'statistic': 'statistics',
    };
    
    // Check if query is a plural that should be singular
    const lowerQuery = query.toLowerCase();
    if (pluralToSingular[lowerQuery]) {
        variations.push(pluralToSingular[lowerQuery]);
    }
    
    // Check if query is a singular that might need plural
    if (singularToPlural[lowerQuery]) {
        variations.push(singularToPlural[lowerQuery]);
    }
    
    // If query ends with 's' and is longer than 3 chars, try without 's'
    if (query.length > 3 && query.toLowerCase().endsWith('s') && !variations.includes(query.slice(0, -1))) {
        variations.push(query.slice(0, -1));
    }
    
    // Remove duplicates while preserving order
    return Array.from(new Set(variations));
}

/**
 * Searches for tables using Census Reporter API and converts to Census Bureau format
 * The Census Reporter API provides table search functionality that the Census Bureau API lacks
 * Tries multiple query variations to improve search results
 */
export async function searchCensusData(
    query: string,
    _size: number = 50, // Kept for API compatibility, not used internally (API returns all results)
    _page: number = 0,  // Kept for API compatibility, not used internally (API returns all results)
    datasetFilter?: string,
    yearFilter?: string
): Promise<RawCensusEntity[]> {
    try {
        // Get query variations to try
        const queryVariations = normalizeSearchQuery(query);
        const allEntities: RawCensusEntity[] = [];
        const seenTableIds = new Set<string>();
        
        // Try each query variation
        for (const searchQuery of queryVariations) {
            // Use Census Bureau API search endpoint to get REAL table IDs directly
            // This returns actual table instances with real IDs, not base IDs that need to be constructed
            // Include year filter in URL if provided (this ensures the API filters at the source)
            // Support pagination with from and size parameters
            let url = `${BASE_API_URL}/search?q=${encodeURIComponent(searchQuery)}&type=table`;
            if (yearFilter) {
                url += `&y=${encodeURIComponent(yearFilter)}`;
            }
            // Add pagination parameters (from and size)
            const from = _page * _size;
            url += `&from=${from}&size=${_size}`;
            

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (compatible; CensusScraper/1.0)',
                },
            });

            if (!response.ok) {
                // Log error but continue with next variation
                log.warning(`Search variation failed: ${searchQuery}`, {
                    status: response.status,
                    statusText: response.statusText,
                });
                await delay(); // Delay even on errors to respect rate limits
                continue;
            }

            const data = await response.json();
            await delay(); // Delay after successful request
            
            // Extract tables from response structure - these contain REAL table IDs in instances
            const tables = data.response?.tables?.tables || [];
            const totalAvailable = data.response?.tables?.total || 0;
            
            
            for (const table of tables) {
                const instances = table.instances || [];
                
                for (const instance of instances) {
                    // Get the REAL table ID from the instance (these are actual IDs from the API, not constructed)
                    const realTableId = instance.id;
                    
                    if (!realTableId || seenTableIds.has(realTableId)) {
                        continue;
                    }
                    
                    // Apply dataset filter if specified
                    if (datasetFilter) {
                        // Match dataset filter (e.g., "acs/acs1" should match "ACSDT1Y")
                        const instanceId = realTableId.toUpperCase();
                        
                        if (datasetFilter.includes('acs1') && !instanceId.includes('ACSDT1Y') && !instanceId.includes('ACSSDT1Y')) {
                            continue;
                        }
                        if (datasetFilter.includes('acs5') && !instanceId.includes('ACSDT5Y') && !instanceId.includes('ACSSDT5Y')) {
                            continue;
                        }
                        if (datasetFilter.includes('dec') && !instanceId.includes('DECENNIAL')) {
                            continue;
                        }
                    }
                    
                    // Apply year filter if specified
                    if (yearFilter) {
                        // Match year filter (check if vintage or table ID contains the year)
                        const instanceVintage = instance.vintage || '';
                        const tableIdYear = realTableId.match(/(\d{4})\./)?.[1];
                        
                        if (instanceVintage !== yearFilter && tableIdYear !== yearFilter) {
                            continue;
                        }
                    }
                    
                    seenTableIds.add(realTableId);
                    
                    allEntities.push({
                        id: realTableId, // Use the REAL table ID from the API instance
                        title: instance.description || table.description || realTableId,
                        description: instance.description || table.description,
                        type: 'table',
                        url: `https://data.census.gov/table?tid=${realTableId}`,
                        metadata: {
                            provider: instance.provider,
                            vintage: instance.vintage,
                            universe: instance.universe,
                            program: instance.program,
                        },
                    } as RawCensusEntity);
                }
            }
            
            // After processing all instances from this query variation, continue to next variation
            // Don't stop early - we want to collect ALL results and let pagination handle limiting
        }

        // Return all entities found - pagination is handled by fetchAllSearchResults
        // The Census Bureau API returns all results in one response, so we return all of them

        return allEntities;
    } catch (error) {
        log.error('Failed to fetch search results', {
            error: error instanceof Error ? error.message : String(error),
            query,
        });
        throw error;
    }
}

/**
 * Fetches table metadata by table ID
 */
export async function fetchTableMetadata(tableId: string): Promise<RawCensusTable> {
    try {
        const url = `${BASE_API_URL}/search/metadata/table?id=${encodeURIComponent(tableId)}`;
        

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; CensusScraper/1.0)',
            },
        });

        if (!response.ok) {
            await delay(); // Delay even on errors
            throw new Error(`Metadata request failed with status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        await delay(); // Delay after successful request
        

        // Extract metadata from nested response structure
        const metadataContent = data.response?.metadataContent || data.metadataContent || data;
        
        // Get the ACTUAL table ID from the API response (it may differ from what we requested)
        // The API response might include the actual tableId in metadata or response
        const actualTableId = metadataContent?.tableId || 
                             data.response?.tableId || 
                             data.response?.objectId || 
                             metadataContent?.id ||
                             tableId; // Fallback to requested ID
        
        // Extract year from table ID (format: DATASETYEAR.TABLEID, e.g., ACSDT1Y2023.B10010)
        // The year in the table ID is the reference year (data year)
        let extractedYear: string | undefined;
        const yearMatch = actualTableId.match(/(\d{4})\./); // Match 4 digits before the dot
        if (yearMatch) {
            extractedYear = yearMatch[1];
        }
        
        // Vintage is the release/publication year, typically from dataset.vintage
        // Year is the reference year (when the data refers to), can be from dataset.year or extracted from table ID
        const datasetData = metadataContent.dataset || data.response?.dataset;
        
        return {
            id: actualTableId, // Use the actual table ID from the API
            title: metadataContent.title || data.response?.title,
            description: metadataContent.description || data.response?.description,
            universe: metadataContent.universe || data.response?.universe,
            year: datasetData?.year || extractedYear || datasetData?.vintage,
            vintage: datasetData?.vintage || datasetData?.year || extractedYear,
            survey: datasetData?.name || data.response?.dataset?.name,
            url: `https://data.census.gov/table?tid=${actualTableId}`,
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
        

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; CensusScraper/1.0)',
            },
        });

        if (!response.ok) {
            await delay(); // Delay even on errors
            throw new Error(`Table data request failed with status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        await delay(); // Delay after successful request
        

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
 * Fetches all search results with pagination
 */
export async function fetchAllSearchResults(
    query: string,
    maxItems?: number,
    onEntity?: (entity: RawCensusEntity) => void,
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
            
            if (onEntity) {
                onEntity(entity);
            }
        }

        // Check if we got fewer results than requested (last page)
        if (entities.length < PAGE_SIZE) {
            hasMore = false;
        }

        currentPage++;

                // Add delay between requests to be respectful (200ms per request)
                if (hasMore && (!maxItems || allEntities.length < maxItems)) {
                    await delay();
                }
    }

    return allEntities;
}

