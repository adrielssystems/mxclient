import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import ClientShell from './components/ClientShell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout({children}) {
  const location = useLocation();
  const isAccountRoute = location.pathname.startsWith('/account');

  return (
    <QueryClientProvider client={queryClient}>
      {isAccountRoute ? (
        children
      ) : (
        <ClientShell>
          {children}
        </ClientShell>
      )}
    </QueryClientProvider>
  );
}