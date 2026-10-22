// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useAsyncData, LOAD_TIMEOUT_MS, LoadTimeoutError } from './useAsyncData'
import { afterAutoClose, SESSIONS_AUTO_CLOSED_EVENT } from '@/services/autoClose'

vi.mock('@/services/autoClose', () => ({
  SESSIONS_AUTO_CLOSED_EVENT: 'test:auto-closed',
  afterAutoClose: vi.fn(() => Promise.resolve([])),
}))

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  afterAutoClose.mockClear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useAsyncData', () => {
  it('goes loading -> success', async () => {
    const { result } = renderHook(() => useAsyncData(() => Promise.resolve(42)))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toBe(42)
  })

  it('goes loading -> error and recovers on reload', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('ok')
    const { result } = renderHook(() => useAsyncData(load))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error.message).toBe('offline')
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toBe('ok')
  })

  it('keeps previous data when a reload fails', async () => {
    const load = vi.fn().mockResolvedValueOnce('first').mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useAsyncData(load))
    await waitFor(() => expect(result.current.data).toBe('first'))
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.data).toBe('first')
  })

  it('drops a stale response when deps change mid-flight', async () => {
    const slow = deferred()
    const fast = deferred()
    const { result, rerender } = renderHook(({ id }) => useAsyncData(() => (id === 1 ? slow.promise : fast.promise), { key: id }), {
      initialProps: { id: 1 },
    })
    rerender({ id: 2 })
    await act(async () => fast.resolve('two'))
    await act(async () => slow.resolve('one'))
    expect(result.current.data).toBe('two')
  })

  it('waits for the auto-close check when asked', async () => {
    const load = vi.fn(() => Promise.resolve('x'))
    renderHook(() => useAsyncData(load, { waitForAutoClose: true }))
    await waitFor(() => expect(load).toHaveBeenCalled())
    expect(afterAutoClose).toHaveBeenCalled()
  })

  it('reloads when sessions are auto-closed, if asked', async () => {
    const load = vi.fn(() => Promise.resolve('x'))
    renderHook(() => useAsyncData(load, { reloadOnAutoClose: true }))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    act(() => {
      window.dispatchEvent(new CustomEvent(SESSIONS_AUTO_CLOSED_EVENT))
    })
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
  })

  it('patches data locally with setData', async () => {
    const { result } = renderHook(() => useAsyncData(() => Promise.resolve({ n: 1 })))
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.setData((d) => ({ n: d.n + 1 })))
    expect(result.current.data).toEqual({ n: 2 })
  })

  describe('read timeout', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    const advance = (ms) => act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })

    it('shows the error after 8s when the load never finishes', async () => {
      const { result } = renderHook(() => useAsyncData(() => new Promise(() => {})))
      await advance(LOAD_TIMEOUT_MS - 1)
      expect(result.current.status).toBe('loading')
      await advance(1)
      expect(result.current.status).toBe('error')
      expect(result.current.error).toBeInstanceOf(LoadTimeoutError)
    })

    it('counts the auto-close wait toward the timeout', async () => {
      afterAutoClose.mockImplementationOnce(() => new Promise(() => {}))
      const load = vi.fn(() => Promise.resolve('x'))
      const { result } = renderHook(() => useAsyncData(load, { waitForAutoClose: true }))
      await advance(LOAD_TIMEOUT_MS)
      expect(result.current.status).toBe('error')
      expect(load).not.toHaveBeenCalled()
    })

    it('replaces the error with data that arrives late', async () => {
      const late = deferred()
      const { result } = renderHook(() => useAsyncData(() => late.promise))
      await advance(LOAD_TIMEOUT_MS)
      expect(result.current.status).toBe('error')
      await act(async () => late.resolve('finally'))
      expect(result.current).toMatchObject({ status: 'success', data: 'finally' })
    })

    it('ignores late data once Try again has started a new load', async () => {
      const late = deferred()
      const load = vi.fn().mockReturnValueOnce(late.promise).mockReturnValueOnce(new Promise(() => {}))
      const { result } = renderHook(() => useAsyncData(load))
      await advance(LOAD_TIMEOUT_MS)
      act(() => result.current.reload())
      expect(result.current.status).toBe('loading')
      await act(async () => late.resolve('stale'))
      expect(result.current.status).toBe('loading')
    })

    it('does not fire after a fast load, and can be disabled', async () => {
      const { result } = renderHook(() => useAsyncData(() => Promise.resolve('fast')))
      await advance(LOAD_TIMEOUT_MS * 2)
      expect(result.current.status).toBe('success')
      const { result: unlimited } = renderHook(() => useAsyncData(() => new Promise(() => {}), { timeoutMs: null }))
      await advance(LOAD_TIMEOUT_MS * 4)
      expect(unlimited.current.status).toBe('loading')
    })
  })

  it('ignores a response that lands after unmount', async () => {
    const pending = deferred()
    const { result, unmount } = renderHook(() => useAsyncData(() => pending.promise))
    unmount()
    await act(async () => pending.resolve('late'))
    expect(result.current.status).toBe('loading')
  })
})
