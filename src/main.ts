// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/).
import { Actor } from 'apify';
import log from '@apify/log';
import { searchCensusData, fetchTableData, fetchTableMetadata, fetchAllSearchResults, findFullTableId } from './api.js';
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
                // Check if tableId is a base ID (doesn't contain dot) or full ID
                // Base IDs are like "B06010", full IDs are like "ACSDT1Y2023.B06010"
                let fullTableId = tableId;
                const isBaseTableId = !tableId.includes('.');
                
                if (isBaseTableId) {
                    log.info('Detected base table ID, attempting to resolve full table ID', { baseTableId: tableId, dataset, year });
                    const resolvedId = await findFullTableId(tableId, dataset, year);
                    if (resolvedId) {
                        fullTableId = resolvedId;
                        log.info('Resolved base table ID to full table ID', { baseTableId: tableId, fullTableId });
                    } else {
                        log.warning('Could not resolve full table ID for base ID. Trying with base ID directly...', { baseTableId: tableId });
                        // Continue with base ID - might work for some endpoints
                    }
                }

                // Fetch both metadata and data using the resolved full table ID
                const [metadata, data] = await Promise.all([
                    fetchTableMetadata(fullTableId),
                    fetchTableData(fullTableId).catch(() => null), // Try to fetch data, but don't fail if unavailable
                ]);

                // Merge metadata and data, preserving metadata fields
                const table: RawCensusTable = {
                    id: fullTableId, // Use the resolved full table ID
                    ...metadata,
                    data: data?.data || metadata?.data,
                    // Preserve metadata from metadata response
                    metadata: (metadata?.metadata || metadata) as Record<string, unknown>,
                };

                const outputTable = mapCensusTable(table);
                totalFetched++;
                
                // Check if the output item exceeds Apify's size limit (~9 MB per item)
                const outputSize = Buffer.byteLength(JSON.stringify(outputTable), 'utf8');
                const MAX_ITEM_SIZE = 9 * 1024 * 1024; // 9 MB in bytes (Apify limit is ~9.4 MB)

                if (outputSize > MAX_ITEM_SIZE) {
                    log.warning(`Table ${fullTableId} exceeds size limit (${(outputSize / 1024 / 1024).toFixed(2)} MB), attempting to push without data field`, {
                        tableId: fullTableId,
                        sizeMB: (outputSize / 1024 / 1024).toFixed(2),
                    });

                    // Try pushing without the data field first
                    const withoutData: any = { ...outputTable };
                    delete withoutData.data;
                    withoutData.dataSizeMB = (outputSize / 1024 / 1024).toFixed(2);
                    withoutData.dataOmitted = 'Data field omitted due to size limit (exceeds 9 MB)';

                    let sizeWithoutData = Buffer.byteLength(JSON.stringify(withoutData), 'utf8');
                    
                    if (sizeWithoutData > MAX_ITEM_SIZE) {
                        // Still too large, also remove variables field
                        log.warning(`Table ${fullTableId} still too large after removing data (${(sizeWithoutData / 1024 / 1024).toFixed(2)} MB), removing variables field`, {
                            tableId: fullTableId,
                            sizeWithoutDataMB: (sizeWithoutData / 1024 / 1024).toFixed(2),
                        });

                        delete withoutData.variables;
                        withoutData.variablesOmitted = 'Variables field omitted due to size limit';
                        
                        sizeWithoutData = Buffer.byteLength(JSON.stringify(withoutData), 'utf8');
                    }

                    if (sizeWithoutData > MAX_ITEM_SIZE) {
                        // Even after removing data and variables, still too large - skip entirely
                        log.error(`Table ${fullTableId} is too large even after removing data and variables (${(sizeWithoutData / 1024 / 1024).toFixed(2)} MB), skipping entirely`, {
                            tableId: fullTableId,
                            finalSizeMB: (sizeWithoutData / 1024 / 1024).toFixed(2),
                        });
                        
                        const errorOutput = {
                            error: 'Table too large to process',
                            tableId: fullTableId,
                            errorMessage: `Data item too large (original size: ${outputSize} bytes, after removing data and variables: ${sizeWithoutData} bytes, limit: ${MAX_ITEM_SIZE} bytes).`,
                            scrapedTimestamp: new Date().toISOString(),
                        };

                        if (Actor.getChargingManager().getPricingInfo().isPayPerEvent) {
                            await Actor.pushData([errorOutput], 'error-item');
                        } else {
                            await Actor.pushData([errorOutput]);
                        }
                        totalPushed++;
                        return;
                    }

                    // Push version without data (and possibly without variables)
                    const omittedFields = [];
                    if (withoutData.dataOmitted) omittedFields.push('data');
                    if (withoutData.variablesOmitted) omittedFields.push('variables');
                    
                    if (Actor.getChargingManager().getPricingInfo().isPayPerEvent) {
                        await Actor.pushData([withoutData], 'result-item');
                    } else {
                        await Actor.pushData([withoutData]);
                    }
                    totalPushed++;
                    log.info(`✅ Processed table ${fullTableId} (omitted fields: ${omittedFields.join(', ')})`, {
                        totalFetched,
                        totalPushed,
                        originalTableId: tableId,
                        omittedFields: omittedFields.join(', '),
                    });
                } else {
                    // Normal case: push full table with data
                    if (Actor.getChargingManager().getPricingInfo().isPayPerEvent) {
                        await Actor.pushData([outputTable], 'result-item');
                    } else {
                        await Actor.pushData([outputTable]);
                    }
                    totalPushed++;

                    log.info(`✅ Processed table ${fullTableId}`, {
                        totalFetched,
                        totalPushed,
                        originalTableId: tableId,
                    });
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                log.error(`Failed to process table: ${tableId}`, {
                    error: errorMessage,
                    tableId,
                });
                
                // Push error to dataset so users can see what failed
                const errorOutput = {
                    error: 'Failed to process table',
                    tableId,
                    errorMessage,
                    scrapedTimestamp: new Date().toISOString(),
                };
                
                if (Actor.getChargingManager().getPricingInfo().isPayPerEvent) {
                    await Actor.pushData([errorOutput], 'error-item');
                } else {
                    await Actor.pushData([errorOutput]);
                }
                totalPushed++; // Count error as a pushed item
            }
        } else if (searchQuery) {
            // Search for tables and process them
            log.info('Searching for tables', { query: searchQuery });

            // Track processed table IDs to avoid duplicates
            const processedTableIds = new Set<string>();
            
            // Batch processing: collect entities and process in batches of 20
            const BATCH_SIZE = 20;
            
            // Callback function to collect entities (no processing yet, just collection)
            const onEntity = (_entity: RawCensusEntity) => {
                // Entity is collected by fetchAllSearchResults, no action needed here
            };
            
            // Function to process a batch of entities in parallel
            const processBatch = async (batch: RawCensusEntity[]) => {
                const batchPromises = batch.map(async (entity) => {
                // Extract table ID from entity
                // entity.id should already be a REAL full table ID from Census Bureau API (e.g., ACSDT1Y2023.B01001)
                // These are actual IDs from the API, not constructed
                const entityTableId = entity.id;
                
                // If entity.id is missing, skip this entity
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

                    // Check if the output item exceeds Apify's size limit (~9 MB per item)
                    // If it does, try pushing without the data field (metadata only)
                    const outputSize = Buffer.byteLength(JSON.stringify(outputTable), 'utf8');
                    const MAX_ITEM_SIZE = 9 * 1024 * 1024; // 9 MB in bytes (Apify limit is ~9.4 MB)

                    if (outputSize > MAX_ITEM_SIZE) {
                        log.warning(`Table ${entityTableId} exceeds size limit (${(outputSize / 1024 / 1024).toFixed(2)} MB), attempting to push without data field`, {
                            tableId: entityTableId,
                            sizeMB: (outputSize / 1024 / 1024).toFixed(2),
                        });

                        // Try pushing without the data field first
                        const withoutData: any = { ...outputTable };
                        delete withoutData.data;
                        withoutData.dataSizeMB = (outputSize / 1024 / 1024).toFixed(2);
                        withoutData.dataOmitted = 'Data field omitted due to size limit (exceeds 9 MB)';

                        let sizeWithoutData = Buffer.byteLength(JSON.stringify(withoutData), 'utf8');
                        
                        if (sizeWithoutData > MAX_ITEM_SIZE) {
                            // Still too large, also remove variables field
                            log.warning(`Table ${entityTableId} still too large after removing data (${(sizeWithoutData / 1024 / 1024).toFixed(2)} MB), removing variables field`, {
                                tableId: entityTableId,
                                sizeWithoutDataMB: (sizeWithoutData / 1024 / 1024).toFixed(2),
                            });

                            delete withoutData.variables;
                            withoutData.variablesOmitted = 'Variables field omitted due to size limit';
                            
                            sizeWithoutData = Buffer.byteLength(JSON.stringify(withoutData), 'utf8');
                        }

                        if (sizeWithoutData > MAX_ITEM_SIZE) {
                            // Even after removing data and variables, still too large - skip entirely
                            log.error(`Table ${entityTableId} is too large even after removing data and variables (${(sizeWithoutData / 1024 / 1024).toFixed(2)} MB), skipping entirely`, {
                                tableId: entityTableId,
                                finalSizeMB: (sizeWithoutData / 1024 / 1024).toFixed(2),
                            });
                            
                            const errorOutput = {
                                error: 'Table too large to process',
                                tableId: entityTableId,
                                entityId: entity.id,
                                errorMessage: `Data item too large (original size: ${outputSize} bytes, after removing data and variables: ${sizeWithoutData} bytes, limit: ${MAX_ITEM_SIZE} bytes).`,
                                scrapedTimestamp: new Date().toISOString(),
                            };

                            if (Actor.getChargingManager().getPricingInfo().isPayPerEvent) {
                                await Actor.pushData([errorOutput], 'error-item');
                            } else {
                                await Actor.pushData([errorOutput]);
                            }
                            totalPushed++;
                            return;
                        }

                        // Push version without data (and possibly without variables)
                        const omittedFields = [];
                        if (withoutData.dataOmitted) omittedFields.push('data');
                        if (withoutData.variablesOmitted) omittedFields.push('variables');
                        
                        if (Actor.getChargingManager().getPricingInfo().isPayPerEvent) {
                            await Actor.pushData([withoutData], 'result-item');
                        } else {
                            await Actor.pushData([withoutData]);
                        }
                        totalPushed++;
                        log.info(`✅ Processed table ${entityTableId} (omitted fields: ${omittedFields.join(', ')})`, {
                            totalFetched,
                            totalPushed,
                            omittedFields: omittedFields.join(', '),
                        });
                    } else {
                        // Normal case: push full table with data
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
                    }

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
                    
                    // Push error to dataset so users can see what failed
                    const errorOutput = {
                        error: 'Failed to process table',
                        tableId: entityTableId,
                        entityId: entity.id,
                        errorMessage,
                        scrapedTimestamp: new Date().toISOString(),
                    };
                    
                    if (Actor.getChargingManager().getPricingInfo().isPayPerEvent) {
                        await Actor.pushData([errorOutput], 'error-item');
                    } else {
                        await Actor.pushData([errorOutput]);
                    }
                    totalPushed++; // Count error as a pushed item
                    
                    // Continue processing other entities even if one fails
                    return;
                }

                });

                // Wait for all entities in the batch to complete
                await Promise.all(batchPromises);
            };

            // Fetch all search results with pagination and collect entities
            const entities = await fetchAllSearchResults(searchQuery, effectiveMaxItems, onEntity, dataset, year);
            
            // Process entities in batches of 20
            log.info(`Processing ${entities.length} entities in batches of ${BATCH_SIZE}`, {
                totalEntities: entities.length,
                batchSize: BATCH_SIZE,
            });

            for (let i = 0; i < entities.length; i += BATCH_SIZE) {
                // Check if we've reached maxItems
                if (effectiveMaxItems && totalPushed >= effectiveMaxItems) {
                    log.info(`⏹️ Reached maxItems limit (${effectiveMaxItems}), stopping batch processing`);
                    break;
                }

                const batch = entities.slice(i, i + BATCH_SIZE);
                const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
                const totalBatches = Math.ceil(entities.length / BATCH_SIZE);
                
                log.info(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} entities)`, {
                    batchStart: i + 1,
                    batchEnd: Math.min(i + BATCH_SIZE, entities.length),
                    totalEntities: entities.length,
                });

                await processBatch(batch);

                log.info(`✅ Completed batch ${batchNumber}/${totalBatches}`, {
                    totalFetched,
                    totalPushed,
                });

                // Add delay between batches to avoid rate limiting
                // Increased to 500ms to give API time to recover between batches
                if (i + BATCH_SIZE < entities.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            if (totalPushed > 0) {
                log.info(`🎉 Collection complete! Records processed: ${totalPushed}`);
            } else if (entities.length === 0) {
                log.warning('⚠️ Search query did not return any table entities from Census Reporter API.');
                log.info('💡 Tip: Try different search terms (e.g., "population", "income", "housing", "education"). You can also use the tableId parameter to fetch a specific table directly.');
            } else {
                log.warning(`⚠️ Found ${entities.length} entities but none could be processed (unable to resolve full table IDs)`);
                log.info('💡 Tip: Try adjusting the dataset or year filters, or use the tableId parameter to fetch a specific table directly.');
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

