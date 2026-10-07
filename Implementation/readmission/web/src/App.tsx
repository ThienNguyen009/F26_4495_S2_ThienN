import { useState } from 'react'

type Prediction = { probability: number; tier: string }

function App() {
  const [result, setResult] = useState<Prediction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handlePredict() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('http://localhost:8000/predict', { method: 'POST' })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      setResult(await res.json())
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>Readmission Risk</h1>
      <button onClick={handlePredict} disabled={loading}>
        {loading ? 'Predicting…' : 'Predict'}
      </button>

      {result && (
        <p>
          Probability: <strong>{result.probability}</strong> — Tier: <strong>{result.tier}</strong>
        </p>
      )}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </main>
  )
}

export default App

