import localforage from 'localforage'
import type { BeatPattern } from '../beat/types'

export interface SessionRecord {
    id: string
    startTime: number
    endTime: number
    avgBpm: number
    avgRmssd: number
    avgSdnn: number
    avgPnn50: number
    beatPatternUsed?: BeatPattern
    userMood?: 'relaxed' | 'neutral' | 'stressed'
    notes?: string
}

const store = localforage.createInstance({
    name: 'hrv-companion',
    storeName: 'sessions'
})

export async function saveSession(record: SessionRecord): Promise<void> {
    await store.setItem(record.id, record)
}

export async function listSessions(): Promise<SessionRecord[]> {
    const sessions: SessionRecord[] = []
    // localforage iterate is async
    await store.iterate<SessionRecord, void>((value: SessionRecord) => {
        sessions.push(value)
    })
    // Sort by date desc
    return sessions.sort((a, b) => b.startTime - a.startTime)
}

export async function getSession(id: string): Promise<SessionRecord | null> {
    return await store.getItem<SessionRecord>(id)
}

export async function deleteSession(id: string): Promise<void> {
    await store.removeItem(id)
}
