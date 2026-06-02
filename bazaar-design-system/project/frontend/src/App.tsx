import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import Hub from "./screens/Hub";
import LiveMatch from "./screens/LiveMatch";
import Ladder from "./screens/Ladder";
import Agents from "./screens/Agents";
import AgentProfile from "./screens/AgentProfile";
import Mint from "./screens/Mint";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Hub />} />
        <Route path="/live" element={<LiveMatch />} />
        <Route path="/live/:id" element={<LiveMatch />} />
        <Route path="/ladder" element={<Ladder />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/agents/:id" element={<AgentProfile />} />
        <Route path="/mint" element={<Mint />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
