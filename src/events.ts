/**
 * The `data-quality/*` session-event vocabulary and its adaptive append gate.
 * The vocabulary is declared on `SessionEventMap` for type-checked payloads;
 * the runtime gate decides per host whether appending is safe:
 *
 * - Hosts whose known-type set already covers the vocabulary (a future harness
 *   that adopts these events) append plainly.
 * - Hosts with an `ignorable` append option (the master-build
 *   `Session.append(type, data, { ignorable: true })` contract) append with the
 *   marker, so builds that do not know the type skip the event on restore.
 * - 0.1.0-rc.6 and 0.1.0-rc.8 hosts have neither a registration surface nor an
 *   `ignorable` append option (rc.8's `Session.append` accepts surface metadata
 *   only, never the marker); appending an unknown type there would make the
 *   persistence coordinator refuse the session log on restore, so the append is
 *   skipped and the storage-domain report remains the durable copy.
 * @module dsh-data-quality/events
 */

import { KNOWN_SESSION_EVENT_TYPES, type Session } from '@deepseek-ai/dsh-session'

/** Payload shared by every `data-quality/*` session event. */
export interface DataQualityEventData {
  /** Which run produced the event. */
  readonly kind: 'profile' | 'clean' | 'verify'
  /** Workspace-relative dataset path as the caller gave it. */
  readonly dataset: string
  /** Storage-domain key of the full persisted report, when persistence is on. */
  readonly reportKey?: string
  /** Compact run summary (small integers/booleans only). */
  readonly summary: {
    readonly rows: number
    readonly columns?: number
    readonly rules?: number
    readonly failedRules?: number
    readonly passed?: boolean
  }
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * A `data_profile` run completed.
     * @mode emit
     * @param data - run kind, dataset, optional report key, and compact summary.
     */
    'data-quality/profile': DataQualityEventData
    /**
     * A `data_clean` run completed.
     * @mode emit
     * @param data - run kind, dataset, optional report key, and compact summary.
     */
    'data-quality/clean': DataQualityEventData
    /**
     * A `data_verify` run completed.
     * @mode emit
     * @param data - run kind, dataset, optional report key, and compact summary.
     */
    'data-quality/verify': DataQualityEventData
  }
}

/** The event type vocabulary this plugin appends. */
export const DATA_QUALITY_EVENT_TYPES = ['data-quality/profile', 'data-quality/clean', 'data-quality/verify'] as const

/** Union of the event types this plugin appends. */
export type DataQualityEventType = (typeof DATA_QUALITY_EVENT_TYPES)[number]

/** Loose append shape probed at runtime (rc.6/rc.8 take no options; master takes `ignorable`). */
type AppendProbe = (type: string, data: unknown, options?: { ignorable: true }) => unknown

/**
 * Append one `data-quality/*` event when the host can carry it safely; skip
 * silently otherwise (the storage-domain report is always the durable copy).
 * The `ignorable` probe reads the UNBOUND method's source (a `.bind()` result
 * reports `[native code]`): the rc.6 and rc.8 builds contain no `ignorable`
 * handling while the master build references the flag by name; property names
 * survive minification, so the probe fails safe (skips) rather than corrupting
 * a log.
 * @param session - the calling session.
 * @param type - the event type.
 * @param data - the payload.
 */
export function appendDataQualityEvent(session: Session, type: DataQualityEventType, data: DataQualityEventData): void {
  if (KNOWN_SESSION_EVENT_TYPES.has(type)) {
    session.append(type, data)
    return
  }
  const append = session.append as AppendProbe
  if (Function.prototype.toString.call(append).includes('ignorable')) {
    append.call(session, type, data, { ignorable: true })
  }
}
