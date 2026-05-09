import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

type AppToastProps = {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  onHide: () => void;
};

export default function AppToast({
  visible,
  message,
  type = 'info',
  onHide,
}: AppToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -16,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onHide();
      });
    }, 2400);

    return () => {
      clearTimeout(timer);
    };
  }, [visible, opacity, translateY, onHide]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.toast,
        styles[type],
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 52,
    left: 20,
    right: 20,
    zIndex: 999,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  success: {
    backgroundColor: '#16A34A',
  },
  error: {
    backgroundColor: '#DC2626',
  },
  info: {
    backgroundColor: '#2563EB',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
  },
});