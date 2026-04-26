import { create } from 'zustand'
import { Cluster } from '../api/client'

interface AppState {
  clusters: Cluster[]
  selectedCluster: string
  setClusters: (c: Cluster[]) => void
  setSelectedCluster: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  clusters: [],
  selectedCluster: '',
  setClusters: (clusters) => set({ clusters }),
  setSelectedCluster: (id) => set({ selectedCluster: id }),
}))
