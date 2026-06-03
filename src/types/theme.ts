export interface ThemeConfig {
  id: string; // 'default' or custom-id or premade-id
  name: string;
  isCustom: boolean;
  primaryColor: string; // e.g. '#D32F2F'
  secondaryColor: string; // e.g. '#000000'
  backgroundColor: string; // e.g. '#0A0A0A'
  cardColor: string; // e.g. '#161616'
  buttonColor: string; // e.g. '#D32F2F'
  linkColor: string; // e.g. '#FFFFFF'
  highlightColor: string; // e.g. '#D32F2F'
  
  // Dynamic calculated contrasing text colors (calculated on the fly or saved)
  primaryTextColor: 'light' | 'dark' | string;
  secondaryTextColor: 'light' | 'dark' | string;
  backgroundTextColor: 'light' | 'dark' | string;
  cardTextColor: 'light' | 'dark' | string;
  buttonTextColor: 'light' | 'dark' | string;
  linkTextColor: 'light' | 'dark' | string;
  highlightTextColor: 'light' | 'dark' | string;

  // Schedulable properties
  scheduled: boolean;
  startDate?: string | null; // ISO Date "yyyy-MM-dd" or "yyyy-MM-ddTHH:mm"
  endDate?: string | null;   // ISO Date "yyyy-MM-dd" or "yyyy-MM-ddTHH:mm"
}

export interface ThemeLog {
  id: string;
  userId: string;
  userName: string;
  timestamp: string; // ISO date-time string
  actionType: 'create' | 'update' | 'delete' | 'activate' | 'deactivate' | 'schedule';
  details: string; // text detail e.g., "Ativou tema Black Friday"
}
