/**
 * BluetoothDrumDevice - Manages Web Bluetooth connection to ESP32 C3 Drum Device
 * 
 * Device Info:
 * - Device Name: DrumBeat-C3
 * - Service UUID: 6e400001-b5a3-f393-e0a9-e50e24dcca9e
 * - RX Characteristic (Write): 6e400002-b5a3-f393-e0a9-e50e24dcca9e
 * - TX Characteristic (Notify): 6e400003-b5a3-f393-e0a9-e50e24dcca9e
 * 
 * Command Protocol:
 * - BPM:xxx - Set tempo (30-240)
 * - START - Start beat engine
 * - STOP - Stop beat engine
 * - TICK - Trigger single beat (for testing)
 */

export class BluetoothDrumDevice {
    private device: BluetoothDevice | null = null
    private server: BluetoothRemoteGATTServer | null = null
    private rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null
    private txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null

    private readonly SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
    private readonly RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
    private readonly TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'

    // Connection state callbacks
    private onDisconnectedCallback?: () => void

    /**
     * Check if Web Bluetooth is supported in current browser
     */
    static isSupported(): boolean {
        return typeof navigator !== 'undefined' && 'bluetooth' in navigator
    }

    /**
     * Connect to the DrumBeat-C3 device
     * Opens browser's device picker and establishes GATT connection
     */
    async connect(): Promise<void> {
        if (!BluetoothDrumDevice.isSupported()) {
            throw new Error('Web Bluetooth is not supported in this browser')
        }

        try {
            // Request device with service filter
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { name: 'DrumBeat-C3' },
                    { services: [this.SERVICE_UUID] }
                ],
                optionalServices: [this.SERVICE_UUID]
            })

            // Listen for disconnection
            this.device.addEventListener('gattserverdisconnected', this.handleDisconnection)

            // Connect to GATT server
            console.log('Connecting to GATT Server...')
            this.server = await this.device.gatt!.connect()

            // Get service
            console.log('Getting Service...')
            const service = await this.server.getPrimaryService(this.SERVICE_UUID)

            // Get characteristics
            console.log('Getting Characteristics...')
            this.rxCharacteristic = await service.getCharacteristic(this.RX_CHAR_UUID)

            // TX characteristic is optional (for notifications from device)
            try {
                this.txCharacteristic = await service.getCharacteristic(this.TX_CHAR_UUID)
                // Could enable notifications here if needed
                // await this.txCharacteristic.startNotifications()
                // this.txCharacteristic.addEventListener('characteristicvaluechanged', ...)
            } catch (e) {
                console.warn('TX characteristic not available, continuing without it')
            }

            console.log('✅ Connected to DrumBeat-C3')
        } catch (error) {
            // Clean up on error
            this.cleanup()
            throw new Error(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    /**
     * Disconnect from the device
     */
    async disconnect(): Promise<void> {
        if (this.server?.connected) {
            this.server.disconnect()
        }
        this.cleanup()
    }

    /**
     * Check if currently connected
     */
    isConnected(): boolean {
        return this.server?.connected ?? false
    }

    /**
     * Get connected device name
     */
    getDeviceName(): string | null {
        return this.device?.name ?? null
    }

    /**
     * Send BPM command to device
     * @param bpm - Beats per minute (30-240)
     */
    async sendBpm(bpm: number): Promise<void> {
        if (bpm < 30 || bpm > 240) {
            throw new Error('BPM must be between 30 and 240')
        }
        await this.sendCommand(`BPM:${Math.round(bpm)}`)
    }

    /**
     * Send START command - begins beat engine on device
     */
    async sendStart(): Promise<void> {
        await this.sendCommand('START')
    }

    /**
     * Send STOP command - stops beat engine on device
     */
    async sendStop(): Promise<void> {
        await this.sendCommand('STOP')
    }

    /**
     * Send TICK command - trigger single beat (for testing)
     */
    async sendTick(): Promise<void> {
        await this.sendCommand('TICK')
    }

    /**
     * Set callback for disconnection events
     */
    onDisconnected(callback: () => void): void {
        this.onDisconnectedCallback = callback
    }

    /**
     * Send raw command string to device
     * Commands are sent as UTF-8 text with newline terminator
     */
    private async sendCommand(command: string): Promise<void> {
        if (!this.isConnected() || !this.rxCharacteristic) {
            throw new Error('Device not connected')
        }

        try {
            // ESP32 expects commands with newline
            const commandWithNewline = command + '\n'
            const encoder = new TextEncoder()
            const data = encoder.encode(commandWithNewline)

            await this.rxCharacteristic.writeValue(data)
            console.log(`📤 Sent: ${command}`)
        } catch (error) {
            console.error('Failed to send command:', error)
            throw new Error(`Command failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    /**
     * Handle GATT disconnection event
     */
    private handleDisconnection = (): void => {
        console.log('🔌 Device disconnected')
        this.cleanup()
        this.onDisconnectedCallback?.()
    }

    /**
     * Clean up resources
     */
    private cleanup(): void {
        if (this.txCharacteristic) {
            try {
                // Stop notifications if they were enabled
                // await this.txCharacteristic.stopNotifications()
            } catch (e) {
                // Ignore errors during cleanup
            }
        }

        this.rxCharacteristic = null
        this.txCharacteristic = null
        this.server = null

        if (this.device) {
            this.device.removeEventListener('gattserverdisconnected', this.handleDisconnection)
            this.device = null
        }
    }
}
