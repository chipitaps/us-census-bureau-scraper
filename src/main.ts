// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/).
import { Actor } from 'apify';
import log from '@apify/log';
import { searchCensusData, fetchTableData, fetchTableMetadata, fetchAllSearchResults } from './api.js';
import { mapCensusTable } from './mapper.js';
import type { CensusInput, RawCensusEntity, RawCensusTable } from './types.js';

const FREE_MAX_ITEMS = Number(process.env.FREE_MAX_ITEMS ?? 100);

// The init() call configures the Actor for its environment. It's recommended to start every Actor with an init().
await Actor.init();

log.info('🚀 Starting US Census Bureau data collection...');

async function main() {
    // Structure of input is defined in input_schema.json
    const input = await Actor.getInput<CensusInput>();
    if (!input) {
        log.error('Input is missing!');
        await Actor.exit();
        return;
    }

    log.info('📋 Configuration loaded', { input });

    const { searchQuery, tableId, maxItems, dataset, geography, year } = input;

    // Validate input
    if (!searchQuery && !tableId) {
        log.error('Either searchQuery or tableId is required. Please provide a search query or table ID.');
        await Actor.exit();
        return;
    }

    // Check if user is paying and validate maxItems accordingly
    let isPayingUser = true; // Default to paying user for local development

    try {
        const user = await Actor.apifyClient.user().get();
        isPayingUser = user.isPaying || false;
    } catch (error) {
        log.info('ℹ️ Running locally - defaulting to paying user mode', {
            error: error instanceof Error ? error.message : String(error),
        });
    }

    // For free users: Auto-limit maxItems to 100 with warning (no errors)
    let effectiveMaxItems = maxItems;
    if (!isPayingUser) {
        if (maxItems === undefined || maxItems === null) {
            effectiveMaxItems = FREE_MAX_ITEMS;
            log.warning('⚠️ Free user did not specify maxItems. Automatically limiting to 100 items. Upgrade to a paid plan to process unlimited items (up to 1,000,000).');
        } else if (maxItems > FREE_MAX_ITEMS) {
            effectiveMaxItems = FREE_MAX_ITEMS;
            log.warning(`⚠️ Free user specified maxItems=${maxItems}, which exceeds the free plan limit of 100. Automatically limiting to 100 items. Upgrade to a paid plan to process up to 1,000,000 items.`);
        }
    } else if (maxItems && maxItems > 1000000) {
        log.error('maxItems cannot exceed 1,000,000');
        await Actor.exit();
        return;
    }

    log.info('📡 Starting Census Bureau data collection', {
        searchQuery,
        tableId,
        maxItems: effectiveMaxItems,
        isPayingUser,
    });

    try {
        const startTime = Date.now();
        log.info(`📊 Collecting up to ${effectiveMaxItems || 'unlimited'} items`);

        // Track statistics
        let totalFetched = 0;
        let totalPushed = 0;

        // If tableId is provided, fetch that specific table
        if (tableId) {
            log.info('Fetching specific table', { tableId });

            try {
                // Fetch both metadata and data
                const [metadata, data] = await Promise.all([
                    fetchTableMetadata(tableId),
                    fetchTableData(tableId).catch(() => null), // Try to fetch data, but don't fail if unavailable
                ]);

                // Merge metadata and data, preserving metadata fields
                const table: RawCensusTable = {
                    id: tableId,
                    ...metadata,
                    data: data?.data || metadata?.data,
                    // Preserve metadata from metadata response
                    metadata: (metadata?.metadata || metadata) as Record<string, unknown>,
                };

                const outputTable = mapCensusTable(table);
                totalFetched++;
                
                if (Actor.getChargingManager().getPricingInfo().isPayPerEvent) {
                    await Actor.pushData([outputTable], 'result-item');
                } else {
                    await Actor.pushData([outputTable]);
                }
                totalPushed++;

                log.info(`✅ Processed table ${tableId}`, {
                    totalFetched,
                    totalPushed,
                });
            } catch (error) {
                log.error(`Failed to process table: ${tableId}`, {
                    error: error instanceof Error ? error.message : String(error),
                    tableId,
                });
            }
        } else if (searchQuery) {
            // Search for tables and process them
            log.info('Searching for tables', { query: searchQuery });

            // Track processed table IDs to avoid duplicates
            const processedTableIds = new Set<string>();
            
            // Callback function to process each result immediately
            const onResult = async (entity: RawCensusEntity) => {
                // Extract table ID from entity
                const entityTableId = entity.id || entity.metadata?.id as string;
                
                if (!entityTableId) {
                    log.warning('Entity missing ID, skipping', { entity });
                    return;
                }

                // Skip if we've already processed this table ID
                if (processedTableIds.has(entityTableId)) {
                    log.info(`⏭️ Skipping duplicate table ID: ${entityTableId}`);
                    return;
                }
                processedTableIds.add(entityTableId);

                totalFetched++;

                try {
                    // Fetch both metadata and data (like we do for direct table ID)
                    const [metadata, data] = await Promise.all([
                        fetchTableMetadata(entityTableId),
                        fetchTableData(entityTableId).catch(() => null), // Try to fetch data, but don't fail if unavailable
                    ]);

                    // Merge metadata and data, preserving metadata fields
                    const table: RawCensusTable = {
                        id: entityTableId,
                        ...metadata,
                        data: data?.data || metadata?.data,
                        metadata: (metadata?.metadata || metadata) as Record<string, unknown>,
                    };

                    const outputTable = mapCensusTable(table);

                    if (Actor.getChargingManager().getPricingInfo().isPayPerEvent) {
                        await Actor.pushData([outputTable], 'result-item');
                    } else {
                        await Actor.pushData([outputTable]);
                    }
                    totalPushed++;

                    log.info(`✅ Processed table ${entityTableId}`, {
                        totalFetched,
                        totalPushed,
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    log.error(`Failed to process entity: ${entity.id}`, {
                        error: errorMessage,
                        entityId: entity.id,
                    });
                    // Continue processing other entities even if one fails
                    return;
                }

                // If we have maxItems and we've reached the limit, we can stop processing
                if (effectiveMaxItems && totalPushed >= effectiveMaxItems) {
                    log.info(`⏹️ Reached maxItems limit (${effectiveMaxItems}), stopping`);
                    return;
                }
            };

            // Fetch all search results with pagination
            const entities = await fetchAllSearchResults(searchQuery, effectiveMaxItems, onResult, dataset, year);

            if (totalPushed > 0) {
                log.info(`🎉 Collection complete! Records processed: ${totalPushed}`);
            } else if (entities.length === 0) {
                log.warning('⚠️ Search query did not return any table entities. The Census Bureau search API returns topic/facet suggestions, not direct table results.');
                log.info('💡 Tip: Use the tableId parameter instead. You can find table IDs on data.census.gov by browsing tables or using the website search.');
            } else {
                log.warning(`⚠️ Found ${entities.length} entities but none could be processed (missing table IDs)`);
                log.info('💡 Tip: The search API returns topic suggestions. Use the tableId parameter for reliable table extraction.');
            }
        }

        log.info(`💾 Saved ${totalPushed} items to dataset`);

        const endTime = Date.now();
        const duration = endTime - startTime;

        log.info('📦 Done!', {
            totalFetched,
            totalPushed,
            duration: `${duration}ms`,
        });
    } catch (error) {
        log.error('Error during Census Bureau data collection', {
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}

// Run the main function
await main();

// Gracefully exit the Actor process. It's recommended to call Actor.exit() when the Actor is finished.
await Actor.exit();

