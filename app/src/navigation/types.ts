import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GameMode } from '../controller/backendApi';

export type RootStackParamList = {
  Login: undefined;
  ModeSelect: undefined;
  LevelSelect: { mode: GameMode };
  Game: { mode: GameMode; levelId: number };
  Leaderboard: { mode: GameMode };
  Settings: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
