const CUSTOMERS_KEY = 'kundeapp_customers';
const APPOINTMENTS_KEY = 'kundeapp_appointments';

export function getCustomers() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '[]');
  } catch { return []; }
}

export function saveCustomers(customers) {
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
}

export function getAppointments() {
  try {
    return JSON.parse(localStorage.getItem(APPOINTMENTS_KEY) || '[]');
  } catch { return []; }
}

export function saveAppointments(appointments) {
  localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(appointments));
}

export function newId() {
  return crypto.randomUUID();
}
