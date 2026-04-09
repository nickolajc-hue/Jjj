import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCustomers, saveCustomers } from '../storage/storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export default function AddEditCustomerScreen({ route, navigation }) {
  const { customerId } = route.params || {};
  const isEditing = !!customerId;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Rediger kunde' : 'Ny kunde' });
    if (isEditing) {
      getCustomers().then((all) => {
        const c = all.find((x) => x.id === customerId);
        if (c) {
          setName(c.name || '');
          setPhone(c.phone || '');
          setEmail(c.email || '');
          setCompany(c.company || '');
          setAddress(c.address || '');
          setNotes(c.notes || '');
        }
      });
    }
  }, [customerId]);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Mangler navn', 'Kundenavn er påkrævet.');
      return;
    }
    const all = await getCustomers();
    if (isEditing) {
      const updated = all.map((c) =>
        c.id === customerId ? { ...c, name, phone, email, company, address, notes } : c
      );
      await saveCustomers(updated);
    } else {
      const newCustomer = { id: uuidv4(), name, phone, email, company, address, notes, createdAt: new Date().toISOString() };
      await saveCustomers([...all, newCustomer]);
    }
    navigation.goBack();
  };

  const Field = ({ label, icon, value, onChangeText, keyboardType, autoCapitalize, multiline, placeholder }) => (
    <View style={styles.fieldWrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, multiline && styles.inputMultiline]}>
        <Ionicons name={icon} size={18} color="#9CA3AF" style={{ marginRight: 8, marginTop: multiline ? 2 : 0 }} />
        <TextInput
          style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || label}
          placeholderTextColor="#D1D5DB"
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize || 'words'}
          multiline={multiline}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <Field label="Navn *" icon="person-outline" value={name} onChangeText={setName} placeholder="Fulde navn" />
        <Field label="Telefon" icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" placeholder="+45 12 34 56 78" />
        <Field label="Email" icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="email@eksempel.dk" />
        <Field label="Virksomhed" icon="business-outline" value={company} onChangeText={setCompany} placeholder="Virksomhedsnavn" />
        <Field label="Adresse" icon="location-outline" value={address} onChangeText={setAddress} placeholder="Vejnavn, postnr, by" />
        <Field label="Noter" icon="document-text-outline" value={notes} onChangeText={setNotes} autoCapitalize="sentences" multiline placeholder="Tilføj noter om kunden..." />

        <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
          <Ionicons name="checkmark" size={22} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.saveBtnText}>{isEditing ? 'Gem ændringer' : 'Opret kunde'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  fieldWrapper: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  inputMultiline: { alignItems: 'flex-start', paddingVertical: 12 },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  saveBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 10,
    shadowColor: '#2563EB',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
