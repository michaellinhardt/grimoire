function App(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--accent)' }}>
        Grimoire
      </h1>
      <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
        A desktop client for Claude Code conversations
      </p>
      <div className="mt-8 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <p className="text-sm">Tailwind CSS v4 is working with dark-first color system</p>
      </div>
    </div>
  )
}

export default App
