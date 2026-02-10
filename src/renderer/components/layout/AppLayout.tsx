import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Toaster } from 'sonner'

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-win-teal p-2">
      {/* Main Window */}
      <div className="win-window flex flex-1 flex-col">
        {/* Title Bar */}
        <div className="win-titlebar select-none" style={{ WebkitAppRegion: 'drag' } as any}>
          <div className="flex items-center gap-1">
            <img
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect x='2' y='2' width='12' height='12' fill='%23c0c0c0' stroke='%23000080' stroke-width='1'/%3E%3Crect x='4' y='4' width='3' height='3' fill='%23000080'/%3E%3Crect x='9' y='4' width='3' height='3' fill='%23ff0000'/%3E%3Crect x='4' y='9' width='3' height='3' fill='%2300ff00'/%3E%3Crect x='9' y='9' width='3' height='3' fill='%23ffff00'/%3E%3C/svg%3E"
              alt=""
              className="w-4 h-4"
            />
            <span>CrabBlaster6900</span>
          </div>
          <div className="flex gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <button className="win-titlebar-btn">_</button>
            <button className="win-titlebar-btn">□</button>
            <button className="win-titlebar-btn">✕</button>
          </div>
        </div>

        {/* Menu Bar */}
        <div className="bg-win-bg border-b border-win-dark px-1 py-0.5 flex gap-3 text-[11px]">
          <span className="hover:bg-win-blue hover:text-white px-1 cursor-default"><u>F</u>ile</span>
          <span className="hover:bg-win-blue hover:text-white px-1 cursor-default"><u>V</u>iew</span>
          <span className="hover:bg-win-blue hover:text-white px-1 cursor-default"><u>T</u>ools</span>
          <span className="hover:bg-win-blue hover:text-white px-1 cursor-default"><u>H</u>elp</span>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-3 bg-win-bg">
            <Outlet />
          </main>
        </div>

        {/* Status Bar */}
        <div className="win-status-bar gap-1">
          <div className="shadow-win-in flex-1 px-1">Ready</div>
          <div className="shadow-win-in w-32 px-1 text-center">CrabBlaster6900</div>
        </div>
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#c0c0c0',
            border: '2px solid',
            borderColor: '#d4d0c8 #0a0a0a #0a0a0a #d4d0c8',
            color: '#000000',
            fontFamily: 'Tahoma, Geneva, sans-serif',
            fontSize: '11px',
            borderRadius: '0',
            boxShadow: 'inset -1px -1px #0a0a0a, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #d4d0c8'
          }
        }}
      />
    </div>
  )
}
