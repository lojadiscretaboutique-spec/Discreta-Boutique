export function isSameBusinessDay(orderDateInput: any): boolean {
  if (!orderDateInput) return false;
  
  let orderDate: Date;
  if (orderDateInput.toDate) {
    orderDate = orderDateInput.toDate();
  } else if (orderDateInput.seconds) {
    orderDate = new Date(orderDateInput.seconds * 1000);
  } else {
    orderDate = new Date(orderDateInput);
  }

  // Compare local dates
  const today = new Date();
  
  return orderDate.getFullYear() === today.getFullYear() &&
         orderDate.getMonth() === today.getMonth() &&
         orderDate.getDate() === today.getDate();
}

export function canReverseOrder(order: any, cashRegister: any): boolean {
  if (!order) return false;
  
  // Se não foi encontrado caixa ou caixa fechado, não pode
  // Como o Firebase salva minúsculo 'aberto' e 'ABERTO' em alguns lugares, garantimos
  if (!cashRegister || String(cashRegister.status).toUpperCase() !== 'ABERTO') {
    return false;
  }
  
  // Status check (only allow if it's considered completed AND not already reversed/cancelled)
  const status = String(order.status).toUpperCase();
  if (status === 'ESTORNADO' || status === 'CANCELADO') return false;
  
  // It shouldn't be reversing if it hasn't been completed. Usually "ENTREGUE" means paid and done here
  if (status !== 'ENTREGUE') return false;
  
  return isSameBusinessDay(order.createdAt);
}
