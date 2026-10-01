/*
 * This file is a placeholder for Supabase types.
 * In a real scenario, you would run: supabase gen types typescript --local
 * But due to Docker issues, we're creating a basic version manually.
 *
 * To update with actual schema, run the supabase CLI command when Docker is available.
 */

/*
 * Example of what the types might look like based on migrations:
 *
 * From 0001_init.sql:
 * - vendors table
 * - snapshots table
 * - changes table
 * - changelog_entries table
 * - vendor_requests table
 * - runs table
 */

export type Database = {
  public: {
    Tables: {
      vendors: {
        Row: {
          id: string;
          slug: string;
          name: string;
          spec_url: string;
          spec_format: string;
          changelog: Json;
          poll_interval_minutes: number;
          poll_offset_minutes: number;
          etag: string | null;
          last_modified: string | null;
          last_content_hash: string | null;
          next_poll_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          spec_url: string;
          spec_format: string;
          changelog?: Json;
          poll_interval_minutes?: number;
          poll_offset_minutes?: number;
          etag?: string | null;
          last_modified?: string | null;
          last_content_hash?: string | null;
          next_poll_at?: string | null;
          last_error?: string | null;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          spec_url?: string;
          spec_format?: string;
          changelog?: Json;
          poll_interval_minutes?: number;
          poll_offset_minutes?: number;
          etag?: string | null;
          last_modified?: string | null;
          last_content_hash?: string | null;
          next_poll_at?: string | null;
          last_error?: string | null;
        };
        Relationships: [];
      };
      snapshots: {
        Row: {
          id: string;
          vendor_id: string;
          content_hash: string;
          size_bytes: number;
          storage_path: string;
          spec_version: string | null;
          parse_ok: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          content_hash: string;
          size_bytes: number;
          storage_path: string;
          spec_version?: string | null;
          parse_ok?: boolean;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          content_hash?: string;
          size_bytes?: number;
          storage_path?: string;
          spec_version?: string | null;
          parse_ok?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "snapshots_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedTable: "vendors";
            referencedColumns: ["id"];
          }
        ];
      };
      changes: {
        Row: {
          id: string;
          vendor_id: string;
          from_snapshot_id: string | null;
          to_snapshot_id: string;
          json_path: string;
          kind: string;
          severity: string;
          summary: string | null;
          impact_hint: string | null;
          seen_at: string | null;
          notified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          from_snapshot_id?: string | null;
          to_snapshot_id: string;
          json_path: string;
          kind: string;
          severity: string;
          summary?: string | null;
          impact_hint?: string | null;
          seen_at?: string | null;
          notified_at?: string | null;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          from_snapshot_id?: string | null;
          to_snapshot_id?: string;
          json_path?: string;
          kind?: string;
          severity?: string;
          summary?: string | null;
          impact_hint?: string | null;
          seen_at?: string | null;
          notified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "changes_from_snapshot_id_fkey";
            columns: ["from_snapshot_id"];
            isOneToOne: false;
            referencedTable: "snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "changes_to_snapshot_id_fkey";
            columns: ["to_snapshot_id"];
            isOneToOne: false;
            referencedTable: "snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "changes_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedTable: "vendors";
            referencedColumns: ["id"];
          }
        ];
      };
      changelog_entries: {
        Row: {
          id: string;
          vendor_id: string;
          external_id: string;
          title: string;
          url: string | null;
          published_at: string | null;
          content: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          external_id: string;
          title: string;
          url?: string | null;
          published_at?: string | null;
          content?: string | null;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          external_id?: string;
          title?: string;
          url?: string | null;
          published_at?: string | null;
          content?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "changelog_entries_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedTable: "vendors";
            referencedColumns: ["id"];
          }
        ];
      };
      vendor_requests: {
        Row: {
          id: string;
          vendor_id: string;
          requested_by: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          requested_by?: string | null;
          status?: string;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          requested_by?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendor_requests_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedTable: "vendors";
            referencedColumns: ["id"];
          }
        ];
      };
      runs: {
        Row: {
          id: string;
          vendor_id: string;
          started_at: string;
          status: string;
          changes_found: number;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          started_at?: string;
          status?: string;
          changes_found?: number;
          error?: string | null;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          started_at?: string;
          status?: string;
          changes_found?: number;
          error?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "runs_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedTable: "vendors";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type { Json };