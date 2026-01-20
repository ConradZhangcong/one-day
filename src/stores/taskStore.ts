import { create } from 'zustand';
import type { Task, TaskStatus, TaskPriority } from '@/types/task';

interface TaskState {
  tasks: Task[];
  filteredTasks: Task[];
  filters: {
    status?: TaskStatus;
    priority?: TaskPriority;
    tags?: string[];
    dateRange?: { start: Date; end: Date };
  };
  sortBy: 'createdAt' | 'deadline' | 'priority' | 'title';
  sortOrder: 'asc' | 'desc';
  isLoading: boolean;
  error: string | null;
}

interface TaskActions {
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, task: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setFilters: (filters: Partial<TaskState['filters']>) => void;
  clearFilters: () => void;
  setSortBy: (sortBy: TaskState['sortBy']) => void;
  setSortOrder: (sortOrder: TaskState['sortOrder']) => void;
  applyFiltersAndSort: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

type TaskStore = TaskState & TaskActions;

const initialState: TaskState = {
  tasks: [],
  filteredTasks: [],
  filters: {},
  sortBy: 'createdAt',
  sortOrder: 'desc',
  isLoading: false,
  error: null,
};

export const useTaskStore = create<TaskStore>((set, get) => ({
  ...initialState,

  setTasks: (tasks) => {
    set({ tasks });
    get().applyFiltersAndSort();
  },

  addTask: (task) => {
    const tasks = [...get().tasks, task];
    set({ tasks });
    get().applyFiltersAndSort();
  },

  updateTask: (id, updates) => {
    const tasks = get().tasks.map((task) =>
      task.id === id ? { ...task, ...updates, updatedAt: new Date() } : task
    );
    set({ tasks });
    get().applyFiltersAndSort();
  },

  deleteTask: (id) => {
    const tasks = get().tasks.filter((task) => task.id !== id);
    set({ tasks });
    get().applyFiltersAndSort();
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
    get().applyFiltersAndSort();
  },

  clearFilters: () => {
    set({ filters: {} });
    get().applyFiltersAndSort();
  },

  setSortBy: (sortBy) => {
    set({ sortBy });
    get().applyFiltersAndSort();
  },

  setSortOrder: (sortOrder) => {
    set({ sortOrder });
    get().applyFiltersAndSort();
  },

  applyFiltersAndSort: () => {
    const { tasks, filters, sortBy, sortOrder } = get();
    let filtered = [...tasks];

    // 应用筛选
    if (filters.status) {
      filtered = filtered.filter((task) => task.status === filters.status);
    }
    if (filters.priority) {
      filtered = filtered.filter((task) => task.priority === filters.priority);
    }
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter((task) =>
        filters.tags!.some((tag) => task.tags.includes(tag))
      );
    }
    if (filters.dateRange) {
      filtered = filtered.filter((task) => {
        if (!task.startDate) return false;
        return (
          task.startDate >= filters.dateRange!.start &&
          task.startDate <= filters.dateRange!.end
        );
      });
    }

    // 应用排序
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'createdAt':
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
          break;
        case 'deadline':
          aValue = a.deadline?.getTime() || Infinity;
          bValue = b.deadline?.getTime() || Infinity;
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1, null: 0 };
          aValue = priorityOrder[a.priority || 'null'];
          bValue = priorityOrder[b.priority || 'null'];
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    set({ filteredTasks: filtered });
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

