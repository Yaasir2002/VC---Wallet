import { ReactNode } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';

type Props = {
  children: ReactNode;
  delay?: number;
};

export default function AnimatedScreen({ children, delay = 0 }: Props) {
  return (
    <Animated.View entering={FadeInUp.duration(500).delay(delay)}>
      {children}
    </Animated.View>
  );
}