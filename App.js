import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import DashboardScreen from './src/screens/DashboardScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import CustomerDetailScreen from './src/screens/CustomerDetailScreen';
import AddEditCustomerScreen from './src/screens/AddEditCustomerScreen';
import AppointmentsScreen from './src/screens/AppointmentsScreen';
import AddEditAppointmentScreen from './src/screens/AddEditAppointmentScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function CustomersStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#2563EB' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="CustomersList" component={CustomersScreen} options={{ title: 'Kunder' }} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Kundedetaljer' }} />
      <Stack.Screen name="AddEditCustomer" component={AddEditCustomerScreen} options={{ title: 'Ny kunde' }} />
      <Stack.Screen name="AddEditAppointment" component={AddEditAppointmentScreen} options={{ title: 'Ny aftale' }} />
    </Stack.Navigator>
  );
}

function AppointmentsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#2563EB' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="AppointmentsList" component={AppointmentsScreen} options={{ title: 'Aftaler' }} />
      <Stack.Screen name="AddEditAppointment" component={AddEditAppointmentScreen} options={{ title: 'Ny aftale' }} />
    </Stack.Navigator>
  );
}

function DashboardStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#2563EB' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="DashboardMain" component={DashboardScreen} options={{ title: 'KundeApp' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#2563EB',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: {
            borderTopColor: '#F3F4F6',
            paddingTop: 6,
            paddingBottom: 6,
            height: 60,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'Overblik') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Kunder') {
              iconName = focused ? 'people' : 'people-outline';
            } else if (route.name === 'Aftaler') {
              iconName = focused ? 'calendar' : 'calendar-outline';
            }
            return <Ionicons name={iconName} size={24} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Overblik" component={DashboardStack} />
        <Tab.Screen name="Kunder" component={CustomersStack} />
        <Tab.Screen name="Aftaler" component={AppointmentsStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
