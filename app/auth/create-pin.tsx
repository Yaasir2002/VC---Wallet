import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { savePin } from '../../src/Storage/authStorage';

export default function CreatePinScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');

  async function handleSave() {
    if (pin.length < 4) return;

    await savePin(pin);
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buat PIN</Text>

      <TextInput
        style={styles.input}
        keyboardType="numeric"
        secureTextEntry
        maxLength={6}
        value={pin}
        onChangeText={setPin}
      />

      <Pressable style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Simpan PIN</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '800' },
});