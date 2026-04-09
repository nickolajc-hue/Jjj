import AsyncStorage from '@react-native-async-storage/async-storage';

const CUSTOMERS_KEY = '@kundeapp_customers';
const APPOINTMENTS_KEY = '@kundeapp_appointments';

export async function getCustomers() {
  const json = await AsyncStorage.getItem(CUSTOMERS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveCustomers(customers) {
  await AsyncStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
}

export async function getAppointments() {
  const json = await AsyncStorage.getItem(APPOINTMENTS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveAppointments(appointments) {
  await AsyncStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(appointments));
}
