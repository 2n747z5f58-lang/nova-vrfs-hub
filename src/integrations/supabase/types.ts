// Generated database types. This is a placeholder until the project has tables —
// the schema-codegen step overwrites this file (e.g. `supabase gen types typescript`).
// After any migration, regenerate this so the client at ./client.ts stays type-safe.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: { [key: string]: never };
    Views: { [key: string]: never };
    Functions: { [key: string]: never };
    Enums: { [key: string]: never };
    CompositeTypes: { [key: string]: never };
  };
};
