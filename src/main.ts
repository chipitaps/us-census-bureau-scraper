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
        log.error('❌ Input is missing!');
        await Actor.pushData([{ error: 'Input is missing!' }]);
        await Actor.exit();
        return;
    }

    const { searchQuery, maxItems, dataset, geography, year } = input;

    // Detect user type - CRITICAL: Always use this method
    const userIsPaying = Boolean(Actor.getEnv()?.userIsPaying);
    log.info(userIsPaying ? '✅ Paid user detected' : '📋 Free user detected');

    // Log comprehensive input parameters for debugging
    log.info('🚀 Starting US Census Bureau data collection...', {
        userInput: {
            searchQuery: searchQuery || 'Not provided',
            maxItems: maxItems || 'Unlimited',
            dataset: dataset || 'Not specified',
            geography: geography || 'Not specified',
            year: year || 'Not specified',
        },
        systemInfo: {
            userType: userIsPaying ? 'Paid' : 'Free',
            maxItemsLimit: userIsPaying ? 1000000 : 100,
            validationStatus: 'Input parameters validated successfully',
        },
    });

    // Validate input
    if (!searchQuery) {
        log.error('❌ searchQuery is required. Please provide a search query.');
        await Actor.pushData([{ error: 'searchQuery is required. Please provide a search query.' }]);
        await Actor.exit();
        return;
    }

    // For free users: Auto-limit maxItems to 100 with warning (no errors)
    let effectiveMaxItems = maxItems;
    if (!userIsPaying) {
        if (maxItems === undefined || maxItems === null) {
            effectiveMaxItems = FREE_MAX_ITEMS;
            log.warning('⚠️ Free user did not specify maxItems. Automatically limiting to 100 items. Upgrade to a paid plan to process unlimited items (up to 1,000,000).');
        } else if (maxItems > FREE_MAX_ITEMS) {
            effectiveMaxItems = FREE_MAX_ITEMS;
            log.warning(`⚠️ Free user specified maxItems=${maxItems}, which exceeds the free plan limit of 100. Automatically limiting to 100 items. Upgrade to a paid plan to process up to 1,000,000 items.`);
        }
    } else if (userIsPaying && maxItems !== undefined && maxItems !== null && maxItems > 1000000) {
        const errorMessage = 'maxItems cannot exceed 1,000,000.';
        log.error('❌ maxItems exceeds maximum allowed value', { maxItems, maxAllowed: 1000000 });
        await Actor.pushData([{ error: errorMessage }]);
        await Actor.exit();
        return;
    }


    try {
        const startTime = Date.now();

        // Track statistics
        let totalFetched = 0;
        let totalPushed = 0;

        // Search for tables and process them
        if (searchQuery) {

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
                    return;
                }
                processedTableIds.add(entityTableId);

                totalFetched++;

                try {
                    // Fetch both metadata and data (like we do for direct table ID)
                    // Use entity metadata as fallback if API metadata fetch fails
                    let metadata: RawCensusTable;
                    try {
                        metadata = await fetchTableMetadata(entityTableId);
                    } catch (metadataError) {
                        // If metadata fetch fails (e.g., 403 for some table types like SOMATIMESERIES),
                        // use the entity data from search results as fallback
                        log.warning(`Metadata fetch failed for ${entityTableId}, using entity data as fallback`, {
                            tableId: entityTableId,
                            error: metadataError instanceof Error ? metadataError.message : String(metadataError),
                        });
                        
                        // Build metadata from entity data
                        metadata = {
                            id: entityTableId,
                            title: entity.title || entity.description || entityTableId,
                            description: entity.description,
                            year: entity.metadata?.vintage as string || undefined,
                            vintage: entity.metadata?.vintage as string || undefined,
                            survey: entity.metadata?.program as string || undefined,
                            universe: entity.metadata?.universe as string || undefined,
                            url: entity.url || `https://data.census.gov/table?tid=${entityTableId}`,
                            metadata: entity.metadata || {},
                        } as RawCensusTable;
                    }
                    
                    const data = await fetchTableData(entityTableId).catch(() => null); // Try to fetch data, but don't fail if unavailable

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
                        log.warning(`Table ${entityTableId} exceeds size limit (${(outputSize / 1024 / 1024).toFixed(2)} MB), attempting to push without variables field`, {
                            tableId: entityTableId,
                            sizeMB: (outputSize / 1024 / 1024).toFixed(2),
                        });

                        // Try pushing without the variables field first
                        const withoutVariables: any = { ...outputTable };
                        delete withoutVariables.variables;
                        withoutVariables.variablesOmitted = 'Variables field omitted due to size limit (exceeds 9 MB)';

                        let sizeWithoutVariables = Buffer.byteLength(JSON.stringify(withoutVariables), 'utf8');
                        
                        if (sizeWithoutVariables > MAX_ITEM_SIZE) {
                            // Still too large, also remove data field
                            log.warning(`Table ${entityTableId} still too large after removing variables (${(sizeWithoutVariables / 1024 / 1024).toFixed(2)} MB), removing data field`, {
                                tableId: entityTableId,
                                sizeWithoutVariablesMB: (sizeWithoutVariables / 1024 / 1024).toFixed(2),
                            });

                            delete withoutVariables.data;
                            withoutVariables.dataSizeMB = (outputSize / 1024 / 1024).toFixed(2);
                            withoutVariables.dataOmitted = 'Data field omitted due to size limit';
                            
                            sizeWithoutVariables = Buffer.byteLength(JSON.stringify(withoutVariables), 'utf8');
                        }

                        if (sizeWithoutVariables > MAX_ITEM_SIZE) {
                            // Even after removing variables and data, still too large - skip entirely
                            log.error(`Table ${entityTableId} is too large even after removing variables and data (${(sizeWithoutVariables / 1024 / 1024).toFixed(2)} MB), skipping entirely`, {
                                tableId: entityTableId,
                                finalSizeMB: (sizeWithoutVariables / 1024 / 1024).toFixed(2),
                            });
                            
                            const errorOutput = {
                                error: 'Table too large to process',
                                tableId: entityTableId,
                                entityId: entity.id,
                                errorMessage: `Data item too large (original size: ${outputSize} bytes, after removing variables and data: ${sizeWithoutVariables} bytes, limit: ${MAX_ITEM_SIZE} bytes).`,
                                scrapedTimestamp: new Date().toISOString(),
                            };

                            // Errors should NEVER use second argument, regardless of pricing model
                            await Actor.pushData([errorOutput]);
                            totalPushed++;
                            return;
                        }

                        // Remove undefined fields before pushing
                        const cleanedOutput = Object.fromEntries(
                            Object.entries(withoutVariables).filter(([_, value]) => value !== undefined)
                        );
                        
                        // Push version without variables (and possibly without data)
                        const omittedFields = [];
                        if (cleanedOutput.variablesOmitted) omittedFields.push('variables');
                        if (cleanedOutput.dataOmitted) omittedFields.push('data');
                        
                        if (Actor.getChargingManager().getPricingInfo().isPayPerEvent) {
                            await Actor.pushData([cleanedOutput], 'result-item');
                        } else {
                            await Actor.pushData([cleanedOutput]);
                        }
                        totalPushed++;
                    } else {
                        // Normal case: push full table with data
                        // Remove undefined fields before pushing
                        const cleanedOutput = Object.fromEntries(
                            Object.entries(outputTable).filter(([_, value]) => value !== undefined)
                        );
                        
                        if (Actor.getChargingManager().getPricingInfo().isPayPerEvent) {
                            await Actor.pushData([cleanedOutput], 'result-item');
                        } else {
                            await Actor.pushData([cleanedOutput]);
                        }
                        totalPushed++;

                    }
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
                    
                    // Errors should NEVER use second argument, regardless of pricing model
                    await Actor.pushData([errorOutput]);
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

            for (let i = 0; i < entities.length; i += BATCH_SIZE) {
                // Check if we've reached maxItems
                if (effectiveMaxItems && totalPushed >= effectiveMaxItems) {
                    break;
                }

                const batch = entities.slice(i, i + BATCH_SIZE);
                const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
                const totalBatches = Math.ceil(entities.length / BATCH_SIZE);
                

                await processBatch(batch);


                // Add delay between batches to avoid rate limiting
                // Increased to 500ms to give API time to recover between batches
                if (i + BATCH_SIZE < entities.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            if (totalPushed > 0) {
                log.info(`🎉 Collection complete! Records processed: ${totalPushed}`);
            } else if (entities.length === 0) {
                log.warning('⚠️ Search query did not return any table entities from Census Bureau API.');
                log.info('💡 Tip: Try different search terms (e.g., "population", "income", "housing", "education").');
            } else {
                log.warning(`⚠️ Found ${entities.length} entities but none could be processed (unable to resolve full table IDs)`);
                log.info('💡 Tip: Try adjusting the dataset or year filters to refine your search results.');
            }
        }


        const endTime = Date.now();
        const duration = endTime - startTime;

        log.info('📦 Done!', {
            totalFetched,
            totalPushed,
            duration: `${duration}ms`,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('❌ Error during Census Bureau data collection', {
            error: errorMessage,
        });
        await Actor.pushData([{ error: `Error during Census Bureau data collection: ${errorMessage}` }]);
        await Actor.exit();
        return;
    }
}

// Run the main function
await main();

// Gracefully exit the Actor process. It's recommended to call Actor.exit() when the Actor is finished.
await Actor.exit();

