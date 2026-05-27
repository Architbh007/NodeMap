import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-[#F8F9FB] overflow-hidden">
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Main content column */}
      <div className="flex flex-col flex-1 min-w-0 pl-[200px]">
        {/* Fixed topbar */}
        <Topbar />

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto pt-[44px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
