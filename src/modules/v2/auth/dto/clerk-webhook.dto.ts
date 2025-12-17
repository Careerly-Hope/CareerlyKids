export interface ClerkWebhookEvent {
  data: {
    id: string;
    email_addresses: Array<{
      email_address: string;
      id: string;
    }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string;
    public_metadata: Record<string, any>;
    private_metadata: Record<string, any>;
    unsafe_metadata: Record<string, any>;
    created_at: number;
    updated_at: number;
  };
  object: 'event';
  type: 'user.created' | 'user.updated' | 'user.deleted';
}
