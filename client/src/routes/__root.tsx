import { createRootRoute, Outlet } from '@tanstack/react-router'
import { ThemeToggle } from '../components/ThemeToggle'

export const Route = createRootRoute({
  component: () => (
    <>
      <ThemeToggle />
      <Outlet />
    </>
  ),
}) 