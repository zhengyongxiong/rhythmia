import { useState, useRef, useEffect } from 'react'
import { BeatPlayer } from './audioEngine'
import { BluetoothDrumDevice } from './BluetoothDrumDevice'
import type { BeatPattern, BluetoothConnectionState } from './types'

export function useBeatPlayer() {
    const playerRef = useRef<BeatPlayer | null>(null)
    const bluetoothRef = useRef<BluetoothDrumDevice | null>(null)

    const [isPlaying, setIsPlaying] = useState(false)
    const [bluetoothState, setBluetoothState] = useState<BluetoothConnectionState>('disconnected')
    const [bluetoothDeviceName, setBluetoothDeviceName] = useState<string | null>(null)

    useEffect(() => {
        playerRef.current = new BeatPlayer()
        bluetoothRef.current = new BluetoothDrumDevice()

        // Set up disconnection handler
        bluetoothRef.current.onDisconnected(() => {
            setBluetoothState('disconnected')
            setBluetoothDeviceName(null)
            // Remove device from player
            if (playerRef.current) {
                playerRef.current.setBluetoothDevice(null)
            }
        })

        return () => {
            if (playerRef.current) {
                playerRef.current.stop()
            }
            if (bluetoothRef.current?.isConnected()) {
                bluetoothRef.current.disconnect()
            }
        }
    }, [])

    const start = async (pattern: BeatPattern) => {
        if (playerRef.current) {
            try {
                await playerRef.current.start(pattern)
                setIsPlaying(true)
            } catch (e) {
                console.error('Failed to start beat player', e)
            }
        }
    }

    const stop = () => {
        if (playerRef.current) {
            playerRef.current.stop()
            setIsPlaying(false)
        }
    }

    const connectBluetooth = async () => {
        if (!BluetoothDrumDevice.isSupported()) {
            setBluetoothState('error')
            throw new Error('Web Bluetooth is not supported in this browser')
        }

        if (!bluetoothRef.current) {
            setBluetoothState('error')
            throw new Error('Bluetooth device not initialized')
        }

        try {
            setBluetoothState('connecting')
            await bluetoothRef.current.connect()
            setBluetoothState('connected')
            setBluetoothDeviceName(bluetoothRef.current.getDeviceName())

            // Attach to player
            if (playerRef.current) {
                playerRef.current.setBluetoothDevice(bluetoothRef.current)
            }
        } catch (error) {
            setBluetoothState('disconnected')
            setBluetoothDeviceName(null)
            throw error
        }
    }

    const disconnectBluetooth = async () => {
        if (bluetoothRef.current) {
            await bluetoothRef.current.disconnect()
            setBluetoothState('disconnected')
            setBluetoothDeviceName(null)

            // Remove from player
            if (playerRef.current) {
                playerRef.current.setBluetoothDevice(null)
            }
        }
    }

    return {
        isPlaying,
        start,
        stop,
        bluetoothState,
        bluetoothDeviceName,
        connectBluetooth,
        disconnectBluetooth,
        isBluetoothSupported: BluetoothDrumDevice.isSupported()
    }
}

