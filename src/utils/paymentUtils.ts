export const buildMercadoPagoPayerFromUser = (user: any, address: any) => {
  if (!user) return null;

  return {
    email: user.email,
    first_name: user.firstName || user.fullName?.split(' ')[0] || '',
    last_name: user.lastName || user.fullName?.split(' ').slice(1).join(' ') || '',
    identification: {
      type: 'CPF',
      number: user.cpf ? user.cpf.replace(/\D/g, '') : '',
    },
    phone: {
      area_code: user.whatsapp ? user.whatsapp.substring(0, 2) : '',
      number: user.whatsapp ? user.whatsapp.substring(2) : '',
    },
    address: address ? {
      zip_code: address.zipCode || '',
      street_name: address.street || '',
      street_number: address.number || '',
      neighborhood: address.neighborhood || '',
      city: address.city || '',
      federal_unit: address.state || '',
    } : undefined
  };
};
