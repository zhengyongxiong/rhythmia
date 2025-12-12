import { createContext, useContext, useState, type ReactNode } from 'react'
import type { HeartRateDevice, DeviceMode } from './types'
import { BleHeartRateDevice } from './BleHeartRateDevice'
import { DemoHeartRateDevice } from './DemoHeartRateDevice'

interface DeviceContextType {
    device: HeartRateDevice | null
    isConnected: boolean
    connect: (mode: DeviceMode) => Promise<void>
    disconnect: () => Promise<void>
    error: string | null
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined)

export function DeviceProvider({ children }: { children: ReactNode }) {
    const [device, setDevice] = useState<HeartRateDevice | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const connect = async (mode: DeviceMode) => {
        setError(null)
        let newDevice: HeartRateDevice

        if (mode === 'ble-real') {
            newDevice = new BleHeartRateDevice()
        } else {
            newDevice = new DemoHeartRateDevice()
        }

        try {
            await newDevice.connect()
            setDevice(newDevice)
            setIsConnected(true)
        } catch (err: any) {
            setError(err.message || 'Failed to connect')
            setIsConnected(false)
            throw err
        }
    }

    const disconnect = async () => {
        if (device) {
            await device.disconnect()
            setDevice(null)
            setIsConnected(false)
        }
    }

    return (
        <DeviceContext.Provider value={{ device, isConnected, connect, disconnect, error }}>
            {children}
        </DeviceContext.Provider>
    )
}

export function useDevice() {
    const context = useContext(DeviceContext)
    if (context === undefined) {
        throw new Error('useDevice must be used within a DeviceProvider')
    }
    return context
}
