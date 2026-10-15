// Puerto de pagos: elige el adaptador según PAYMENT_PROVIDER.
// Contrato: { name, createCheckout, getPayment, parseNotification, charge? }
import { createMercadoPagoGateway } from './mercadopago.gateway.js';
import { createSimulatedGateway } from './simulated.gateway.js';

export function createPaymentGateway(config) {
  const { provider, mercadoPagoAccessToken, mercadoPagoWebhookSecret } = config.payments;
  if (provider === 'mercadopago') {
    return createMercadoPagoGateway({
      accessToken: mercadoPagoAccessToken,
      webhookSecret: mercadoPagoWebhookSecret,
      appUrl: config.appUrl,
    });
  }
  if (provider === 'simulated') return createSimulatedGateway();
  throw new Error(`PAYMENT_PROVIDER desconocido: ${provider}`);
}
