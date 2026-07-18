import { Stack } from 'expo-router';

export default function GameLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="game" options={{ animation: 'none' }} />
      <Stack.Screen name="gameover" options={{ animation: 'fade' }} />
    </Stack>
  );
}
