import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        {/* Routes verranno aggiunte qui */}
      </Route>
    </Routes>
  )
}

export default App
