/// <reference types="web-bluetooth" />
import type { HeartRateDevice, HeartRateSample, DeviceMode } from './types'

export class BleHeartRateDevice implements HeartRateDevice {
    mode: DeviceMode = 'ble-real'
    isConnected: boolean = false
    name: string = 'Bluetooth Device'

    private device: BluetoothDevice | null = null
    private server: BluetoothRemoteGATTServer | null = null
    private characteristic: BluetoothRemoteGATTCharacteristic | null = null
    private listeners: ((sample: HeartRateSample) => void)[] = []

    async connect(): Promise<void> {
        if (!navigator.bluetooth) {
            throw new Error('Web Bluetooth is not supported in this browser.')
        }

        try {
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['heart_rate'] }]
            })

            if (!this.device || !this.device.gatt) {
                throw new Error('No device selected.')
            }

            this.device.addEventListener('gattserverdisconnected', this.handleDisconnect)
            this.name = this.device.name || 'Unknown Device'

            this.server = await this.device.gatt.connect()
            const service = await this.server.getPrimaryService('heart_rate')
            this.characteristic = await service.getCharacteristic('heart_rate_measurement')

            await this.characteristic.startNotifications()
            this.characteristic.addEventListener('characteristicvaluechanged', this.handleCharacteristicValueChanged)

            this.isConnected = true
        } catch (error) {
            console.error('Connection failed', error)
            this.cleanup()
            throw error
        }
    }

    async disconnect(): Promise<void> {
        this.cleanup()
    }

    onSample(callback: (sample: HeartRateSample) => void): void {
        this.listeners.push(callback)
    }

    offSample(callback: (sample: HeartRateSample) => void): void {
        this.listeners = this.listeners.filter(l => l !== callback)
    }

    private handleDisconnect = () => {
        console.log('Device disconnected')
        this.cleanup()
    }

    private cleanup() {
        if (this.characteristic) {
            try {
                this.characteristic.removeEventListener('characteristicvaluechanged', this.handleCharacteristicValueChanged)
                this.characteristic.stopNotifications().catch(() => { })
            } catch (e) { /* ignore */ }
            this.characteristic = null
        }

        if (this.device) {
            this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect)
            if (this.device.gatt?.connected) {
                this.device.gatt.disconnect()
            }
            this.device = null
        }

        this.server = null
        this.isConnected = false
    }

    private handleCharacteristicValueChanged = (event: Event) => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value
        if (!value) return

        this.parseHeartRate(value)
    }

    private parseHeartRate(value: DataView) {
        // Flags
        const flags = value.getUint8(0)
        const rate16Bits = flags & 0x1
        const rrIntervalPresent = (flags >> 4) & 0x1

        let offset = 1
        let bpm = 0
        if (rate16Bits) {
            bpm = value.getUint16(offset, true) // Little Endian
            offset += 2
        } else {
            bpm = value.getUint8(offset)
            offset += 1
        }

        // Skip Energy Expended if present
        // ... not implemented for simplicity, assuming standard monitors

        const sample: HeartRateSample = {
            timestamp: Date.now(),
            bpm
        }

        if (rrIntervalPresent) {
            // RR intervals are uint16 in units of 1/1024 seconds
            // There can be multiple RR intervals in one packet
            // We will just take the last one or average them for the sample
            // For HRV detailed calculation, ideally we emit all of them.
            // But the interface is per-sample. Let's emit one if available.
            // Note: DataView might have more bytes.
            if (value.byteLength >= offset + 2) {
                const rrRaw = value.getUint16(offset, true)
                // Convert to ms: rrRaw / 1024 * 1000
                sample.rrMs = (rrRaw / 1024) * 1000
            }
        }

        this.notifyListeners(sample)
    }

    private notifyListeners(sample: HeartRateSample) {
        this.listeners.forEach(l => l(sample))
    }
}
