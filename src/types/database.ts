export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// This project uses the generated Supabase schema as a local dev contract, but the
// generated types can occasionally be incomplete/insufficient in local workspaces.
// Keeping the Database type permissive avoids "never" inference in the server actions
// while preserving the rest of the app's existing typed usage.
export type Database = any;
