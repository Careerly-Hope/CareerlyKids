export interface PaystackWebhookDto {
  event: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: {
      userId: string;
      tokenType: 'INDIVIDUAL' | 'BULK';
      quantity: number;
      email: string;
      name: string;
      school?: string;
    };
    customer: {
      id: number;
      first_name: string | null;
      last_name: string | null;
      email: string;
    };
    authorization: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
    };
  };
}
