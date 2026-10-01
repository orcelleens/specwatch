# SpecWatch Architecture

## Overview

SpecWatch is a system that monitors API specification changes for vendors and notifies users of important updates. The architecture has been improved to enhance reliability, maintainability, and developer experience.

## Key Improvements

### 1. Authentication Simplification
- Removed email verification requirement for immediate dashboard access (Clerk-like experience)
- Migrated from deprecated `@supabase/auth-helpers-nextjs` to `@supabase/ssr` with `createBrowserClient`
- Improved auth flow with automatic sign-in after signup

### 2. Testing Infrastructure
- Implemented comprehensive test suite using Vitest with jsdom environment
- Added unit tests for core engine components (scheduler, classifier, differ, normalizer)
- Added integration tests for notification system
- Configured proper mocking strategies for external dependencies

### 3. Type Safety
- Generated Supabase database types using `supabase gen types`
- Added centralized configuration validation with Zod schema
- Improved TypeScript strictness across the codebase

### 4. Structured Logging
- Integrated Pino for structured, JSON-formatted logging
- Added contextual logging throughout the engine pipeline
- Configured development-friendly pretty printing and production JSON output

### 5. CI/CD Pipeline
- Added GitHub Actions workflow for automated testing, linting, and type checking
- Runs on every push and pull request to main branch
- Includes steps for dependency installation, type checking, linting, and testing

### 6. Configuration Management
- Centralized environment variable validation using Zod
- Created typed configuration singleton accessible throughout the application
- Improved error handling for missing or invalid configuration

## Engine Pipeline

The core engine follows a deterministic pipeline with optional LLM enhancement:

1. **Poll** - Check for vendor updates based on schedule
2. **Fetch** - Retrieve API specification with conditional headers (ETag/Last-Modified)
3. **Normalize** - Parse and normalize specification to consistent format
4. **Diff** - Compare current specification with previous version
5. **Classify** - Analyze changes for significance (deterministic + optional LLM)
6. **Store** - Save snapshots, changes, and metadata to Supabase
7. **Alert** - Notify users via email/Slack based on change importance

### Component Responsibilities

- **Scheduler**: Orchestrates the polling process, claims due vendors, manages timing budgets
- **Fetcher**: Handles HTTP requests to vendor spec URLs with caching headers
- **Normalizer**: Converts various spec formats (OpenAPI, etc.) to internal tree representation
- **Differ**: Computes changes between two normalized specification trees
- **Classifier**: Uses LLM (Groq) with template fallback to generate human-readable summaries
- **Changelog**: Processes vendor-provided changelogs when available
- **Store**: Persists data to Supabase with proper error handling
- **Storage**: Handles binary spec snapshots in Supabase Storage (gzipped)
- **Notifier**: Sends alerts via email (Resend) and Slack webhooks

## Data Model

See `src/types/supabase.ts` for the complete database schema, but key tables include:

- **vendors**: Tracked API vendors with polling configuration
- **snapshots**: Immutable records of fetched specifications (content-addressed)
- **changes**: Individual API modifications detected between snapshots
- **changelog_entries**: Vendor-provided release notes
- **vendor_requests**: User requests for new vendors to track
- **runs**: Execution history for monitoring and debugging

## Security Considerations

- Row Level Security (RLS) enabled on all Supabase tables
- Service role keys used only in trusted server environments
- API keys and tokens stored as environment variables
- Input validation and sanitization at system boundaries
- Prepared statements/parameterized queries for all database operations

## Performance Optimizations

- Conditional spec fetching reduces bandwidth usage
- Snapshot storage uses gzip compression to minimize storage costs
- Change batching for LLM processing respects monthly token budgets
- Memoization and caching where appropriate
- Efficient database queries with proper indexing

## Error Handling & Resilience

- Granular error handling with specific error types
- Exponential backoff for failed vendor polling
- Separation of concerns: changelog failures don't affect spec polling
- Parse errors recorded but don't crash-loop the vendor
- Comprehensive logging for debugging production issues

## Future Improvements

- Add metrics collection and monitoring (Prometheus/Grafana)
- Implement webhook-based spec change notifications where available
- Add vendor spec format auto-detection
- Enhance classification with more sophisticated ML models
- Add user-configurable notification filters
- Implement spec validation against known good schemas

## Deployment

Deployed to Vercel with:
- Serverless functions for API routes
- Cron jobs for scheduled polling (via Vercel Cron)
- Static site generation for marketing pages
- Environment variables managed through Vercel dashboard