export interface MercadoPagoAdminConfig {
  enabled: boolean;
  environment: 'sandbox' | 'production';
  publicKey: string;
  accessToken: string;
  pixEnabled: boolean;
  creditCardEnabled: boolean;
  debitEnabled: boolean;
  webhookUrl: string;
  webhookConfigured: boolean;
  lastValidationAt?: string | null;
  lastValidationStatus?: string | null;
  accountName?: string | null;
  accountId?: string | null;
}

export const mercadoPagoIntegrationService = {
  async getConfig(): Promise<MercadoPagoAdminConfig> {
    const res = await fetch('/api/admin/mercadopago/config');
    if (!res.ok) throw new Error('Erro ao obter as configurações do Mercado Pago');
    return res.json();
  },

  async saveConfig(config: MercadoPagoAdminConfig): Promise<void> {
    const res = await fetch('/api/admin/mercadopago/save-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao salvar as configurações do Mercado Pago');
    }
  },

  async testConnection(accessToken?: string, publicKey?: string, environment?: 'sandbox' | 'production'): Promise<any> {
    const res = await fetch('/api/admin/mercadopago/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, publicKey, environment })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Falha no teste de conexão');
    }
    return res.json();
  }
};
