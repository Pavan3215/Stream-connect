import { User, MeetingHistory } from '../types';

const KEYS = {
  USER: 'streamconnect_user',
  HISTORY: 'streamconnect_history',
};

export const StorageService = {
  getUser: (): User | null => {
    const data = localStorage.getItem(KEYS.USER);
    return data ? JSON.parse(data) : null;
  },

  saveUser: (user: User) => {
    localStorage.setItem(KEYS.USER, JSON.stringify(user));
  },

  getHistory: (): MeetingHistory[] => {
    const data = localStorage.getItem(KEYS.HISTORY);
    return data ? JSON.parse(data) : [];
  },

  addToHistory: (entry: MeetingHistory) => {
    const history = StorageService.getHistory();
    // Avoid duplicates
    const newHistory = [entry, ...history.filter(h => h.roomId !== entry.roomId)].slice(0, 10);
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(newHistory));
  },
  
  clearUser: () => {
    localStorage.removeItem(KEYS.USER);
  }
};