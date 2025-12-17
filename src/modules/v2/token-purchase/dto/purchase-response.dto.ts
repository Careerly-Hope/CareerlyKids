export class PurchaseResponseDto {
    success: boolean;
    message: string;
    paymentId: string;
    reference: string;
    authorizationUrl: string;
    amount: number;
    currency: string;
    quote?: {
      quantity: number;
      pricePerToken: number;
      totalPrice: number;
      discount: number;
      savings: number;
    };
  }