export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          active: boolean | null
          agency_name: string
          created_at: string | null
          id: string
          twilio_account_sid: string
          twilio_auth_token: string
          twilio_phone_number: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          agency_name: string
          created_at?: string | null
          id?: string
          twilio_account_sid: string
          twilio_auth_token: string
          twilio_phone_number: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          agency_name?: string
          created_at?: string | null
          id?: string
          twilio_account_sid?: string
          twilio_auth_token?: string
          twilio_phone_number?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          agency_id: string | null
          created_at: string | null
          full_name: string
          id: string
          note: string | null
          pax: number
          phone: string
          status: Database["public"]["Enums"]["registration_status"]
          tour_date_id: string
          tour_id: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string | null
          full_name: string
          id?: string
          note?: string | null
          pax?: number
          phone: string
          status?: Database["public"]["Enums"]["registration_status"]
          tour_date_id: string
          tour_id: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          note?: string | null
          pax?: number
          phone?: string
          status?: Database["public"]["Enums"]["registration_status"]
          tour_date_id?: string
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_tour_date_id_fkey"
            columns: ["tour_date_id"]
            isOneToOne: false
            referencedRelation: "tour_dates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_dates: {
        Row: {
          agency_id: string | null
          created_at: string | null
          departure_date: string
          id: string
          price_adult: number
          price_child: number | null
          price_single: number | null
          quota: number
          return_date: string | null
          tour_id: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string | null
          departure_date: string
          id?: string
          price_adult: number
          price_child?: number | null
          price_single?: number | null
          quota?: number
          return_date?: string | null
          tour_id: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string | null
          departure_date?: string
          id?: string
          price_adult?: number
          price_child?: number | null
          price_single?: number | null
          quota?: number
          return_date?: string | null
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_dates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_dates_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tours: {
        Row: {
          agency_id: string | null
          created_at: string | null
          currency: string
          destination: string
          gezilecek_yerler: string | null
          hareket_noktasi: string | null
          id: string
          konaklama: string | null
          min_pax: number | null
          program_kisa: string | null
          program_url: string | null
          title: string
          toplanma_saati: string | null
          tur_kategorisi: string | null
          tur_sure: string | null
          type: Database["public"]["Enums"]["tour_type"]
          ulasim: string | null
          visa_required: boolean | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string | null
          currency?: string
          destination: string
          gezilecek_yerler?: string | null
          hareket_noktasi?: string | null
          id?: string
          konaklama?: string | null
          min_pax?: number | null
          program_kisa?: string | null
          program_url?: string | null
          title: string
          toplanma_saati?: string | null
          tur_kategorisi?: string | null
          tur_sure?: string | null
          type: Database["public"]["Enums"]["tour_type"]
          ulasim?: string | null
          visa_required?: boolean | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string | null
          currency?: string
          destination?: string
          gezilecek_yerler?: string | null
          hareket_noktasi?: string | null
          id?: string
          konaklama?: string | null
          min_pax?: number | null
          program_kisa?: string | null
          program_url?: string | null
          title?: string
          toplanma_saati?: string | null
          tur_kategorisi?: string | null
          tur_sure?: string | null
          type?: Database["public"]["Enums"]["tour_type"]
          ulasim?: string | null
          visa_required?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tours_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          agency_id: string | null
          content: string
          created_at: string
          id: string
          phone: string
          role: string
        }
        Insert: {
          agency_id?: string | null
          content: string
          created_at?: string
          id?: string
          phone: string
          role: string
        }
        Update: {
          agency_id?: string | null
          content?: string
          created_at?: string
          id?: string
          phone?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_agency_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "agency"
      registration_status: "NEW" | "PENDING" | "CONFIRMED" | "CANCELLED"
      tour_type: "DAYTRIP" | "N2" | "N3"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "agency"],
      registration_status: ["NEW", "PENDING", "CONFIRMED", "CANCELLED"],
      tour_type: ["DAYTRIP", "N2", "N3"],
    },
  },
} as const
