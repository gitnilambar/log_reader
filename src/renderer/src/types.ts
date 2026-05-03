export type LogRow = {
  id: string
  source: string
  lineNumber: number
  data: Record<string, unknown>
  raw?: string
  valid: boolean
}

export type LogStats = {
  totalLines: number
  invalidLines: number
}

export type LogChunkPayload = {
  processId: string
  rows: LogRow[]
  columns: string[]
  stats: LogStats
}

export type LogProgressPayload = {
  processId: string
  processedBytes: number
  totalBytes: number
  currentFile: string
  fileIndex: number
  fileCount: number
}

export type LogDonePayload = {
  processId: string
  stats: LogStats
  cancelled: boolean
}

export type LogErrorPayload = {
  processId: string
  message: string
}

export interface FileTab {
  id: string; // unique id for the tab
  processId: string | null; // associated process id
  name: string; // display name
  rows: LogRow[];
  columns: string[];
  stats: LogStats;
  processing: boolean;
  progress: LogProgressPayload | null;
  error: string | null;
  
  // Filters and state per file
  globalSearch: string;
  columnFilters: Record<string, string>;
  startDate: string;
  endDate: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  selectedIndex: number | null;
  useDynamicColumns: boolean;
}
