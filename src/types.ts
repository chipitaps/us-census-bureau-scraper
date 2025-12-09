// TypeScript interfaces for the US Census Bureau scraper

export interface CensusInput {
    searchQuery?: string;
    geography?: string;
    year?: string;
    dataset?: string;
    topics?: string[];
    maxItems?: number;
}

// Raw search result entity from Census API
export interface RawCensusEntity {
    id?: string;
    title?: string;
    description?: string;
    type?: string;
    url?: string;
    metadata?: Record<string, unknown>;
}

// Raw table data from Census API
export interface RawCensusTable {
    id?: string;
    title?: string;
    description?: string;
    universe?: string;
    survey?: string;
    year?: string;
    vintage?: string;
    url?: string;
    data?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

// Flattened output interface for Census table data
export interface OutputCensusTable {
    tableId: string;
    title: string;
    description?: string;
    survey?: string;
    universe?: string;
    year?: string;
    vintage?: string;
    url: string;
    geography?: string;
    variables?: Record<string, unknown>;
    data?: Record<string, unknown>;
    scrapedTimestamp: string;
}

// Error output interface for failed processing
export interface OutputError {
    error: string;
    tableId?: string;
    entityId?: string;
    errorMessage: string;
    scrapedTimestamp: string;
}

// Union type for all possible output types
export type CensusOutput = OutputCensusTable | OutputError;

