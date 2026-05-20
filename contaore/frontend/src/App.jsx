import { useState } from 'react'
import { scanTag } from './api'

export default function App() {

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function testScan() {

    try {

      setLoading(true)

      const data = await scanTag({
        tag_uid: '123456',
        reader_id: 'WEB_TEST',
        offline: false
      })

      setResult(data)

    } catch (err) {

      console.log(err)

      setResult({
        error: 'SERVER_ERROR'
      })

    } finally {

      setLoading(false)
    }
  }

  return (
    <div
      style={{
        padding: 40,
        fontFamily: 'Arial'
      }}
    >

      <h1>Controllo Badge</h1>

      <button
        onClick={testScan}
        disabled={loading}
        style={{
          padding: '12px 20px',
          fontSize: 18,
          cursor: 'pointer'
        }}
      >
        {loading ? 'Caricamento...' : 'TEST SCAN'}
      </button>

      <pre
        style={{
          marginTop: 20,
          background: '#eee',
          padding: 20
        }}
      >
        {JSON.stringify(result, null, 2)}
      </pre>

    </div>
  )
}