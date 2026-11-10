import { messages } from "../lib/messages";

export function App() {
  return (
    <main className="page">
      <h1>{messages.appName}</h1>
      <p className="lead">{messages.tagline}</p>
      <p>{messages.underConstruction}</p>
    </main>
  );
}
