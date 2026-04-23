import { create } from 'zustand'

interface NamespaceStore {
  selectedNamespace: string
  setNamespace: (ns: string) => void
}

export const useNamespaceStore = create<NamespaceStore>((set) => ({
  selectedNamespace: 'default',
  setNamespace: (ns) => set({ selectedNamespace: ns }),
}))
