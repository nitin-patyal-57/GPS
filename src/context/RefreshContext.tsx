import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface RefreshContextType {
  refreshCount: number
  triggerRefresh: () => void
}

const RefreshContext = createContext<RefreshContextType>({
  refreshCount: 0,
  triggerRefresh: () => {},
})

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [refreshCount, setRefreshCount] = useState(0)

  const triggerRefresh = useCallback(() => {
    setRefreshCount((c) => c + 1)
  }, [])

  return (
    <RefreshContext.Provider value={{ refreshCount, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  )
}

export function useRefresh() {
  return useContext(RefreshContext)
}
