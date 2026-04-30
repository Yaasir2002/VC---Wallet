import 'react-native-get-random-values';
import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#6B7280',
        headerShown: true,
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerTitleAlign: 'center',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="did"
        options={{
          title: 'DID',
          headerTitleAlign: 'center',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="finger-print-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          headerTitleAlign: 'center',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="verifier"
        options={{
          title: 'Verifier',
          headerTitleAlign: 'center',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="setting"
        options={{
          title: 'Settings',
          headerTitleAlign: 'center',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}