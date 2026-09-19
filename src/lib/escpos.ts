export const ESCPOS_COMMANDS = {
  INIT: new Uint8Array([0x1b, 0x40]),
  LF: new Uint8Array([0x0a]),
  ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]),
  BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]),
  TEXT_DOUBLE_HEIGHT: new Uint8Array([0x1b, 0x21, 0x10]),
  TEXT_NORMAL: new Uint8Array([0x1b, 0x21, 0x00]),
  CUT_FULL: new Uint8Array([0x1d, 0x56, 0x00]),
  CUT_PARTIAL: new Uint8Array([0x1d, 0x56, 0x01]),
  OPEN_DRAWER: new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]),
};

let cachedPort: any = null;
let cachedBluetoothDevice: any = null;
let cachedBluetoothCharacteristic: any = null;

export function isInsideIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

export function getHardwareCapabilities() {
  const serialSupported = typeof navigator !== 'undefined' && 'serial' in navigator;
  const bluetoothSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const inIframe = isInsideIframe();

  return {
    serialSupported,
    bluetoothSupported,
    inIframe
  };
}

/**
 * Format a line with left text and right text padded to exactly maxCols characters (default 32 for 58mm).
 */
export function format58mmLine(left: string, right: string, maxCols: number = 32): string {
  const cleanLeft = left.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const cleanRight = right.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  const rightLen = cleanRight.length;
  const maxLeftLen = maxCols - rightLen - 1;
  
  const truncatedLeft = cleanLeft.length > maxLeftLen ? cleanLeft.substring(0, maxLeftLen) : cleanLeft;
  const spacesNeeded = Math.max(1, maxCols - truncatedLeft.length - rightLen);
  
  return `${truncatedLeft}${' '.repeat(spacesNeeded)}${cleanRight}`;
}

/**
 * Encode an array of lines into an ESC/POS byte sequence.
 */
export function encodeEscPosLines(
  textLines: string[], 
  openDrawer: boolean = false, 
  width: '58mm' | '80mm' = '58mm'
): Uint8Array {
  const cols = width === '58mm' ? 32 : 42;
  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();

  const append = (arr: Uint8Array) => chunks.push(arr);
  const appendText = (text: string) => {
    const clean = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    chunks.push(encoder.encode(clean));
  };

  append(ESCPOS_COMMANDS.INIT);

  for (const rawLine of textLines) {
    let line = rawLine;

    if (line === '---') {
      appendText('-'.repeat(cols));
      append(ESCPOS_COMMANDS.LF);
      continue;
    }
    if (line === '===') {
      appendText('='.repeat(cols));
      append(ESCPOS_COMMANDS.LF);
      continue;
    }

    let isBold = false;
    let isCenter = false;
    let isRight = false;

    if (line.startsWith('CENTER|')) {
      isCenter = true;
      line = line.substring(7);
    } else if (line.startsWith('RIGHT|')) {
      isRight = true;
      line = line.substring(6);
    }

    if (line.startsWith('BOLD|')) {
      isBold = true;
      line = line.substring(5);
    }

    if (isCenter) append(ESCPOS_COMMANDS.ALIGN_CENTER);
    if (isRight) append(ESCPOS_COMMANDS.ALIGN_RIGHT);
    if (isBold) append(ESCPOS_COMMANDS.BOLD_ON);

    appendText(line);
    append(ESCPOS_COMMANDS.LF);

    if (isBold) append(ESCPOS_COMMANDS.BOLD_OFF);
    if (isCenter || isRight) append(ESCPOS_COMMANDS.ALIGN_LEFT);
  }

  // Feed and cut
  append(ESCPOS_COMMANDS.LF);
  append(ESCPOS_COMMANDS.LF);
  append(ESCPOS_COMMANDS.LF);
  append(ESCPOS_COMMANDS.CUT_PARTIAL);

  if (openDrawer) {
    append(ESCPOS_COMMANDS.OPEN_DRAWER);
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Connect to USB/Serial Printer
 */
export async function connectPrinter() {
  if (cachedPort && cachedPort.readable) {
    return cachedPort;
  }
  
  if (isInsideIframe()) {
    throw new Error('Las APIs de hardware directo (USB/Serie) están restringidas dentro de marcos (iframe). Abre la aplicación en una pestaña nueva para vincular.');
  }

  if (!('serial' in navigator)) {
    throw new Error('Web Serial API no está soportada en este navegador. Utiliza Google Chrome o Microsoft Edge en tu PC o Mac.');
  }

  try {
    // @ts-ignore
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    cachedPort = port;
    return port;
  } catch (error: any) {
    if (
      error?.name === 'NotFoundError' || 
      error?.message?.includes('No port selected') || 
      error?.message?.includes('Failed to execute \'requestPort\' on \'Serial\'')
    ) {
      throw new Error('Selección de puerto cancelada.');
    }
    if (error?.name === 'SecurityError') {
      throw new Error('Permiso denegado por el navegador o bloqueado por el visor. Abre el sistema en una nueva pestaña del navegador.');
    }
    console.error('Error conectando impresora USB/Serie:', error);
    throw new Error(error?.message || 'No se pudo conectar con la impresora.');
  }
}

export async function checkPrinterConnection() {
  if (!('serial' in navigator)) return false;
  try {
    // @ts-ignore
    const ports = await navigator.serial.getPorts();
    if (ports.length > 0) {
      if (!cachedPort) {
        cachedPort = ports[0];
        try {
          await cachedPort.open({ baudRate: 9600 });
        } catch (e) {
          // Already opened
        }
      }
      return true;
    }
  } catch (e) {}
  return false;
}

export async function checkBluetoothConnection(): Promise<boolean> {
  if (cachedBluetoothDevice && cachedBluetoothDevice.gatt && cachedBluetoothDevice.gatt.connected) {
    return true;
  }
  return false;
}

export async function getConnectedDeviceName(): Promise<string | null> {
  if (cachedBluetoothDevice && cachedBluetoothDevice.gatt?.connected) {
    return cachedBluetoothDevice.name || 'Impresora Bluetooth 58mm';
  }
  if (cachedPort) {
    return 'Impresora USB/Serie 58mm';
  }
  return null;
}

/**
 * Connect to Bluetooth Thermal Printer (BLE ESC/POS)
 */
export async function connectBluetoothPrinter() {
  if (isInsideIframe()) {
    throw new Error('Las APIs de Bluetooth están restringidas dentro de marcos (iframe). Abre la aplicación en una pestaña nueva para buscar dispositivos.');
  }

  if (!('bluetooth' in navigator)) {
    throw new Error('Web Bluetooth no está disponible en este navegador o sistema operativo. Usa Google Chrome o Edge en Android, Mac o Windows.');
  }
  
  try {
    // @ts-ignore
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455'
      ]
    });
    
    cachedBluetoothDevice = device;
    
    if (device.gatt) {
      const server = await device.gatt.connect();
      cachedBluetoothCharacteristic = await findBluetoothWritableCharacteristic(server);
    }
    
    return device;
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err?.message?.includes('User cancelled')) {
      throw new Error('Búsqueda de dispositivo cancelada.');
    }
    if (err.name === 'SecurityError') {
      throw new Error('Permiso de Bluetooth denegado. Asegúrate de abrir la app en una pestaña directa.');
    }
    throw new Error(err.message || 'Error al conectar con la impresora Bluetooth.');
  }
}

async function findBluetoothWritableCharacteristic(server: any) {
  const serviceUUIDs = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455'
  ];

  for (const sUuid of serviceUUIDs) {
    try {
      const service = await server.getPrimaryService(sUuid);
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          return char;
        }
      }
    } catch (e) {
      // Try next service
    }
  }

  // Fallback: search all primary services
  try {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            return char;
          }
        }
      } catch (e) {}
    }
  } catch (e) {}

  return null;
}

/**
 * Print raw ESC/POS bytes over Bluetooth in safe chunk size (<= 100 bytes)
 */
export async function printReceiptOverBluetooth(textLines: string[], openDrawer: boolean = false, width: '58mm' | '80mm' = '58mm') {
  if (!cachedBluetoothDevice || !cachedBluetoothDevice.gatt) {
    throw new Error('No hay impresora Bluetooth conectada.');
  }

  let server = cachedBluetoothDevice.gatt;
  if (!server.connected) {
    server = await cachedBluetoothDevice.gatt.connect();
  }

  let characteristic = cachedBluetoothCharacteristic;
  if (!characteristic) {
    characteristic = await findBluetoothWritableCharacteristic(server);
    cachedBluetoothCharacteristic = characteristic;
  }

  if (!characteristic) {
    throw new Error('No se encontró canal de escritura ESC/POS en la impresora Bluetooth conectada.');
  }

  const bytes = encodeEscPosLines(textLines, openDrawer, width);
  const chunkSize = 100;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    await new Promise(r => setTimeout(r, 20));
  }
}

/**
 * Print raw ESC/POS bytes over Serial/USB
 */
export async function printReceiptOverSerial(textLines: string[], openDrawer: boolean = false, width: '58mm' | '80mm' = '58mm') {
  if (!await checkPrinterConnection()) {
    throw new Error('No hay impresora USB/Serie conectada.');
  }

  const bytes = encodeEscPosLines(textLines, openDrawer, width);
  const writer = cachedPort.writable.getWriter();
  try {
    await writer.write(bytes);
  } finally {
    writer.releaseLock();
  }
}

/**
 * Unified Thermal Receipt Dispatcher:
 * 1) Tries Bluetooth if device is connected
 * 2) Tries Serial/USB if connected
 * 3) If neither is connected or hardware fails, triggers system print dialog on formatted thermal area
 */
export async function printThermalReceipt(options: {
  lines: string[];
  openDrawer?: boolean;
  width?: '58mm' | '80mm';
  onSuccess?: (method: 'bluetooth' | 'serial' | 'system') => void;
  onError?: (err: any) => void;
}): Promise<'bluetooth' | 'serial' | 'system'> {
  const { lines, openDrawer = false, width = '58mm', onSuccess, onError } = options;

  // 1. Try Bluetooth
  if (cachedBluetoothDevice?.gatt?.connected) {
    try {
      await printReceiptOverBluetooth(lines, openDrawer, width);
      onSuccess?.('bluetooth');
      return 'bluetooth';
    } catch (btErr) {
      console.warn('Bluetooth thermal print failed, attempting serial/system fallback:', btErr);
    }
  }

  // 2. Try Serial / USB
  const isSerialConnected = await checkPrinterConnection();
  if (isSerialConnected) {
    try {
      await printReceiptOverSerial(lines, openDrawer, width);
      onSuccess?.('serial');
      return 'serial';
    } catch (serErr) {
      console.warn('Serial thermal print failed, falling back to system print:', serErr);
    }
  }

  // 3. Fallback to System Print dialog (with 58mm CSS styles)
  try {
    window.print();
    onSuccess?.('system');
    return 'system';
  } catch (sysErr) {
    console.error('System print failed:', sysErr);
    onError?.(sysErr);
    throw sysErr;
  }
}

export async function openCashDrawer() {
  if (cachedBluetoothDevice?.gatt?.connected) {
    await printReceiptOverBluetooth([], true);
    return;
  }

  if (await checkPrinterConnection()) {
    const writer = cachedPort.writable.getWriter();
    try {
      await writer.write(ESCPOS_COMMANDS.OPEN_DRAWER);
    } finally {
      writer.releaseLock();
    }
    return;
  }

  throw new Error('No hay impresora térmica conectada para abrir el cajón.');
}

export async function testWifiPrinterConnection(ipAddress: string, _port: number = 9100) {
  if (!ipAddress || !ipAddress.trim()) {
    throw new Error('Ingresa una dirección IP válida (ejemplo: 192.168.1.100).');
  }
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ipAddress.trim())) {
    throw new Error('Formato de IP no válido. Ejemplo esperado: 192.168.1.100');
  }
  return true;
}
