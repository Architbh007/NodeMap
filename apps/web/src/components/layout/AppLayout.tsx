import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { RepoSelector } from './RepoSelector';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-56">
        <RepoSelector />
        <main className="pt-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
