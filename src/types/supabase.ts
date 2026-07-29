export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CreatedSourceType = 'WEB' | 'ADMIN' | 'SYSTEM' | 'API' | 'MOBILE' | 'AUTOMATION';

export type BookingStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAYMENT_PROCESSING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'DRIVER_ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RENTAL_ACTIVE'
  | 'PICKUP_SCHEDULED'
  | 'OUT_FOR_PICKUP'
  | 'PICKED_UP'
  | 'COMPLETED'
  | 'CANCELLATION_REQUESTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REJECTED'
  | 'REFUNDED'
  | 'PAYMENT_FAILED';

export interface Database {
  public: {
    Tables: {
      subscription_plans: {
        Row: {
          id: string;
          name: string;
          slug: string;
          price_monthly: number;
          price_annual: number;
          max_inventory_units: number;
          max_staff_accounts: number;
          max_bookings_per_month: number;
          max_branches: number;
          features: Json;
          is_active: boolean;
          is_archived: boolean;
          archived_at: string | null;
          archived_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['subscription_plans']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['subscription_plans']['Insert']>;
      };
      tenants: {
        Row: {
          id: string;
          public_id: string;
          name: string;
          slug: string;
          plan_id: string;
          status: 'trial' | 'active' | 'suspended' | 'cancelled';
          trial_ends_at: string | null;
          owner_id: string | null;
          billing_email: string | null;
          custom_domain: string | null;
          is_custom_domain_verified: boolean;
          version: number;
          created_source: CreatedSourceType;
          is_deleted: boolean;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          is_archived: boolean;
          archived_at: string | null;
          archived_by: string | null;
          created_at: string;
          updated_at: string;
          metadata: Json;
        };
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'public_id' | 'created_at' | 'updated_at' | 'version'> & {
          id?: string;
          public_id?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          email: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          is_active: boolean;
          version: number;
          created_source: CreatedSourceType;
          is_deleted: boolean;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'public_id' | 'created_at' | 'updated_at' | 'version'> & {
          public_id?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      packages: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          slug: string;
          tagline: string | null;
          description: string | null;
          price_4_hours: number;
          price_8_hours: number;
          price_full_day: number;
          featured_image_url: string | null;
          gallery_urls: string[];
          inclusions: Json;
          max_guests: string | null;
          sound_rating: string | null;
          is_featured: boolean;
          is_popular: boolean;
          is_published: boolean;
          version: number;
          is_deleted: boolean;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['packages']['Row'], 'id' | 'created_at' | 'updated_at' | 'version'> & {
          id?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['packages']['Insert']>;
      };
      inventory_units: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          package_id: string;
          serial_number: string;
          status: 'READY_TO_DEPLOY' | 'IN_USE' | 'UNDER_REPAIR' | 'RETIRED';
          condition_notes: string | null;
          version: number;
          is_deleted: boolean;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory_units']['Row'], 'id' | 'public_id' | 'created_at' | 'updated_at' | 'version'> & {
          id?: string;
          public_id?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['inventory_units']['Insert']>;
      };
      bookings: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          customer_id: string;
          package_id: string;
          assigned_unit_id: string | null;
          assigned_delivery_personnel_id: string | null;
          vehicle_info: string | null;
          status: BookingStatus;
          event_date: string;
          start_time: string;
          duration_hours: number;
          event_end_time: string;
          delivery_address: string;
          delivery_zone: string | null;
          special_instructions: string | null;
          subtotal_amount: number;
          surcharge_amount: number;
          delivery_fee: number;
          discount_amount: number;
          grand_total: number;
          deposit_amount: number;
          balance_amount: number;
          snapshot: Json;
          terms_accepted_at: string | null;
          terms_policy_version: string | null;
          terms_policy_path: string | null;
          version: number;
          created_source: CreatedSourceType;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bookings']['Row'], 'id' | 'public_id' | 'created_at' | 'updated_at' | 'version'> & {
          id?: string;
          public_id?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
      };
      inventory_locks: {
        Row: {
          id: string;
          tenant_id: string;
          package_id: string;
          event_date: string;
          session_id: string;
          expires_at: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory_locks']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['inventory_locks']['Insert']>;
      };
      payments: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          booking_id: string;
          payment_type: 'deposit' | 'balance' | 'full' | 'refund';
          payment_method: 'gcash' | 'maya' | 'card' | 'cash' | 'bank_transfer';
          amount: number;
          status: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';
          gateway_transaction_id: string | null;
          gateway_response: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'public_id' | 'created_at' | 'updated_at'> & {
          id?: string;
          public_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      webhook_inbox: {
        Row: {
          id: string;
          tenant_id: string;
          provider: string;
          event_id: string;
          event_type: string;
          payload: Json;
          status: 'pending' | 'processing' | 'processed' | 'failed' | 'poison';
          attempts: number;
          max_attempts: number;
          last_error: string | null;
          next_retry_at: string | null;
          processed_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['webhook_inbox']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['webhook_inbox']['Insert']>;
      };
      idempotency_keys: {
        Row: {
          id: string;
          tenant_id: string;
          key: string;
          user_id: string | null;
          request_path: string;
          request_hash: string;
          response_status: number | null;
          response_body: Json | null;
          status: 'processing' | 'completed' | 'failed';
          expires_at: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['idempotency_keys']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['idempotency_keys']['Insert']>;
      };
      booking_timeline_events: {
        Row: {
          id: string;
          tenant_id: string;
          booking_id: string;
          from_status: string | null;
          to_status: string;
          event_label: string;
          event_description: string | null;
          performed_by: string | null;
          performed_by_role: string | null;
          is_system_event: boolean;
          metadata: Json;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['booking_timeline_events']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['booking_timeline_events']['Insert']>;
      };
      roles: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_system_role: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['roles']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['roles']['Insert']>;
      };
      permissions: {
        Row: {
          id: string;
          action: string;
          category: string;
          description: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['permissions']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['permissions']['Insert']>;
      };
      role_permissions: {
        Row: {
          role_id: string;
          permission_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['role_permissions']['Row'], 'created_at'> & {
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['role_permissions']['Insert']>;
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role_id: string;
          tenant_id: string;
          assigned_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_roles']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_roles']['Insert']>;
      };
      settings: {
        Row: {
          id: string;
          tenant_id: string;
          namespace: string;
          key: string;
          value: Json;
          data_type: 'string' | 'number' | 'boolean' | 'json' | 'url' | 'image_url' | 'html' | 'markdown';
          label: string;
          description: string | null;
          validation_rules: Json;
          is_public: boolean;
          is_sensitive: boolean;
          version: number;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['settings']['Row'], 'id' | 'created_at' | 'updated_at' | 'version'> & {
          id?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['settings']['Insert']>;
      };
      settings_history: {
        Row: {
          id: string;
          setting_id: string;
          tenant_id: string;
          previous_value: Json;
          new_value: Json;
          changed_by: string | null;
          changed_at: string;
          reason: string | null;
        };
        Insert: Omit<Database['public']['Tables']['settings_history']['Row'], 'id' | 'changed_at'> & {
          id?: string;
          changed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['settings_history']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          tenant_id: string;
          performed_by: string | null;
          performed_by_role: string | null;
          action: string;
          category: string;
          entity_type: string | null;
          entity_id: string | null;
          entity_label: string | null;
          before_state: Json | null;
          after_state: Json | null;
          diff: Json | null;
          metadata: Json;
          ip_address: string | null;
          user_agent: string | null;
          request_id: string | null;
          correlation_id: string | null;
          request_duration_ms: number | null;
          device_type: string | null;
          country_code: string | null;
          browser: string | null;
          severity: 'info' | 'warning' | 'critical';
          created_source: CreatedSourceType;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
      inventory_maintenance_logs: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          unit_id: string;
          previous_status: string;
          new_status: string;
          reason: string;
          notes: string | null;
          performed_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory_maintenance_logs']['Row'], 'id' | 'public_id' | 'created_at'> & {
          id?: string;
          public_id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['inventory_maintenance_logs']['Insert']>;
      };
      delivery_assignment_logs: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          booking_id: string;
          previous_assignee_id: string | null;
          previous_vehicle_info: string | null;
          assignee_id: string;
          vehicle_info: string | null;
          notes: string | null;
          assigned_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['delivery_assignment_logs']['Row'], 'id' | 'public_id' | 'created_at'> & {
          id?: string;
          public_id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['delivery_assignment_logs']['Insert']>;
      };
      customer_cancellation_requests: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          booking_id: string;
          customer_id: string;
          previous_status: string;
          new_status: string;
          reason: string;
          processed_by: string | null;
          processed_at: string | null;
          decision: string | null;
          decision_notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customer_cancellation_requests']['Row'], 'id' | 'public_id' | 'created_at'> & {
          id?: string;
          public_id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['customer_cancellation_requests']['Insert']>;
      };
      reviews: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          booking_id: string;
          customer_id: string;
          rating: number;
          comment: string | null;
          is_published: boolean;
          is_deleted: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'id' | 'public_id' | 'created_at' | 'updated_at'> & {
          id?: string;
          public_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['reviews']['Insert']>;
      };
      expense_categories: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          name: string;
          code: string;
          description: string | null;
          is_active: boolean;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['expense_categories']['Row'], 'id' | 'public_id' | 'created_at' | 'updated_at'> & {
          id?: string;
          public_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['expense_categories']['Insert']>;
      };
      expenses: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          category_id: string;
          amount: number;
          expense_date: string;
          vendor: string | null;
          description: string;
          payment_method: string;
          receipt_url: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
        };
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'public_id' | 'created_at' | 'updated_at'> & {
          id?: string;
          public_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>;
      };
      expense_logs: {
        Row: {
          id: string;
          tenant_id: string;
          expense_id: string;
          action: string;
          previous_data: unknown | null;
          new_data: unknown | null;
          performed_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['expense_logs']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['expense_logs']['Insert']>;
      };
      promo_codes: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          code: string;
          discount_type: 'FIXED' | 'PERCENTAGE';
          discount_value: number;
          min_booking_amount: number;
          max_discount_amount: number | null;
          max_usage_limit: number | null;
          current_usage_count: number;
          per_customer_limit: number;
          start_date: string;
          end_date: string;
          is_active: boolean;
          is_deleted: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['promo_codes']['Row'], 'id' | 'public_id' | 'created_at' | 'updated_at'> & {
          id?: string;
          public_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['promo_codes']['Insert']>;
      };
      promo_code_redemptions: {
        Row: {
          id: string;
          tenant_id: string;
          promo_code_id: string;
          booking_id: string;
          customer_id: string;
          discount_applied_amount: number;
          redeemed_at: string;
        };
        Insert: Omit<Database['public']['Tables']['promo_code_redemptions']['Row'], 'id' | 'redeemed_at'> & {
          id?: string;
          redeemed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['promo_code_redemptions']['Insert']>;
      };
      delivery_checklists: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          booking_id: string;
          checklist_type: 'PRE_DELIVERY' | 'POST_PICKUP';
          microphones_ok: boolean;
          speakers_ok: boolean;
          display_screen_ok: boolean;
          cables_remote_ok: boolean;
          notes: string | null;
          inspected_by: string;
          inspected_at: string;
        };
        Insert: Omit<Database['public']['Tables']['delivery_checklists']['Row'], 'id' | 'public_id' | 'inspected_at'> & {
          id?: string;
          public_id?: string;
          inspected_at?: string;
        };
        Update: Partial<Database['public']['Tables']['delivery_checklists']['Insert']>;
      };
      proof_of_deliveries: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          booking_id: string;
          customer_signature_url: string | null;
          signed_at: string | null;
          signer_name: string | null;
          signer_contact: string | null;
          device_type: string | null;
          signature_version: string | null;
          notes: string | null;
          delivered_by: string;
          delivered_at: string;
        };
        Insert: Omit<Database['public']['Tables']['proof_of_deliveries']['Row'], 'id' | 'public_id' | 'delivered_at'> & {
          id?: string;
          public_id?: string;
          delivered_at?: string;
        };
        Update: Partial<Database['public']['Tables']['proof_of_deliveries']['Insert']>;
      };
      proof_of_delivery_photos: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          pod_id: string;
          photo_url: string;
          photo_type: string;
          caption: string | null;
          uploaded_by: string;
          uploaded_at: string;
        };
        Insert: Omit<Database['public']['Tables']['proof_of_delivery_photos']['Row'], 'id' | 'public_id' | 'uploaded_at'> & {
          id?: string;
          public_id?: string;
          uploaded_at?: string;
        };
        Update: Partial<Database['public']['Tables']['proof_of_delivery_photos']['Insert']>;
      };
      incidents: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          booking_id: string;
          unit_id: string | null;
          severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
          incident_type: 'DAMAGE' | 'MISSING_ITEM' | 'EQUIPMENT_FAILURE' | 'ACCIDENT';
          description: string;
          estimated_cost: number | null;
          status: 'REPORTED' | 'UNDER_REVIEW' | 'RESOLVED';
          reported_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['incidents']['Row'], 'id' | 'public_id' | 'created_at' | 'updated_at'> & {
          id?: string;
          public_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['incidents']['Insert']>;
      };
      incident_photos: {
        Row: {
          id: string;
          public_id: string;
          tenant_id: string;
          incident_id: string;
          photo_url: string;
          caption: string | null;
          uploaded_by: string;
          uploaded_at: string;
        };
        Insert: Omit<Database['public']['Tables']['incident_photos']['Row'], 'id' | 'public_id' | 'uploaded_at'> & {
          id?: string;
          public_id?: string;
          uploaded_at?: string;
        };
        Update: Partial<Database['public']['Tables']['incident_photos']['Insert']>;
      };
    };
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: {
      created_source_type: CreatedSourceType;
    };
  };
}
